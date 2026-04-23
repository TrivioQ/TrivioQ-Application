'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import { FirebaseProvider } from '../context/FirebaseProvider';
import { NotificationProvider } from '../context/NotificationContext';
import { Toaster } from './Toaster';

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <NotificationProvider>
      <FirebaseProvider>
        <QueryClientProvider client={queryClient}>
          {children}
          <Toaster />
        </QueryClientProvider>
      </FirebaseProvider>
    </NotificationProvider>
  );
}
