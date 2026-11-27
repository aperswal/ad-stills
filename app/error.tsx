'use client';
import { ErrorState } from '../components/states';
export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return <ErrorState error={new Error('This page could not load. Try again.')} retry={reset} />;
}
