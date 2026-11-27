'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Images, Plus } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { ErrorState, LoadingState } from '../../components/states';
import { api } from '../../shared/client';
import { batchListSchema } from '../../shared/contracts';
export function HomeScreen() {
  const [offset, setOffset] = useState(0);
  const query = useQuery({
    queryKey: ['batches', offset],
    queryFn: () => api(`/api/batches?offset=${String(offset)}`, batchListSchema),
  });
  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-2">
          <p className="text-sm font-medium text-muted-foreground">Your workspace</p>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">My batches</h1>
        </div>
        <Button asChild>
          <Link href="/new">
            <Plus />
            New batch
          </Link>
        </Button>
      </div>
      {query.isPending ? (
        <LoadingState />
      ) : query.isError ? (
        <ErrorState
          error={query.error}
          retry={() => {
            void query.refetch();
          }}
        />
      ) : query.data.items.length === 0 ? (
        <div className="flex min-h-80 flex-col items-center justify-center gap-5 rounded-2xl border border-dashed border-input bg-white px-6 py-16 text-center">
          <span className="rounded-2xl bg-secondary p-5 text-primary">
            <Images className="size-8" />
          </span>
          <p className="text-muted-foreground">Your first batch starts with an ad you like.</p>
          <Button asChild>
            <Link href="/new">
              <Plus />
              New batch
            </Link>
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {query.data.items.map((batch) => (
            <Link
              key={batch.id}
              href={`/b/${batch.id}`}
              className="group flex flex-wrap items-center gap-4 rounded-2xl border border-border bg-white px-5 py-6 transition-colors hover:border-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary sm:px-7"
            >
              <span className="flex size-12 items-center justify-center rounded-xl bg-secondary text-primary">
                <Images />
              </span>
              <div className="min-w-0 flex-1">
                <h2 className="break-words text-lg font-semibold">{batch.brandName}</h2>
                <time
                  dateTime={new Date(batch.createdAt).toISOString()}
                  className="mt-1 block text-sm text-muted-foreground"
                >
                  {new Date(batch.createdAt).toLocaleDateString(undefined, {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </time>
              </div>
              <Badge variant="secondary" className="px-3 py-1.5 text-sm">
                {batch.startedAt === null
                  ? 'Draft'
                  : `${String(batch.done)} of ${String(batch.total)} done`}
              </Badge>
            </Link>
          ))}
          <div className="flex gap-3">
            {offset > 0 && (
              <Button
                variant="outline"
                onClick={() => {
                  setOffset(Math.max(0, offset - 20));
                }}
              >
                Previous
              </Button>
            )}
            {query.data.nextOffset !== null && (
              <Button
                variant="outline"
                onClick={() => {
                  setOffset(query.data.nextOffset ?? 0);
                }}
              >
                Next
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
