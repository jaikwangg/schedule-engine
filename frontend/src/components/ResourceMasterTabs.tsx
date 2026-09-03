'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutGrid } from 'lucide-react';
import { RESOURCE_TYPE_LIST } from '@/lib/resourceTypes';

const TABS = [
  { href: '/resources', label: 'All', icon: LayoutGrid },
  ...RESOURCE_TYPE_LIST.map((meta) => ({
    href: `/resources/${meta.slug}`,
    label: meta.short,
    icon: meta.icon,
  })),
];

export default function ResourceMasterTabs() {
  const pathname = usePathname();

  return (
    <nav className="flex items-center gap-1 p-1 rounded-xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 w-fit max-w-full overflow-x-auto">
      {TABS.map((tab) => {
        const Icon = tab.icon;
        const isActive = pathname === tab.href;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
              isActive
                ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-xs'
                : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
            }`}
          >
            <Icon className="w-3.5 h-3.5" />
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
