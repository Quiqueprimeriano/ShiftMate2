import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { Shift } from "@shared/schema";
import { formatTime } from "@/lib/time-utils";

interface CalendarGridProps {
  currentDate: Date;
  onDateChange: (date: Date) => void;
  shifts: Shift[];
  onDayClick?: (date: string) => void;
}

const DAYS_OF_WEEK = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

const SHIFT_TYPE_COLORS = {
  morning: 'bg-emerald-500',
  afternoon: 'bg-blue-500',
  night: 'bg-purple-500',
};

export function CalendarGrid({ currentDate, onDateChange, shifts, onDayClick }: CalendarGridProps) {
  const { year, month, daysInMonth, firstDayOfMonth, today } = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDayOfMonth = new Date(year, month, 1).getDay();
    const today = new Date().toISOString().split('T')[0];
    
    return { year, month, daysInMonth, firstDayOfMonth, today };
  }, [currentDate]);

  const shiftsByDate = useMemo(() => {
    const map = new Map<string, Shift[]>();
    shifts.forEach(shift => {
      const existing = map.get(shift.date) || [];
      map.set(shift.date, [...existing, shift]);
    });
    return map;
  }, [shifts]);

  const previousMonth = () => {
    const newDate = new Date(currentDate);
    newDate.setMonth(month - 1);
    onDateChange(newDate);
  };

  const nextMonth = () => {
    const newDate = new Date(currentDate);
    newDate.setMonth(month + 1);
    onDateChange(newDate);
  };

  const renderCalendarDay = (day: number, isCurrentMonth: boolean = true, monthOffset: number = 0) => {
    const actualMonth = month + monthOffset;
    const actualYear = actualMonth < 0 ? year - 1 : actualMonth > 11 ? year + 1 : year;
    const normalizedMonth = actualMonth < 0 ? 11 : actualMonth > 11 ? 0 : actualMonth;
    
    const dateString = `${actualYear}-${(normalizedMonth + 1).toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
    const dayShifts = shiftsByDate.get(dateString) || [];
    const isToday = dateString === today;
    const hasMissingEntry = isCurrentMonth && dayShifts.length === 0;

    return (
      <div
        key={`${actualYear}-${normalizedMonth}-${day}`}
        className={`h-20 p-2 relative cursor-pointer transition-colors ${
          isCurrentMonth ? 'bg-white hover:bg-slate-50' : 'bg-slate-50'
        } ${isToday ? 'bg-blue-50 border-2 border-blue-300' : ''} ${
          hasMissingEntry && isCurrentMonth ? 'border-2 border-red-200' : ''
        }`}
        onClick={() => isCurrentMonth && onDayClick?.(dateString)}
      >
        <span className={`text-sm font-medium ${
          isCurrentMonth ? (isToday ? 'text-blue-900' : 'text-slate-900') : 'text-slate-400'
        }`}>
          {day}
        </span>
        
        {isToday && (
          <span className="absolute bottom-1 left-1 text-xs text-blue-600">
            Today
          </span>
        )}
        
        {hasMissingEntry && isCurrentMonth && (
          <span className="absolute top-1 right-1 text-xs text-red-500">!</span>
        )}
        
        {dayShifts.length > 0 && (
          <div className="absolute bottom-1 left-1 right-1 space-y-0.5">
            {dayShifts.slice(0, 2).map((shift, index) => (
              <div
                key={index}
                className={`w-full h-1 rounded-full ${
                  SHIFT_TYPE_COLORS[shift.shiftType as keyof typeof SHIFT_TYPE_COLORS] || 'bg-gray-500'
                }`}
                title={`${shift.shiftType} (${formatTime(shift.startTime)} - ${formatTime(shift.endTime)})`}
              />
            ))}
            {dayShifts.length > 2 && (
              <div className="text-xs text-slate-500">+{dayShifts.length - 2} more</div>
            )}
          </div>
        )}
      </div>
    );
  };

  const renderCalendarGrid = () => {
    const days = [];
    
    // Previous month's trailing days
    const prevMonth = month === 0 ? 11 : month - 1;
    const prevYear = month === 0 ? year - 1 : year;
    const daysInPrevMonth = new Date(prevYear, prevMonth + 1, 0).getDate();
    
    for (let i = firstDayOfMonth - 1; i >= 0; i--) {
      days.push(renderCalendarDay(daysInPrevMonth - i, false, -1));
    }
    
    // Current month's days
    for (let day = 1; day <= daysInMonth; day++) {
      days.push(renderCalendarDay(day, true, 0));
    }
    
    // Next month's leading days
    const remainingDays = 42 - days.length; // 6 rows × 7 days
    for (let day = 1; day <= remainingDays; day++) {
      days.push(renderCalendarDay(day, false, 1));
    }
    
    return days;
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200">
      <div className="p-6 border-b border-slate-200">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-slate-900">
            {currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
          </h3>
          <div className="flex items-center space-x-2">
            <Button variant="ghost" size="sm" onClick={previousMonth}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={nextMonth}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
      
      <div className="p-6">
        <div className="grid grid-cols-7 gap-px bg-slate-200 rounded-lg overflow-hidden">
          {/* Header Days */}
          {DAYS_OF_WEEK.map(day => (
            <div key={day} className="bg-slate-50 p-3 text-center">
              <span className="text-xs font-medium text-slate-600">{day}</span>
            </div>
          ))}
          
          {/* Calendar Days */}
          {renderCalendarGrid()}
        </div>

        {/* Legend */}
        <div className="mt-6 flex flex-wrap items-center gap-6">
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-emerald-500 rounded-full"></div>
            <span className="text-sm text-slate-600">Morning Shift</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
            <span className="text-sm text-slate-600">Evening Shift</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-purple-500 rounded-full"></div>
            <span className="text-sm text-slate-600">Night Shift</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-amber-500 rounded-full"></div>
            <span className="text-sm text-slate-600">Double Shift</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 border-2 border-red-300 rounded-full"></div>
            <span className="text-sm text-slate-600">Missing Entry</span>
          </div>
        </div>
      </div>
    </div>
  );
}
