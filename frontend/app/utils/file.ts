export function filenameFromKey(key?: string | null): string {
  if (!key) return ''
  const parts = key.split('/')
  return parts[parts.length - 1] || key
}
