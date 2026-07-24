'use client';

import { createContext, useContext, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslations } from 'next-intl';

type ConfirmOptions = {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  isDestructive?: boolean;
};

type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn | null>(null);

export function ConfirmProvider({ children }: { children: any }) {
  const commonT = useTranslations('common');
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState<ConfirmOptions>({ title: '', message: '' });
  const resolveRef = useRef<((value: boolean) => void) | null>(null);

  const confirm = useCallback((opts: ConfirmOptions): Promise<boolean> => {
    setOptions(opts);
    setOpen(true);
    return new Promise((resolve) => {
      resolveRef.current = resolve;
    });
  }, []);

  const handleClose = (confirmed: boolean) => {
    setOpen(false);
    resolveRef.current?.(confirmed);
    resolveRef.current = null;
  };

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <AnimatePresence>
        {open && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => handleClose(false)} className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100]" />
            <div className="fixed inset-0 flex items-center justify-center pointer-events-none z-[101] p-4">
              <motion.div initial={{ scale: 0.95, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0, y: 20 }} className="w-full max-w-md bg-gray-900 border border-white/10 rounded-3xl p-8 shadow-2xl pointer-events-auto overflow-hidden relative">
                <div className={`absolute top-0 left-0 w-full h-1 bg-gradient-to-r ${options.isDestructive ? 'from-red-500 to-brand-500' : 'from-brand-500 to-brand-500'}`} />
                <h3 className="text-2xl font-bold text-white mb-3">{options.title}</h3>
                <p className="text-gray-400 leading-relaxed mb-8">{options.message}</p>
                <div className="flex flex-col sm:flex-row gap-3 justify-end">
                  <button onClick={() => handleClose(false)} className="px-6 py-3 rounded-2xl text-sm font-bold text-gray-400 hover:text-white hover:bg-white/5 transition-all">
                    {options.cancelLabel ?? commonT('cancel')}
                  </button>
                  <button onClick={() => handleClose(true)} className={`px-8 py-3 rounded-2xl text-sm font-bold text-white shadow-lg transition-all ${options.isDestructive ? 'bg-red-500 hover:bg-red-600 shadow-red-500/20' : 'bg-brand-500 hover:bg-brand-600 shadow-brand-500/20'}`}>
                    {options.confirmLabel ?? commonT('confirm')}
                  </button>
                </div>
              </motion.div>
            </div>
          </>
        )}
      </AnimatePresence>
    </ConfirmContext.Provider>
  );
}

export function useConfirm(): ConfirmFn {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error('useConfirm must be used within a ConfirmProvider');
  return ctx;
}
