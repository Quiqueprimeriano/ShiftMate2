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

// Helper function to get 2-week date range
const getTwoWeekRange = (startDate: Date): Date[] => {
  const dates: Date[] = [];
  const current = new Date(startDate);
  
  for (let i = 0; i < 14; i++) {
    dates.push(new Date(current));
    current.setDate(current.getDate() + 1);
  }
  
  return dates;
};

// Helper function to get shift color based on type
const getShiftColor = (shiftType: string): string => {
  switch (shiftType.toLowerCase()) {
    case 'morning':
      return 'bg-emerald-100 text-emerald-800 border-emerald-200';
    case 'afternoon':
      return 'bg-blue-100 text-blue-800 border-blue-200';
    case 'night':
      return 'bg-indigo-100 text-indigo-800 border-indigo-200';
    default:
      return 'bg-gray-100 text-gray-800 border-gray-200';
  }
};

export default function Calendar() {
  const [currentWeekStart, setCurrentWeekStart] = useState(() => getStartOfWeek(new Date()));
  
  // Get 2-week date range
  const twoWeekDates = useMemo(() => getTwoWeekRange(currentWeekStart), [currentWeekStart]);
  
  // Get shifts for the 2-week period
  const startDate = twoWeekDates[0].toISOString().split('T')[0];
  const endDate = twoWeekDates[13].toISOString().split('T')[0];
  
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

  // Calculate total hours for the 2-week period
  const totalHours = useMemo(() => {
    return shifts.reduce((total, shift) => {
      return total + calculateDuration(shift.startTime, shift.endTime);
    }, 0);
  }, [shifts]);

  const navigateWeeks = (direction: 'prev' | 'next') => {
    const newDate = new Date(currentWeekStart);
    newDate.setDate(newDate.getDate() + (direction === 'next' ? 14 : -14));
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
    const lastDate = dates[13];
    const firstMonth = firstDate.toLocaleDateString('en-US', { month: 'short' });
    const lastMonth = lastDate.toLocaleDateString('en-US', { month: 'short' });
    const year = firstDate.getFullYear();
    
    if (firstMonth === lastMonth) {
      return `${firstMonth} ${firstDate.getDate()}-${lastDate.getDate()}, ${year}`;
    } else {
      return `${firstMonth} ${firstDate.getDate()} - ${lastMonth} ${lastDate.getDate()}, ${year}`;
    }
  };

  return (
    <div className="p-4 lg:p-8">
      <div className="space-y-6">
        {/* Header with Navigation */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <h1 className="text-xl font-semibold text-slate-900">
              {formatWeekRange(twoWeekDates)}
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

        {/* 2-Week Calendar Grid */}
        <Card>
          <CardContent className="p-6">
            <div className="grid grid-cols-7 gap-1 mb-4">
              {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => (
                <div key={day} className="text-center text-sm font-medium text-slate-600 py-2">
                  {day}
                </div>
              ))}
            </div>
            
            {/* Week 1 */}
            <div className="grid grid-cols-7 gap-1 mb-4">
              {twoWeekDates.slice(0, 7).map((date, index) => {
                const dateStr = date.toISOString().split('T')[0];
                const dayShifts = shiftsByDate[dateStr] || [];
                const isToday = dateStr === new Date().toISOString().split('T')[0];
                const totalDayHours = dayShifts.reduce((total, shift) => 
                  total + calculateDuration(shift.startTime, shift.endTime), 0);

                return (
                  <div
                    key={index}
                    className={`min-h-32 p-2 border rounded-lg ${
                      isToday ? 'bg-blue-50 border-blue-200' : 'bg-white border-slate-200'
                    } hover:bg-slate-50 transition-colors`}
                  >
                    <div className={`text-sm font-medium mb-2 ${
                      isToday ? 'text-blue-700' : 'text-slate-700'
                    }`}>
                      {date.getDate()}
                    </div>
                    <div className="space-y-1">
                      {dayShifts.map(shift => (
                        <div
                          key={shift.id}
                          className={`text-xs px-2 py-1 rounded border ${getShiftColor(shift.shiftType)}`}
                        >
                          <div className="font-medium">{shift.shiftType}</div>
                          <div className="text-xs opacity-75">
                            {formatTime(shift.startTime)} - {formatTime(shift.endTime)}
                          </div>
                          <div className="text-xs font-semibold">
                            {calculateDuration(shift.startTime, shift.endTime).toFixed(1)}h
                          </div>
                        </div>
                      ))}
                      {totalDayHours > 0 && dayShifts.length > 1 && (
                        <div className="text-xs text-slate-600 font-semibold pt-1 border-t">
                          Total: {totalDayHours.toFixed(1)}h
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Week 2 */}
            <div className="grid grid-cols-7 gap-1">
              {twoWeekDates.slice(7, 14).map((date, index) => {
                const dateStr = date.toISOString().split('T')[0];
                const dayShifts = shiftsByDate[dateStr] || [];
                const isToday = dateStr === new Date().toISOString().split('T')[0];
                const totalDayHours = dayShifts.reduce((total, shift) => 
                  total + calculateDuration(shift.startTime, shift.endTime), 0);

                return (
                  <div
                    key={index + 7}
                    className={`min-h-32 p-2 border rounded-lg ${
                      isToday ? 'bg-blue-50 border-blue-200' : 'bg-white border-slate-200'
                    } hover:bg-slate-50 transition-colors`}
                  >
                    <div className={`text-sm font-medium mb-2 ${
                      isToday ? 'text-blue-700' : 'text-slate-700'
                    }`}>
                      {date.getDate()}
                    </div>
                    <div className="space-y-1">
                      {dayShifts.map(shift => (
                        <div
                          key={shift.id}
                          className={`text-xs px-2 py-1 rounded border ${getShiftColor(shift.shiftType)}`}
                        >
                          <div className="font-medium">{shift.shiftType}</div>
                          <div className="text-xs opacity-75">
                            {formatTime(shift.startTime)} - {formatTime(shift.endTime)}
                          </div>
                          <div className="text-xs font-semibold">
                            {calculateDuration(shift.startTime, shift.endTime).toFixed(1)}h
                          </div>
                        </div>
                      ))}
                      {totalDayHours > 0 && dayShifts.length > 1 && (
                        <div className="text-xs text-slate-600 font-semibold pt-1 border-t">
                          Total: {totalDayHours.toFixed(1)}h
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
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
                    {shifts.length > 0 ? (totalHours / 14).toFixed(1) : 0}h
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
