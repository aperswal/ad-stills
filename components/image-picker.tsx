'use client';
import { useEffect, useRef, useState } from 'react';
import { ImagePlus, X } from 'lucide-react';
import { Button } from './ui/button';
import { Label } from './ui/label';
import { ErrorState } from './states';

export interface PickedImage {
  id: string;
  file: File;
  url: string;
}
export function ImagePicker({
  id,
  label,
  files,
  onChange,
  disabled = false,
}: {
  id: string;
  label: string;
  files: PickedImage[];
  onChange: (files: PickedImage[]) => void;
  disabled?: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);
  const urls = useRef(new Set<string>());
  const [error, setError] = useState<Error | null>(null);
  useEffect(() => {
    const current = urls.current;
    return () => {
      for (const url of current) URL.revokeObjectURL(url);
    };
  }, []);
  function add(list: FileList | null) {
    if (!list || disabled) return;
    const added = Array.from(list);
    if (files.length + added.length > 10) {
      setError(new Error('Choose up to 10 images.'));
      return;
    }
    if (
      added.some(
        (file) =>
          !['image/png', 'image/jpeg', 'image/webp'].includes(file.type) ||
          file.size > 10 * 1024 * 1024,
      )
    ) {
      setError(new Error('Use PNG, JPEG or WebP, up to 10 MB each.'));
      return;
    }
    setError(null);
    onChange([
      ...files,
      ...added.map((file) => {
        const url = URL.createObjectURL(file);
        urls.current.add(url);
        return { id: crypto.randomUUID(), file, url };
      }),
    ]);
  }
  function remove(image: PickedImage) {
    URL.revokeObjectURL(image.url);
    urls.current.delete(image.url);
    onChange(files.filter((item) => item.id !== image.id));
  }
  return (
    <fieldset disabled={disabled} className="space-y-4">
      <legend className="mb-4 flex w-full items-center justify-between gap-3">
        <span className="font-semibold">{label}</span>
        <span className="text-sm text-muted-foreground" aria-live="polite">
          {files.length} of 10
        </span>
      </legend>
      <div
        className="relative rounded-xl border border-dashed border-input bg-background p-6 text-center transition-colors focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20"
        onDragOver={(event) => {
          event.preventDefault();
        }}
        onDrop={(event) => {
          event.preventDefault();
          add(event.dataTransfer.files);
        }}
      >
        <ImagePlus className="mx-auto mb-3 size-6 text-primary" />
        <Label htmlFor={id} className="justify-center text-sm">
          Drop images or choose files
        </Label>
        <p id={`${id}-hint`} className="mt-2 text-sm text-muted-foreground">
          PNG, JPEG, WebP · 10 MB each
        </p>
        <input
          ref={input}
          id={id}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          multiple
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0 disabled:cursor-not-allowed"
          aria-describedby={`${id}-hint`}
          onChange={(event) => {
            add(event.target.files);
            event.target.value = '';
          }}
        />
      </div>
      {error && <ErrorState error={error} />}
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
        {files.map((image, index) => (
          <div
            key={image.id}
            className="relative aspect-square overflow-hidden rounded-lg border border-border bg-muted"
          >
            <img
              src={image.url}
              alt={`${label} ${String(index + 1)}`}
              className="h-full w-full object-cover"
            />
            <Button
              type="button"
              size="icon"
              variant="secondary"
              aria-label={`Remove ${label.toLowerCase()} ${String(index + 1)}`}
              className="absolute right-1 top-1 size-8 bg-white shadow-sm"
              onClick={() => {
                remove(image);
              }}
            >
              <X className="size-4" />
            </Button>
          </div>
        ))}
      </div>
    </fieldset>
  );
}
