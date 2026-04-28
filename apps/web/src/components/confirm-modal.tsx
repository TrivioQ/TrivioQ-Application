'use client';

import { motion, AnimatePresence } from 'framer-motion';

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  isDestructive?: boolean;
}

export function ConfirmModal({ isOpen, title, message, confirmLabel = 'Confirm', cancelLabel = 'Cancel', onConfirm, onCancel, isDestructive = false }: ConfirmModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onCancel} className='fixed inset-0 bg-black/60 backdrop-blur-sm z-[100]' />

          {/* Modal Container */}
          <div className='fixed inset-0 flex items-center justify-center pointer-events-none z-[101] p-4'>
            <motion.div initial={{ scale: 0.95, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0, y: 20 }} className='w-full max-w-md bg-gray-900 border border-white/10 rounded-3xl p-8 shadow-2xl pointer-events-auto overflow-hidden relative'>
              {/* Decorative Gradient Line */}
              <div className={`absolute top-0 left-0 w-full h-1 bg-gradient-to-r ${isDestructive ? 'from-red-500 to-orange-500' : 'from-indigo-500 to-purple-500'}`} />

              <h3 className='text-2xl font-bold text-white mb-3'>{title}</h3>
              <p className='text-gray-400 leading-relaxed mb-8'>{message}</p>

              <div className='flex flex-col sm:flex-row gap-3 justify-end'>
                <button onClick={onCancel} className='px-6 py-3 rounded-2xl text-sm font-bold text-gray-400 hover:text-white hover:bg-white/5 transition-all'>
                  {cancelLabel}
                </button>
                <button onClick={onConfirm} className={`px-8 py-3 rounded-2xl text-sm font-bold text-white shadow-lg transition-all ${isDestructive ? 'bg-red-500 hover:bg-red-400 shadow-red-500/20' : 'bg-indigo-500 hover:bg-indigo-400 shadow-indigo-500/20'}`}>
                  {confirmLabel}
                </button>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
