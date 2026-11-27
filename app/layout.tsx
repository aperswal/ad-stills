import type { Metadata } from 'next';
import Link from 'next/link';
import { Layers2 } from 'lucide-react';
import { Providers } from '../components/providers';
import './globals.css';
export const metadata: Metadata = {
  title: 'Ad Stills',
  description: 'Remake photo ads for your product.',
  robots: { index: false, follow: false },
};
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-background font-sans text-foreground antialiased">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:bg-white focus:p-4"
        >
          Skip to content
        </a>
        <header className="border-b border-border bg-white">
          <nav
            aria-label="Main"
            className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-5 sm:px-8"
          >
            <Link
              href="/"
              className="flex items-center gap-2.5 rounded-md text-lg font-semibold tracking-tight focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary"
            >
              <span className="flex size-9 items-center justify-center rounded-xl bg-primary text-white">
                <Layers2 className="size-5" />
              </span>
              Ad Stills
            </Link>
            <Link
              href="/"
              className="rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted focus-visible:outline-2 focus-visible:outline-primary"
            >
              My batches
            </Link>
          </nav>
        </header>
        <Providers>
          <main id="main" className="mx-auto max-w-6xl px-5 py-9 sm:px-8 sm:py-12">
            {children}
          </main>
        </Providers>
      </body>
    </html>
  );
}
