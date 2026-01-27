import { useState, useMemo } from "react";
import { useIndividualRosterShifts } from "@/hooks/use-shifts";
import { useTimeOffRequestsByRange, useCreateTimeOffRequest, useUpdateTimeOffRequest, useDeleteTimeOffRequest } from "@/hooks/use-time-off";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Clock, ChevronLeft, ChevronRight, CalendarIcon, User, ChevronDown, MapPin, CheckCircle, AlertCircle, XCircle, Download, Edit3, Phone, CalendarOff, Trash2 } from "lucide-react";
import { formatTime, calculateDuration, formatDateLocal } from "@/lib/time-utils";
import type { Shift, TimeOffRequest } from "@shared/schema";
import { PayBreakdown } from "@/components/PayBreakdown";

// Max weeks to navigate forward
const MAX_WEEKS_FORWARD = 12;

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

// Get shift status based on shift data
const getShiftStatus = (shift: Shift): 'confirmed' | 'pending' | 'conflict' => {
  // A shift is confirmed if it has been approved or if status is 'approved' or 'completed'
  if (shift.status === 'approved' || shift.status === 'completed' || shift.approvedAt) {
    return 'confirmed';
  }
  // A shift is pending if status is 'pending_approval' or 'scheduled'
  if (shift.status === 'pending_approval' || shift.status === 'scheduled') {
    return 'pending';
  }
  // Default to confirmed for roster shifts
  return 'confirmed';
};

// Helper function to get shift color based on status (AC-001-4)
// Verde (confirmado), Amarillo (pendiente), Rojo (conflicto)
const getShiftColorByStatus = (shift: Shift): string => {
  const status = getShiftStatus(shift);
  const statusColors = {
    confirmed: 'bg-green-100 text-green-800 border-green-300',
    pending: 'bg-amber-100 text-amber-800 border-amber-300',
    conflict: 'bg-red-100 text-red-800 border-red-300'
  };
  return statusColors[status];
};

// Get status badge component (AC-001-7)
const ShiftStatusBadge = ({ shift }: { shift: Shift }) => {
  const status = getShiftStatus(shift);

  if (status === 'confirmed') {
    return (
      <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 text-xs">
        <CheckCircle className="h-3 w-3 mr-1" />
        Confirmed
      </Badge>
    );
  }
  if (status === 'pending') {
    return (
      <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 text-xs">
        <AlertCircle className="h-3 w-3 mr-1" />
        Pending
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 text-xs">
      <XCircle className="h-3 w-3 mr-1" />
      Conflict
    </Badge>
  );
};

// Helper function to get shift color based on type (for secondary styling)
const getShiftTypeColor = (shiftType: string): string => {
  const typeColors = {
    morning: 'border-l-emerald-500',
    afternoon: 'border-l-blue-500',
    evening: 'border-l-blue-500',
    night: 'border-l-indigo-500',
    default: 'border-l-gray-500'
  };

  const colorKey = shiftType.toLowerCase() as keyof typeof typeColors;
  return typeColors[colorKey] || typeColors.default;
};

// Generate ICS file content for calendar export (AC-002-3)
const generateIcsFile = (shift: Shift): string => {
  const formatIcsDate = (dateStr: string, timeStr: string): string => {
    const [year, month, day] = dateStr.split('-').map(Number);
    const [hours, minutes] = timeStr.split(':').map(Number);
    const date = new Date(year, month - 1, day, hours, minutes);
    return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  };

  const dtStart = formatIcsDate(shift.date, shift.startTime);
  const dtEnd = formatIcsDate(shift.date, shift.endTime);
  const now = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  const uid = `shift-${shift.id}@shiftmate.app`;

  const summary = `${shift.shiftType.charAt(0).toUpperCase() + shift.shiftType.slice(1)} Shift`;
  const location = shift.location || '';
  const description = shift.notes ? shift.notes.replace(/\n/g, '\\n') : '';

  return `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//ShiftMate//Shift Export//EN
CALSCALE:GREGORIAN
METHOD:PUBLISH
BEGIN:VEVENT
UID:${uid}
DTSTAMP:${now}
DTSTART:${dtStart}
DTEND:${dtEnd}
SUMMARY:${summary}
LOCATION:${location}
DESCRIPTION:${description}
STATUS:CONFIRMED
END:VEVENT
END:VCALENDAR`;
};

// Download ICS file
const downloadIcsFile = (shift: Shift) => {
  const icsContent = generateIcsFile(shift);
  const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `shift-${shift.date}-${shift.shiftType}.ics`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

// Helper to get month dates for monthly view
const getMonthRange = (date: Date): Date[] => {
  const dates: Date[] = [];
  const year = date.getFullYear();
  const month = date.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);

  // Get the Monday before or on the first day of month
  const startDate = new Date(firstDay);
  const dayOfWeek = startDate.getDay();
  startDate.setDate(startDate.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));

  // Generate 6 weeks (42 days) to ensure full coverage
  for (let i = 0; i < 42; i++) {
    dates.push(new Date(startDate));
    startDate.setDate(startDate.getDate() + 1);
  }

  return dates;
};

// Helper to convert time string to minutes from midnight
const timeToMinutes = (time: string): number => {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
};

