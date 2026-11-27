import Link from 'next/link';
import { Button } from '../components/ui/button';
export default function NotFound() {
  return (
    <div className="space-y-5 py-16 text-center">
      <h1 className="text-2xl font-semibold">Page not found</h1>
      <Button asChild>
        <Link href="/">My batches</Link>
      </Button>
    </div>
  );
}
