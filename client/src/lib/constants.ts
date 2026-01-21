// Shift type color mappings
export const SHIFT_TYPE_COLORS = {
  morning: 'bg-amber-500',
  afternoon: 'bg-blue-500',
  evening: 'bg-blue-500',
  night: 'bg-indigo-500',
  double: 'bg-purple-500',
  custom: 'bg-gray-500',
} as const;

// Shift type labels
export const SHIFT_TYPE_LABELS = {
  morning: 'Morning',
  afternoon: 'Afternoon',
  evening: 'Evening',
  night: 'Night',
  double: 'Double',
  custom: 'Custom',
} as const;

// Day type labels
export const DAY_TYPE_LABELS = {
  weekday: 'Weekday',
  saturday: 'Saturday',
  sunday: 'Sunday',
  holiday: 'Holiday',
} as const;

// Time options generator
export function generateTimeOptions(): string[] {
  const options: string[] = [];
  for (let hour = 0; hour < 24; hour++) {
    for (let minute = 0; minute < 60; minute += 15) {
      const h = hour.toString().padStart(2, '0');
      const m = minute.toString().padStart(2, '0');
      options.push(`${h}:${m}`);
    }
  }
  return options;
}

// Memoized time options (generate once)
export const TIME_OPTIONS = generateTimeOptions();

export type ShiftType = keyof typeof SHIFT_TYPE_COLORS;
export type DayType = keyof typeof DAY_TYPE_LABELS;
