import { useState, useMemo } from "react";
import { useShifts } from "@/hooks/use-shifts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Clock, Plus, ChevronLeft, ChevronRight } from "lucide-react";
import { formatTime, calculateDuration } from "@/lib/time-utils";
import { Link } from "wouter";
import type { Shift } from "@shared/schema";

// Helper function to get start of week (Monday)
const getStartOfWeek = (date: Date): Date => {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust for Sunday
  return new Date(d.setDate(diff));
};

// Helper function to get week date range
const getWeekRange = (startDate: Date): Date[] => {
  const dates: Date[] = [];
  const current = new Date(startDate);
  
  for (let i = 0; i < 7; i++) {
    dates.push(new Date(current));
    current.setDate(current.getDate() + 1);
  }
  
  return dates;
};

// Helper function to get shift color based on type
const getShiftColor = (shiftType: string): string => {
  switch (shiftType.toLowerCase()) {
    case 'morning':
      return 'bg-emerald-500 text-white border-emerald-600';
    case 'afternoon':
      return 'bg-blue-500 text-white border-blue-600';
    case 'night':
      return 'bg-indigo-500 text-white border-indigo-600';
    default:
      return 'bg-gray-500 text-white border-gray-600';
  }
};

// Helper function to convert time string to minutes from midnight
const timeToMinutes = (timeStr: string): number => {
  const [hours, minutes] = timeStr.split(':').map(Number);
  return hours * 60 + minutes;
};

// Helper function to get position and height for shift based on time
const getShiftPosition = (startTime: string, endTime: string) => {
  const startMinutes = timeToMinutes(startTime);
  const endMinutes = timeToMinutes(endTime);
  
  // Each hour is 60px, starting from 6 AM (360 minutes)
  const baseMinutes = 6 * 60; // 6 AM
  const pixelsPerMinute = 1; // 60px per hour = 1px per minute
  
  const top = Math.max(0, (startMinutes - baseMinutes) * pixelsPerMinute);
  const height = Math.max(20, (endMinutes - startMinutes) * pixelsPerMinute);
  
  return { top, height };
};

