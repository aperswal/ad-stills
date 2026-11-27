'use client';
import { useEffect, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { retry: 1, staleTime: 10000 }, mutations: { retry: false } },
      }),
  );
  useEffect(() => {
    const source = new EventSource('/api/events');
    source.addEventListener('refresh', () => {
      void client.invalidateQueries();
    });
    return () => {
      source.close();
    };
  }, [client]);
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
