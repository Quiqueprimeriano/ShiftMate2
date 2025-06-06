import { useState, useEffect, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Clock, History, TrendingUp, AlertTriangle, Plus, Play, Square, Edit } from "lucide-react";
import { useShifts, useWeeklyHours, useCreateShift } from "@/hooks/use-shifts";
import { getWeekDates, formatTime, calculateDuration } from "@/lib/time-utils";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";
import { useToast } from "@/hooks/use-toast";

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

  const [isShiftActive, setIsShiftActive] = useState(false);
  const [shiftStartTime, setShiftStartTime] = useState<Date | null>(null);
  const [elapsedTime, setElapsedTime] = useState(0);

  const { data: recentShifts, isLoading: shiftsLoading } = useShifts();
  const { data: thisWeekHours, isLoading: thisWeekLoading } = useWeeklyHours(currentWeek.start, currentWeek.end);
  const { data: lastWeekHours, isLoading: lastWeekLoading } = useWeeklyHours(previousWeek.start, previousWeek.end);
  const createShiftMutation = useCreateShift();
  const { toast } = useToast();

  // Timer effect
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isShiftActive && shiftStartTime) {
      interval = setInterval(() => {
        setElapsedTime(Date.now() - shiftStartTime.getTime());
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isShiftActive, shiftStartTime]);

  const recentShiftsToShow = useMemo(() => {
    return recentShifts?.slice(0, 3) || [];
  }, [recentShifts]);

  const formatElapsedTime = (milliseconds: number): string => {
    const totalMinutes = Math.floor(milliseconds / 60000);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
  };

  const roundToNearestQuarter = (minutes: number): number => {
    return Math.round(minutes / 15) * 15;
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
    setShiftStartTime(new Date());
    setIsShiftActive(true);
    setElapsedTime(0);
  };

  const handleEndShift = async () => {
    if (!shiftStartTime) return;
    
    const endTime = new Date();
    const totalMinutes = Math.floor((endTime.getTime() - shiftStartTime.getTime()) / 60000);
    
    // Validate minimum shift duration (15 minutes)
    if (totalMinutes < 15) {
      toast({
        title: "Shift too short",
        description: "Minimum shift duration is 15 minutes.",
        variant: "destructive",
      });
      return;
    }
    
    const roundedMinutes = roundToNearestQuarter(totalMinutes);
    
    // Calculate start and end times
    const startHour = shiftStartTime.getHours();
    const startMinute = shiftStartTime.getMinutes();
    
    // Calculate end time based on rounded duration
    const endTotalMinutes = startHour * 60 + startMinute + roundedMinutes;
    const endHour = Math.floor(endTotalMinutes / 60) % 24;
    const endMinuteCalc = endTotalMinutes % 60;
    
    const startTimeStr = `${startHour.toString().padStart(2, '0')}:${startMinute.toString().padStart(2, '0')}`;
    const endTimeStr = `${endHour.toString().padStart(2, '0')}:${endMinuteCalc.toString().padStart(2, '0')}`;
    
    const shiftType = determineShiftType(shiftStartTime);
    const shiftDate = shiftStartTime.toISOString().split('T')[0];
    
    try {
      await createShiftMutation.mutateAsync({
        date: shiftDate,
        startTime: startTimeStr,
        endTime: endTimeStr,
        shiftType: shiftType,
        notes: ''
      });
      
      toast({
        title: "Shift recorded",
        description: `${shiftType} shift automatically created (${(roundedMinutes / 60).toFixed(1)} hours)`,
      });
      
      setIsShiftActive(false);
      setShiftStartTime(null);
      setElapsedTime(0);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to create shift. Please try again.",
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
      {/* Add Today's Shift - Featured Button */}
      <div className="mb-8">
        <Link href="/add-shift">
          <Button size="lg" className="w-full md:w-auto text-lg px-8 py-4 h-auto">
            <Plus className="h-6 w-6 mr-3" />
            Add Today's Shift
          </Button>
        </Link>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-600">This Week</p>
                {thisWeekLoading ? (
                  <Skeleton className="h-8 w-16 mt-1" />
                ) : (
                  <p className="text-3xl font-bold text-slate-900">
                    {thisWeekHours?.toFixed(1) || "0"}h
                  </p>
                )}
              </div>
              <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                <Clock className="h-6 w-6 text-blue-600" />
              </div>
            </div>
            <div className="mt-4 flex items-center text-sm">
              {thisWeekLoading || lastWeekLoading ? (
                <Skeleton className="h-4 w-24" />
              ) : (
                <>
                  <span className="text-emerald-600 font-medium">
                    {thisWeekHours && lastWeekHours 
                      ? `${thisWeekHours > lastWeekHours ? '+' : ''}${(thisWeekHours - lastWeekHours).toFixed(1)}h`
                      : '--'
                    }
                  </span>
                  <span className="text-slate-500 ml-1">from last week</span>
                </>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-600">Last Week</p>
                {lastWeekLoading ? (
                  <Skeleton className="h-8 w-16 mt-1" />
                ) : (
                  <p className="text-3xl font-bold text-slate-900">
                    {lastWeekHours?.toFixed(1) || "0"}h
                  </p>
                )}
              </div>
              <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center">
                <History className="h-6 w-6 text-slate-600" />
              </div>
            </div>
            <div className="mt-4 flex items-center text-sm">
              <span className="text-slate-600">Previous period</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-600">
                  Shift Timer {isShiftActive && <span className="text-green-600">• Running</span>}
                </p>
                <p className={`text-3xl font-bold ${isShiftActive ? 'text-green-600' : 'text-slate-900'}`}>
                  {isShiftActive ? formatElapsedTime(elapsedTime) : "00:00"}
                </p>
              </div>
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                isShiftActive ? 'bg-red-100' : 'bg-green-100'
              }`}>
                {isShiftActive ? (
                  <Square className="h-6 w-6 text-red-600" />
                ) : (
                  <Play className="h-6 w-6 text-green-600" />
                )}
              </div>
            </div>
            <div className="mt-4">
              <Button 
                onClick={isShiftActive ? handleEndShift : handleStartShift}
                variant={isShiftActive ? "destructive" : "default"}
                size="sm"
                className="w-full"
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
              <div className="mt-2 text-xs text-slate-500 text-center">
                Started at {shiftStartTime.toLocaleTimeString('en-US', { 
                  hour: '2-digit', 
                  minute: '2-digit' 
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-600">Total Shifts</p>
                <p className="text-3xl font-bold text-slate-900">
                  {recentShifts?.length || 0}
                </p>
              </div>
              <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
                <History className="h-6 w-6 text-purple-600" />
              </div>
            </div>
            <div className="mt-4 flex items-center text-sm">
              <span className="text-slate-600">All time</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Recent Shifts */}
        <div className="lg:col-span-2">
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
                        <Button variant="ghost" size="sm">
                          <Edit className="h-4 w-4" />
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
    </div>
  );
}
