'use client';

import { createContext, useContext, useEffect, useMemo, useState } from 'react';

export type AppLocale = 'th' | 'en';
export type AppTheme = 'system' | 'light' | 'dark';
type ResolvedTheme = 'light' | 'dark';

type AppPreferencesValue = {
  locale: AppLocale;
  theme: AppTheme;
  resolvedTheme: ResolvedTheme;
  setLocale: (locale: AppLocale) => void;
  setTheme: (theme: AppTheme) => void;
  toggleLocale: () => void;
  cycleTheme: () => void;
};

const THEME_KEY = 'kk.app.theme';
const LOCALE_KEY = 'kk.app.locale';

const AppPreferencesContext = createContext<AppPreferencesValue | null>(null);

function resolveTheme(theme: AppTheme): ResolvedTheme {
  if (theme === 'light' || theme === 'dark') return theme;
  if (typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches) return 'dark';
  return 'light';
}

export function AppPreferencesProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<AppLocale>('th');
  const [theme, setThemeState] = useState<AppTheme>('system');
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>('light');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const storedLocale = localStorage.getItem(LOCALE_KEY);
      if (storedLocale === 'th' || storedLocale === 'en') {
        setLocaleState(storedLocale);
      } else {
        const browserLang = navigator.language.toLowerCase();
        setLocaleState(browserLang.startsWith('th') ? 'th' : 'en');
      }
      const storedTheme = localStorage.getItem(THEME_KEY);
      if (storedTheme === 'light' || storedTheme === 'dark' || storedTheme === 'system') {
        setThemeState(storedTheme);
        setResolvedTheme(resolveTheme(storedTheme));
      } else {
        setResolvedTheme(resolveTheme('system'));
      }
    } catch {
      setResolvedTheme(resolveTheme('system'));
    }
    setMounted(true);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const sync = () => setResolvedTheme(resolveTheme(theme));
    sync();
    if (typeof media.addEventListener === 'function') {
      media.addEventListener('change', sync);
      return () => media.removeEventListener('change', sync);
    }
    media.addListener(sync);
    return () => media.removeListener(sync);
  }, [theme]);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const html = document.documentElement;
    html.lang = locale;
    html.dataset.theme = resolvedTheme;
    html.classList.toggle('dark', resolvedTheme === 'dark');
  }, [locale, resolvedTheme]);

  const setLocale = (nextLocale: AppLocale) => {
    setLocaleState(nextLocale);
    try { localStorage.setItem(LOCALE_KEY, nextLocale); } catch {}
  };

  const setTheme = (nextTheme: AppTheme) => {
    setThemeState(nextTheme);
    try { localStorage.setItem(THEME_KEY, nextTheme); } catch {}
  };

  const value = useMemo<AppPreferencesValue>(() => ({
    locale,
    theme,
    resolvedTheme,
    setLocale,
    setTheme,
    toggleLocale: () => setLocale(locale === 'th' ? 'en' : 'th'),
    cycleTheme: () => setTheme(theme === 'system' ? 'light' : theme === 'light' ? 'dark' : 'system'),
  }), [locale, theme, resolvedTheme]);

  return (
    <AppPreferencesContext.Provider value={value}>
      <div suppressHydrationWarning>{mounted ? children : children}</div>
    </AppPreferencesContext.Provider>
  );
}

export function useAppPreferences() {
  const ctx = useContext(AppPreferencesContext);
  if (!ctx) throw new Error('useAppPreferences must be used within AppPreferencesProvider');
  return ctx;
}

export function useT<T extends string>(messages: Record<AppLocale, T>) {
  const { locale } = useAppPreferences();
  return messages[locale];
}
