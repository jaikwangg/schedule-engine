import type { Metadata } from 'next';
import ResourceCrud from '@/components/ResourceCrud';

export const metadata: Metadata = {
  title: 'Rooms | Schedule Core Engine',
  description: 'Create, update and retire bookable rooms and spaces.',
};

export default function RoomsPage() {
  return <ResourceCrud type="ROOM" />;
}
