import { useState, useEffect, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Clock, History, TrendingUp, AlertTriangle, Plus, Play, Square, Edit, Check, X, Trash2, BarChart3 } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LabelList } from "recharts";
import { useShifts, useWeeklyHours, useCreateShift, useUpdateShift, useDeleteShift } from "@/hooks/use-shifts";
import { getWeekDates, formatTime, calculateDuration, generateTimeOptions } from "@/lib/time-utils";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { useTimer } from "@/hooks/use-timer";

export default function Dashboard() {
  const currentWeek = getWeekDates(new Date());
  const previousWeekStart = new Date(currentWeek.start);
  previousWeekStart.setDate(previousWeekStart.getDate() - 7);
  const previousWeekEnd = new Date(currentWeek.end);
  previousWeekEnd.setDate(previousWeekEnd.getDate() - 7);
  
  const previousWeek = {
    start: previousWeekStart.toISOString().split('T')[0],
    end: previousWeekEnd.toISOString().split('T')[0]
  };

  // Use global timer hook
  const { isActive: isShiftActive, startTime: shiftStartTime, elapsedTime, startTimer, stopTimer } = useTimer();
  
  // Post-shift confirmation dialog state
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [pendingShiftData, setPendingShiftData] = useState<any>(null);
  const [editableShift, setEditableShift] = useState<any>(null);
  
  // Edit shift modal state
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [shiftToEdit, setShiftToEdit] = useState<any>(null);

  const { data: recentShifts, isLoading: shiftsLoading } = useShifts();
  const { data: thisWeekHours, isLoading: thisWeekLoading } = useWeeklyHours(currentWeek.start, currentWeek.end);
  const { data: lastWeekHours, isLoading: lastWeekLoading } = useWeeklyHours(previousWeek.start, previousWeek.end);
  const createShiftMutation = useCreateShift();
  const updateShiftMutation = useUpdateShift();
  const deleteShiftMutation = useDeleteShift();
  const { toast } = useToast();

  const recentShiftsToShow = useMemo(() => {
    return recentShifts?.slice(0, 3) || [];
  }, [recentShifts]);

  // Prepare weekly chart data
  const weeklyChartData = useMemo(() => {
    if (!recentShifts) return [];

    const daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    const weekStart = new Date(currentWeek.start);
    
    return daysOfWeek.map((day, index) => {
      const currentDate = new Date(weekStart);
      currentDate.setDate(weekStart.getDate() + index);
      const dateString = currentDate.toISOString().split('T')[0];
      
      // Filter shifts for this specific day
      const dayShifts = recentShifts.filter(shift => shift.date === dateString);
      
      // Calculate total hours and create shift data for stacking
      const totalHours = dayShifts.reduce((sum, shift) => 
        sum + calculateDuration(shift.startTime, shift.endTime), 0);
      
      // Group shifts by type and calculate hours for each type
      const shiftTypeHours = {
        morningHours: 0,
        eveningHours: 0,
        nightHours: 0,
        doubleHours: 0,
        customHours: 0
      };
      
      dayShifts.forEach((shift) => {
        const duration = Number(calculateDuration(shift.startTime, shift.endTime).toFixed(2));
        switch (shift.shiftType) {
          case 'morning':
            shiftTypeHours.morningHours += duration;
            break;
          case 'evening':
            shiftTypeHours.eveningHours += duration;
            break;
          case 'night':
            shiftTypeHours.nightHours += duration;
            break;
          case 'double':
            shiftTypeHours.doubleHours += duration;
            break;
          case 'custom':
            shiftTypeHours.customHours += duration;
            break;
        }
      });
      
      // Round all shift type hours to 2 decimal places
      Object.keys(shiftTypeHours).forEach(key => {
        shiftTypeHours[key as keyof typeof shiftTypeHours] = Number(
          shiftTypeHours[key as keyof typeof shiftTypeHours].toFixed(2)
        );
      });
      
      // Format day with date for better clarity
      const dayWithDate = `${day.slice(0, 3)} ${currentDate.getMonth() + 1}/${currentDate.getDate()}`;
      
      return {
        day: dayWithDate, // Short day names with date
        fullDay: day,
        date: dateString,
        totalHours: Number(totalHours.toFixed(2)),
        shiftsCount: dayShifts.length,
        shifts: dayShifts,
        ...shiftTypeHours
      };
    });
  }, [recentShifts, currentWeek.start]);

  // Get unique shift colors based on type
  const getShiftColor = (shiftType: string) => {
    const colors = {
      morning: '#10b981', // emerald-500
      evening: '#f59e0b', // amber-500
      night: '#6366f1',   // indigo-500
      double: '#ef4444',  // red-500
      custom: '#8b5cf6'   // violet-500
    };
    return colors[shiftType as keyof typeof colors] || '#6b7280';
  };

  const formatElapsedTime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const roundToNearestQuarter = (minutes: number): number => {
    return Math.round(minutes / 15) * 15;
  };

  const roundStartTimeToQuarter = (date: Date): string => {
    const hours = date.getHours();
    const minutes = date.getMinutes();
    // Round DOWN to nearest quarter for start time
    const roundedMinutes = Math.floor(minutes / 15) * 15;
    
    return `${hours.toString().padStart(2, '0')}:${roundedMinutes.toString().padStart(2, '0')}`;
  };

  const roundEndTimeToQuarter = (date: Date): string => {
    const hours = date.getHours();
    const minutes = date.getMinutes();
    
    // End time rounding logic:
    // Minutes 0-7 → rounds to 0
    // Minutes 8-22 → rounds to 15
    // Minutes 23-37 → rounds to 30
    // Minutes 38-52 → rounds to 45
    // Minutes 53-59 → rounds to 0 (next hour)
    let roundedMinutes;
    if (minutes <= 7) {
      roundedMinutes = 0;
    } else if (minutes <= 22) {
      roundedMinutes = 15;
    } else if (minutes <= 37) {
      roundedMinutes = 30;
    } else if (minutes <= 52) {
      roundedMinutes = 45;
    } else {
      roundedMinutes = 0;
    }
    
    let finalHours = hours;
    let finalMinutes = roundedMinutes;
    
    // If rounded to 0 and original minutes were 53-59, move to next hour
    if (minutes >= 53 && roundedMinutes === 0) {
      finalHours += 1;
    }
    
    if (finalHours >= 24) {
      finalHours = 0;
    }
    
    return `${finalHours.toString().padStart(2, '0')}:${finalMinutes.toString().padStart(2, '0')}`;
  };

  const determineShiftType = (startTime: Date): string => {
    const hour = startTime.getHours();
    const minute = startTime.getMinutes();
    const totalMinutes = hour * 60 + minute;
    
    // 5:00 AM - 11:00 AM: Morning shift
    if (totalMinutes >= 300 && totalMinutes <= 660) {
      return 'morning';
    }
    // 11:01 AM - 4:00 PM: Evening shift  
    else if (totalMinutes >= 661 && totalMinutes <= 960) {
      return 'evening';
    }
    // 4:01 PM - 4:59 AM: Night shift
    else {
      return 'night';
    }
  };

  const handleStartShift = () => {
    startTimer();
  };

  const handleEndShift = async () => {
    if (!shiftStartTime) {
      console.error('No shift start time found');
      toast({
        title: "Error",
        description: "No active shift found to end.",
        variant: "destructive",
      });
      return;
    }
    
    const endTime = new Date();
    const totalMinutes = Math.floor((endTime.getTime() - shiftStartTime.getTime()) / 60000);
    
    console.log('Shift duration:', totalMinutes, 'minutes');
    console.log('Shift start time:', shiftStartTime);
    console.log('Shift end time:', endTime);
    
    // Validate minimum shift duration (1 minute)
    if (totalMinutes < 1) {
      toast({
        title: "Shift too short",
        description: "Minimum shift duration is 1 minute.",
        variant: "destructive",
      });
      return;
    }
    
    const roundedMinutes = roundToNearestQuarter(totalMinutes);
    
    // Use actual start and end times from the timer with quarter-hour rounding
    const startTimeStr = roundStartTimeToQuarter(shiftStartTime);
    const endTimeStr = roundEndTimeToQuarter(endTime);
    
    const shiftType = determineShiftType(shiftStartTime);
    const shiftDate = shiftStartTime.toISOString().split('T')[0];
    
    const shiftData = {
      date: shiftDate,
      startTime: startTimeStr,
      endTime: endTimeStr,
      shiftType: shiftType,
      notes: '',
      duration: (roundedMinutes / 60).toFixed(2)
    };
    
    console.log('Preparing shift confirmation with data:', shiftData);
    
    // Show confirmation dialog instead of immediately creating shift
    setPendingShiftData(shiftData);
    setEditableShift({ ...shiftData });
    setShowConfirmDialog(true);
    
    // Stop the timer since shift is being processed
    stopTimer();
  };

  const handleConfirmShift = async () => {
    if (!editableShift) return;
    
    try {
      const { duration, ...shiftToCreate } = editableShift;
      await createShiftMutation.mutateAsync(shiftToCreate);
      
      toast({
        title: "Shift recorded",
        description: `${editableShift.shiftType.charAt(0).toUpperCase() + editableShift.shiftType.slice(1)} shift created - ${duration} hours`,
      });
      
      setShowConfirmDialog(false);
      setPendingShiftData(null);
      setEditableShift(null);
      
    } catch (error) {
      console.error('Failed to create shift:', error);
      toast({
        title: "Error",
        description: "Failed to save shift",
        variant: "destructive",
      });
    }
  };

  const handleCancelShift = () => {
    setShowConfirmDialog(false);
    setPendingShiftData(null);
    setEditableShift(null);
    
    toast({
      title: "Shift cancelled",
      description: "Timer reset to 00:00:00",
    });
  };

  const handleDeletePendingShift = () => {
    setShowConfirmDialog(false);
    setPendingShiftData(null);
    setEditableShift(null);
    
    toast({
      title: "Shift deleted",
      description: "Timer reset to 00:00:00",
    });
  };

  const timeOptions = generateTimeOptions();

  // Handle opening edit modal
  const handleEditShift = (shift: any) => {
    setShiftToEdit(shift);
    setShowEditDialog(true);
  };

  // Handle updating shift
  const handleUpdateShift = async (updatedData: any) => {
    if (!shiftToEdit) return;
    
    try {
      await updateShiftMutation.mutateAsync({ id: shiftToEdit.id, ...updatedData });
      toast({
        title: "Success",
        description: "Shift updated successfully!",
      });
      setShowEditDialog(false);
      setShiftToEdit(null);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update shift. Please try again.",
        variant: "destructive",
      });
    }
  };

  // Handle deleting existing shift from edit modal
  const handleDeleteExistingShift = async () => {
    if (!shiftToEdit) return;
    
    try {
      await deleteShiftMutation.mutateAsync(shiftToEdit.id);
      toast({
        title: "Success",
        description: "Shift deleted successfully!",
      });
      setShowEditDialog(false);
      setShiftToEdit(null);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete shift. Please try again.",
        variant: "destructive",
      });
    }
  };

  const shiftTypeColors = {
    morning: 'bg-emerald-500',
    evening: 'bg-blue-500',
    night: 'bg-purple-500',
    double: 'bg-amber-500',
    custom: 'bg-gray-500',
  };

  const alerts = useMemo(() => {
    const alertList = [];
    
    // Find next upcoming shift
    if (recentShifts && recentShifts.length > 0) {
      const today = new Date().toISOString().split('T')[0];
      const upcomingShifts = recentShifts
        .filter(shift => shift.date >= today)
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      
      if (upcomingShifts.length > 0) {
        const nextShift = upcomingShifts[0];
        const shiftDate = new Date(nextShift.date);
        const isToday = nextShift.date === today;
        const isTomorrow = new Date(nextShift.date).getTime() === new Date(today).getTime() + 24 * 60 * 60 * 1000;
        
        let dateText = shiftDate.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
        if (isToday) dateText = 'Today';
        if (isTomorrow) dateText = 'Tomorrow';
        
        alertList.push({
          type: 'info',
          icon: Clock,
          title: 'Next Shift',
          description: `${dateText} • ${formatTime(nextShift.startTime)} - ${formatTime(nextShift.endTime)} (${nextShift.shiftType})`,
          bgColor: 'bg-blue-50',
          borderColor: 'border-blue-200',
          textColor: 'text-blue-900',
          descColor: 'text-blue-700'
        });
      }
    }

    // Check for long shifts (12+ hours)
    if (recentShifts) {
      const longShifts = recentShifts.filter(shift => 
        calculateDuration(shift.startTime, shift.endTime) >= 12
      );
      
      if (longShifts.length > 0) {
        alertList.push({
          type: 'warning',
          icon: Clock,
          title: 'Long Shift Alert',
          description: `${longShifts.length} shift(s) over 12 hours`,
          bgColor: 'bg-amber-50',
          borderColor: 'border-amber-200',
          textColor: 'text-amber-900',
          descColor: 'text-amber-700'
        });
      }
    }

    return alertList;
  }, [recentShifts]);

  return (
    <div className="p-4 lg:p-8">
      {/* Add Manual Shift - Featured Button */}
      <div className="mb-8">
        <Link href="/add-shift">
          <Button size="lg" className="w-full text-lg px-8 py-4 h-auto touch-target">
            <Plus className="h-6 w-6 mr-3" />
            Add Manual Shift
          </Button>
        </Link>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-600">This Week Hours</p>
                {thisWeekLoading ? (
                  <Skeleton className="h-8 w-16 mt-1" />
                ) : (
                  <p className="text-4xl font-bold text-blue-600">
                    {thisWeekHours?.toFixed(1) || "0"}h
                  </p>
                )}
              </div>
              <div className="w-16 h-16 bg-blue-100 rounded-xl flex items-center justify-center">
                <Clock className="h-8 w-8 text-blue-600" />
              </div>
            </div>
            <div className="mt-4 flex items-center text-sm">
              <span className="text-slate-600">Current week total</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-600">
                  Shift Timer {isShiftActive && <span className="text-green-600 animate-pulse">• Running</span>}
                </p>
                <p className={`text-4xl font-bold tabular-nums ${isShiftActive ? 'text-green-600' : 'text-slate-900'}`}>
                  {isShiftActive ? formatElapsedTime(elapsedTime) : "00:00:00"}
                </p>
              </div>
              <div className={`w-16 h-16 rounded-full flex items-center justify-center touch-target ${
                isShiftActive ? 'bg-red-100 animate-pulse' : 'bg-green-100'
              }`}>
                {isShiftActive ? (
                  <Square className="h-8 w-8 text-red-600" />
                ) : (
                  <Play className="h-8 w-8 text-green-600" />
                )}
              </div>
            </div>
            <div className="mt-6 space-y-3">
              <Button 
                onClick={isShiftActive ? handleEndShift : handleStartShift}
                variant={isShiftActive ? "destructive" : "default"}
                size="lg"
                className="w-full h-14 text-lg touch-target no-callout"
                disabled={createShiftMutation.isPending}
              >
                {createShiftMutation.isPending 
                  ? "Creating shift..." 
                  : isShiftActive 
                    ? "End Shift" 
                    : "Start Shift"
                }
              </Button>
              {isShiftActive && (
                <Button 
                  onClick={stopTimer}
                  variant="outline"
                  size="lg"
                  className="w-full h-12 text-base touch-target"
                >
                  Cancel Shift
                </Button>
              )}
            </div>
            {isShiftActive && shiftStartTime && (
              <div className="mt-3 p-2 bg-green-50 rounded-lg text-sm text-green-700 text-center">
                Started at {shiftStartTime.toLocaleTimeString('en-US', { 
                  hour: '2-digit', 
                  minute: '2-digit' 
                })}
              </div>
            )}
          </CardContent>
        </Card>

      </div>

      <div className="space-y-8">
        {/* Weekly Hours Chart */}
        <div>
          <Card>
            <div className="p-6 border-b border-slate-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                    <BarChart3 className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900">This Week's Hours</h3>
                    <p className="text-sm text-slate-500">Daily breakdown of your shifts</p>
                  </div>
                </div>
              </div>
            </div>
            <CardContent className="p-6">
              {shiftsLoading ? (
                <div className="h-64 flex items-center justify-center">
                  <Skeleton className="h-48 w-full" />
                </div>
              ) : weeklyChartData.length > 0 ? (
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={weeklyChartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis 
                        dataKey="day" 
                        tick={{ fontSize: 12, fill: '#64748b' }}
                        tickLine={{ stroke: '#cbd5e1' }}
                      />
                      <YAxis 
                        tick={{ fontSize: 12, fill: '#64748b' }}
                        tickLine={{ stroke: '#cbd5e1' }}
                        label={{ value: 'Hours', angle: -90, position: 'insideLeft', style: { textAnchor: 'middle', fontSize: '12px', fill: '#64748b' } }}
                      />
                      <Tooltip
                        content={({ active, payload, label }) => {
                          if (active && payload && payload.length) {
                            const data = payload[0].payload;
                            return (
                              <div className="bg-white p-3 border border-slate-200 rounded-lg shadow-lg">
                                <p className="font-semibold text-slate-900">{data.fullDay}</p>
                                <p className="text-sm text-slate-600 mb-2">{new Date(data.date).toLocaleDateString()}</p>
                                {data.shiftsCount > 0 ? (
                                  <div className="space-y-1">
                                    <p className="text-sm font-medium text-slate-900">
                                      Total: {data.totalHours} hours ({data.shiftsCount} shift{data.shiftsCount > 1 ? 's' : ''})
                                    </p>
                                    <div className="space-y-1 mt-2">
                                      {data.morningHours > 0 && (
                                        <div className="flex items-center gap-2 text-xs">
                                          <div className="w-3 h-3 rounded-full bg-emerald-500"></div>
                                          <span>Morning: {data.morningHours} hours</span>
                                        </div>
                                      )}
                                      {data.eveningHours > 0 && (
                                        <div className="flex items-center gap-2 text-xs">
                                          <div className="w-3 h-3 rounded-full bg-amber-500"></div>
                                          <span>Evening: {data.eveningHours} hours</span>
                                        </div>
                                      )}
                                      {data.nightHours > 0 && (
                                        <div className="flex items-center gap-2 text-xs">
                                          <div className="w-3 h-3 rounded-full bg-indigo-500"></div>
                                          <span>Night: {data.nightHours} hours</span>
                                        </div>
                                      )}
                                      {data.doubleHours > 0 && (
                                        <div className="flex items-center gap-2 text-xs">
                                          <div className="w-3 h-3 rounded-full bg-red-500"></div>
                                          <span>Double: {data.doubleHours} hours</span>
                                        </div>
                                      )}
                                      {data.customHours > 0 && (
                                        <div className="flex items-center gap-2 text-xs">
                                          <div className="w-3 h-3 rounded-full bg-violet-500"></div>
                                          <span>Custom: {data.customHours} hours</span>
                                        </div>
                                      )}
                                    </div>
                                    {data.shifts && data.shifts.length > 0 && (
                                      <div className="mt-2 pt-2 border-t border-slate-200">
                                        <p className="text-xs font-medium text-slate-700 mb-1">Individual Shifts:</p>
                                        {data.shifts.map((shift: any, index: number) => (
                                          <div key={shift.id} className="text-xs text-slate-600 bg-slate-50 p-1.5 rounded mb-1">
                                            <div className="font-medium capitalize">{shift.shiftType}</div>
                                            <div>{formatTime(shift.startTime)} - {formatTime(shift.endTime)}</div>
                                            <div>{calculateDuration(shift.startTime, shift.endTime).toFixed(2)} hours</div>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                ) : (
                                  <p className="text-sm text-slate-500">No shifts</p>
                                )}
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      {/* Render separate bars for each shift type */}
                      <Bar dataKey="morningHours" stackId="shifts" fill="#10b981" name="Morning Shifts" />
                      <Bar dataKey="eveningHours" stackId="shifts" fill="#f59e0b" name="Evening Shifts" />
                      <Bar dataKey="nightHours" stackId="shifts" fill="#6366f1" name="Night Shifts" />
                      <Bar dataKey="doubleHours" stackId="shifts" fill="#ef4444" name="Double Shifts" />
                      <Bar dataKey="customHours" stackId="shifts" fill="#8b5cf6" name="Custom Shifts">
                        <LabelList 
                          dataKey="totalHours" 
                          position="top" 
                          style={{ 
                            fontSize: '12px', 
                            fontWeight: '600',
                            fill: '#374151'
                          }}
                          formatter={(value: number) => value > 0 ? `${value}h` : ''}
                        />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-64 flex items-center justify-center text-slate-500">
                  <div className="text-center">
                    <BarChart3 className="h-12 w-12 mx-auto mb-3 text-slate-300" />
                    <p className="text-sm">No shifts recorded this week</p>
                    <p className="text-xs text-slate-400 mt-1">Start tracking your shifts to see the chart</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Recent Shifts */}
        <div>
          <Card>
            <div className="p-6 border-b border-slate-200">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-slate-900">Recent Shifts</h3>
                <Link href="/shifts">
                  <Button variant="ghost" size="sm">
                    View All
                  </Button>
                </Link>
              </div>
            </div>
            <div className="divide-y divide-slate-200">
              {shiftsLoading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="p-6 flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <Skeleton className="w-3 h-3 rounded-full" />
                      <div>
                        <Skeleton className="h-4 w-24 mb-1" />
                        <Skeleton className="h-3 w-20" />
                      </div>
                    </div>
                    <div className="text-right">
                      <Skeleton className="h-4 w-32 mb-1" />
                      <Skeleton className="h-3 w-16" />
                    </div>
                  </div>
                ))
              ) : recentShiftsToShow.length > 0 ? (
                recentShiftsToShow.map((shift) => (
                  <div key={shift.id} className="p-6 flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <div className={`w-3 h-3 rounded-full ${
                        shiftTypeColors[shift.shiftType as keyof typeof shiftTypeColors] || 'bg-gray-500'
                      }`}></div>
                      <div>
                        <p className="font-medium text-slate-900 capitalize">
                          {shift.shiftType} Shift
                        </p>
                        <p className="text-sm text-slate-500">
                          {new Date(shift.date).toLocaleDateString('en-US', { 
                            month: 'short', 
                            day: 'numeric', 
                            year: 'numeric' 
                          })}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-4">
                      <div className="text-right">
                        <p className="font-medium text-slate-900">
                          {formatTime(shift.startTime)} - {formatTime(shift.endTime)}
                        </p>
                        <p className="text-sm text-slate-500">
                          {calculateDuration(shift.startTime, shift.endTime).toFixed(2)} hours
                        </p>
                      </div>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="touch-target"
                        onClick={() => handleEditShift(shift)}
                      >
                        <Edit className="h-5 w-5" />
                      </Button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-6 text-center text-slate-500">
                  No shifts recorded yet
                </div>
              )}
            </div>
          </Card>
        </div>

        {/* Alerts */}
        <div className="space-y-6">
          <Card>
            <CardContent className="p-6">
              <h3 className="text-lg font-semibold text-slate-900 mb-4">Alerts</h3>
              <div className="space-y-3">
                {alerts.length > 0 ? (
                  alerts.map((alert, index) => {
                    const Icon = alert.icon;
                    return (
                      <div
                        key={index}
                        className={`flex items-start space-x-3 p-3 rounded-lg border ${alert.bgColor} ${alert.borderColor}`}
                      >
                        <Icon className={`h-4 w-4 mt-0.5 ${alert.textColor.replace('text-', 'text-').replace('-900', '-500')}`} />
                        <div>
                          <p className={`text-sm font-medium ${alert.textColor}`}>
                            {alert.title}
                          </p>
                          <p className={`text-xs ${alert.descColor}`}>
                            {alert.description}
                          </p>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="text-sm text-slate-500 text-center py-4">
                    No alerts at this time
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Shift Confirmation Dialog */}
      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Confirm Shift Details</DialogTitle>
          </DialogHeader>
          
          {editableShift && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="shift-date">Date</Label>
                  <Input
                    id="shift-date"
                    type="date"
                    value={editableShift.date}
                    onChange={(e) => setEditableShift({...editableShift, date: e.target.value})}
                  />
                </div>
                <div>
                  <Label htmlFor="shift-type">Shift Type</Label>
                  <Select
                    value={editableShift.shiftType}
                    onValueChange={(value) => setEditableShift({...editableShift, shiftType: value})}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="morning">Morning</SelectItem>
                      <SelectItem value="evening">Evening</SelectItem>
                      <SelectItem value="night">Night</SelectItem>
                      <SelectItem value="double">Double</SelectItem>
                      <SelectItem value="custom">Custom</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="start-time">Start Time</Label>
                  <Select
                    value={editableShift.startTime}
                    onValueChange={(value) => setEditableShift({...editableShift, startTime: value})}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {timeOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="end-time">End Time</Label>
                  <Select
                    value={editableShift.endTime}
                    onValueChange={(value) => setEditableShift({...editableShift, endTime: value})}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {timeOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label htmlFor="shift-notes">Notes (Optional)</Label>
                <Textarea
                  id="shift-notes"
                  placeholder="Add notes about this shift..."
                  value={editableShift.notes}
                  onChange={(e) => setEditableShift({...editableShift, notes: e.target.value})}
                  rows={3}
                />
              </div>

              <div className="p-3 bg-slate-50 rounded-lg">
                <div className="text-sm text-slate-600">Duration: <span className="font-semibold">{editableShift.duration} hours</span></div>
                <div className="text-sm text-slate-600">Type: <span className="font-semibold capitalize">{editableShift.shiftType}</span></div>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={handleDeletePendingShift}
              className="flex items-center gap-2"
            >
              <Trash2 className="h-4 w-4" />
              Delete
            </Button>
            <Button
              onClick={handleConfirmShift}
              disabled={createShiftMutation.isPending}
              className="flex items-center gap-2"
            >
              <Check className="h-4 w-4" />
              {createShiftMutation.isPending ? "Saving..." : "Confirm"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Shift Modal */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Shift</DialogTitle>
          </DialogHeader>
          
          {shiftToEdit && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="edit-shift-date">Date</Label>
                  <Input
                    id="edit-shift-date"
                    type="date"
                    defaultValue={shiftToEdit.date}
                    onChange={(e) => setShiftToEdit({...shiftToEdit, date: e.target.value})}
                  />
                </div>
                <div>
                  <Label htmlFor="edit-shift-type">Shift Type</Label>
                  <Select
                    value={shiftToEdit.shiftType}
                    onValueChange={(value) => setShiftToEdit({...shiftToEdit, shiftType: value})}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="morning">Morning</SelectItem>
                      <SelectItem value="evening">Evening</SelectItem>
                      <SelectItem value="night">Night</SelectItem>
                      <SelectItem value="double">Double</SelectItem>
                      <SelectItem value="custom">Custom</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="edit-start-time">Start Time</Label>
                  <Select
                    value={shiftToEdit.startTime}
                    onValueChange={(value) => setShiftToEdit({...shiftToEdit, startTime: value})}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {timeOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="edit-end-time">End Time</Label>
                  <Select
                    value={shiftToEdit.endTime}
                    onValueChange={(value) => setShiftToEdit({...shiftToEdit, endTime: value})}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {timeOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label htmlFor="edit-shift-notes">Notes</Label>
                <Textarea
                  id="edit-shift-notes"
                  placeholder="Add notes about this shift..."
                  defaultValue={shiftToEdit.notes || ''}
                  onChange={(e) => setShiftToEdit({...shiftToEdit, notes: e.target.value})}
                  rows={3}
                />
              </div>

              <div className="p-3 bg-slate-50 rounded-lg">
                <div className="text-sm text-slate-600">
                  Duration: <span className="font-semibold">{calculateDuration(shiftToEdit.startTime, shiftToEdit.endTime).toFixed(2)} hours</span>
                </div>
                <div className="text-sm text-slate-600">
                  Type: <span className="font-semibold capitalize">{shiftToEdit.shiftType}</span>
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button
              variant="destructive"
              onClick={handleDeleteExistingShift}
              disabled={deleteShiftMutation.isPending}
              className="flex items-center gap-2"
            >
              <Trash2 className="h-4 w-4" />
              {deleteShiftMutation.isPending ? 'Deleting...' : 'Delete'}
            </Button>
            <Button
              onClick={() => {
                if (shiftToEdit) {
                  const { id, userId, createdAt, ...updateData } = shiftToEdit;
                  handleUpdateShift(updateData);
                }
              }}
              disabled={updateShiftMutation.isPending}
              className="flex items-center gap-2"
            >
              <Check className="h-4 w-4" />
              {updateShiftMutation.isPending ? "Updating..." : "Update"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
