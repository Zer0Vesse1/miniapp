import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';

export type Theme = 'light' | 'dark' | 'system';
export type FontSize = 'small' | 'medium' | 'large';

interface ThemeContextValue {
  theme: Theme;
  setTheme: (t: Theme) => void;
  resolved: 'light' | 'dark';
  fontSize: FontSize;
  setFontSize: (s: FontSize) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

const THEME_KEY = 'miniapp-theme';
const FONT_KEY = 'miniapp-font-size';

function getStoredTheme(): Theme {
  try {
    const v = localStorage.getItem(THEME_KEY);
    if (v === 'light' || v === 'dark' || v === 'system') return v;
  } catch { /* noop */ }
  return 'system';
}

function getStoredFontSize(): FontSize {
  try {
    const v = localStorage.getItem(FONT_KEY);
    if (v === 'small' || v === 'medium' || v === 'large') return v;
  } catch { /* noop */ }
  return 'medium';
}

function resolveTheme(theme: Theme): 'light' | 'dark' {
  if (theme === 'system') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return theme;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeRaw] = useState<Theme>(getStoredTheme);
  const [resolved, setResolved] = useState<'light' | 'dark'>(() => resolveTheme(getStoredTheme()));
  const [fontSize, setFontSizeRaw] = useState<FontSize>(getStoredFontSize);

  const setTheme = useCallback((t: Theme) => {
    setThemeRaw(t);
    try { localStorage.setItem(THEME_KEY, t); } catch { /* noop */ }
  }, []);

  const setFontSize = useCallback((s: FontSize) => {
    setFontSizeRaw(s);
    try { localStorage.setItem(FONT_KEY, s); } catch { /* noop */ }
  }, []);

  useEffect(() => {
    setResolved(resolveTheme(theme));
    if (theme !== 'system') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    function onChange() { setResolved(resolveTheme('system')); }
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [theme]);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', resolved);
  }, [resolved]);

  useEffect(() => {
    document.documentElement.setAttribute('data-font-size', fontSize);
  }, [fontSize]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, resolved, fontSize, setFontSize }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
