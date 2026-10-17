const STORAGE_KEY = 'guessit-theme';

export type Theme = 'light' | 'dark';

export function getStoredTheme(): Theme | null {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return v === 'dark' || v === 'light' ? v : null;
  } catch {
    return null;
  }
}

/** Theme to use on first paint: stored choice, otherwise dark. */
export function initialTheme(): Theme {
  return getStoredTheme() ?? 'dark';
}

export function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle('dark', theme === 'dark');
  document.documentElement.style.colorScheme = theme;
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // private mode etc. — theme just won't persist
  }
}
