'use client';

import { useRef, useEffect, useState } from 'react';
import { Sun, Moon, Monitor } from 'lucide-react';
import { useTheme, type Theme } from '@/context/theme-context';

const THEMES: { value: Theme; icon: React.ReactNode; label: string }[] = [
  { value: 'light', icon: <Sun className="w-4 h-4" />, label: 'Light' },
  { value: 'dark', icon: <Moon className="w-4 h-4" />, label: 'Dark' },
  { value: 'system', icon: <Monitor className="w-4 h-4" />, label: 'System' },
];

export function ThemeSwitcher() {
  const { theme, setTheme } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const current = THEMES.find((t) => t.value === theme) ?? THEMES[2];

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen((o) => !o)}
        aria-label="Toggle theme"
        aria-expanded={isOpen}
        className="flex items-center justify-center w-8 h-8 rounded-full bg-sidebar-accent hover:bg-sidebar-accent/80 border border-sidebar-border text-sidebar-foreground/70 hover:text-sidebar-foreground transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {current.icon}
      </button>

      {isOpen && (
        <div className="absolute right-0 bottom-full mb-2 w-36 rounded-xl bg-popover border border-border shadow-xl overflow-hidden z-50 animate-in fade-in-0 zoom-in-95 duration-100">
          <div className="py-1">
            {THEMES.map((t) => (
              <button
                key={t.value}
                onClick={() => {
                  setTheme(t.value);
                  setIsOpen(false);
                }}
                className={`w-full flex items-center gap-3 px-4 py-2 text-sm text-left transition-colors ${
                  theme === t.value
                    ? 'bg-brand-500/10 text-brand-interactive'
                    : 'text-foreground hover:bg-muted'
                }`}
              >
                <span>{t.icon}</span>
                {t.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
