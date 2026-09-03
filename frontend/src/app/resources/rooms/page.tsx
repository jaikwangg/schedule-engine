import type { Metadata } from 'next';
import ResourceCrud from '@/components/ResourceCrud';

export const metadata: Metadata = {
  title: 'Rooms | Schedule Core Engine',
  description: 'Create, update and retire bookable suites and rooms.',
};

export default function RoomsPage() {
  return <ResourceCrud type="ROOM" />;
}
