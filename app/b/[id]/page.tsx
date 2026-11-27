import { BatchScreen } from '../../../features/batches/batch';
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <BatchScreen id={id} />;
}
