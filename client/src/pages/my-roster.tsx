import { useState, useMemo } from "react";
import { useIndividualRosterShifts } from "@/hooks/use-shifts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Clock, Plus, ChevronLeft, ChevronRight, CalendarIcon, User, ChevronDown } from "lucide-react";
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

// Helper function to get shift color based on type (roster shifts have light colors)
const getShiftColor = (shiftType: string): string => {
  const rosterColors = {
    morning: 'bg-emerald-100 text-emerald-800 border-emerald-300',
    afternoon: 'bg-blue-100 text-blue-800 border-blue-300',
    evening: 'bg-blue-100 text-blue-800 border-blue-300', // Handle old 'evening' type
    night: 'bg-indigo-100 text-indigo-800 border-indigo-300',
    default: 'bg-gray-100 text-gray-800 border-gray-300'
  };

  const colorKey = shiftType.toLowerCase() as keyof typeof rosterColors;
  return rosterColors[colorKey] || rosterColors.default;
};

// Mobile agenda view components
const MobileAgendaView = ({ 
  weekDates, 
  shiftsByDate, 
  onShiftClick 
}: { 
  weekDates: Date[]; 
  shiftsByDate: Record<string, Shift[]>; 
  onShiftClick: (shift: Shift) => void;
}) => {
  const [openDays, setOpenDays] = useState<Set<string>>(new Set());

  const toggleDay = (dateStr: string) => {
    const newOpenDays = new Set(openDays);
    if (newOpenDays.has(dateStr)) {
      newOpenDays.delete(dateStr);
    } else {
      newOpenDays.add(dateStr);
    }
    setOpenDays(newOpenDays);
  };

  return (
    <div className="space-y-2">
      {weekDates.map(date => {
        const dateStr = date.toISOString().split('T')[0];
        const dayShifts = shiftsByDate[dateStr] || [];
        const isToday = dateStr === new Date().toISOString().split('T')[0];
        const isOpen = openDays.has(dateStr);
        
        return (
          <Card key={dateStr} className={`${isToday ? 'ring-2 ring-blue-200 bg-blue-50/30' : ''}`}>
            <Collapsible open={isOpen} onOpenChange={() => toggleDay(dateStr)}>
              <CollapsibleTrigger asChild>
                <CardHeader className="pb-3 cursor-pointer hover:bg-slate-50 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`text-center ${isToday ? 'text-blue-600' : 'text-slate-600'}`}>
                        <div className="text-xs font-medium uppercase tracking-wide">
                          {date.toLocaleDateString('en-US', { weekday: 'short' })}
                        </div>
                        <div className={`text-lg font-bold ${isToday ? 'text-blue-600' : 'text-slate-900'}`}>
                          {date.getDate()}
                        </div>
                      </div>
                      <div>
                        <h3 className={`font-medium ${isToday ? 'text-blue-900' : 'text-slate-900'}`}>
                          {date.toLocaleDateString('en-US', { 
                            weekday: 'long', 
                            month: 'long', 
                            day: 'numeric' 
                          })}
                        </h3>
                        <p className="text-sm text-slate-600">
                          {dayShifts.length === 0 ? 'No shifts' : `${dayShifts.length} shift${dayShifts.length !== 1 ? 's' : ''}`}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {dayShifts.length > 0 && (
                        <div className="text-sm font-medium text-slate-600">
                          {dayShifts.reduce((total, shift) => total + calculateDuration(shift.startTime, shift.endTime), 0).toFixed(1)}h
                        </div>
                      )}
                      <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                    </div>
                  </div>
                </CardHeader>
              </CollapsibleTrigger>
              
              {dayShifts.length > 0 && (
                <CollapsibleContent>
                  <CardContent className="pt-0 space-y-3">
                    {dayShifts.map(shift => {
                      const duration = calculateDuration(shift.startTime, shift.endTime);
                      return (
                        <div
                          key={shift.id}
                          data-testid={`mobile-shift-${shift.id}`}
                          className={`p-4 rounded-lg cursor-pointer transition-all hover:shadow-md border-2 border-dashed ${getShiftColor(shift.shiftType)}`}
                          onClick={() => onShiftClick(shift)}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex items-center gap-3 flex-1">
                              <CalendarIcon className="h-5 w-5 flex-shrink-0" />
                              <div className="flex-1 min-w-0">
                                <div className="font-semibold text-base capitalize">
                                  {shift.shiftType} Shift
                                </div>
                                <div className="text-sm opacity-90 font-medium">
                                  {formatTime(shift.startTime)} - {formatTime(shift.endTime)}
                                </div>
                                {shift.notes && (
                                  <div className="text-sm opacity-75 mt-1 truncate">
                                    {shift.notes}
                                  </div>
                                )}
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="text-sm font-bold">
                                {duration.toFixed(1)}h
                              </div>
                              <div className="text-xs opacity-75">
                                Roster
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </CardContent>
                </CollapsibleContent>
              )}
            </Collapsible>
          </Card>
        );
      })}
    </div>
  );
};

export default function MyRoster() {
  const [currentWeekStart, setCurrentWeekStart] = useState(() => getStartOfWeek(new Date()));
  const [selectedShift, setSelectedShift] = useState<Shift | null>(null);
  
  // Get week date range
  const weekDates = useMemo(() => getWeekRange(currentWeekStart), [currentWeekStart]);
  
  // Get roster shifts for the week (only manager-planned shifts)
  const startDate = weekDates[0].toISOString().split('T')[0];
  const endDate = weekDates[6].toISOString().split('T')[0];
  
  const { data: shifts = [], isLoading } = useIndividualRosterShifts(startDate, endDate);

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
          <div className="text-slate-500">Loading roster...</div>
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

  return (
    <div className="p-4 lg:p-8">
      <div className="space-y-4 md:space-y-6">
        {/* Mobile Summary Bar */}
        <div className="md:hidden bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-4 border border-blue-100">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-xs text-slate-600 mb-1">Total Hours</div>
              <div className="text-lg font-bold text-slate-900">{totalHours.toFixed(1)}h</div>
            </div>
            <div>
              <div className="text-xs text-slate-600 mb-1">Total Shifts</div>
              <div className="text-lg font-bold text-slate-900">{shifts.length}</div>
            </div>
            <div>
              <div className="text-xs text-slate-600 mb-1">Avg per Day</div>
              <div className="text-lg font-bold text-slate-900">
                {shifts.length > 0 ? (totalHours / 7).toFixed(1) : 0}h
              </div>
            </div>
          </div>
        </div>

        {/* Header with Navigation */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-col md:flex-row md:items-center md:space-x-4">
            <div className="mb-3 md:mb-0">
              <h1 className="text-xl font-semibold text-slate-900">My Roster</h1>
              <p className="text-sm text-slate-600">{formatWeekRange(weekDates)}</p>
              <p className="text-xs text-slate-500 mt-1">Manager-assigned shifts only</p>
            </div>
            
            {/* Navigation - Larger buttons for mobile */}
            <div className="flex items-center space-x-3">
              <Button
                variant="outline"
                size="default"
                data-testid="button-prev-week"
                onClick={() => navigateWeeks('prev')}
                className="min-h-[44px] px-4"
              >
                <ChevronLeft className="h-5 w-5 md:h-4 md:w-4" />
                <span className="ml-2 md:hidden">Previous</span>
              </Button>
              <Button
                variant="outline"
                size="default"
                data-testid="button-next-week"
                onClick={() => navigateWeeks('next')}
                className="min-h-[44px] px-4"
              >
                <ChevronRight className="h-5 w-5 md:h-4 md:w-4" />
                <span className="ml-2 md:hidden">Next</span>
              </Button>
              {!isCurrentWeek() && (
                <Button
                  variant="outline"
                  size="default"
                  data-testid="button-today"
                  onClick={goToCurrentWeek}
                  className="min-h-[44px] px-4"
                >
                  Today
                </Button>
              )}
            </div>
          </div>
          
          {/* Desktop Summary and Add Button */}
          <div className="flex flex-col md:flex-row md:items-center md:space-x-4 gap-3 md:gap-0">
            <div className="hidden md:block text-sm text-slate-600">
              Total Hours: <span className="font-semibold">{totalHours.toFixed(1)}h</span>
            </div>
            <Link href="/add-shift">
              <Button size="default" className="min-h-[44px] w-full md:w-auto" data-testid="button-add-shift">
                <Plus className="h-5 w-5 md:h-4 md:w-4 mr-2" />
                Add Shift
              </Button>
            </Link>
          </div>
        </div>

        {/* Roster Agenda View */}
        <MobileAgendaView 
          weekDates={weekDates}
          shiftsByDate={shiftsByDate}
          onShiftClick={setSelectedShift}
        />

        {/* Shift Details Dialog */}
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
                
                <div className="grid grid-cols-2 gap-4">
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
                
                <div className="grid grid-cols-2 gap-4">
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

        {/* Desktop Summary Stats (hidden on mobile - mobile has summary bar at top) */}
        <div className="hidden md:grid grid-cols-1 md:grid-cols-3 gap-4">
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