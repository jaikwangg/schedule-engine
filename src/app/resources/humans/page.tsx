import type { Metadata } from 'next';
import ResourceCrud from '@/components/ResourceCrud';

export const metadata: Metadata = {
  title: 'Staff | Schedule Core Engine',
  description: 'Create, update and retire schedulable people and their shift patterns.',
};

export default function HumansPage() {
  return <ResourceCrud type="HUMAN" />;
}
