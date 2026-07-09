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
      await fetch(uploadUrl, { method: 'PUT', body: file, headers: { 'Content-Type': file.type } })
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
