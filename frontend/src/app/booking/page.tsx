'use client';

import React, { useState, useEffect } from 'react';
import { Resource, DayAvailability, TimeSlot } from '@/types';
import { api } from '@/lib/api';
import { 
  Layers, 
  Calendar, 
  Clock, 
  User, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  ArrowRight,
  Sparkles
} from 'lucide-react';
import Link from 'next/link';

export default function BookingPortalPage() {
  const [resources, setResources] = useState<Resource[]>([]);
  const [selectedResourceId, setSelectedResourceId] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [durationMinutes, setDurationMinutes] = useState<number>(60);
  
  const [availability, setAvailability] = useState<DayAvailability | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null);
  const [loadingSlots, setLoadingSlots] = useState<boolean>(false);

  // Form Fields
  const [requesterName, setRequesterName] = useState<string>('');
  const [requesterDept, setRequesterDept] = useState<string>('');
  const [purpose, setPurpose] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [successBookingCode, setSuccessBookingCode] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>('');

  useEffect(() => {
    const today = new Date().toISOString().split('T')[0];
    setSelectedDate(today);

    api.getResources().then((list) => {
      setResources(list);
      if (list.length > 0) setSelectedResourceId(list[0].id);
    });
  }, []);

  // Fetch Available Slots whenever Resource or Date changes
  useEffect(() => {
    if (!selectedResourceId || !selectedDate) return;

    setLoadingSlots(true);
    setSelectedSlot(null);
    api.getDaySlots(selectedResourceId, selectedDate, durationMinutes, 30)
      .then((res) => {
        setAvailability(res);
      })
      .catch((err) => {
        console.error('Failed to load slots:', err);
      })
      .finally(() => {
        setLoadingSlots(false);
      });
  }, [selectedResourceId, selectedDate, durationMinutes]);

  const handleSubmitBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSlot || !requesterName || !purpose) {
      setErrorMessage('Please choose an available time slot and fill in required details.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage('');
    try {
      const res = await api.createBooking({
        resource_id: selectedResourceId,
        start_at: selectedSlot.start_at,
        end_at: selectedSlot.end_at,
        requester_name: requesterName,
        requester_dept: requesterDept,
        purpose: purpose,
      });
      setSuccessBookingCode(res.booking_code);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to create booking');
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatSlotTime = (isoString: string) => {
    const d = new Date(isoString);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
  };

  const selectedResource = resources.find((r) => r.id === selectedResourceId);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
          <Layers className="w-6 h-6 text-blue-600" />
          <span>Resource Booking Portal</span>
        </h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">
          Submit commitment request for machinery, testing rooms, or engineering staff
        </p>
      </div>

      {successBookingCode ? (
        <div className="p-8 rounded-3xl bg-white dark:bg-zinc-900 border border-emerald-200 dark:border-emerald-950 shadow-sm text-center space-y-4 animate-in fade-in zoom-in-95">
          <div className="w-16 h-16 rounded-2xl bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">Booking Request Submitted!</h2>
          <p className="text-sm text-zinc-600 dark:text-zinc-400 max-w-md mx-auto">
            Your booking reference code is{' '}
            <span className="font-mono font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950 px-2.5 py-1 rounded-lg">
              {successBookingCode}
            </span>
            . The schedule slot is held as <strong>TENTATIVE</strong> pending approval.
          </p>
          <div className="pt-4 flex items-center justify-center gap-3">
            <button
              onClick={() => {
                setSuccessBookingCode(null);
                setPurpose('');
                setSelectedSlot(null);
              }}
              className="px-4 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 text-sm font-medium hover:bg-zinc-50 dark:hover:bg-zinc-800"
            >
              Book Another Resource
            </button>
            <Link
              href="/approvals"
              className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold shadow-md shadow-blue-500/20 flex items-center gap-2"
            >
              <span>View in Approval Queue</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmitBooking} className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Left Column: Resource & Date Selection */}
          <div className="md:col-span-1 space-y-4">
            <div className="p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-xs space-y-4">
              <h3 className="font-semibold text-sm text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                <span>1. Select Resource & Date</span>
              </h3>

              {/* Resource */}
              <div>
                <label className="block text-xs font-semibold text-zinc-600 dark:text-zinc-400 mb-1">
                  Target Resource
                </label>
                <select
                  value={selectedResourceId}
                  onChange={(e) => setSelectedResourceId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-sm font-medium"
                >
                  {resources.map((r) => (
                    <option key={r.id} value={r.id}>
                      [{r.code}] {r.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Date */}
              <div>
                <label className="block text-xs font-semibold text-zinc-600 dark:text-zinc-400 mb-1 flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5" /> Booking Date
                </label>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-sm font-medium"
                  required
                />
              </div>

              {/* Duration */}
              <div>
                <label className="block text-xs font-semibold text-zinc-600 dark:text-zinc-400 mb-1 flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" /> Duration
                </label>
                <select
                  value={durationMinutes}
                  onChange={(e) => setDurationMinutes(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-sm font-medium"
                >
                  <option value={30}>30 Minutes</option>
                  <option value={60}>60 Minutes (1 Hour)</option>
                  <option value={120}>120 Minutes (2 Hours)</option>
                  <option value={180}>180 Minutes (3 Hours)</option>
                  <option value={240}>240 Minutes (4 Hours)</option>
                </select>
              </div>

              {selectedResource && (
                <div className="p-3 rounded-xl bg-blue-50/50 dark:bg-blue-950/40 border border-blue-100 dark:border-blue-900/50 text-xs space-y-1">
                  <div className="font-semibold text-blue-900 dark:text-blue-300 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-blue-500" />
                    Resource Details
                  </div>
                  <p className="text-zinc-600 dark:text-zinc-400">Type: {selectedResource.resource_type}</p>
                  <p className="text-zinc-600 dark:text-zinc-400">Company ID: {selectedResource.company_id}</p>
                </div>
              )}
            </div>
          </div>

          {/* Center Column: Available Slots Grid */}
          <div className="md:col-span-2 space-y-4">
            <div className="p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-sm text-zinc-900 dark:text-zinc-100">
                  2. Choose Available Time Slot
                </h3>
                <span className="text-xs text-zinc-500 font-mono">Dynamic Slot Engine</span>
              </div>

              {loadingSlots ? (
                <div className="p-12 flex flex-col items-center justify-center gap-2">
                  <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
                  <p className="text-xs text-zinc-500">Calculating availability...</p>
                </div>
              ) : !availability || availability.slots.length === 0 ? (
                <div className="p-8 text-center text-xs text-zinc-500 rounded-xl bg-zinc-50 dark:bg-zinc-800/50">
                  No slots configured or resource closed on this day.
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  {availability.slots.map((slot, idx) => {
                    const isSelected = selectedSlot?.start_at === slot.start_at;

                    if (!slot.is_available) {
                      return (
                        <div
                          key={idx}
                          className="p-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-100/70 dark:bg-zinc-800/40 text-zinc-400 dark:text-zinc-600 text-xs opacity-70 cursor-not-allowed"
                          title={slot.conflict_reasons.join(', ')}
                        >
                          <div className="font-mono font-semibold">
                            {formatSlotTime(slot.start_at)} - {formatSlotTime(slot.end_at)}
                          </div>
                          <div className="text-[10px] truncate text-rose-500/80 mt-0.5">
                            {slot.conflict_reasons[0] || 'Unavailable'}
                          </div>
                        </div>
                      );
                    }

                    return (
                      <button
                        type="button"
                        key={idx}
                        onClick={() => setSelectedSlot(slot)}
                        className={`p-3 rounded-xl border text-left text-xs transition-all ${
                          isSelected
                            ? 'bg-blue-600 border-blue-600 text-white font-semibold shadow-md shadow-blue-500/20'
                            : 'border-zinc-200 dark:border-zinc-800 hover:border-blue-400 bg-white dark:bg-zinc-900 text-zinc-800 dark:text-zinc-200'
                        }`}
                      >
                        <div className="font-mono font-bold">
                          {formatSlotTime(slot.start_at)} - {formatSlotTime(slot.end_at)}
                        </div>
                        <div className={`text-[10px] mt-0.5 ${isSelected ? 'text-blue-100' : 'text-emerald-600 dark:text-emerald-400'}`}>
                          ✓ Available
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* 3. Requester Information */}
              <div className="pt-4 border-t border-zinc-200 dark:border-zinc-800 space-y-3">
                <h3 className="font-semibold text-sm text-zinc-900 dark:text-zinc-100">
                  3. Requester Information & Purpose
                </h3>

                {errorMessage && (
                  <div className="p-3 text-xs bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300 rounded-xl border border-rose-200 dark:border-rose-900 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{errorMessage}</span>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-zinc-600 dark:text-zinc-400 mb-1">
                      Your Name / Requester *
                    </label>
                    <input
                      type="text"
                      value={requesterName}
                      onChange={(e) => setRequesterName(e.target.value)}
                      placeholder="e.g. Somchai P."
                      className="w-full px-3 py-2 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-sm"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-zinc-600 dark:text-zinc-400 mb-1">
                      Department
                    </label>
                    <input
                      type="text"
                      value={requesterDept}
                      onChange={(e) => setRequesterDept(e.target.value)}
                      placeholder="e.g. Production Team / Engineering"
                      className="w-full px-3 py-2 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-sm"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-600 dark:text-zinc-400 mb-1">
                    Purpose / Job Requirement *
                  </label>
                  <textarea
                    rows={2}
                    value={purpose}
                    onChange={(e) => setPurpose(e.target.value)}
                    placeholder="Describe what work will be performed on the resource..."
                    className="w-full px-3 py-2 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-sm"
                    required
                  />
                </div>

                <button
                  type="submit"
                  disabled={!selectedSlot || isSubmitting}
                  className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold text-sm shadow-md shadow-blue-500/20 flex items-center justify-center gap-2"
                >
                  {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                  Submit Booking Request
                </button>
              </div>
            </div>
          </div>
        </form>
      )}
    </div>
  );
}
