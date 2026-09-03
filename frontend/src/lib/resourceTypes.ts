import type { ComponentType } from 'react';
import {
  Clapperboard,
  DoorOpen,
  HardDrive,
  Palette,
  SlidersHorizontal,
} from 'lucide-react';
import type { ResourceType } from '@/types';

/**
 * Single source of truth for the five schedulable categories.
 *
 * Every screen that names, colours, filters or routes to a category reads from
 * here, so adding or renaming one is a one-file change.
 */
export interface ResourceTypeMeta {
  type: ResourceType;
  /** Route segment under /resources */
  slug: string;
  /** Singular, used in "New {label}" and detail rows */
  label: string;
  /** Plural, used as the page heading */
  plural: string;
  /** Short form for the tab bar and filter chips */
  short: string;
  icon: ComponentType<{ className?: string }>;
  blurb: string;
  codePlaceholder: string;
  namePlaceholder: string;
  capacityLabel: string;
  capacityHint: string;
  companyLabel: string;
  accentText: string;
  accentButton: string;
  accentSoft: string;
}

export const RESOURCE_TYPE_META: Record<ResourceType, ResourceTypeMeta> = {
  ROOM: {
    type: 'ROOM',
    slug: 'rooms',
    label: 'Room',
    plural: 'Rooms',
    short: 'Rooms',
    icon: DoorOpen,
    blurb: 'Suites and rooms that sessions get booked into — codes, capacity and the hours they can be reserved.',
    codePlaceholder: 'ROOM-CG2',
    namePlaceholder: 'Color Grading Suite 2',
    capacityLabel: 'Seats',
    capacityHint: 'How many concurrent bookings this room accepts.',
    companyLabel: 'Facility / Company',
    accentText: 'text-emerald-600 dark:text-emerald-400',
    accentButton: 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-500/20',
    accentSoft: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300',
  },
  PRODUCER: {
    type: 'PRODUCER',
    slug: 'producers',
    label: 'Producer',
    plural: 'Producers',
    short: 'Producers',
    icon: Clapperboard,
    blurb: 'Producers who own jobs and client relationships — their availability and how many jobs they can carry.',
    codePlaceholder: 'PRD-003',
    namePlaceholder: 'Nattaya S. (Senior Post Producer)',
    capacityLabel: 'Concurrent jobs',
    capacityHint: 'How many jobs this producer can run in parallel.',
    companyLabel: 'Department / Company',
    accentText: 'text-amber-600 dark:text-amber-400',
    accentButton: 'bg-amber-600 hover:bg-amber-700 shadow-amber-500/20',
    accentSoft: 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300',
  },
  COLOR_GRADING_STAFF: {
    type: 'COLOR_GRADING_STAFF',
    slug: 'color-grading-staff',
    label: 'Color Grading Staff',
    plural: 'Color Grading Staff',
    short: 'Color Grading',
    icon: Palette,
    blurb: 'Colorists and grading assistants — who can be booked into a grading session, and when.',
    codePlaceholder: 'CGS-003',
    namePlaceholder: 'Anan T. (Senior Colorist)',
    capacityLabel: 'Concurrent sessions',
    capacityHint: 'How many grading sessions this person can be booked on at once.',
    companyLabel: 'Department / Company',
    accentText: 'text-violet-600 dark:text-violet-400',
    accentButton: 'bg-violet-600 hover:bg-violet-700 shadow-violet-500/20',
    accentSoft: 'bg-violet-50 text-violet-700 dark:bg-violet-950/60 dark:text-violet-300',
  },
  OPERATOR_UNIT_STAFF: {
    type: 'OPERATOR_UNIT_STAFF',
    slug: 'operator-unit-staff',
    label: 'Operator Unit Staff',
    plural: 'Operator Unit Staff',
    short: 'Operator Unit',
    icon: SlidersHorizontal,
    blurb: 'Online, conform and operating unit staff — shift patterns and booking capacity.',
    codePlaceholder: 'OPU-003',
    namePlaceholder: 'Kittipong R. (Online Operator)',
    capacityLabel: 'Concurrent sessions',
    capacityHint: 'How many sessions this operator can be booked on at once.',
    companyLabel: 'Department / Company',
    accentText: 'text-blue-600 dark:text-blue-400',
    accentButton: 'bg-blue-600 hover:bg-blue-700 shadow-blue-500/20',
    accentSoft: 'bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300',
  },
  DATA_MANAGEMENT_STAFF: {
    type: 'DATA_MANAGEMENT_STAFF',
    slug: 'data-management-staff',
    label: 'Data Management Staff',
    plural: 'Data Management Staff',
    short: 'Data Mgmt',
    icon: HardDrive,
    blurb: 'DIT and data management staff — ingest, backup and delivery availability.',
    codePlaceholder: 'DMS-002',
    namePlaceholder: 'Chalida P. (DIT / Data Manager)',
    capacityLabel: 'Concurrent jobs',
    capacityHint: 'How many ingest or delivery jobs this person can handle at once.',
    companyLabel: 'Department / Company',
    accentText: 'text-cyan-600 dark:text-cyan-400',
    accentButton: 'bg-cyan-600 hover:bg-cyan-700 shadow-cyan-500/20',
    accentSoft: 'bg-cyan-50 text-cyan-700 dark:bg-cyan-950/60 dark:text-cyan-300',
  },
};

/** Display order used by the tab bar, filters and the type dropdown */
export const RESOURCE_TYPES = Object.keys(RESOURCE_TYPE_META) as ResourceType[];

export const RESOURCE_TYPE_LIST = RESOURCE_TYPES.map((t) => RESOURCE_TYPE_META[t]);

/**
 * Friendly singular name for a raw `resource_type` string. Falls back to the
 * raw value so a row from an older database still renders something readable.
 */
export const resourceTypeLabel = (type: string): string =>
  RESOURCE_TYPE_META[type as ResourceType]?.label ?? type;

/** Short name, for tight spots like filter chips and timeline badges */
export const resourceTypeShort = (type: string): string =>
  RESOURCE_TYPE_META[type as ResourceType]?.short ?? type;
