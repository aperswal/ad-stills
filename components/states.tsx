'use client';
import { useQuery } from '@tanstack/react-query';
import { AlertCircle, Monitor, Terminal } from 'lucide-react';
import { Button } from './ui/button';
import { Skeleton } from './ui/skeleton';
import { Alert, AlertTitle } from './ui/alert';
import { api } from '../shared/client';
import { statusSchema } from '../shared/contracts';
export function ErrorState({ error, retry }: { error: Error; retry?: () => void }) {
  return (
    <Alert variant="destructive" role="alert">
      <AlertCircle />
      <AlertTitle className="flex flex-wrap items-center justify-between gap-3">
        {error.message}
        {retry && (
          <Button variant="outline" onClick={retry}>
            Try again
          </Button>
        )}
      </AlertTitle>
    </Alert>
  );
}
export function LoadingState({ label = 'Loading batches' }: { label?: string }) {
  return (
    <div role="status" className="space-y-5">
      <p className="text-sm text-muted-foreground">{label}…</p>
      <Skeleton className="h-32 w-full rounded-2xl" />
      <Skeleton className="h-32 w-full rounded-2xl" />
    </div>
  );
}
export function SetupState() {
  const query = useQuery({ queryKey: ['status'], queryFn: () => api('/api/status', statusSchema) });
  if (query.isPending)
    return (
      <p role="status" className="text-sm text-muted-foreground">
        Checking runner…
      </p>
    );
  if (query.isError)
    return (
      <ErrorState
        error={query.error}
        retry={() => {
          void query.refetch();
        }}
      />
    );
  if (query.data.connected && query.data.signedIn)
    return (
      <div className="flex items-center gap-2 text-sm text-emerald-800">
        <Monitor className="size-4" />
        Runner ready
      </div>
    );
  return (
    <div
      role="status"
      className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 text-amber-950"
    >
      <span className="flex items-center gap-2 text-sm font-medium">
        <Terminal className="size-4" />
        {query.data.connected ? 'Sign in to Codex' : 'Runner not connected'}
      </span>
      <div className="flex flex-wrap gap-2">
        {!query.data.connected && (
          <code className="rounded-md bg-white px-3 py-1.5 text-sm">{query.data.command}</code>
        )}
        {!query.data.signedIn && (
          <code className="rounded-md bg-white px-3 py-1.5 text-sm">codex login</code>
        )}
      </div>
    </div>
  );
}
