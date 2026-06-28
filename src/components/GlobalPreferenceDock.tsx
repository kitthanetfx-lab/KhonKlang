'use client';

import { useState } from 'react';
import { useAppPreferences } from './AppPreferences';

function themeLabel(theme: 'light' | 'dark') {
  return theme === 'light' ? 'Light' : 'Dark';
}

export function GlobalPreferenceDock() {
  const { locale, theme, toggleLocale, cycleTheme } = useAppPreferences();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className={`pref-dock-wrap ${mobileOpen ? 'is-open' : ''}`}>
      <button
        type="button"
        className="pref-dock-toggle"
        onClick={() => setMobileOpen(prev => !prev)}
        aria-label={mobileOpen ? 'Hide display preferences' : 'Show display preferences'}
        aria-expanded={mobileOpen}
      >
        <span className="pref-dock-toggle-pill" />
        <span className="pref-dock-toggle-text">{mobileOpen ? 'Hide' : 'Prefs'}</span>
      </button>
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
          <span className="pref-chip-value">{themeLabel(theme)}</span>
        </button>
      </div>
    </div>
  );
}

export default GlobalPreferenceDock;
