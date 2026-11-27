'use client';
import { useMutation } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { LockKeyhole } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { ErrorState } from '../../components/states';
import { api, post } from '../../shared/client';
import { useHydrated } from '../../shared/use-hydrated';
import { okSchema } from '../../shared/contracts';
export default function LoginPage() {
  const router = useRouter();
  const hydrated = useHydrated();
  const mutation = useMutation({
    mutationFn: (passcode: string) => api('/api/login', okSchema, post({ passcode })),
    onSuccess: () => {
      router.push('/');
    },
  });
  return (
    <form
      method="post"
      action="/api/login"
      className="mx-auto mt-8 max-w-sm space-y-6 rounded-2xl border border-border bg-white p-7"
      onSubmit={(event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        const passcode = form.get('passcode');
        if (typeof passcode === 'string') mutation.mutate(passcode);
      }}
    >
      <LockKeyhole className="size-7 text-primary" />
      <h1 className="text-2xl font-semibold">Open Ad Stills</h1>
      <div className="space-y-2">
        <Label htmlFor="passcode">App passcode</Label>
        <Input
          id="passcode"
          name="passcode"
          type="password"
          required
          maxLength={256}
          autoComplete="current-password"
        />
      </div>
      {mutation.isError && <ErrorState error={mutation.error} />}
      <Button disabled={!hydrated || mutation.isPending} className="w-full">
        {mutation.isPending ? 'Opening…' : 'Open'}
      </Button>
    </form>
  );
}
