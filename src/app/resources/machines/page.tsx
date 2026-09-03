import type { Metadata } from 'next';
import ResourceCrud from '@/components/ResourceCrud';

export const metadata: Metadata = {
  title: 'Machines | Schedule Core Engine',
  description: 'Create, update and retire schedulable production machines.',
};

export default function MachinesPage() {
  return <ResourceCrud type="MACHINE" />;
}
