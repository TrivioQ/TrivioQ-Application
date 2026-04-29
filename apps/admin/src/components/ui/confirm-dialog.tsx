'use client';

import { createContext, useContext, useRef, useState, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

type ConfirmOptions = {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  isDestructive?: boolean;
};

type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn | null>(null);

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
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
      <Dialog open={open} onOpenChange={(o) => !o && handleClose(false)}>
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>{options.title}</DialogTitle>
            <p className="text-sm text-muted-foreground">{options.message}</p>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => handleClose(false)}>
              {options.cancelLabel ?? 'Cancel'}
            </Button>
            <Button
              variant={options.isDestructive ? 'destructive' : 'default'}
              onClick={() => handleClose(true)}
            >
              {options.confirmLabel ?? 'Confirm'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ConfirmContext.Provider>
  );
}

export function useConfirm(): ConfirmFn {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error('useConfirm must be used within a ConfirmProvider');
  return ctx;
}
