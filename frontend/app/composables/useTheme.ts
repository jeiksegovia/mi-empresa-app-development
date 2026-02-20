export const useTheme = () => {
  const isDark = ref(false)

  const initTheme = () => {
    if (import.meta.client) {
      const stored = localStorage.getItem('theme')
      isDark.value = stored === 'dark'
      applyTheme(isDark.value)
    }
  }

  const applyTheme = (dark: boolean) => {
    if (import.meta.client) {
      const html = document.documentElement
      if (dark) {
        html.classList.add('dark')
      } else {
        html.classList.remove('dark')
      }
    }
  }

  const toggleTheme = () => {
    isDark.value = !isDark.value
    applyTheme(isDark.value)
    if (import.meta.client) {
      localStorage.setItem('theme', isDark.value ? 'dark' : 'light')
    }
  }

  onMounted(() => {
    initTheme()
  })

  return {
    isDark,
    toggleTheme,
    initTheme,
  }
}