export default function Calendar() {
  const [currentWeekStart, setCurrentWeekStart] = useState(() => getStartOfWeek(new Date()));
  
  // Get week date range
  const weekDates = useMemo(() => getWeekRange(currentWeekStart), [currentWeekStart]);
  
  // Get shifts for the week
  const startDate = weekDates[0].toISOString().split('T')[0];
  const endDate = weekDates[6].toISOString().split('T')[0];
  
  const { data: shifts = [], isLoading } = useShifts(startDate, endDate);

  // Group shifts by date
  const shiftsByDate = useMemo(() => {
    const grouped: Record<string, Shift[]> = {};
    shifts.forEach(shift => {
      if (!grouped[shift.date]) {
        grouped[shift.date] = [];
      }
      grouped[shift.date].push(shift);
    });
    return grouped;
  }, [shifts]);

  // Calculate total hours for the week
  const totalHours = useMemo(() => {
    return shifts.reduce((total, shift) => {
      return total + calculateDuration(shift.startTime, shift.endTime);
    }, 0);
  }, [shifts]);

  const navigateWeeks = (direction: 'prev' | 'next') => {
    const newDate = new Date(currentWeekStart);
    newDate.setDate(newDate.getDate() + (direction === 'next' ? 7 : -7));
    setCurrentWeekStart(newDate);
  };

  const goToCurrentWeek = () => {
    setCurrentWeekStart(getStartOfWeek(new Date()));
  };

  const isCurrentWeek = () => {
    const currentWeekStartDate = getStartOfWeek(new Date());
    return currentWeekStart.toDateString() === currentWeekStartDate.toDateString();
  };

  if (isLoading) {
    return (
      <div className="p-4 lg:p-8">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 h-96 flex items-center justify-center">
          <div className="text-slate-500">Loading calendar...</div>
        </div>
      </div>
    );
  }

  const formatWeekRange = (dates: Date[]) => {
    const firstDate = dates[0];
    const lastDate = dates[6];
    const firstMonth = firstDate.toLocaleDateString('en-US', { month: 'short' });
    const lastMonth = lastDate.toLocaleDateString('en-US', { month: 'short' });
    const year = firstDate.getFullYear();
    
    if (firstMonth === lastMonth) {
      return `${firstMonth} ${firstDate.getDate()}-${lastDate.getDate()}, ${year}`;
    } else {
      return `${firstMonth} ${firstDate.getDate()} - ${lastMonth} ${lastDate.getDate()}, ${year}`;
    }
  };

  // Generate time slots from 6 AM to 11 PM
  const timeSlots = [];
  for (let hour = 6; hour <= 23; hour++) {
    timeSlots.push({
      hour,
      time: `${hour.toString().padStart(2, '0')}:00`,
      display: hour === 12 ? '12 PM' : hour > 12 ? `${hour - 12} PM` : `${hour} AM`
    });
  }

  return (
    <div className="p-4 lg:p-8">
      <div className="space-y-6">
        {/* Header with Navigation */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <h1 className="text-xl font-semibold text-slate-900">
              {formatWeekRange(weekDates)}
            </h1>
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigateWeeks('prev')}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigateWeeks('next')}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
              {!isCurrentWeek() && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={goToCurrentWeek}
                >
                  Today
                </Button>
              )}
            </div>
          </div>
          <div className="flex items-center space-x-4">
            <div className="text-sm text-slate-600">
              Total Hours: <span className="font-semibold">{totalHours.toFixed(1)}h</span>
            </div>
            <Link href="/add-shift">
              <Button size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Add Shift
              </Button>
            </Link>
          </div>
        </div>

        {/* Google Calendar Style Weekly View */}
        <Card>
          <CardContent className="p-0">
            <div className="grid grid-cols-8 border-b border-slate-200">
              {/* Time column header */}
              <div className="p-3 text-xs text-slate-500 font-medium border-r border-slate-200">
                Time
              </div>
              {/* Day headers */}
              {weekDates.map((date, index) => {
                const isToday = date.toISOString().split('T')[0] === new Date().toISOString().split('T')[0];
                return (
                  <div
                    key={index}
                    className={`p-3 text-center border-r border-slate-200 last:border-r-0 ${
                      isToday ? 'bg-blue-50' : ''
                    }`}
                  >
                    <div className="text-xs text-slate-500 font-medium">
                      {date.toLocaleDateString('en-US', { weekday: 'short' })}
                    </div>
                    <div className={`text-lg font-semibold ${
                      isToday ? 'text-blue-600' : 'text-slate-900'
                    }`}>
                      {date.getDate()}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Time grid */}
            <div className="relative">
              {timeSlots.map((slot, timeIndex) => (
                <div key={slot.hour} className="grid grid-cols-8 border-b border-slate-100 last:border-b-0">
                  {/* Time label */}
                  <div className="p-2 text-xs text-slate-500 font-medium border-r border-slate-200 bg-slate-50">
                    {slot.display}
                  </div>
                  {/* Day columns */}
                  {weekDates.map((date, dayIndex) => {
                    const dateStr = date.toISOString().split('T')[0];
                    const dayShifts = shiftsByDate[dateStr] || [];
                    const isToday = dateStr === new Date().toISOString().split('T')[0];
                    
                    return (
                      <div
                        key={dayIndex}
                        className={`relative h-16 border-r border-slate-200 last:border-r-0 ${
                          isToday ? 'bg-blue-50/30' : ''
                        }`}
                      >
                        {/* Render shifts that overlap with this time slot */}
                        {dayShifts.map(shift => {
                          const shiftStartHour = parseInt(shift.startTime.split(':')[0]);
                          const shiftEndHour = parseInt(shift.endTime.split(':')[0]);
                          const shiftStartMinutes = parseInt(shift.startTime.split(':')[1]);
                          const shiftEndMinutes = parseInt(shift.endTime.split(':')[1]);
                          
                          // Check if shift overlaps with this time slot
                          const slotStart = slot.hour * 60;
                          const slotEnd = (slot.hour + 1) * 60;
                          const shiftStart = shiftStartHour * 60 + shiftStartMinutes;
                          const shiftEnd = shiftEndHour * 60 + shiftEndMinutes;
                          
                          // Only show shift in the first time slot it appears
                          if (shiftStartHour === slot.hour && shiftStart < shiftEnd) {
                            const duration = calculateDuration(shift.startTime, shift.endTime);
                            const heightInPixels = Math.max(20, duration * 64); // 64px per hour
                            
                            return (
                              <div
                                key={shift.id}
                                className={`absolute left-1 right-1 rounded text-xs font-medium ${getShiftColor(shift.shiftType)} shadow-sm z-10 p-1 overflow-hidden`}
                                style={{ 
                                  height: `${heightInPixels}px`,
                                  top: `${(shiftStartMinutes / 60) * 64}px`
                                }}
                              >
                                <div className="font-semibold truncate">{shift.shiftType}</div>
                                <div className="text-xs opacity-90 truncate">
                                  {formatTime(shift.startTime)} - {formatTime(shift.endTime)}
                                </div>
                                <div className="text-xs font-bold">
                                  {duration.toFixed(1)}h
                                </div>
                              </div>
                            );
                          }
                          return null;
                        })}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Summary Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center">
                <Clock className="h-5 w-5 text-blue-600 mr-2" />
                <div>
                  <div className="text-sm text-slate-600">Total Hours</div>
                  <div className="text-xl font-semibold">{totalHours.toFixed(1)}h</div>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center">
                <div className="w-5 h-5 bg-emerald-500 rounded mr-2"></div>
                <div>
                  <div className="text-sm text-slate-600">Total Shifts</div>
                  <div className="text-xl font-semibold">{shifts.length}</div>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center">
                <div className="w-5 h-5 bg-blue-500 rounded mr-2"></div>
                <div>
                  <div className="text-sm text-slate-600">Avg per Day</div>
                  <div className="text-xl font-semibold">
                    {shifts.length > 0 ? (totalHours / 7).toFixed(1) : 0}h
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
