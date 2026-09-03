'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Booking } from '@/types';
import { api } from '@/lib/api';
import { 
  CheckSquare, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  User, 
  Building2, 
  Calendar, 
  RefreshCw,
  Loader2,
  AlertCircle
} from 'lucide-react';

export default function ApprovalsPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('REQUESTED');
  const [loading, setLoading] = useState<boolean>(true);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const fetchBookings = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.getBookings(statusFilter === 'ALL' ? undefined : statusFilter);
      setBookings(data);
    } catch (err) {
      console.error('Failed to fetch bookings:', err);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    fetchBookings();
  }, [fetchBookings]);

  const handleDecision = async (bookingId: string, status: 'APPROVED' | 'REJECTED') => {
    const comment = prompt(`Enter optional comment for ${status}:`) || undefined;
    setProcessingId(bookingId);
    try {
      await api.approveBooking(bookingId, {
        approver_id: 'APPR-ADMIN-01',
        approver_name: 'System Approver',
        status,
        comment,
      });
      fetchBookings();
    } catch (err: any) {
      alert(`Approval error: ${err.message}`);
    } finally {
      setProcessingId(null);
    }
  };

  const getStatusBadge = (st: string) => {
    switch (st) {
      case 'CONFIRMED':
        return <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">CONFIRMED</span>;
      case 'REQUESTED':
        return <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">PENDING APPROVAL</span>;
      case 'REJECTED':
        return <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300">REJECTED</span>;
      default:
        return <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-300">{st}</span>;
    }
  };

  const formatDateTime = (isoString?: string) => {
    if (!isoString) return '-';
    const d = new Date(isoString);
    return d.toLocaleString([], {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
            <CheckSquare className="w-6 h-6 text-blue-600" />
            <span>Booking Approval Queue</span>
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">
            Evaluate booking commitments and authorize resource allocations
          </p>
        </div>

        <button
          onClick={fetchBookings}
          className="self-start sm:self-auto p-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 shadow-xs"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 border-b border-zinc-200 dark:border-zinc-800 pb-3">
        {['REQUESTED', 'CONFIRMED', 'REJECTED', 'ALL'].map((tab) => (
          <button
            key={tab}
            onClick={() => setStatusFilter(tab)}
            className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
              statusFilter === tab
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'
            }`}
          >
            {tab === 'REQUESTED' ? 'Pending Approval' : tab}
          </button>
        ))}
      </div>

      {/* Bookings List */}
      {loading ? (
        <div className="p-16 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 flex flex-col items-center justify-center gap-2">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
          <p className="text-sm text-zinc-500">Loading booking queue...</p>
        </div>
      ) : bookings.length === 0 ? (
        <div className="p-12 text-center rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-500 text-sm space-y-1">
          <CheckCircle2 className="w-8 h-8 mx-auto text-emerald-500 opacity-60 mb-2" />
          <p className="font-semibold">No bookings found in this status</p>
          <p className="text-xs text-zinc-400">All pending requests have been processed.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {bookings.map((b) => (
            <div
              key={b.id}
              className="p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4 hover:border-zinc-300 dark:hover:border-zinc-700 transition-all"
            >
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <span className="font-mono text-sm font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950 px-2.5 py-0.5 rounded-lg">
                    {b.booking_code}
                  </span>
                  {getStatusBadge(b.status)}
                </div>

                <div>
                  <h4 className="font-semibold text-zinc-900 dark:text-zinc-100 text-base">
                    {b.purpose}
                  </h4>
                </div>

                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-zinc-500 dark:text-zinc-400">
                  <span className="flex items-center gap-1">
                    <User className="w-3.5 h-3.5 text-zinc-400" />
                    {b.requester_name}
                  </span>
                  {b.requester_dept && (
                    <span className="flex items-center gap-1">
                      <Building2 className="w-3.5 h-3.5 text-zinc-400" />
                      {b.requester_dept}
                    </span>
                  )}
                  {b.schedule && (
                    <span className="flex items-center gap-1 font-mono text-zinc-700 dark:text-zinc-300">
                      <Clock className="w-3.5 h-3.5 text-zinc-400" />
                      {formatDateTime(b.schedule.start_at)} → {formatDateTime(b.schedule.end_at)}
                    </span>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              {b.status === 'REQUESTED' && (
                <div className="flex items-center gap-2 pt-2 md:pt-0 border-t md:border-t-0 border-zinc-100 dark:border-zinc-800">
                  <button
                    disabled={processingId === b.id}
                    onClick={() => handleDecision(b.id, 'REJECTED')}
                    className="px-4 py-2 rounded-xl border border-rose-200 dark:border-rose-900 text-rose-600 dark:text-rose-400 text-xs font-semibold hover:bg-rose-50 dark:hover:bg-rose-950/50 flex items-center gap-1.5 transition-all"
                  >
                    <XCircle className="w-4 h-4" />
                    <span>Reject</span>
                  </button>
                  <button
                    disabled={processingId === b.id}
                    onClick={() => handleDecision(b.id, 'APPROVED')}
                    className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-md shadow-emerald-500/20 flex items-center gap-1.5 transition-all"
                  >
                    {processingId === b.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <CheckCircle2 className="w-4 h-4" />
                    )}
                    <span>Approve & Confirm</span>
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
