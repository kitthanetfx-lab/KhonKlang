'use client';

import { useAppPreferences } from './AppPreferences';

function themeLabel(theme: 'system' | 'light' | 'dark') {
  if (theme === 'light') return 'Light';
  if (theme === 'dark') return 'Dark';
  return 'System';
}

export function GlobalPreferenceDock() {
  const { locale, theme, resolvedTheme, toggleLocale, cycleTheme } = useAppPreferences();

  return (
    <div className="pref-dock" aria-label="Display preferences">
      <button
        type="button"
        className="pref-chip"
        onClick={toggleLocale}
        aria-label={locale === 'th' ? 'Switch to English' : 'สลับเป็นภาษาไทย'}
        title={locale === 'th' ? 'Switch to English' : 'สลับเป็นภาษาไทย'}
      >
        <span className="pref-chip-label">Lang</span>
        <span className="pref-chip-value">{locale.toUpperCase()}</span>
      </button>
      <button
        type="button"
        className="pref-chip"
        onClick={cycleTheme}
        aria-label={`Theme ${themeLabel(theme)}`}
        title={`Theme ${themeLabel(theme)}`}
      >
        <span className="pref-chip-label">Theme</span>
        <span className="pref-chip-value">{theme === 'system' ? `${themeLabel(theme)}:${resolvedTheme}` : themeLabel(theme)}</span>
      </button>
    </div>
  );
}

export default GlobalPreferenceDock;