// Weekly Calendar View - Google Calendar style
const WeeklyCalendarView = ({
  weekDates,
  shiftsByDate,
  timeOffByDate,
  onShiftClick,
  onTimeOffClick,
  onTimeSlotClick
}: {
  weekDates: Date[];
  shiftsByDate: Record<string, Shift[]>;
  timeOffByDate: Record<string, TimeOffRequest[]>;
  onShiftClick: (shift: Shift) => void;
  onTimeOffClick: (request: TimeOffRequest) => void;
  onTimeSlotClick: (dateStr: string, hour: number) => void;
}) => {
  // Calendar hours (6 AM to 11 PM)
  const startHour = 6;
  const endHour = 23;
  const hours = Array.from({ length: endHour - startHour + 1 }, (_, i) => startHour + i);
  const hourHeight = 32; // pixels per hour (matches Calendar page h-8)

  const formatHour = (hour: number) => {
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const h = hour % 12 || 12;
    return `${h} ${ampm}`;
  };

  // Calculate position and height for a shift
  const getShiftStyle = (shift: Shift) => {
    const startMinutes = timeToMinutes(shift.startTime);
    const endMinutes = timeToMinutes(shift.endTime);
    const dayStartMinutes = startHour * 60;

    const top = ((startMinutes - dayStartMinutes) / 60) * hourHeight;
    const height = ((endMinutes - startMinutes) / 60) * hourHeight;

    return {
      top: `${Math.max(0, top)}px`,
      height: `${Math.max(16, height)}px`,
    };
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      {/* Header with days */}
      <div className="grid grid-cols-8 border-b border-slate-200 bg-slate-50 sticky top-0 z-10">
        <div className="p-1 text-xs text-slate-500 font-medium border-r border-slate-200 w-16">
          Time
        </div>
        {weekDates.map(date => {
          const dateStr = formatDateLocal(date);
          const isToday = dateStr === formatDateLocal(new Date());
          const hasTimeOff = (timeOffByDate[dateStr] || []).length > 0;

          return (
            <div
              key={dateStr}
              className={`p-1 text-center border-r border-slate-200 last:border-r-0 ${
                hasTimeOff ? 'bg-purple-50' : isToday ? 'bg-blue-50' : ''
              }`}
            >
              <div className={`text-xs font-medium uppercase ${
                hasTimeOff ? 'text-purple-600' : isToday ? 'text-blue-600' : 'text-slate-500'
              }`}>
                {date.toLocaleDateString('en-US', { weekday: 'short' })}
              </div>
              <div className={`text-lg font-bold ${
                hasTimeOff ? 'text-purple-700' : isToday ? 'text-blue-700' : 'text-slate-900'
              }`}>
                {date.getDate()}
              </div>
              {hasTimeOff && <CalendarOff className="h-3 w-3 mx-auto text-purple-500" />}
            </div>
          );
        })}
      </div>

      {/* Time grid - column-based layout */}
      <div className="flex overflow-y-auto max-h-[576px]">
        {/* Time labels column */}
        <div className="flex-shrink-0 w-16 bg-slate-50">
          {hours.map(hour => (
            <div
              key={hour}
              className="h-8 p-1 text-xs text-slate-500 font-medium border-r border-b border-slate-100"
            >
              {formatHour(hour)}
            </div>
          ))}
        </div>

        {/* Day columns */}
        {weekDates.map(date => {
          const dateStr = formatDateLocal(date);
          const dayShifts = shiftsByDate[dateStr] || [];
          const dayTimeOff = timeOffByDate[dateStr] || [];
          const isToday = dateStr === formatDateLocal(new Date());
          const hasTimeOff = dayTimeOff.length > 0;

          return (
            <div
              key={dateStr}
              className={`flex-1 relative border-r border-slate-200 last:border-r-0 ${
                hasTimeOff
                  ? 'bg-purple-50/50 bg-[repeating-linear-gradient(45deg,transparent,transparent_10px,rgba(147,51,234,0.05)_10px,rgba(147,51,234,0.05)_20px)]'
                  : isToday ? 'bg-blue-50/30' : ''
              }`}
            >
              {/* Hour grid lines */}
              {hours.map(hour => (
                <div
                  key={hour}
                  className="h-8 border-b border-slate-100 hover:bg-slate-50 cursor-pointer transition-colors"
                  onClick={() => onTimeSlotClick(dateStr, hour)}
                />
              ))}

              {/* Time-off overlay */}
              {dayTimeOff.map(request => {
                const isFullDay = request.isFullDay;
                let top = 0;
                let height = hours.length * hourHeight;

                if (!isFullDay && request.startTime && request.endTime) {
                  const startMinutes = timeToMinutes(request.startTime);
                  const endMinutes = timeToMinutes(request.endTime);
                  const dayStartMinutes = startHour * 60;
                  top = ((startMinutes - dayStartMinutes) / 60) * hourHeight;
                  height = ((endMinutes - startMinutes) / 60) * hourHeight;
                }

                return (
                  <div
                    key={`timeoff-${request.id}`}
                    className="absolute left-0 right-0 bg-purple-200/60 border-l-4 border-purple-500 cursor-pointer hover:bg-purple-200/80 transition-colors z-5"
                    style={{ top: `${Math.max(0, top)}px`, height: `${height}px` }}
                    onClick={(e) => {
                      e.stopPropagation();
                      onTimeOffClick(request);
                    }}
                  >
                    <div className="p-1 text-xs text-purple-800 font-medium truncate">
                      Unavailable
                    </div>
                  </div>
                );
              })}

              {/* Shifts */}
              {dayShifts.map((shift, index) => {
                const style = getShiftStyle(shift);
                const status = getShiftStatus(shift);
                const statusColors = {
                  confirmed: 'bg-green-500 border-green-600',
                  pending: 'bg-amber-500 border-amber-600',
                  conflict: 'bg-red-500 border-red-600'
                };

                return (
                  <div
                    key={shift.id}
                    className={`absolute left-0.5 right-0.5 rounded text-xs shadow-sm cursor-pointer hover:shadow-md transition-shadow z-10 overflow-hidden ${statusColors[status]}`}
                    style={{
                      ...style,
                      marginLeft: index > 0 ? `${index * 2}px` : '2px',
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      onShiftClick(shift);
                    }}
                  >
                    <div className="px-1 py-0.5 h-full bg-white/90">
                      <div className="font-medium text-slate-900 truncate capitalize leading-tight">
                        {shift.shiftType}
                      </div>
                      <div className="text-slate-600 leading-tight">
                        {formatTime(shift.startTime)}
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* Current time indicator */}
              {isToday && (() => {
                const now = new Date();
                const currentMinutes = now.getHours() * 60 + now.getMinutes();
                const dayStartMinutes = startHour * 60;
                const dayEndMinutes = endHour * 60;

                if (currentMinutes >= dayStartMinutes && currentMinutes <= dayEndMinutes) {
                  const top = ((currentMinutes - dayStartMinutes) / 60) * hourHeight;
                  return (
                    <div
                      className="absolute left-0 right-0 border-t-2 border-red-500 z-20 pointer-events-none"
                      style={{ top: `${top}px` }}
                    >
                      <div className="absolute -left-1 -top-1.5 w-3 h-3 bg-red-500 rounded-full" />
                    </div>
                  );
                }
                return null;
              })()}
            </div>
          );
        })}
      </div>
    </div>
  );
};

// Mobile agenda view components
const MobileAgendaView = ({
  weekDates,
  shiftsByDate,
  timeOffByDate,
  onShiftClick,
  onTimeOffClick,
  onDateLongPress
}: {
  weekDates: Date[];
  shiftsByDate: Record<string, Shift[]>;
  timeOffByDate: Record<string, TimeOffRequest[]>;
  onShiftClick: (shift: Shift) => void;
  onTimeOffClick: (request: TimeOffRequest) => void;
  onDateLongPress: (dateStr: string) => void;
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
        const dateStr = formatDateLocal(date);
        const dayShifts = shiftsByDate[dateStr] || [];
        const dayTimeOff = timeOffByDate[dateStr] || [];
        const isToday = dateStr === formatDateLocal(new Date());
        const isOpen = openDays.has(dateStr);
        const hasTimeOff = dayTimeOff.length > 0;

        return (
          <Card
            key={dateStr}
            className={`${isToday ? 'ring-2 ring-blue-200 bg-blue-50/30' : ''} ${hasTimeOff ? 'bg-gradient-to-r from-purple-50 to-white border-purple-200' : ''}`}
          >
            <Collapsible open={isOpen} onOpenChange={() => toggleDay(dateStr)}>
              <CollapsibleTrigger asChild>
                <CardHeader
                  className="pb-3 cursor-pointer hover:bg-slate-50 transition-colors"
                  onContextMenu={(e) => {
                    e.preventDefault();
                    onDateLongPress(dateStr);
                  }}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`text-center ${hasTimeOff ? 'text-purple-600' : isToday ? 'text-blue-600' : 'text-slate-600'}`}>
                        <div className="text-xs font-medium uppercase tracking-wide">
                          {date.toLocaleDateString('en-US', { weekday: 'short' })}
                        </div>
                        <div className={`text-lg font-bold ${hasTimeOff ? 'text-purple-600' : isToday ? 'text-blue-600' : 'text-slate-900'}`}>
                          {date.getDate()}
                        </div>
                        {hasTimeOff && <CalendarOff className="h-4 w-4 mx-auto mt-1" />}
                      </div>
                      <div>
                        <h3 className={`font-medium ${hasTimeOff ? 'text-purple-900' : isToday ? 'text-blue-900' : 'text-slate-900'}`}>
                          {date.toLocaleDateString('en-US', {
                            weekday: 'long',
                            month: 'long',
                            day: 'numeric'
                          })}
                        </h3>
                        <p className="text-sm text-slate-600">
                          {hasTimeOff
                            ? 'Unavailable'
                            : dayShifts.length === 0
                              ? 'No shifts'
                              : `${dayShifts.length} shift${dayShifts.length !== 1 ? 's' : ''}`}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {hasTimeOff && (
                        <Badge variant="outline" className="bg-purple-100 text-purple-700 border-purple-300 text-xs">
                          <CalendarOff className="h-3 w-3 mr-1" />
                          {dayTimeOff[0].status === 'approved' ? 'Approved' : dayTimeOff[0].status === 'rejected' ? 'Rejected' : 'Pending'}
                        </Badge>
                      )}
                      {dayShifts.length > 0 && !hasTimeOff && (
                        <div className="text-sm font-medium text-slate-600">
                          {dayShifts.reduce((total, shift) => total + calculateDuration(shift.startTime, shift.endTime), 0).toFixed(1)}h
                        </div>
                      )}
                      <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                    </div>
                  </div>
                </CardHeader>
              </CollapsibleTrigger>
              
              {(dayShifts.length > 0 || hasTimeOff) && (
                <CollapsibleContent>
                  <CardContent className="pt-0 space-y-3">
                    {/* Time-off indicator (AC-003-4) */}
                    {dayTimeOff.map(request => (
                      <div
                        key={`timeoff-${request.id}`}
                        className="p-4 rounded-lg cursor-pointer transition-all hover:shadow-md border-2 border-l-4 border-purple-300 bg-purple-50 bg-[repeating-linear-gradient(45deg,transparent,transparent_10px,rgba(147,51,234,0.1)_10px,rgba(147,51,234,0.1)_20px)]"
                        onClick={() => onTimeOffClick(request)}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-3 flex-1">
                            <CalendarOff className="h-5 w-5 flex-shrink-0 text-purple-600" />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="font-semibold text-base text-purple-800">
                                  Unavailable
                                </span>
                                <Badge
                                  variant="outline"
                                  className={`text-xs ${
                                    request.status === 'approved'
                                      ? 'bg-green-50 text-green-700 border-green-300'
                                      : request.status === 'rejected'
                                        ? 'bg-red-50 text-red-700 border-red-300'
                                        : 'bg-amber-50 text-amber-700 border-amber-300'
                                  }`}
                                >
                                  {request.status === 'approved' ? 'Approved' : request.status === 'rejected' ? 'Rejected' : 'Pending'}
                                </Badge>
                              </div>
                              <div className="text-sm text-purple-700 font-medium">
                                {request.isFullDay
                                  ? 'Full Day'
                                  : `${request.startTime} - ${request.endTime}`}
                              </div>
                              {request.reason && (
                                <div className="text-sm text-purple-600 mt-1 truncate">
                                  {request.reason}
                                </div>
                              )}
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-purple-600 hover:text-purple-800"
                            onClick={(e) => {
                              e.stopPropagation();
                              onTimeOffClick(request);
                            }}
                          >
                            <Edit3 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}

                    {/* Shifts */}
                    {dayShifts.map(shift => {
                      const duration = calculateDuration(shift.startTime, shift.endTime);
                      return (
                        <div
                          key={shift.id}
                          data-testid={`mobile-shift-${shift.id}`}
                          className={`p-4 rounded-lg cursor-pointer transition-all hover:shadow-md border-2 border-l-4 ${getShiftColorByStatus(shift)} ${getShiftTypeColor(shift.shiftType)}`}
                          onClick={() => onShiftClick(shift)}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex items-center gap-3 flex-1">
                              <CalendarIcon className="h-5 w-5 flex-shrink-0" />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="font-semibold text-base capitalize">
                                    {shift.shiftType} Shift
                                  </span>
                                  <ShiftStatusBadge shift={shift} />
                                </div>
                                <div className="text-sm opacity-90 font-medium">
                                  {formatTime(shift.startTime)} - {formatTime(shift.endTime)}
                                </div>
                                {shift.location && (
                                  <div className="text-sm opacity-75 mt-1 flex items-center gap-1">
                                    <MapPin className="h-3 w-3" />
                                    {shift.location}
                                  </div>
                                )}
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

// Monthly calendar view component (AC-001-6)
const MonthlyView = ({
  monthDates,
  shiftsByDate,
  timeOffByDate,
  onShiftClick,
  onTimeOffClick,
  onDateClick,
  currentMonth
}: {
  monthDates: Date[];
  shiftsByDate: Record<string, Shift[]>;
  timeOffByDate: Record<string, TimeOffRequest[]>;
  onShiftClick: (shift: Shift) => void;
  onTimeOffClick: (request: TimeOffRequest) => void;
  onDateClick: (dateStr: string) => void;
  currentMonth: number;
}) => {
  const weekDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      {/* Week day headers */}
      <div className="grid grid-cols-7 border-b border-slate-200">
        {weekDays.map(day => (
          <div key={day} className="text-center py-3 text-sm font-medium text-slate-600 bg-slate-50">
            {day}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7">
        {monthDates.map((date, index) => {
          const dateStr = formatDateLocal(date);
          const dayShifts = shiftsByDate[dateStr] || [];
          const dayTimeOff = timeOffByDate[dateStr] || [];
          const isToday = dateStr === formatDateLocal(new Date());
          const isCurrentMonth = date.getMonth() === currentMonth;
          const hasTimeOff = dayTimeOff.length > 0;

          return (
            <div
              key={index}
              onClick={() => onDateClick(dateStr)}
              className={`min-h-[100px] p-2 border-b border-r border-slate-100 cursor-pointer hover:bg-slate-50 transition-colors ${
                hasTimeOff
                  ? 'bg-purple-50 bg-[repeating-linear-gradient(45deg,transparent,transparent_5px,rgba(147,51,234,0.05)_5px,rgba(147,51,234,0.05)_10px)]'
                  : isToday ? 'bg-blue-50' : isCurrentMonth ? 'bg-white' : 'bg-slate-50'
              }`}
            >
              <div className={`text-sm font-medium mb-1 flex items-center justify-between ${
                hasTimeOff
                  ? 'text-purple-600'
                  : isToday
                    ? 'text-blue-600'
                    : isCurrentMonth
                      ? 'text-slate-900'
                      : 'text-slate-400'
              }`}>
                <span>{date.getDate()}</span>
                {hasTimeOff && <CalendarOff className="h-3 w-3" />}
              </div>
              <div className="space-y-1">
                {/* Time-off indicator */}
                {dayTimeOff.slice(0, 1).map(request => (
                  <div
                    key={`timeoff-${request.id}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onTimeOffClick(request);
                    }}
                    className="text-xs p-1 rounded cursor-pointer truncate border-l-2 bg-purple-100 text-purple-700 border-purple-400"
                  >
                    Unavailable
                  </div>
                ))}
                {/* Shifts */}
                {dayShifts.slice(0, hasTimeOff ? 1 : 2).map(shift => (
                  <div
                    key={shift.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      onShiftClick(shift);
                    }}
                    className={`text-xs p-1 rounded cursor-pointer truncate border-l-2 ${getShiftColorByStatus(shift)} ${getShiftTypeColor(shift.shiftType)}`}
                  >
                    {formatTime(shift.startTime)}
                  </div>
                ))}
                {(dayShifts.length + dayTimeOff.length) > 2 && (
                  <div className="text-xs text-slate-500 pl-1">
                    +{dayShifts.length + dayTimeOff.length - 2} more
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default function MyRoster() {
  const [currentWeekStart, setCurrentWeekStart] = useState(() => getStartOfWeek(new Date()));
  const [selectedShift, setSelectedShift] = useState<Shift | null>(null);
  const [viewMode, setViewMode] = useState<'weekly' | 'monthly'>('weekly');

  // Time-off state (US-003)
  const [timeOffDialogOpen, setTimeOffDialogOpen] = useState(false);
  const [editingTimeOff, setEditingTimeOff] = useState<TimeOffRequest | null>(null);
  const [selectedDates, setSelectedDates] = useState<string[]>([]);
  const [timeOffForm, setTimeOffForm] = useState({
    isFullDay: true,
    startTime: '09:00',
    endTime: '17:00',
    reason: ''
  });

  const { toast } = useToast();

  // Get week date range
  const weekDates = useMemo(() => getWeekRange(currentWeekStart), [currentWeekStart]);

  // Get month dates for monthly view
  const monthDates = useMemo(() => getMonthRange(currentWeekStart), [currentWeekStart]);

  // Calculate max date for 12 weeks limit
  const maxDate = useMemo(() => {
    const max = new Date();
    max.setDate(max.getDate() + (MAX_WEEKS_FORWARD * 7));
    return max;
  }, []);

  // Check if can navigate forward
  const canNavigateForward = useMemo(() => {
    const nextWeekStart = new Date(currentWeekStart);
    nextWeekStart.setDate(nextWeekStart.getDate() + 7);
    return nextWeekStart <= maxDate;
  }, [currentWeekStart, maxDate]);

  // Get roster shifts for the week (only manager-planned shifts)
  const startDate = formatDateLocal(weekDates[0]);
  const endDate = formatDateLocal(weekDates[6]);
  
  const { data: shifts = [], isLoading } = useIndividualRosterShifts(startDate, endDate);

  // Get time-off requests for the date range (US-003)
  const { data: timeOffRequests = [] } = useTimeOffRequestsByRange(startDate, endDate);
  const createTimeOff = useCreateTimeOffRequest();
  const updateTimeOff = useUpdateTimeOffRequest();
  const deleteTimeOff = useDeleteTimeOffRequest();

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

  // Group time-off by date (AC-003-4)
  const timeOffByDate = useMemo(() => {
    const grouped: Record<string, TimeOffRequest[]> = {};
    timeOffRequests.forEach((request) => {
      // Add request to each date in the range
      const start = new Date(request.startDate);
      const end = new Date(request.endDate);
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const dateStr = formatDateLocal(d);
        if (!grouped[dateStr]) {
          grouped[dateStr] = [];
        }
        grouped[dateStr].push(request);
      }
    });
    return grouped;
  }, [timeOffRequests]);

  // Calculate total hours for the week
  const totalHours = useMemo(() => {
    return shifts.reduce((total: number, shift: Shift) => {
      return total + calculateDuration(shift.startTime, shift.endTime);
    }, 0);
  }, [shifts]);

  // Time-off handlers (US-003)
  const handleDateSelect = (dateStr: string) => {
    setSelectedDates(prev => {
      if (prev.includes(dateStr)) {
        return prev.filter(d => d !== dateStr);
      }
      return [...prev, dateStr].sort();
    });
  };

  const openTimeOffDialog = (dates?: string[]) => {
    if (dates && dates.length > 0) {
      setSelectedDates(dates);
    }
    setEditingTimeOff(null);
    setTimeOffForm({
      isFullDay: true,
      startTime: '09:00',
      endTime: '17:00',
      reason: ''
    });
    setTimeOffDialogOpen(true);
  };

  const openEditTimeOff = (request: TimeOffRequest) => {
    setEditingTimeOff(request);
    setSelectedDates([request.startDate]);
    setTimeOffForm({
      isFullDay: request.isFullDay ?? true,
      startTime: request.startTime || '09:00',
      endTime: request.endTime || '17:00',
      reason: request.reason || ''
    });
    setTimeOffDialogOpen(true);
  };

  const handleSaveTimeOff = async () => {
    try {
      if (selectedDates.length === 0) {
        toast({
          title: "Error",
          description: "Please select at least one date",
          variant: "destructive"
        });
        return;
      }

      const sortedDates = [...selectedDates].sort();
      const startDate = sortedDates[0];
      const endDate = sortedDates[sortedDates.length - 1];

      if (editingTimeOff) {
        await updateTimeOff.mutateAsync({
          id: editingTimeOff.id,
          startDate,
          endDate,
          isFullDay: timeOffForm.isFullDay,
          startTime: timeOffForm.isFullDay ? undefined : timeOffForm.startTime,
          endTime: timeOffForm.isFullDay ? undefined : timeOffForm.endTime,
          reason: timeOffForm.reason || undefined
        });
        toast({
          title: "Success",
          description: "Time-off request updated",
        });
      } else {
        await createTimeOff.mutateAsync({
          startDate,
          endDate,
          isFullDay: timeOffForm.isFullDay,
          startTime: timeOffForm.isFullDay ? undefined : timeOffForm.startTime,
          endTime: timeOffForm.isFullDay ? undefined : timeOffForm.endTime,
          reason: timeOffForm.reason || undefined
        });
        toast({
          title: "Success",
          description: "Time-off request created",
        });
      }

      setTimeOffDialogOpen(false);
      setSelectedDates([]);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to save time-off request",
        variant: "destructive"
      });
    }
  };

  const handleDeleteTimeOff = async () => {
    if (!editingTimeOff) return;

    try {
      await deleteTimeOff.mutateAsync(editingTimeOff.id);
      toast({
        title: "Success",
        description: "Time-off request deleted",
      });
      setTimeOffDialogOpen(false);
      setSelectedDates([]);
      setEditingTimeOff(null);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to delete time-off request",
        variant: "destructive"
      });
    }
  };

  const navigateWeeks = (direction: 'prev' | 'next') => {
    const newDate = new Date(currentWeekStart);
    if (viewMode === 'weekly') {
      newDate.setDate(newDate.getDate() + (direction === 'next' ? 7 : -7));
    } else {
      // Monthly navigation
      newDate.setMonth(newDate.getMonth() + (direction === 'next' ? 1 : -1));
    }

    // Check forward limit
    if (direction === 'next' && newDate > maxDate) {
      return; // Don't navigate past 12 weeks
    }

    setCurrentWeekStart(getStartOfWeek(newDate));
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
              <p className="text-sm text-slate-600">
                {viewMode === 'weekly'
                  ? formatWeekRange(weekDates)
                  : currentWeekStart.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
              </p>
              <p className="text-xs text-slate-500 mt-1">Manager-assigned shifts only</p>
            </div>

            {/* View Mode Toggle (AC-001-6) */}
            <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as 'weekly' | 'monthly')} className="w-auto">
              <TabsList className="grid w-full grid-cols-2 h-9">
                <TabsTrigger value="weekly" className="text-xs px-3">Weekly</TabsTrigger>
                <TabsTrigger value="monthly" className="text-xs px-3">Monthly</TabsTrigger>
              </TabsList>
            </Tabs>

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
                disabled={!canNavigateForward}
                title={!canNavigateForward ? `Cannot navigate more than ${MAX_WEEKS_FORWARD} weeks ahead` : undefined}
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
            <Button
                variant="outline"
                size="default"
                className="min-h-[44px]"
                onClick={() => openTimeOffDialog()}
              >
                <CalendarOff className="h-5 w-5 md:h-4 md:w-4 mr-2" />
                Mark Unavailable
              </Button>
          </div>
        </div>

        {/* Color Legend */}
        <div className="flex flex-wrap items-center gap-4 text-xs text-slate-600 bg-slate-50 p-3 rounded-lg">
          <span className="font-medium">Status:</span>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-green-200 border border-green-400"></div>
            <span>Confirmed</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-amber-200 border border-amber-400"></div>
            <span>Pending</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-red-200 border border-red-400"></div>
            <span>Conflict</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-purple-200 border border-purple-400 bg-[repeating-linear-gradient(45deg,transparent,transparent_2px,rgba(147,51,234,0.3)_2px,rgba(147,51,234,0.3)_4px)]"></div>
            <span>Unavailable</span>
          </div>
        </div>

        {/* Roster View - Weekly or Monthly */}
        {viewMode === 'weekly' ? (
          <>
            {/* Desktop: Google Calendar style */}
            <div className="hidden md:block">
              <WeeklyCalendarView
                weekDates={weekDates}
                shiftsByDate={shiftsByDate}
                timeOffByDate={timeOffByDate}
                onShiftClick={setSelectedShift}
                onTimeOffClick={openEditTimeOff}
                onTimeSlotClick={(dateStr, hour) => {
                  setSelectedDates([dateStr]);
                  setTimeOffForm(prev => ({
                    ...prev,
                    isFullDay: false,
                    startTime: `${hour.toString().padStart(2, '0')}:00`,
                    endTime: `${(hour + 1).toString().padStart(2, '0')}:00`
                  }));
                  setTimeOffDialogOpen(true);
                }}
              />
            </div>
            {/* Mobile: Agenda style */}
            <div className="md:hidden">
              <MobileAgendaView
                weekDates={weekDates}
                shiftsByDate={shiftsByDate}
                timeOffByDate={timeOffByDate}
                onShiftClick={setSelectedShift}
                onTimeOffClick={openEditTimeOff}
                onDateLongPress={(dateStr) => openTimeOffDialog([dateStr])}
              />
            </div>
          </>
        ) : (
          <MonthlyView
            monthDates={monthDates}
            shiftsByDate={shiftsByDate}
            timeOffByDate={timeOffByDate}
            onShiftClick={setSelectedShift}
            onTimeOffClick={openEditTimeOff}
            onDateClick={(dateStr) => openTimeOffDialog([dateStr])}
            currentMonth={currentWeekStart.getMonth()}
          />
        )}

        {/* Shift Details Dialog */}
        <Dialog open={!!selectedShift} onOpenChange={() => setSelectedShift(null)}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Shift Details</DialogTitle>
            </DialogHeader>
            {selectedShift && (
              <div className="space-y-4">
                {/* Status Badge and Roster Indicator */}
                <div className="flex items-center gap-2">
                  <ShiftStatusBadge shift={selectedShift} />
                  <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 text-xs">
                    <CalendarIcon className="h-3 w-3 mr-1" />
                    Roster Shift
                  </Badge>
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
                    <div className="text-sm text-slate-900 capitalize">{selectedShift.shiftType}</div>
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

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-slate-600">Duration</label>
                    <div className="text-sm text-slate-900">
                      {calculateDuration(selectedShift.startTime, selectedShift.endTime).toFixed(1)} hours
                    </div>
                  </div>
                  {selectedShift.location && (
                    <div>
                      <label className="text-sm font-medium text-slate-600">Location / Area</label>
                      <div className="text-sm text-slate-900 flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        {selectedShift.location}
                      </div>
                    </div>
                  )}
                </div>

                {/* Pay Breakdown Section */}
                <PayBreakdown shift={selectedShift} />

                {selectedShift.notes && (
                  <div>
                    <label className="text-sm font-medium text-slate-600">Manager Notes</label>
                    <div className="text-sm text-slate-900 bg-slate-50 p-3 rounded-lg mt-1">
                      {selectedShift.notes}
                    </div>
                  </div>
                )}

                {!selectedShift.notes && !selectedShift.location && (
                  <div className="text-sm text-slate-500 italic">
                    No additional details for this shift.
                  </div>
                )}

                {/* Emergency Contact Section (AC-002-5) */}
                <div className="border-t pt-4">
                  <label className="text-sm font-medium text-slate-600 flex items-center gap-1">
                    <Phone className="h-3 w-3" />
                    Emergency Contact
                  </label>
                  <div className="text-sm text-slate-900 bg-amber-50 p-3 rounded-lg mt-1 border border-amber-200">
                    <div className="font-medium">Manager on Duty</div>
                    <div className="text-slate-600">Contact your manager for urgent shift issues</div>
                  </div>
                </div>

                {/* Action Buttons (AC-002-3 & AC-002-4) */}
                <div className="flex flex-col sm:flex-row gap-2 pt-2 border-t">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => downloadIcsFile(selectedShift)}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Add to Calendar
                  </Button>
                  <Button
                    variant="outline"
                    className="flex-1 text-amber-700 border-amber-300 hover:bg-amber-50"
                    onClick={() => {
                      // TODO: Implement modification request (US-010)
                      alert('Modification request feature coming soon. Please contact your manager directly for now.');
                    }}
                  >
                    <Edit3 className="h-4 w-4 mr-2" />
                    Request Change
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Time-Off Request Dialog (US-003) */}
        <Dialog open={timeOffDialogOpen} onOpenChange={setTimeOffDialogOpen}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>
                {editingTimeOff ? 'Edit Time Off' : 'Mark Unavailable'}
              </DialogTitle>
              <DialogDescription>
                {editingTimeOff
                  ? 'Update your unavailability request'
                  : 'Select dates when you are not available to work'}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              {/* Date Selection (AC-003-1) */}
              <div className="space-y-2">
                <Label>Selected Dates</Label>
                {selectedDates.length === 0 ? (
                  <div className="text-sm text-slate-500 italic p-3 bg-slate-50 rounded-lg">
                    Click on dates in the calendar to select them, or enter dates below.
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {selectedDates.map(date => (
                      <Badge
                        key={date}
                        variant="outline"
                        className="bg-purple-50 text-purple-700 border-purple-300"
                      >
                        {new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        <button
                          className="ml-1 hover:text-purple-900"
                          onClick={() => setSelectedDates(prev => prev.filter(d => d !== date))}
                        >
                          ×
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs">Start Date</Label>
                    <Input
                      type="date"
                      value={selectedDates[0] || ''}
                      onChange={(e) => {
                        const newDate = e.target.value;
                        if (newDate) {
                          setSelectedDates(prev => {
                            if (prev.length === 0) return [newDate];
                            return [newDate, ...prev.slice(1)].sort();
                          });
                        }
                      }}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">End Date</Label>
                    <Input
                      type="date"
                      value={selectedDates[selectedDates.length - 1] || ''}
                      onChange={(e) => {
                        const newDate = e.target.value;
                        if (newDate && selectedDates.length > 0) {
                          const start = selectedDates[0];
                          const dates: string[] = [];
                          const current = new Date(start);
                          const end = new Date(newDate);
                          while (current <= end) {
                            dates.push(formatDateLocal(current));
                            current.setDate(current.getDate() + 1);
                          }
                          setSelectedDates(dates);
                        } else if (newDate) {
                          setSelectedDates([newDate]);
                        }
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* Full Day Toggle (AC-003-2) */}
              <div className="flex items-center justify-between">
                <Label htmlFor="fullDay">Full Day</Label>
                <Switch
                  id="fullDay"
                  checked={timeOffForm.isFullDay}
                  onCheckedChange={(checked) =>
                    setTimeOffForm(prev => ({ ...prev, isFullDay: checked }))
                  }
                />
              </div>

              {/* Time Range (AC-003-2) */}
              {!timeOffForm.isFullDay && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="startTime">Start Time</Label>
                    <Input
                      id="startTime"
                      type="time"
                      value={timeOffForm.startTime}
                      onChange={(e) =>
                        setTimeOffForm(prev => ({ ...prev, startTime: e.target.value }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="endTime">End Time</Label>
                    <Input
                      id="endTime"
                      type="time"
                      value={timeOffForm.endTime}
                      onChange={(e) =>
                        setTimeOffForm(prev => ({ ...prev, endTime: e.target.value }))
                      }
                    />
                  </div>
                </div>
              )}

              {/* Reason (AC-003-3) */}
              <div className="space-y-2">
                <Label htmlFor="reason">Reason (Optional)</Label>
                <Textarea
                  id="reason"
                  placeholder="Why are you unavailable? (e.g., vacation, appointment, personal)"
                  value={timeOffForm.reason}
                  onChange={(e) =>
                    setTimeOffForm(prev => ({ ...prev, reason: e.target.value.slice(0, 500) }))
                  }
                  className="resize-none"
                  rows={3}
                />
                <div className="text-xs text-slate-500 text-right">
                  {timeOffForm.reason.length}/500 characters
                </div>
              </div>

              {/* Status indicator for existing requests */}
              {editingTimeOff && (
                <div className="p-3 bg-slate-50 rounded-lg">
                  <div className="text-sm">
                    <span className="text-slate-600">Status: </span>
                    <Badge
                      variant="outline"
                      className={
                        editingTimeOff.status === 'approved'
                          ? 'bg-green-50 text-green-700 border-green-300'
                          : editingTimeOff.status === 'rejected'
                            ? 'bg-red-50 text-red-700 border-red-300'
                            : 'bg-amber-50 text-amber-700 border-amber-300'
                      }
                    >
                      {editingTimeOff.status === 'approved'
                        ? 'Approved'
                        : editingTimeOff.status === 'rejected'
                          ? 'Rejected'
                          : 'Pending'}
                    </Badge>
                  </div>
                  {editingTimeOff.rejectionReason && (
                    <div className="mt-2 text-sm text-red-600">
                      <span className="font-medium">Rejection reason: </span>
                      {editingTimeOff.rejectionReason}
                    </div>
                  )}
                </div>
              )}
            </div>

            <DialogFooter className="flex-col sm:flex-row gap-2">
              {editingTimeOff && editingTimeOff.status === 'pending' && (
                <Button
                  variant="destructive"
                  onClick={handleDeleteTimeOff}
                  disabled={deleteTimeOff.isPending}
                  className="sm:mr-auto"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </Button>
              )}
              <Button
                variant="outline"
                onClick={() => {
                  setTimeOffDialogOpen(false);
                  setSelectedDates([]);
                  setEditingTimeOff(null);
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={handleSaveTimeOff}
                disabled={
                  createTimeOff.isPending ||
                  updateTimeOff.isPending ||
                  selectedDates.length === 0 ||
                  !!(editingTimeOff && editingTimeOff.status !== 'pending')
                }
              >
                {createTimeOff.isPending || updateTimeOff.isPending
                  ? 'Saving...'
                  : editingTimeOff
                    ? 'Update'
                    : 'Save'}
              </Button>
            </DialogFooter>
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