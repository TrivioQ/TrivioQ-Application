'use client';

import { useRef, useEffect, useState } from 'react';
import { Sun, Moon, Monitor } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useTheme, type Theme } from '@/context/theme-context';

const THEMES: { value: Theme; icon: React.ReactNode; labelKey: 'light' | 'dark' | 'system' }[] = [
  { value: 'light', icon: <Sun className="w-4 h-4" />, labelKey: 'light' },
  { value: 'dark', icon: <Moon className="w-4 h-4" />, labelKey: 'dark' },
  { value: 'system', icon: <Monitor className="w-4 h-4" />, labelKey: 'system' },
];

export function ThemeSwitcher() {
  const { theme, setTheme } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const t = useTranslations('layout.themeSwitcher');

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const current = THEMES.find((th) => th.value === theme) ?? THEMES[2];

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen((o) => !o)}
        aria-label={t('toggleTheme')}
        aria-expanded={isOpen}
        className="flex items-center justify-center w-8 h-8 rounded-full bg-sidebar-accent hover:bg-sidebar-accent/80 border border-sidebar-border text-sidebar-foreground/70 hover:text-sidebar-foreground transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {current.icon}
      </button>

      {isOpen && (
        <div className="absolute right-0 bottom-full mb-2 w-36 rounded-xl bg-popover border border-border shadow-xl overflow-hidden z-50 animate-in fade-in-0 zoom-in-95 duration-100">
          <div className="py-1">
            {THEMES.map((th) => (
              <button
                key={th.value}
                onClick={() => {
                  setTheme(th.value);
                  setIsOpen(false);
                }}
                className={`w-full flex items-center gap-3 px-4 py-2 text-sm text-left transition-colors ${
                  theme === th.value
                    ? 'bg-brand-500/10 text-brand-interactive'
                    : 'text-foreground hover:bg-muted'
                }`}
              >
                <span>{th.icon}</span>
                {t(th.labelKey)}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
