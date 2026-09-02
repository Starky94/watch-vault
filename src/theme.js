import { defaultThemeKey, normalizeActiveTheme } from '../shared/themes.js'

export const themeStorageKey = 'watchvault.site-theme'

export function readCachedActiveTheme() {
  try {
    return normalizeActiveTheme(window.localStorage.getItem(themeStorageKey))
  } catch {
    return defaultThemeKey
  }
}

export function applyActiveTheme(themeKey) {
  const activeTheme = normalizeActiveTheme(themeKey)
  if (activeTheme === defaultThemeKey) {
    document.documentElement.removeAttribute('data-theme')
  } else {
    document.documentElement.dataset.theme = activeTheme
  }
  try {
    window.localStorage.setItem(themeStorageKey, activeTheme)
  } catch {
    // Theme application should still work when storage is unavailable.
  }
  return activeTheme
}
