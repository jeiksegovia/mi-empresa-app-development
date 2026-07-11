export function useFileUpload() {
  const { apiFetch } = useApi()
  const toast = useToast()
  const uploading = ref(false)

  async function uploadFile(file: File, folder: string): Promise<string | null> {
    uploading.value = true
    try {
      const res = await apiFetch<{ success: boolean; data: { uploadUrl: string; key: string } }>('/uploads/presigned-url', {
        method: 'POST',
        body: { contentType: file.type, folder },
      })
      const { uploadUrl, key } = res.data
      // W11 ADDENDUM (urgent, blocking deploy): `fetch` does NOT throw on
      // HTTP errors (4xx/5xx). The previous code returned the presigned
      // `key` even when the S3 PUT itself returned 403/500/etc., which is
      // the silent "saved without file" mechanism that drove S7. Check
      // `putRes.ok` explicitly so the outer `catch` toasts + returns
      // null, and the calling form never persists a bogus key.
      // (Mirrors the explicit ok-check that pacientes/[id]/index.vue:726
      // already does on its inline S3 PUT.)
      const putRes = await fetch(uploadUrl, {
        method: 'PUT',
        body: file,
        headers: { 'Content-Type': file.type },
      })
      if (!putRes.ok) {
        throw new Error(`Upload failed: ${putRes.status}`)
      }
      return key
    } catch (e: any) {
      toast.add({
        severity: 'error',
        summary: 'Error al subir archivo',
        detail: e?.data?.message || e?.message || 'No se pudo subir el archivo.',
        life: 5000,
      })
      return null
    } finally {
      uploading.value = false
    }
  }

  async function downloadFile(key: string): Promise<void> {
    try {
      const res = await apiFetch<{ success: boolean; data: { downloadUrl: string } }>(
        `/uploads/download-url?key=${encodeURIComponent(key)}`,
      )
      window.open(res.data.downloadUrl, '_blank')
    } catch {
      toast.add({
        severity: 'error',
        summary: 'Error',
        detail: 'No se pudo descargar el archivo.',
        life: 5000,
      })
    }
  }

  return { uploading, uploadFile, downloadFile }
}
