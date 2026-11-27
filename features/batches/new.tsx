'use client';
import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useMutation } from '@tanstack/react-query';
import { z } from 'zod';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Textarea } from '../../components/ui/textarea';
import { Label } from '../../components/ui/label';
import { ImagePicker, type PickedImage } from '../../components/image-picker';
import { SetupState, ErrorState } from '../../components/states';
import { useHydrated } from '../../shared/use-hydrated';
import { api, post } from '../../shared/client';
import { batchInputSchema, batchSchema, idSchema, okSchema } from '../../shared/contracts';

export function NewScreen() {
  const router = useRouter();
  const hydrated = useHydrated();
  const [originals, setOriginals] = useState<PickedImage[]>([]);
  const [products, setProducts] = useState<PickedImage[]>([]);
  const [progress, setProgress] = useState('');
  const [locked, setLocked] = useState(false);
  const saved = useRef<{ id: string; uploaded: Set<string> } | null>(null);
  const mutation = useMutation({
    mutationFn: async (form: HTMLFormElement) => {
      if (originals.length === 0 || products.length === 0)
        throw new Error('Add at least one ad and one product photo.');
      const fields = Object.fromEntries(new FormData(form));
      const colours = z
        .string()
        .parse(fields.colours ?? '')
        .split(/[\s,]+/)
        .filter(Boolean);
      const input = batchInputSchema.parse({ ...fields, colours });
      if (!saved.current) {
        setProgress('Creating batch…');
        const batch = await api('/api/batches', batchSchema, post(input));
        saved.current = { id: batch.id, uploaded: new Set() };
        setLocked(true);
      }
      const current = saved.current;
      for (const [kind, files] of [
        ['original', originals],
        ['product', products],
      ] as const) {
        for (const [position, image] of files.entries()) {
          const key = `${kind}:${String(position)}`;
          if (current.uploaded.has(key)) continue;
          setProgress(
            `Uploading ${String(current.uploaded.size + 1)} of ${String(originals.length + products.length)}…`,
          );
          await api(
            `/api/batches/${current.id}/files?kind=${kind}&position=${String(position)}`,
            z.strictObject({ id: idSchema }),
            { method: 'PUT', body: image.file },
          );
          current.uploaded.add(key);
        }
      }
      setProgress('Starting ads…');
      await api(`/api/batches/${current.id}/start`, okSchema, post({}));
      return current.id;
    },
    onSuccess: (id) => {
      router.push(`/b/${id}`);
    },
  });
  return (
    <div className="mx-auto max-w-4xl space-y-7">
      <div className="space-y-3">
        <Link
          href="/"
          className="text-sm font-medium text-muted-foreground underline-offset-4 hover:underline"
        >
          My batches
        </Link>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">New batch</h1>
      </div>
      <SetupState />
      <form
        method="post"
        className="space-y-7"
        onSubmit={(event) => {
          event.preventDefault();
          mutation.mutate(event.currentTarget);
        }}
      >
        <section
          aria-label="Images"
          className="grid gap-8 rounded-2xl border border-border bg-white p-5 sm:grid-cols-2 sm:p-7"
        >
          <ImagePicker
            id="originals"
            label="Ads that worked"
            files={originals}
            onChange={setOriginals}
            disabled={mutation.isPending || locked}
          />
          <ImagePicker
            id="products"
            label="Product photos"
            files={products}
            onChange={setProducts}
            disabled={mutation.isPending || locked}
          />
        </section>
        <section
          aria-labelledby="brand-heading"
          className="space-y-6 rounded-2xl border border-border bg-white p-5 sm:p-7"
        >
          <h2 id="brand-heading" className="text-xl font-semibold tracking-tight">
            Your brand
          </h2>
          <div className="space-y-2">
            <Label htmlFor="brandName">Brand name</Label>
            <Input
              id="brandName"
              name="brandName"
              required
              maxLength={80}
              placeholder="Your brand"
              readOnly={locked}
            />
          </div>
          {(
            [
              {
                name: 'problem',
                label: 'The problem your customer has',
                placeholder: 'What gets in their way?',
              },
              { name: 'audience', label: 'Who it is for', placeholder: 'Who needs your product?' },
              {
                name: 'solution',
                label: 'How your product solves it',
                placeholder: 'What does your product help them do?',
              },
            ] as const
          ).map((field) => (
            <div className="space-y-2" key={field.name}>
              <Label htmlFor={field.name}>{field.label}</Label>
              <Textarea
                id={field.name}
                name={field.name}
                placeholder={field.placeholder}
                required
                maxLength={2000}
                readOnly={locked}
              />
            </div>
          ))}
          <div className="space-y-2">
            <Label htmlFor="colours">
              Brand colours <span className="font-normal text-muted-foreground">(optional)</span>
            </Label>
            <Input
              id="colours"
              name="colours"
              placeholder="#145C49, #F2E4C8"
              maxLength={80}
              readOnly={locked}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="notes">
              Anything else <span className="font-normal text-muted-foreground">(optional)</span>
            </Label>
            <Textarea
              id="notes"
              name="notes"
              maxLength={4000}
              placeholder="Details to include or avoid"
              readOnly={locked}
            />
          </div>
        </section>
        {mutation.isError && <ErrorState error={mutation.error} />}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <p role="status" className="text-sm text-muted-foreground">
            {mutation.isPending
              ? progress
              : `${String(originals.length)} ${originals.length === 1 ? 'ad' : 'ads'} to make`}
          </p>
          <Button type="submit" disabled={!hydrated || mutation.isPending} className="min-w-40">
            {mutation.isPending ? 'Making your batch…' : locked ? 'Retry upload' : 'Make the ads'}
          </Button>
        </div>
      </form>
    </div>
  );
}
