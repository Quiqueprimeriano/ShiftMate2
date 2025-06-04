import { useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Clock, History, TrendingUp, AlertTriangle, Plus } from "lucide-react";
import { useShifts, useWeeklyHours, useDailyAverage, useMissingEntries } from "@/hooks/use-shifts";
import { getWeekDates, formatTime, calculateDuration } from "@/lib/time-utils";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";

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

  const { data: recentShifts, isLoading: shiftsLoading } = useShifts();
  const { data: thisWeekHours, isLoading: thisWeekLoading } = useWeeklyHours(currentWeek.start, currentWeek.end);
  const { data: lastWeekHours, isLoading: lastWeekLoading } = useWeeklyHours(previousWeek.start, previousWeek.end);
  const { data: dailyAverage, isLoading: avgLoading } = useDailyAverage(currentWeek.start, currentWeek.end);
  const { data: missingEntries, isLoading: missingLoading } = useMissingEntries(currentWeek.start, currentWeek.end);

  const recentShiftsToShow = useMemo(() => {
    return recentShifts?.slice(0, 3) || [];
  }, [recentShifts]);

  const shiftTypeColors = {
    morning: 'bg-emerald-500',
    evening: 'bg-blue-500',
    night: 'bg-purple-500',
    double: 'bg-amber-500',
    custom: 'bg-gray-500',
  };

  const alerts = useMemo(() => {
    const alertList = [];
    
    if (missingEntries && missingEntries.length > 0) {
      alertList.push({
        type: 'error',
        icon: AlertTriangle,
        title: 'Missing Entries',
        description: `No shifts logged for ${missingEntries.length} days`,
        bgColor: 'bg-red-50',
        borderColor: 'border-red-200',
        textColor: 'text-red-900',
        descColor: 'text-red-700'
      });
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
  }, [missingEntries, recentShifts]);

  return (
    <div className="p-4 lg:p-8">
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
                <p className="text-sm font-medium text-slate-600">Daily Average</p>
                {avgLoading ? (
                  <Skeleton className="h-8 w-16 mt-1" />
                ) : (
                  <p className="text-3xl font-bold text-slate-900">
                    {dailyAverage?.toFixed(1) || "0"}h
                  </p>
                )}
              </div>
              <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center">
                <TrendingUp className="h-6 w-6 text-amber-600" />
              </div>
            </div>
            <div className="mt-4 flex items-center text-sm">
              <span className="text-slate-600">Per working day</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-600">Missing Entries</p>
                {missingLoading ? (
                  <Skeleton className="h-8 w-8 mt-1" />
                ) : (
                  <p className="text-3xl font-bold text-red-600">
                    {missingEntries?.length || 0}
                  </p>
                )}
              </div>
              <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center">
                <AlertTriangle className="h-6 w-6 text-red-600" />
              </div>
            </div>
            <div className="mt-4 flex items-center text-sm">
              <span className="text-red-600 font-medium">
                {missingEntries && missingEntries.length > 0 ? "Needs attention" : "Up to date"}
              </span>
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
                    <div className="text-right">
                      <p className="font-medium text-slate-900">
                        {formatTime(shift.startTime)} - {formatTime(shift.endTime)}
                      </p>
                      <p className="text-sm text-slate-500">
                        {calculateDuration(shift.startTime, shift.endTime).toFixed(1)} hours
                      </p>
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

        {/* Quick Actions & Alerts */}
        <div className="space-y-6">
          {/* Quick Add Shift */}
          <Card>
            <CardContent className="p-6">
              <h3 className="text-lg font-semibold text-slate-900 mb-4">Quick Add</h3>
              <Link href="/add-shift">
                <Button className="w-full">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Today's Shift
                </Button>
              </Link>
            </CardContent>
          </Card>

          {/* Alerts */}
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
