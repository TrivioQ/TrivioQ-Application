'use client';

import { useState, useRef, useEffect } from 'react';
import { useTheme, Theme } from '../context/ThemeContext';
import { motion, AnimatePresence } from 'framer-motion';
import { Sun, Moon, Monitor } from 'lucide-react';
import { useTranslations } from 'next-intl';

export function ThemeSwitcher() {
  const t = useTranslations('theme');
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

  const themes: { value: Theme; label: string; icon: React.ReactNode }[] = [
    { value: 'light', label: t('light'), icon: <Sun className="w-4 h-4" /> },
    { value: 'dark', label: t('dark'), icon: <Moon className="w-4 h-4" /> },
    { value: 'system', label: t('system'), icon: <Monitor className="w-4 h-4" /> },
  ];

  const currentTheme = themes.find((item) => item.value === theme) || themes[2];

  return (
    <div className="relative" ref={dropdownRef}>
      <button onClick={() => setIsOpen(!isOpen)} className="flex items-center justify-center w-8 h-8 rounded-full bg-white/10 dark:bg-gray-800/50 hover:bg-white/20 dark:hover:bg-gray-700 transition-colors border border-white/20 dark:border-gray-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400" aria-label={t('toggle')}>
        <span className="text-sm">{currentTheme.icon}</span>
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div initial={{ opacity: 0, y: -8, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -8, scale: 0.96 }} transition={{ duration: 0.15, ease: 'easeOut' }} className="absolute right-0 mt-2 w-36 rounded-xl bg-white/90 dark:bg-gray-900/90 backdrop-blur-md border border-gray-200 dark:border-white/10 shadow-xl overflow-hidden z-50">
            <div className="py-1">
              {themes.map((t) => (
                <button
                  key={t.value}
                  onClick={() => {
                    setTheme(t.value);
                    setIsOpen(false);
                  }}
                  className={`w-full flex items-center gap-3 px-4 py-2 text-sm text-left transition-colors ${theme === t.value ? 'bg-brand-50 dark:bg-brand-900/20 text-brand-600 dark:text-brand-400' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/5'}`}
                >
                  <span>{t.icon}</span>
                  {t.label}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
