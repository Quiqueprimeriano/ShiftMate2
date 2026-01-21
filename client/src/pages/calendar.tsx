import { useState, useMemo } from "react";
import { useShifts } from "@/hooks/use-shifts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Clock, Plus, ChevronLeft, ChevronRight, CalendarIcon, User } from "lucide-react";
import { formatTime, calculateDuration } from "@/lib/time-utils";
import { Link } from "wouter";
import type { Shift } from "@shared/schema";
import { PayBreakdown } from "@/components/PayBreakdown";

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

// Helper function to get shift color based on type and source
const getShiftColor = (shiftType: string, isRosterShift: boolean = false): string => {
  if (isRosterShift) {
    // Roster shifts have light colors with dashed borders
    const rosterColors = {
      morning: 'bg-emerald-100 text-emerald-800 border-emerald-300',
      afternoon: 'bg-blue-100 text-blue-800 border-blue-300',
      evening: 'bg-blue-100 text-blue-800 border-blue-300',
      night: 'bg-indigo-100 text-indigo-800 border-indigo-300',
      default: 'bg-gray-100 text-gray-800 border-gray-300'
    };
    const colorKey = shiftType.toLowerCase() as keyof typeof rosterColors;
    return rosterColors[colorKey] || rosterColors.default;
  } else {
    // Personal shifts have solid colors
    const personalColors = {
      morning: 'bg-emerald-500 text-white border-emerald-600',
      afternoon: 'bg-blue-500 text-white border-blue-600',
      evening: 'bg-blue-500 text-white border-blue-600',
      night: 'bg-indigo-500 text-white border-indigo-600',
      default: 'bg-gray-500 text-white border-gray-600'
    };
    const colorKey = shiftType.toLowerCase() as keyof typeof personalColors;
    return personalColors[colorKey] || personalColors.default;
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
  const [selectedShift, setSelectedShift] = useState<Shift | null>(null);
  
  // Get week date range
  const weekDates = useMemo(() => getWeekRange(currentWeekStart), [currentWeekStart]);
  
  // Get all shifts for the week (both personal and roster shifts)
  const startDate = weekDates[0].toISOString().split('T')[0];
  const endDate = weekDates[6].toISOString().split('T')[0];
  
  const { data: shifts = [], isLoading } = useShifts(startDate, endDate);

  // Group shifts by date
  const shiftsByDate = useMemo(() => {
    const grouped: Record<string, Shift[]> = {};
    shifts.forEach((shift: Shift) => {
      if (!grouped[shift.date]) {
        grouped[shift.date] = [];
      }
      grouped[shift.date].push(shift);
    });
    return grouped;
  }, [shifts]);

  // Calculate total hours for the week
  const totalHours = useMemo(() => {
    return shifts.reduce((total: number, shift: Shift) => {
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

  // Helper function to determine if a shift is a roster shift
  // For simplicity, we'll treat all shifts as personal for now since we're showing all shifts
  const isRosterShift = (shift: Shift): boolean => {
    // In the future, this could check for a specific field that indicates roster vs personal
    return false; // All shifts displayed as personal for now since this is the unified calendar
  };

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
    <>
      <div className="p-4 lg:p-8">
        <div className="space-y-6">
        {/* Header with Navigation */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div>
              <h1 className="text-xl font-semibold text-slate-900">Calendar</h1>
              <p className="text-sm text-slate-600">{formatWeekRange(weekDates)}</p>
              <p className="text-xs text-slate-500 mt-1">View all your shifts on the calendar</p>
            </div>
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

        {/* Calendar Grid View */}
        <Card>
            <CardContent className="p-0">
              <div className="grid grid-cols-8 border-b border-slate-200">
                {/* Time column header */}
                <div className="p-1 text-xs text-slate-500 font-medium border-r border-slate-200 w-16">
                  Time
                </div>
                {/* Day headers */}
                {weekDates.map((date, index) => {
                  const isToday = date.toISOString().split('T')[0] === new Date().toISOString().split('T')[0];
                  return (
                    <div
                      key={index}
                      className={`p-1 text-center border-r border-slate-200 last:border-r-0 ${
                        isToday ? 'bg-blue-50' : ''
                      }`}
                    >
                      <div className="text-xs text-slate-500 font-medium">
                        {date.toLocaleDateString('en-US', { weekday: 'short' })}
                      </div>
                      <div className={`text-xs font-semibold ${
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
                    <div className="p-1 text-xs text-slate-500 font-medium border-r border-slate-200 bg-slate-50 w-16">
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
                          className={`relative h-8 border-r border-slate-200 last:border-r-0 ${
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
                              const heightInPixels = Math.max(12, duration * 32); // 32px per hour
                              
                              return (
                                <div
                                  key={shift.id}
                                  data-testid={`desktop-shift-${shift.id}`}
                                  className={`absolute left-1 right-1 rounded text-xs font-medium ${getShiftColor(shift.shiftType, isRosterShift(shift))} shadow-sm z-10 p-1 overflow-hidden cursor-pointer hover:opacity-80 transition-opacity ${isRosterShift(shift) ? 'border-2 border-dashed' : 'border-2 border-solid'}`}
                                  style={{ 
                                    height: `${heightInPixels}px`,
                                    top: `${(shiftStartMinutes / 60) * 32}px`
                                  }}
                                  onClick={() => setSelectedShift(shift)}
                                >
                                  <div className="flex items-center gap-1">
                                    <CalendarIcon className="h-3 w-3" />
                                    <div className="font-semibold truncate">{shift.shiftType}</div>
                                  </div>
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
        </div>

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

      <Dialog open={!!selectedShift} onOpenChange={() => setSelectedShift(null)}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Shift Details</DialogTitle>
          </DialogHeader>
          {selectedShift && (
            <div className="space-y-4">
              {/* Roster Shift Indicator */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-center gap-2">
                <CalendarIcon className="h-4 w-4 text-blue-600" />
                <div className="text-sm text-blue-800">
                  <div className="font-medium">Roster Shift</div>
                  <div className="text-xs">This shift was assigned by your manager</div>
                </div>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-slate-600">Date</label>
                  <div className="text-sm text-slate-900">
                    {new Date(selectedShift.date).toLocaleDateString('en-US', { 
                      weekday: 'long', 
                      year: 'numeric', 
                      month: 'long', 
                      day: 'numeric' 
                    })}
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-600">Shift Type</label>
                  <div className="text-sm text-slate-900">{selectedShift.shiftType}</div>
                </div>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-slate-600">Start Time</label>
                  <div className="text-sm text-slate-900">{formatTime(selectedShift.startTime)}</div>
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-600">End Time</label>
                  <div className="text-sm text-slate-900">{formatTime(selectedShift.endTime)}</div>
                </div>
              </div>
              
              <div>
                <label className="text-sm font-medium text-slate-600">Duration</label>
                <div className="text-sm text-slate-900">
                  {calculateDuration(selectedShift.startTime, selectedShift.endTime).toFixed(1)} hours
                </div>
              </div>
              
              {/* Pay Breakdown Section */}
              <PayBreakdown shift={selectedShift} />
              
              {selectedShift.notes && (
                <div>
                  <label className="text-sm font-medium text-slate-600">Notes</label>
                  <div className="text-sm text-slate-900 bg-slate-50 p-3 rounded-lg mt-1">
                    {selectedShift.notes}
                  </div>
                </div>
              )}
              
              {!selectedShift.notes && (
                <div className="text-sm text-slate-500 italic">
                  No notes added for this shift.
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
