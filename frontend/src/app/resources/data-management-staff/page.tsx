import type { Metadata } from 'next';
import ResourceCrud from '@/components/ResourceCrud';

export const metadata: Metadata = {
  title: 'Data Management Staff | Schedule Core Engine',
  description: 'Create, update and retire DIT and data management staff.',
};

export default function DataManagementStaffPage() {
  return <ResourceCrud type="DATA_MANAGEMENT_STAFF" />;
}
