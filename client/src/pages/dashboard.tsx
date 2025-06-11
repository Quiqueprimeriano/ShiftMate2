import { useState, useEffect, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Clock, History, TrendingUp, AlertTriangle, Plus, Play, Square, Edit, Check, X, Trash2 } from "lucide-react";
import { useShifts, useWeeklyHours, useCreateShift } from "@/hooks/use-shifts";
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

  const { data: recentShifts, isLoading: shiftsLoading } = useShifts();
  const { data: thisWeekHours, isLoading: thisWeekLoading } = useWeeklyHours(currentWeek.start, currentWeek.end);
  const { data: lastWeekHours, isLoading: lastWeekLoading } = useWeeklyHours(previousWeek.start, previousWeek.end);
  const createShiftMutation = useCreateShift();
  const { toast } = useToast();

  const recentShiftsToShow = useMemo(() => {
    return recentShifts?.slice(0, 3) || [];
  }, [recentShifts]);

  const formatElapsedTime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const roundToNearestQuarter = (minutes: number): number => {
    return Math.round(minutes / 15) * 15;
  };

  const roundTimeToQuarter = (date: Date): string => {
    const hours = date.getHours();
    const minutes = date.getMinutes();
    const roundedMinutes = Math.round(minutes / 15) * 15;
    
    let finalHours = hours;
    let finalMinutes = roundedMinutes;
    
    if (finalMinutes >= 60) {
      finalHours += 1;
      finalMinutes = 0;
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
    const startTimeStr = roundTimeToQuarter(shiftStartTime);
    const endTimeStr = roundTimeToQuarter(endTime);
    
    const shiftType = determineShiftType(shiftStartTime);
    const shiftDate = shiftStartTime.toISOString().split('T')[0];
    
    const shiftData = {
      date: shiftDate,
      startTime: startTimeStr,
      endTime: endTimeStr,
      shiftType: shiftType,
      notes: '',
      duration: (roundedMinutes / 60).toFixed(1)
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

  const handleDeleteShift = () => {
    setShowConfirmDialog(false);
    setPendingShiftData(null);
    setEditableShift(null);
    
    toast({
      title: "Shift deleted",
      description: "Timer reset to 00:00:00",
    });
  };

  const timeOptions = generateTimeOptions();

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
            + Add Manual Shift
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
            <div className="mt-6">
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
        {/* Recent Shifts */}
        <div>
          <Card>
            <div className="p-6 border-b border-slate-200">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-slate-900">Recent Shifts</h3>
                <Link href="/calendar">
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
                          {calculateDuration(shift.startTime, shift.endTime).toFixed(1)} hours
                        </p>
                      </div>
                      <Link href={`/add-shift?edit=${shift.id}`}>
                        <Button variant="ghost" size="sm" className="touch-target">
                          <Edit className="h-5 w-5" />
                        </Button>
                      </Link>
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
              onClick={handleDeleteShift}
              className="flex items-center gap-2"
            >
              <Trash2 className="h-4 w-4" />
              Delete
            </Button>
            <Button
              variant="outline"
              onClick={handleCancelShift}
              className="flex items-center gap-2"
            >
              <X className="h-4 w-4" />
              Cancel
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
    </div>
  );
}
