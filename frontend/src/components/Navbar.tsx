'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  CalendarDays, 
  Layers, 
  CheckSquare, 
  Clock, 
  Cpu, 
  Activity,
  AlertCircle
} from 'lucide-react';
import { api } from '@/lib/api';

export default function Navbar() {
  const pathname = usePathname();
  const [isBackendHealthy, setIsBackendHealthy] = useState<boolean | null>(null);

  useEffect(() => {
    const check = async () => {
      const healthy = await api.checkHealth();
      setIsBackendHealthy(healthy);
    };
    check();
    const interval = setInterval(check, 10000);
    return () => clearInterval(interval);
  }, []);

  const navItems = [
    { href: '/', label: 'Timeline / Board', icon: CalendarDays },
    { href: '/booking', label: 'Book Resource', icon: Layers },
    { href: '/approvals', label: 'Approval Queue', icon: CheckSquare },
    { href: '/usage', label: 'Actual Usage & Cost', icon: Clock },
    { href: '/resources', label: 'Resource Master', icon: Cpu },
  ];

  return (
    <header className="sticky top-0 z-50 backdrop-blur-md bg-white/85 dark:bg-zinc-950/85 border-b border-zinc-200 dark:border-zinc-800 transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand Logo */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-violet-500 flex items-center justify-center text-white shadow-md shadow-indigo-500/20">
              <Activity className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <span className="font-bold text-lg tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-violet-600 dark:from-blue-400 dark:to-violet-400">
                Schedule Engine
              </span>
              <span className="ml-2 text-xs font-medium px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                Core Domain
              </span>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="hidden md:flex items-center space-x-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              // Sub-routes (e.g. /resources/machines) keep their parent tab lit
              const isActive =
                pathname === item.href || (item.href !== '/' && pathname.startsWith(`${item.href}/`));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/70 dark:text-blue-400 shadow-xs'
                      : 'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:text-zinc-100 dark:hover:bg-zinc-900'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'text-blue-600 dark:text-blue-400' : ''}`} />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          {/* Status Indicator */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-xs font-mono">
              <span className="text-zinc-500 dark:text-zinc-400">API:</span>
              {isBackendHealthy === null ? (
                <span className="inline-flex items-center gap-1 text-zinc-500">
                  <span className="w-2 h-2 rounded-full bg-zinc-400 animate-ping" /> Checking...
                </span>
              ) : isBackendHealthy ? (
                <span className="inline-flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-semibold">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" /> Connected
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 text-rose-600 dark:text-rose-400 font-semibold">
                  <AlertCircle className="w-3.5 h-3.5" /> Disconnected
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
