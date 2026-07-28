'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import { AuthProvider } from '../context/auth-provider';
import { Toaster } from 'sonner';
import { ConfirmProvider } from './confirm-modal';
import { ThemeProvider, Theme } from '../context/ThemeContext';
import { ThemeSync } from './theme-sync';

export function Providers({ children, initialTheme = 'system' }: { children: React.ReactNode; initialTheme?: Theme }) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <ThemeProvider initialTheme={initialTheme}>
      <AuthProvider>
        <QueryClientProvider client={queryClient}>
          <ConfirmProvider>
            <ThemeSync />
            {children}
            <Toaster richColors position="top-center" />
          </ConfirmProvider>
        </QueryClientProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
