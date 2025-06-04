import { useState, useMemo } from "react";
import { CalendarGrid } from "@/components/calendar-grid";
import { useShifts } from "@/hooks/use-shifts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Clock, Plus } from "lucide-react";
import { formatTime } from "@/lib/time-utils";
import { Link } from "wouter";

export default function Calendar() {
  const [currentDate, setCurrentDate] = useState(new Date());
  
  // Get shifts for the current month
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const startDate = new Date(year, month, 1).toISOString().split('T')[0];
  const endDate = new Date(year, month + 1, 0).toISOString().split('T')[0];
  
  const { data: shifts = [], isLoading } = useShifts(startDate, endDate);

  // Get upcoming shifts for the next 7 days
  const upcomingShifts = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);
    const nextWeekStr = nextWeek.toISOString().split('T')[0];
    
    return shifts
      .filter(shift => shift.date >= today && shift.date <= nextWeekStr)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .slice(0, 5); // Show next 5 shifts
  }, [shifts]);

  const handleDayClick = (date: string) => {
    console.log('Day clicked:', date);
    // Here you could open a modal to add/edit shifts for this date
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

  return (
    <div className="p-4 lg:p-8">
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Calendar Grid */}
        <div className="lg:col-span-3">
          <CalendarGrid
            currentDate={currentDate}
            onDateChange={setCurrentDate}
            shifts={shifts}
            onDayClick={handleDayClick}
          />
        </div>

        {/* Upcoming Shifts Sidebar */}
        <div className="space-y-6">
          {/* Quick Add */}
          <Card>
            <CardContent className="p-4">
              <Link href="/add-shift">
                <Button className="w-full">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Shift
                </Button>
              </Link>
            </CardContent>
          </Card>

          {/* Upcoming Shifts */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center">
                <Clock className="h-5 w-5 mr-2 text-blue-600" />
                Upcoming Shifts
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              {isLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="p-3 border rounded-lg">
                      <Skeleton className="h-4 w-20 mb-2" />
                      <Skeleton className="h-3 w-32" />
                    </div>
                  ))}
                </div>
              ) : upcomingShifts.length > 0 ? (
                <div className="space-y-3">
                  {upcomingShifts.map((shift) => {
                    const shiftDate = new Date(shift.date);
                    const today = new Date().toISOString().split('T')[0];
                    const isToday = shift.date === today;
                    const isTomorrow = new Date(shift.date).getTime() === new Date(today).getTime() + 24 * 60 * 60 * 1000;
                    
                    let dateText = shiftDate.toLocaleDateString('en-US', { 
                      weekday: 'short', 
                      month: 'short', 
                      day: 'numeric' 
                    });
                    if (isToday) dateText = 'Today';
                    if (isTomorrow) dateText = 'Tomorrow';

                    return (
                      <div key={shift.id} className="p-3 border rounded-lg hover:bg-gray-50 transition-colors">
                        <div className="text-sm font-medium text-gray-900">
                          {dateText}
                        </div>
                        <div className="text-xs text-gray-600 mt-1">
                          {formatTime(shift.startTime)} - {formatTime(shift.endTime)}
                        </div>
                        <div className="text-xs text-gray-500 capitalize mt-1">
                          {shift.shiftType} shift
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-sm text-gray-500 text-center py-4">
                  No upcoming shifts scheduled
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
