'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import { FirebaseProvider } from '../context/FirebaseProvider';

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <FirebaseProvider>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </FirebaseProvider>
  );
}
