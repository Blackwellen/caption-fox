// Date-range presets shared by server pages and client controls. Kept out of
// the 'use client' Controls module: a server component importing a plain value
// from a client module receives a client reference, not the array.

export type RangePresetOption = { value: string; label: string }

export const RANGE_PRESETS: RangePresetOption[] = [
  { value: 'last_7', label: 'Last 7 days' },
  { value: 'last_14', label: 'Last 14 days' },
  { value: 'last_28', label: 'Last 28 days' },
  { value: 'last_30', label: 'Last 30 days' },
  { value: 'last_90', label: 'Last 90 days' },
  { value: 'this_month', label: 'This month' },
  { value: 'last_month', label: 'Last month' },
]
