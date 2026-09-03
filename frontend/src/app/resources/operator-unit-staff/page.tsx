import type { Metadata } from 'next';
import ResourceCrud from '@/components/ResourceCrud';

export const metadata: Metadata = {
  title: 'Operator Unit Staff | Schedule Core Engine',
  description: 'Create, update and retire online, conform and operating unit staff.',
};

export default function OperatorUnitStaffPage() {
  return <ResourceCrud type="OPERATOR_UNIT_STAFF" />;
}
