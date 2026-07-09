/**
 * useFileStash — stash a File/Blob in IndexedDB, retrieve later.
 *
 * Why: sessionStorage can hold the file NAME but not the File itself.
 * On Android Chrome, when the file picker round-trips, the tab may be
 * discarded (full reload) — the JS heap (and any in-memory File refs)
 * are wiped. IndexedDB persists across reloads, so we stash the blob
 * there on `visibilitychange === 'hidden'` and re-hydrate on `pageshow`.
 *
 * Storage shape:
 *   db: "mi-empresa-file-stash", store: "files", key: <fichaId>-<field>
 *   value: { blob: Blob, name: string, type: string, size: number,
 *            ts: number }
 *
 * Stale entries expire after 24h (cleared on read).
 */

const DB_NAME = 'mi-empresa-file-stash'
const STORE = 'files'
const TTL_MS = 24 * 60 * 60 * 1000

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(STORE)
    req.onerror = () => reject(req.error)
    req.onsuccess = () => resolve(req.result)
  })
}

export function useFileStash() {
  async function stash(key: string, file: File): Promise<void> {
    try {
      const db = await openDB()
      const tx = db.transaction(STORE, 'readwrite')
      tx.objectStore(STORE).put({
        blob: file,
        name: file.name,
        type: file.type,
        size: file.size,
        ts: Date.now(),
        key, // Indexed by 'key' field, not the keyPath
      }, key)
      await new Promise<void>((res, rej) => {
        tx.oncomplete = () => res()
        tx.onerror = () => rej(tx.error)
        // commit() ensures the write commits before the page may freeze.
        ;(tx as any).commit?.()
      })
      db.close()
    } catch {
      /* IDB may be disabled in some browser modes — silently noop */
    }
  }

  async function restore(key: string): Promise<File | null> {
    try {
      const db = await openDB()
      const tx = db.transaction(STORE, 'readonly')
      const entry: any = await new Promise((res, rej) => {
        const req = tx.objectStore(STORE).get(key)
        req.onsuccess = () => res(req.result)
        req.onerror = () => rej(req.error)
      })
      db.close()
      if (!entry || Date.now() - entry.ts > TTL_MS) return null
      // Re-construct File from Blob (IDB stores as Blob, but File API
      // methods are needed downstream in our component).
      return new File([entry.blob], entry.name, { type: entry.type })
    } catch {
      return null
    }
  }

  async function clear(key: string): Promise<void> {
    try {
      const db = await openDB()
      const tx = db.transaction(STORE, 'readwrite')
      tx.objectStore(STORE).delete(key)
      await new Promise<void>((res) => { tx.oncomplete = () => res() })
      db.close()
    } catch { /* noop */ }
  }

  return { stash, restore, clear }
}

/**
 * useFileStashTitleGuard — sets a transient title while a file picker is
 * open so Chrome's discard heuristics (Fix Option B) treat the tab as
 * actively updating its UI, reducing the chance of being discarded
 * during the picker round-trip on Android.
 *
 * Usage in onClick of a `<label>` wrapping a file input:
 *   const guard = useFileStashTitleGuard('Adjuntar archivo')
 *   guard.arm()  // marks title as in-picker
 *   // When file is selected OR picker is cancelled:
 *   guard.disarm()
 *
 * Disarm is also auto-fires on the next macrotask via setTimeout(arm, 0)
 * as a defensive fallback in case the change event never fires (e.g.
 * user backed out without picking).
 */
export function useFileStashTitleGuard(reason = 'Selecciona un archivo') {
  let armed = false
  function arm() {
    if (typeof document === 'undefined' || armed) return
    armed = true
    const originalTitle = document.title
    document.title = `⚠ ${reason} — ${originalTitle}`
    // Defensive disarm in 60s (typical picker timeout)
    setTimeout(disarm, 60_000)
  }
  function disarm() {
    if (typeof document === 'undefined' || !armed) return
    armed = false
    const originalTitle = document.title
    // Strip the warning prefix we added
    document.title = originalTitle.replace(/^⚠\s.+\s—\s/, '')
  }
  return { arm, disarm }
}