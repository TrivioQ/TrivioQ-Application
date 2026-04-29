'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import { AuthProvider } from '../context/auth-provider';
import { NotificationProvider } from '../context/notification-context';
import { Toaster } from './toaster';
import { ConfirmProvider } from './confirm-modal';

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <NotificationProvider>
      <AuthProvider>
        <QueryClientProvider client={queryClient}>
          <ConfirmProvider>
            {children}
            <Toaster />
          </ConfirmProvider>
        </QueryClientProvider>
      </AuthProvider>
    </NotificationProvider>
  );
}
