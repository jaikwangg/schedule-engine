'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { ResourceUsage, Resource } from '@/types';
import { api } from '@/lib/api';
import { 
  Clock, 
  Play, 
  Square, 
  DollarSign, 
  Cpu, 
  RefreshCw, 
  Loader2, 
  CheckCircle2,
  AlertCircle,
  TrendingUp
} from 'lucide-react';

export default function UsagePage() {
  const [usages, setUsages] = useState<ResourceUsage[]>([]);
  const [resources, setResources] = useState<Resource[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Manual Clock-in Modal State
  const [isClockInOpen, setIsClockInOpen] = useState<boolean>(false);
  const [selectedResourceId, setSelectedResourceId] = useState<string>('');
  const [operatorId, setOperatorId] = useState<string>('OP-SOMCHAI-01');
  const [meterStart, setMeterStart] = useState<number>(0);

  // Clock-out Modal State
  const [selectedUsageForOut, setSelectedUsageForOut] = useState<ResourceUsage | null>(null);
  const [meterEnd, setMeterEnd] = useState<number>(0);
  const [hourlyRate, setHourlyRate] = useState<number>(1000);
  const [setupCost, setSetupCost] = useState<number>(200);
  const [billingCompany, setBillingCompany] = useState<string>('COM-MFG-01');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [usageList, resList] = await Promise.all([
        api.getUsages(),
        api.getResources(),
      ]);
      setUsages(usageList);
      setResources(resList);
      if (resList.length > 0 && !selectedResourceId) {
        setSelectedResourceId(resList[0].id);
      }
    } catch (err) {
      console.error('Failed to load usage data:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedResourceId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleClockIn = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.clockIn({
        resource_id: selectedResourceId,
        operator_id: operatorId,
        meter_start: meterStart,
      });
      setIsClockInOpen(false);
      fetchData();
    } catch (err: any) {
      alert(`Clock-in error: ${err.message}`);
    }
  };

  const handleClockOut = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUsageForOut) return;
    try {
      await api.clockOut(selectedUsageForOut.id, {
        meter_end: meterEnd,
        hourly_rate: hourlyRate,
        setup_cost: setupCost,
        billing_company_id: billingCompany,
      });
      setSelectedUsageForOut(null);
      fetchData();
    } catch (err: any) {
      alert(`Clock-out error: ${err.message}`);
    }
  };

  const formatDateTime = (isoString?: string | null) => {
    if (!isoString) return '-';
    const d = new Date(isoString);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
  };

  const totalCalculatedCost = usages.reduce((acc, u) => acc + (u.cost?.total_cost ? Number(u.cost.total_cost) : 0), 0);
  const totalActualMinutes = usages.reduce((acc, u) => acc + (u.actual_duration_minutes || 0), 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
            <Clock className="w-6 h-6 text-blue-600" />
            <span>Actual Usage & Cost Tracking</span>
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">
            Compare planned vs actual telemetry hours and compute intercompany usage costs
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchData}
            className="p-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 shadow-xs"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => setIsClockInOpen(true)}
            className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold shadow-md shadow-emerald-500/20 flex items-center gap-2"
          >
            <Play className="w-4 h-4" />
            <span>Clock-In Job</span>
          </button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400 flex items-center justify-center">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Total Clocked Time</span>
            <p className="text-xl font-bold text-zinc-900 dark:text-zinc-100">
              {Math.floor(totalActualMinutes / 60)}h {totalActualMinutes % 60}m
            </p>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400 flex items-center justify-center">
            <DollarSign className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Total Calculated Cost</span>
            <p className="text-xl font-bold text-zinc-900 dark:text-zinc-100">
              ฿{totalCalculatedCost.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </p>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-violet-50 text-violet-600 dark:bg-violet-950 dark:text-violet-400 flex items-center justify-center">
            <TrendingUp className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Active Usages</span>
            <p className="text-xl font-bold text-zinc-900 dark:text-zinc-100">
              {usages.filter((u) => !u.actual_end_at).length} In Progress
            </p>
          </div>
        </div>
      </div>

      {/* Usages Table */}
      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-xs overflow-hidden">
        <div className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
          <h3 className="font-semibold text-sm text-zinc-900 dark:text-zinc-100">Resource Usages Log</h3>
          <span className="text-xs text-zinc-500 font-mono">Actuals vs Planned Domain</span>
        </div>

        {loading ? (
          <div className="p-12 flex flex-col items-center justify-center gap-2">
            <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
            <p className="text-xs text-zinc-500">Loading usage telemetry...</p>
          </div>
        ) : usages.length === 0 ? (
          <div className="p-12 text-center text-xs text-zinc-500">No actual usage records recorded yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-zinc-50 dark:bg-zinc-950 text-zinc-500 border-b border-zinc-200 dark:border-zinc-800 font-medium">
                <tr>
                  <th className="px-5 py-3">Resource / Operator</th>
                  <th className="px-5 py-3">Clock-In Time</th>
                  <th className="px-5 py-3">Clock-Out Time</th>
                  <th className="px-5 py-3">Duration</th>
                  <th className="px-5 py-3">Calculated Cost</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800 font-mono">
                {usages.map((u) => {
                  const res = resources.find((r) => r.id === u.resource_id);
                  const isRunning = !u.actual_end_at;

                  return (
                    <tr key={u.id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-900/50 transition-colors">
                      <td className="px-5 py-3.5">
                        <div className="font-bold text-zinc-900 dark:text-zinc-100 font-sans">
                          [{res?.code || u.resource_id}] {res?.name}
                        </div>
                        <div className="text-[11px] text-zinc-500 font-mono">
                          Operator: {u.operator_id || 'System'}
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-zinc-700 dark:text-zinc-300">
                        {formatDateTime(u.actual_start_at)}
                      </td>
                      <td className="px-5 py-3.5 text-zinc-700 dark:text-zinc-300">
                        {formatDateTime(u.actual_end_at)}
                      </td>
                      <td className="px-5 py-3.5 font-bold text-zinc-800 dark:text-zinc-200">
                        {u.actual_duration_minutes ? `${u.actual_duration_minutes} mins` : '-'}
                      </td>
                      <td className="px-5 py-3.5 font-bold text-emerald-600 dark:text-emerald-400">
                        {u.cost ? `฿${Number(u.cost.total_cost).toLocaleString(undefined, { minimumFractionDigits: 2 })}` : '-'}
                      </td>
                      <td className="px-5 py-3.5">
                        {isRunning ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                            IN_PROGRESS
                          </span>
                        ) : (
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                            COMPLETED
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        {isRunning && (
                          <button
                            onClick={() => setSelectedUsageForOut(u)}
                            className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-sans text-xs font-semibold shadow-xs flex items-center gap-1 ml-auto"
                          >
                            <Square className="w-3 h-3" />
                            <span>Clock-Out</span>
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Clock-In Modal */}
      {isClockInOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 max-w-md w-full border border-zinc-200 dark:border-zinc-800 space-y-4">
            <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
              <Play className="w-4 h-4 text-emerald-500" />
              <span>Clock-In Actual Work</span>
            </h3>

            <form onSubmit={handleClockIn} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold mb-1">Resource</label>
                <select
                  value={selectedResourceId}
                  onChange={(e) => setSelectedResourceId(e.target.value)}
                  className="w-full p-2 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800"
                >
                  {resources.map((r) => (
                    <option key={r.id} value={r.id}>[{r.code}] {r.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold mb-1">Operator ID / Name</label>
                <input
                  type="text"
                  value={operatorId}
                  onChange={(e) => setOperatorId(e.target.value)}
                  className="w-full p-2 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold mb-1">Initial Meter / Odometer Reading</label>
                <input
                  type="number"
                  step="0.1"
                  value={meterStart}
                  onChange={(e) => setMeterStart(Number(e.target.value))}
                  className="w-full p-2 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800"
                />
              </div>

              <div className="pt-3 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsClockInOpen(false)}
                  className="px-4 py-2 rounded-xl border border-zinc-300 dark:border-zinc-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-emerald-600 text-white font-semibold"
                >
                  Confirm Clock-In
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Clock-Out Modal */}
      {selectedUsageForOut && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 max-w-md w-full border border-zinc-200 dark:border-zinc-800 space-y-4">
            <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
              <Square className="w-4 h-4 text-rose-500" />
              <span>Clock-Out Job & Compute Cost</span>
            </h3>

            <form onSubmit={handleClockOut} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold mb-1">Hourly Rate (฿/hr)</label>
                  <input
                    type="number"
                    value={hourlyRate}
                    onChange={(e) => setHourlyRate(Number(e.target.value))}
                    className="w-full p-2 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800"
                    required
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">Setup Cost (฿)</label>
                  <input
                    type="number"
                    value={setupCost}
                    onChange={(e) => setSetupCost(Number(e.target.value))}
                    className="w-full p-2 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold mb-1">End Meter Reading</label>
                <input
                  type="number"
                  step="0.1"
                  value={meterEnd}
                  onChange={(e) => setMeterEnd(Number(e.target.value))}
                  className="w-full p-2 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800"
                />
              </div>

              <div>
                <label className="block font-semibold mb-1">Billing Company ID (Intercompany)</label>
                <input
                  type="text"
                  value={billingCompany}
                  onChange={(e) => setBillingCompany(e.target.value)}
                  className="w-full p-2 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800"
                />
              </div>

              <div className="pt-3 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedUsageForOut(null)}
                  className="px-4 py-2 rounded-xl border border-zinc-300 dark:border-zinc-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-rose-600 text-white font-semibold"
                >
                  Complete & Calculate Cost
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
