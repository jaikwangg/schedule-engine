import React from 'react';
import ResourceMasterTabs from '@/components/ResourceMasterTabs';

export default function ResourcesLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-6">
      <ResourceMasterTabs />
      {children}
    </div>
  );
}
