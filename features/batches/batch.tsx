'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Copy, Download, Image as ImageIcon, RotateCcw } from 'lucide-react';
import { zipSync, strToU8 } from 'fflate';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { SetupState, ErrorState, LoadingState } from '../../components/states';
import { api, post } from '../../shared/client';
import { batchDetailSchema, fileUrl, okSchema, type Ad } from '../../shared/contracts';

export function BatchScreen({ id }: { id: string }) {
  const query = useQuery({
    queryKey: ['batch', id],
    queryFn: () => api(`/api/batches/${id}`, batchDetailSchema),
  });
  const download = useMutation({
    mutationFn: async () => {
      const files: Record<string, Uint8Array> = {};
      for (const ad of query.data?.ads ?? [])
        if (ad.state === 'done' && ad.resultKey) {
          const response = await fetch(fileUrl(ad.resultKey));
          if (!response.ok) throw new Error('One ad could not be downloaded. Try again.');
          files[`ad-${String(ad.position + 1)}.png`] = new Uint8Array(await response.arrayBuffer());
          files[`ad-${String(ad.position + 1)}-copy.json`] = strToU8(
            JSON.stringify(ad.copy, null, 2),
          );
        }
      const blob = new Blob([new Uint8Array(zipSync(files, { level: 0 }))], {
        type: 'application/zip',
      });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = 'ad-stills.zip';
      anchor.click();
      setTimeout(() => {
        URL.revokeObjectURL(url);
      }, 1000);
    },
  });
  if (query.isPending) return <LoadingState label="Loading batch" />;
  if (query.isError)
    return (
      <ErrorState
        error={query.error}
        retry={() => {
          void query.refetch();
        }}
      />
    );
  const { batch, ads } = query.data;
  const done = ads.filter((ad) => ad.state === 'done').length;
  return (
    <div className="space-y-7">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0 space-y-3">
          <Link
            href="/"
            className="text-sm font-medium text-muted-foreground underline-offset-4 hover:underline"
          >
            My batches
          </Link>
          <h1 className="break-words text-3xl font-semibold tracking-tight sm:text-4xl">
            {batch.brandName}
          </h1>
          <p className="text-sm text-muted-foreground" aria-live="polite">
            {batch.startedAt === null
              ? 'Draft'
              : `${String(done)} of ${String(ads.length)} ads done`}
          </p>
        </div>
        <Button
          variant="outline"
          disabled={done === 0 || download.isPending}
          onClick={() => {
            download.mutate();
          }}
        >
          <Download />
          {download.isPending ? 'Preparing ZIP…' : 'Download all'}
        </Button>
      </div>
      <SetupState />
      {download.isError && <ErrorState error={download.error} />}
      {batch.startedAt === null ? (
        <DraftState id={id} ready={ads.length > 0 && query.data.photos.length > 0} />
      ) : ads.length === 0 ? (
        <div className="rounded-2xl bg-white p-10 text-center">
          <p>No ads in this batch.</p>
          <Button asChild className="mt-5">
            <Link href="/new">New batch</Link>
          </Button>
        </div>
      ) : (
        ads.map((ad) => <AdRow key={`${ad.id}:${String(ad.attempt)}`} ad={ad} />)
      )}
    </div>
  );
}
function DraftState({ id, ready }: { id: string; ready: boolean }) {
  const client = useQueryClient();
  const start = useMutation({
    mutationFn: () => api(`/api/batches/${id}/start`, okSchema, post({})),
    onSuccess: () => client.invalidateQueries({ queryKey: ['batch', id] }),
  });
  return (
    <div className="space-y-5 rounded-2xl border border-border bg-white p-8 text-center">
      <p>{ready ? 'Your images are ready.' : 'This upload did not finish.'}</p>
      {ready ? (
        <Button
          onClick={() => {
            start.mutate();
          }}
          disabled={start.isPending}
        >
          Make the ads
        </Button>
      ) : (
        <Button asChild>
          <Link href="/new">New batch</Link>
        </Button>
      )}
      {start.isError && <ErrorState error={start.error} />}
    </div>
  );
}
function AdRow({ ad }: { ad: Ad }) {
  const [note, setNote] = useState('');
  const client = useQueryClient();
  const [copied, setCopied] = useState(false);
  const retry = useMutation({
    mutationFn: () => api(`/api/ads/${ad.id}/again`, okSchema, post({ note })),
    onSuccess: () => client.invalidateQueries({ queryKey: ['batch', ad.batchId] }),
  });
  const copy = useMutation({
    mutationFn: async () => {
      if (ad.copy)
        await navigator.clipboard.writeText(
          `${ad.copy.headline}\n\n${ad.copy.body}\n\n${ad.copy.cta}`,
        );
      setCopied(true);
    },
  });
  return (
    <article className="overflow-hidden rounded-2xl border border-border bg-white">
      <div className="flex items-center justify-between border-b border-border px-5 py-4 sm:px-7">
        <h2 className="font-semibold">Ad {ad.position + 1}</h2>
        <Badge variant={ad.state === 'done' ? 'default' : 'secondary'}>
          {{ queued: 'Waiting', running: 'Making ad', done: 'Done', failed: 'Failed' }[ad.state]}
        </Badge>
      </div>
      <div className="grid gap-6 p-5 sm:p-7 md:grid-cols-2">
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-muted-foreground">Original</h3>
          <div className="flex min-h-60 items-center justify-center overflow-hidden rounded-xl bg-muted">
            <img
              src={fileUrl(ad.originalKey)}
              alt={`Original ad ${String(ad.position + 1)}`}
              className="max-h-[38rem] w-full object-contain"
            />
          </div>
        </div>
        <div className="space-y-4">
          <h3 className="text-sm font-medium text-muted-foreground">Your ad</h3>
          {ad.state === 'done' && ad.resultKey && ad.copy ? (
            <>
              <img
                src={fileUrl(ad.resultKey)}
                alt={`${ad.copy.headline} — ${ad.copy.cta}`}
                className="max-h-[38rem] w-full rounded-xl bg-muted object-contain"
              />
              <div className="space-y-4 rounded-xl bg-background p-5">
                <div>
                  <p className="mb-1 text-sm text-muted-foreground">Headline</p>
                  <p className="break-words font-semibold">{ad.copy.headline}</p>
                </div>
                <div>
                  <p className="mb-1 text-sm text-muted-foreground">Body</p>
                  <p className="whitespace-pre-wrap break-words text-sm leading-6">
                    {ad.copy.body || '—'}
                  </p>
                </div>
                <div>
                  <p className="mb-1 text-sm text-muted-foreground">Call to action</p>
                  <p className="break-words text-sm font-medium">{ad.copy.cta}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      copy.mutate();
                    }}
                  >
                    <Copy />
                    {copied ? 'Copied' : 'Copy text'}
                  </Button>
                  <Button variant="outline" asChild>
                    <a href={`${fileUrl(ad.resultKey)}?download=1`} download>
                      <Download />
                      Download
                    </a>
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <div
              role="status"
              className="flex min-h-72 flex-col items-center justify-center gap-4 rounded-xl border border-dashed border-input bg-background p-6 text-center"
            >
              <ImageIcon className="size-8 text-muted-foreground" />
              <p className="font-medium">
                {ad.state === 'failed'
                  ? 'Could not make this ad'
                  : ad.state === 'running'
                    ? 'Making your ad…'
                    : 'Waiting for a runner'}
              </p>
              {ad.failureReason && (
                <p className="max-w-sm break-words text-sm text-destructive">{ad.failureReason}</p>
              )}
            </div>
          )}
          {(ad.state === 'done' || ad.state === 'failed') && (
            <div className="space-y-3">
              <Label htmlFor={`note-${ad.id}`}>
                Change for next try{' '}
                <span className="font-normal text-muted-foreground">(optional)</span>
              </Label>
              <Input
                id={`note-${ad.id}`}
                maxLength={2000}
                value={note}
                onChange={(event) => {
                  setNote(event.target.value);
                }}
                placeholder="Make the headline larger"
              />
              <Button
                variant="secondary"
                onClick={() => {
                  retry.mutate();
                }}
                disabled={retry.isPending}
              >
                <RotateCcw />
                {retry.isPending ? 'Queuing…' : ad.state === 'failed' ? 'Try again' : 'Make again'}
              </Button>
            </div>
          )}
          {retry.isError && <ErrorState error={retry.error} />}{' '}
          {copy.isError && <ErrorState error={copy.error} />}
        </div>
      </div>
    </article>
  );
}
