import type { Metadata } from 'next';
import ResourceCrud from '@/components/ResourceCrud';

export const metadata: Metadata = {
  title: 'Color Grading Staff | Schedule Core Engine',
  description: 'Create, update and retire colorists and grading assistants.',
};

export default function ColorGradingStaffPage() {
  return <ResourceCrud type="COLOR_GRADING_STAFF" />;
}
