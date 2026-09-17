export function useFileUpload() {
  const { apiFetch } = useApi()
  const toast = useToast()
  const uploading = ref(false)

  async function uploadFile(file: File, folder: string): Promise<string | null> {
    uploading.value = true
    try {
      // S4 (sfx-W2): the server now returns a presigned POST (url + fields)
      // so S3 can enforce the ContentLengthRange policy. The browser must
      // submit the leading form fields from `fields` plus the file under
      // `file` (the field name the presigned POST policy expects by
      // convention). The legacy PUT path no longer works because S3 would
      // 403 it (presigned POST URLs only accept POST submissions).
      const res = await apiFetch<{
        success: boolean
        data: {
          uploadUrl: string
          url: string
          fields: Record<string, string>
          key: string
        }
      }>('/uploads/presigned-url', {
        method: 'POST',
        body: { contentType: file.type, folder },
      })
      const { uploadUrl, fields, key } = res.data
      if (!fields) {
        throw new Error('El servidor no devolvió los campos de la política de subida.')
      }
      const form = new FormData()
      // The leading policy fields must be appended first; S3 verifies the
      // policy document against the form fields in order.
      for (const [fieldName, value] of Object.entries(fields)) {
        form.append(fieldName, value)
      }
      // The file must come last, under the conventional `file` field name.
      // S3's POST policy does not constrain this name unless the policy
      // itself adds an `eq $file ...` condition (we don't), so any name
      // works; `file` is the de-facto standard.
      form.append('file', file)
      // W11 ADDENDUM: `fetch` does NOT throw on HTTP errors (4xx/5xx).
      // Check `postRes.ok` explicitly so the outer `catch` toasts and the
      // calling form never persists a bogus key.
      const postRes = await fetch(uploadUrl, {
        method: 'POST',
        body: form,
      })
      if (!postRes.ok) {
        throw new Error(`Upload failed: ${postRes.status}`)
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
