import type { Metadata } from 'next';
import ResourceCrud from '@/components/ResourceCrud';

export const metadata: Metadata = {
  title: 'Producers | Schedule Core Engine',
  description: 'Create, update and retire producers and their availability.',
};

export default function ProducersPage() {
  return <ResourceCrud type="PRODUCER" />;
}
