import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { Users, Clock, TrendingUp, DollarSign, Calendar as CalendarIcon, UserCheck, AlertTriangle, Building2, Filter, ChevronLeft, ChevronRight } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from "recharts";
import { useAuth } from "@/hooks/use-auth";
import { Skeleton } from "@/components/ui/skeleton";
import { useCompanyEmployees, useCompanyShifts, usePendingShifts, useApproveShift, useRosterShifts, useCreateRosterShift, useUpdateRosterShift, useDeleteRosterShift } from "@/hooks/use-business";
import { getDateRange, formatDuration } from "@/lib/time-utils";
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, addDays, addWeeks, addMonths, subWeeks, subMonths, subDays, parseISO } from "date-fns";
import type { User } from "@shared/schema";

// Mock data for charts until real data is available
const mockWeeklyData = [
  { day: "Mon", totalHours: 32, employees: 4 },
  { day: "Tue", totalHours: 35, employees: 4 },
  { day: "Wed", totalHours: 28, employees: 3 },
  { day: "Thu", totalHours: 40, employees: 4 },
  { day: "Fri", totalHours: 38, employees: 4 },
  { day: "Sat", totalHours: 20, employees: 2 },
  { day: "Sun", totalHours: 15, employees: 2 },
];

const mockDepartmentData = [
  { name: "Sales", value: 45, color: "#3b82f6" },
  { name: "Support", value: 30, color: "#10b981" },
  { name: "Management", value: 25, color: "#6366f1" },
];

export default function BusinessDashboard() {
  const { user, isLoading: userLoading } = useAuth();
  const [selectedTimeframe, setSelectedTimeframe] = useState("week");
  const [currentDate, setCurrentDate] = useState(new Date());
  const [customStartDate, setCustomStartDate] = useState("");
  const [customEndDate, setCustomEndDate] = useState("");
  const [viewMode, setViewMode] = useState<"week" | "month" | "custom">("week");
  const [overviewStartDate, setOverviewStartDate] = useState(format(subDays(new Date(), 7), 'yyyy-MM-dd'));
  const [overviewEndDate, setOverviewEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [hoveredShift, setHoveredShift] = useState<any>(null);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  
  // Roster management state
  const [isShiftModalOpen, setIsShiftModalOpen] = useState(false);
  const [editingShift, setEditingShift] = useState<any>(null);
  const [selectedEmployee, setSelectedEmployee] = useState<any>(null);
  const [selectedDate, setSelectedDate] = useState<string>("");

  // Calculate date range based on view mode
  const getDateRangeForView = () => {
    if (viewMode === "custom" && customStartDate && customEndDate) {
      return {
        startDate: customStartDate,
        endDate: customEndDate
      };
    }
    
    if (viewMode === "month") {
      const start = startOfMonth(currentDate);
      const end = endOfMonth(currentDate);
      return {
        startDate: format(start, 'yyyy-MM-dd'),
        endDate: format(end, 'yyyy-MM-dd')
      };
    }
    
    // Default to week view
    const start = startOfWeek(currentDate, { weekStartsOn: 1 }); // Monday start
    const end = endOfWeek(currentDate, { weekStartsOn: 1 });
    return {
      startDate: format(start, 'yyyy-MM-dd'),
      endDate: format(end, 'yyyy-MM-dd')
    };
  };

  const { startDate, endDate } = getDateRangeForView();

  // Cast user to include company properties
  const businessUser = user as any;

  // Fetch real company data
  const { data: employees = [], isLoading: employeesLoading, error: employeesError } = useCompanyEmployees(businessUser?.companyId || 0);
  const { data: shifts = [], isLoading: shiftsLoading, error: shiftsError } = useCompanyShifts(businessUser?.companyId || 0, startDate, endDate);
  const { data: pendingShifts = [], isLoading: pendingLoading, error: pendingError } = usePendingShifts(businessUser?.companyId || 0);
  
  // Fetch ALL shifts for calendar (not date filtered)
  const { data: allShifts = [], isLoading: allShiftsLoading } = useCompanyShifts(businessUser?.companyId || 0);

  // Roster management hooks
  const weekStart = format(startOfWeek(currentDate, { weekStartsOn: 1 }), 'yyyy-MM-dd');
  const weekEnd = format(endOfWeek(currentDate, { weekStartsOn: 1 }), 'yyyy-MM-dd');
  const { data: rosterShifts = [], isLoading: rosterLoading } = useRosterShifts(weekStart, weekEnd);
  const createRosterShiftMutation = useCreateRosterShift();
  const updateRosterShiftMutation = useUpdateRosterShift();
  const deleteRosterShiftMutation = useDeleteRosterShift();

  const approveShiftMutation = useApproveShift();

  // Process shift data for daily breakdown
  const processShiftData = () => {
    const employeeList = Array.isArray(employees) ? employees : [];
    const shiftList = Array.isArray(shifts) ? shifts : [];
    
    // Group shifts by date and employee
    const dailyData: Record<string, Record<number, number>> = {};
    
    shiftList.forEach((shift: any) => {
      if (!shift.startTime || !shift.endTime || !shift.date) return;
      
      const start = new Date(`2000-01-01T${shift.startTime}`);
      const end = new Date(`2000-01-01T${shift.endTime}`);
      if (end < start) end.setDate(end.getDate() + 1);
      
      const hours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
      
      if (!dailyData[shift.date]) {
        dailyData[shift.date] = {};
      }
      if (!dailyData[shift.date][shift.userId]) {
        dailyData[shift.date][shift.userId] = 0;
      }
      dailyData[shift.date][shift.userId] += hours;
    });
    
    // Convert to chart format
    const chartData = Object.entries(dailyData).map(([date, employeeHours]) => {
      const dayData: any = { date: format(parseISO(date), 'MMM dd') };
      let totalHours = 0;
      
      employeeList.forEach((employee: any) => {
        const hours = employeeHours[employee.id] || 0;
        dayData[employee.name] = hours;
        totalHours += hours;
      });
      
      dayData.totalHours = totalHours;
      return dayData;
    }).sort((a, b) => a.date.localeCompare(b.date));
    
    return { dailyData, chartData, employeeList };
  };

  const { dailyData, chartData, employeeList: processedEmployeeList } = processShiftData();

  // Navigation functions
  const navigatePrevious = () => {
    if (viewMode === "week") {
      setCurrentDate(prev => subWeeks(prev, 1));
    } else if (viewMode === "month") {
      setCurrentDate(prev => subMonths(prev, 1));
    }
  };

  const navigateNext = () => {
    if (viewMode === "week") {
      setCurrentDate(prev => addWeeks(prev, 1));
    } else if (viewMode === "month") {
      setCurrentDate(prev => addMonths(prev, 1));
    }
  };

  const getDateRangeLabel = () => {
    if (viewMode === "custom") {
      return `${customStartDate} to ${customEndDate}`;
    }
    if (viewMode === "month") {
      return format(currentDate, 'MMMM yyyy');
    }
    const start = startOfWeek(currentDate, { weekStartsOn: 1 });
    const end = endOfWeek(currentDate, { weekStartsOn: 1 });
    return `${format(start, 'MMM dd')} - ${format(end, 'MMM dd, yyyy')}`;
  };

  // If user is not a business user, show access denied
  if (user && businessUser.userType !== 'business') {
    return (
      <div className="p-6 text-center">
        <h1 className="text-2xl font-bold text-slate-900 mb-4">Access Denied</h1>
        <p className="text-slate-600">You need to be a business user to access this dashboard.</p>
      </div>
    );
  }

  // Calculate real metrics
  const employeeArray = Array.isArray(employees) ? employees : [];
  const shiftList = Array.isArray(shifts) ? shifts : [];
  const pendingList = Array.isArray(pendingShifts) ? pendingShifts : [];

  const totalEmployees = employeeArray.length;
  const activeEmployees = employeeArray.filter((emp: any) => emp.isActive !== false).length;
  const totalWeeklyHours = shiftList.reduce((sum: number, shift: any) => {
    if (!shift.startTime || !shift.endTime) return sum;
    const start = new Date(`2000-01-01T${shift.startTime}`);
    const end = new Date(`2000-01-01T${shift.endTime}`);
    if (end < start) end.setDate(end.getDate() + 1);
    return sum + (end.getTime() - start.getTime()) / (1000 * 60 * 60);
  }, 0);
  const pendingApprovals = pendingList.length;

  // Handle shift approval
  const handleApproveShift = (shiftId: number) => {
    if (businessUser?.id) {
      approveShiftMutation.mutate({ shiftId, approvedBy: businessUser.id });
    }
  };

  // Roster management handlers
  const handleAddShift = (employee: any, date: string) => {
    setSelectedEmployee(employee);
    setSelectedDate(date);
    setEditingShift(null);
    setIsShiftModalOpen(true);
  };

  const handleEditShift = (shift: any) => {
    setEditingShift(shift);
    setSelectedEmployee(null);
    setSelectedDate("");
    setIsShiftModalOpen(true);
  };

  const handleDeleteShift = async (shiftId: number) => {
    if (confirm('Are you sure you want to delete this shift?')) {
      try {
        await deleteRosterShiftMutation.mutateAsync(shiftId);
      } catch (error) {
        console.error('Failed to delete shift:', error);
      }
    }
  };

  const handleSaveShift = async (shiftData: any) => {
    try {
      if (editingShift) {
        // Update existing shift
        await updateRosterShiftMutation.mutateAsync({
          shiftId: editingShift.id,
          shiftData
        });
      } else {
        // Create new shift
        await createRosterShiftMutation.mutateAsync({
          ...shiftData,
          userId: selectedEmployee?.id,
          date: selectedDate,
          status: 'scheduled'
        });
      }
      setIsShiftModalOpen(false);
      setEditingShift(null);
      setSelectedEmployee(null);
      setSelectedDate("");
    } catch (error) {
      console.error('Failed to save shift:', error);
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Business Dashboard</h1>
          <p className="text-slate-600">
            Welcome back, {businessUser?.name}! Here's your team overview.
          </p>
          {businessUser?.companyId && (
            <p className="text-sm text-slate-500 mt-1">
              Company ID: {businessUser.companyId} | Role: {businessUser.role || 'Owner'}
            </p>
          )}
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={navigatePrevious}
              disabled={viewMode === "custom"}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="text-sm font-medium min-w-[200px] text-center">
              {getDateRangeLabel()}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={navigateNext}
              disabled={viewMode === "custom"}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          
          <Select value={viewMode} onValueChange={(value: "week" | "month" | "custom") => setViewMode(value)}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="week">Week</SelectItem>
              <SelectItem value="month">Month</SelectItem>
              <SelectItem value="custom">Custom</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Custom Date Range Picker */}
      {viewMode === "custom" && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Filter className="h-5 w-5" />
              Custom Date Range
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <div className="space-y-2">
                <Label htmlFor="start-date">Start Date</Label>
                <Input
                  id="start-date"
                  type="date"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="end-date">End Date</Label>
                <Input
                  id="end-date"
                  type="date"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Loading State */}
      {(userLoading || employeesLoading || shiftsLoading) && (
        <div className="space-y-6">
          <Skeleton className="h-8 w-64" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-32" />
            ))}
          </div>
        </div>
      )}

      {/* Key Metrics */}
      {!userLoading && !employeesLoading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Employees</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalEmployees}</div>
              <p className="text-xs text-muted-foreground">
                {activeEmployees} active employees
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Weekly Hours</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{Math.round(totalWeeklyHours)}h</div>
              <p className="text-xs text-muted-foreground">
                Last 7 days
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending Approvals</CardTitle>
              <AlertTriangle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{pendingApprovals}</div>
              <p className="text-xs text-muted-foreground">
                Shifts awaiting approval
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Avg. Hours/Day</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{(totalWeeklyHours / 7).toFixed(1)}h</div>
              <p className="text-xs text-muted-foreground">
                Daily average
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Main Content Tabs */}
      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="employees">Employees</TabsTrigger>
          <TabsTrigger value="shifts">Shifts</TabsTrigger>
          <TabsTrigger value="roster">Roster Planner</TabsTrigger>
          <TabsTrigger value="calendar">Calendar</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {/* Date Filter Controls */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Filter className="h-5 w-5" />
                Overview Filters
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col sm:flex-row gap-4 items-end">
                <div className="grid grid-cols-2 gap-4 flex-1">
                  <div>
                    <label className="text-sm font-medium mb-2 block">Start Date</label>
                    <input
                      type="date"
                      value={overviewStartDate}
                      onChange={(e) => setOverviewStartDate(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-2 block">End Date</label>
                    <input
                      type="date"
                      value={overviewEndDate}
                      onChange={(e) => setOverviewEndDate(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      const today = new Date();
                      const weekAgo = subDays(today, 7);
                      setOverviewStartDate(format(weekAgo, 'yyyy-MM-dd'));
                      setOverviewEndDate(format(today, 'yyyy-MM-dd'));
                    }}
                  >
                    Last 7 Days
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      const today = new Date();
                      const monthStart = startOfMonth(today);
                      setOverviewStartDate(format(monthStart, 'yyyy-MM-dd'));
                      setOverviewEndDate(format(today, 'yyyy-MM-dd'));
                    }}
                  >
                    This Month
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {(() => {
            const filteredShifts = Array.isArray(allShifts) 
              ? allShifts.filter((shift: any) => 
                  shift.date >= overviewStartDate && shift.date <= overviewEndDate
                ) 
              : [];

            // Generate timeline chart data
            const timelineData = (() => {
              const shiftsByDate = filteredShifts.reduce((acc: any, shift: any) => {
                if (!acc[shift.date]) {
                  acc[shift.date] = [];
                }
                acc[shift.date].push(shift);
                return acc;
              }, {});

              const sortedDates = Object.keys(shiftsByDate).sort();
              
              return sortedDates.map(date => {
                const dayShifts = shiftsByDate[date];
                
                // Calculate total hours for the day
                const totalHours = dayShifts.reduce((total: number, shift: any) => {
                  if (!shift.startTime || !shift.endTime) return total;
                  const start = new Date(`2000-01-01T${shift.startTime}`);
                  const end = new Date(`2000-01-01T${shift.endTime}`);
                  if (end < start) end.setDate(end.getDate() + 1);
                  return total + ((end.getTime() - start.getTime()) / (1000 * 60 * 60));
                }, 0);

                // Calculate hours per employee
                const employeeHours = dayShifts.reduce((acc: any, shift: any) => {
                  const employee = employees.find((emp: any) => emp.id === shift.userId);
                  const employeeName = employee?.name?.split(' ')[0] || `User${shift.userId}`;
                  
                  if (!shift.startTime || !shift.endTime) return acc;
                  const start = new Date(`2000-01-01T${shift.startTime}`);
                  const end = new Date(`2000-01-01T${shift.endTime}`);
                  if (end < start) end.setDate(end.getDate() + 1);
                  const hours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
                  
                  acc[employeeName] = (acc[employeeName] || 0) + hours;
                  return acc;
                }, {});

                return {
                  date: format(parseISO(date), 'MMM dd'),
                  fullDate: date,
                  totalHours: Number(totalHours.toFixed(1)),
                  shifts: dayShifts.length,
                  ...employeeHours
                };
              });
            })();

            // Calculate period totals
            const totalPeriodHours = filteredShifts.reduce((total: number, shift: any) => {
              if (!shift.startTime || !shift.endTime) return total;
              const start = new Date(`2000-01-01T${shift.startTime}`);
              const end = new Date(`2000-01-01T${shift.endTime}`);
              if (end < start) end.setDate(end.getDate() + 1);
              return total + ((end.getTime() - start.getTime()) / (1000 * 60 * 60));
            }, 0);

            // Calculate employee totals for the period
            const employeeTotals = filteredShifts.reduce((acc: any, shift: any) => {
              const employee = employees.find((emp: any) => emp.id === shift.userId);
              const employeeName = employee?.name || `User ${shift.userId}`;
              
              if (!shift.startTime || !shift.endTime) return acc;
              const start = new Date(`2000-01-01T${shift.startTime}`);
              const end = new Date(`2000-01-01T${shift.endTime}`);
              if (end < start) end.setDate(end.getDate() + 1);
              const hours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
              
              acc[employeeName] = (acc[employeeName] || 0) + hours;
              return acc;
            }, {});

            const uniqueEmployees = Array.from(new Set(filteredShifts.map((shift: any) => {
              const employee = employees.find((emp: any) => emp.id === shift.userId);
              return employee?.name?.split(' ')[0] || `User${shift.userId}`;
            })));

            return (
              <>
                {/* Period Summary Cards */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Total Hours</CardTitle>
                      <Clock className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{totalPeriodHours.toFixed(1)}h</div>
                      <p className="text-xs text-muted-foreground">
                        {format(parseISO(overviewStartDate), 'MMM dd')} - {format(parseISO(overviewEndDate), 'MMM dd')}
                      </p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Total Shifts</CardTitle>
                      <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{filteredShifts.length}</div>
                      <p className="text-xs text-muted-foreground">
                        {timelineData.length} days worked
                      </p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Daily Average</CardTitle>
                      <TrendingUp className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">
                        {timelineData.length > 0 ? (totalPeriodHours / timelineData.length).toFixed(1) : '0'}h
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Per working day
                      </p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Active Employees</CardTitle>
                      <Users className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{Object.keys(employeeTotals).length}</div>
                      <p className="text-xs text-muted-foreground">
                        In this period
                      </p>
                    </CardContent>
                  </Card>
                </div>

                {/* Timeline Chart - Days vs Hours */}
                <Card>
                  <CardHeader>
                    <CardTitle>Shift Timeline</CardTitle>
                    <p className="text-sm text-muted-foreground">
                      Days (x-axis) vs Hours (y-axis) showing when shifts occur
                    </p>
                  </CardHeader>
                  <CardContent>
                    {filteredShifts.length > 0 ? (
                      (() => {
                        // Group shifts by date
                        const shiftsByDate = filteredShifts.reduce((acc: any, shift: any) => {
                          if (!acc[shift.date]) {
                            acc[shift.date] = [];
                          }
                          acc[shift.date].push(shift);
                          return acc;
                        }, {});

                        const sortedDates = Object.keys(shiftsByDate).sort();
                        const maxDays = 14; // Show max 14 days for readability
                        const displayDates = sortedDates.slice(0, maxDays);

                        // Get unique employees and assign colors
                        const uniqueEmployees = Array.from(new Set(filteredShifts.map((shift: any) => shift.userId)))
                          .map(userId => employees.find((emp: any) => emp.id === userId))
                          .filter(Boolean);

                        const getEmployeeColor = (userId: number) => {
                          const index = uniqueEmployees.findIndex((emp: any) => emp.id === userId);
                          const colors = [
                            { bg: 'bg-blue-500', border: 'border-blue-600', text: 'text-white' },
                            { bg: 'bg-green-500', border: 'border-green-600', text: 'text-white' },
                            { bg: 'bg-purple-500', border: 'border-purple-600', text: 'text-white' },
                            { bg: 'bg-red-500', border: 'border-red-600', text: 'text-white' },
                            { bg: 'bg-yellow-500', border: 'border-yellow-600', text: 'text-black' },
                            { bg: 'bg-pink-500', border: 'border-pink-600', text: 'text-white' },
                            { bg: 'bg-indigo-500', border: 'border-indigo-600', text: 'text-white' },
                            { bg: 'bg-teal-500', border: 'border-teal-600', text: 'text-white' },
                            { bg: 'bg-orange-500', border: 'border-orange-600', text: 'text-white' },
                            { bg: 'bg-cyan-500', border: 'border-cyan-600', text: 'text-white' }
                          ];
                          return colors[index % colors.length] || colors[0];
                        };

                        return (
                          <div className="relative">
                            {/* Chart container */}
                            <div className="relative bg-gray-50 border rounded-lg p-4 pb-24" style={{ height: '680px' }}>
                              {/* Y-axis labels (Hours) - 0:00 at top, 24:00 at bottom */}
                              <div className="absolute left-0 top-0 bottom-0 w-12 flex flex-col justify-between text-xs text-gray-600 py-4">
                                {Array.from({ length: 25 }, (_, i) => (
                                  <div key={i} className="text-right pr-2">
                                    {i.toString().padStart(2, '0')}:00
                                  </div>
                                ))}
                              </div>

                              {/* Chart area */}
                              <div className="ml-12 mr-4 relative h-full">
                                {/* Grid lines - horizontal (hours) */}
                                {Array.from({ length: 25 }, (_, i) => (
                                  <div
                                    key={i}
                                    className="absolute w-full border-t border-gray-200"
                                    style={{ top: `${(i / 24) * 100}%` }}
                                  />
                                ))}
                                
                                {/* Grid lines - vertical (days) */}
                                {displayDates.map((_, i) => (
                                  <div
                                    key={i}
                                    className="absolute h-full border-l border-gray-300"
                                    style={{ left: `${((i + 1) / displayDates.length) * 100}%` }}
                                  />
                                ))}

                                {/* Shift blocks */}
                                {displayDates.map((date, dateIndex) => {
                                  const dayShifts = shiftsByDate[date];
                                  
                                  // Stack all shifts vertically for this day
                                  return dayShifts.map((shift: any, shiftIndex: number) => {
                                      if (!shift.startTime || !shift.endTime) return null;
                                      
                                      const employee = employees.find((emp: any) => emp.id === shift.userId);
                                      const employeeName = employee?.name || `User ${shift.userId}`;
                                      
                                      // Parse start and end times
                                      const [startHours, startMinutes] = shift.startTime.split(':').map(Number);
                                      const [endHours, endMinutes] = shift.endTime.split(':').map(Number);
                                      
                                      const startTime = startHours + startMinutes / 60;
                                      let endTime = endHours + endMinutes / 60;
                                      
                                      // Handle overnight shifts
                                      if (endTime <= startTime) {
                                        endTime += 24;
                                      }
                                      
                                      // Convert to percentage positions (0:00 at top, 24:00 at bottom)
                                      const topPercent = (startTime / 24) * 100;
                                      const heightPercent = ((Math.min(endTime, 24) - startTime) / 24) * 100;
                                      
                                      // X position - stack vertically for non-doubled shifts, side by side for doubled
                                      const columnWidth = (1 / displayDates.length) * 100;
                                      const leftPercent = (dateIndex / displayDates.length) * 100;
                                      const widthPercent = Math.max(columnWidth * 0.95, 3); // Use most of column width
                                      
                                      const colorScheme = getEmployeeColor(shift.userId);
                                      
                                      return (
                                        <div
                                          key={`${shift.id}-${dateIndex}-${shiftIndex}`}
                                          className={`absolute border-2 rounded opacity-90 hover:opacity-100 hover:scale-105 transition-all cursor-pointer ${colorScheme.bg} ${colorScheme.border}`}
                                          style={{
                                            left: `${leftPercent}%`,
                                            width: `${widthPercent}%`,
                                            top: `${topPercent}%`,
                                            height: `${Math.max(heightPercent, 2)}%`
                                          }}
                                          onMouseEnter={(e) => {
                                            setHoveredShift({
                                              ...shift,
                                              employeeName,
                                              date,
                                              duration: ((Math.min(endTime, 24) - startTime)).toFixed(1)
                                            });
                                            setMousePosition({ x: e.clientX, y: e.clientY });
                                          }}
                                          onMouseLeave={() => setHoveredShift(null)}
                                          onMouseMove={(e) => setMousePosition({ x: e.clientX, y: e.clientY })}
                                          title={`${employeeName}: ${shift.startTime} - ${shift.endTime}`}
                                        >
                                          <div className={`text-xs font-medium p-1 truncate ${colorScheme.text}`}>
                                            {employeeName.split(' ')[0]}
                                          </div>
                                        </div>
                                      );
                                    });
                                })}
                              </div>

                              {/* X-axis labels (Days) with totals */}
                              <div className="absolute bottom-0 left-12 right-4 flex justify-between text-xs text-gray-600 pt-8">
                                {displayDates.map((date) => {
                                  const dayShifts = shiftsByDate[date];
                                  const dayTotal = dayShifts.reduce((total: number, shift: any) => {
                                    if (!shift.startTime || !shift.endTime) return total;
                                    const [startHours, startMinutes] = shift.startTime.split(':').map(Number);
                                    const [endHours, endMinutes] = shift.endTime.split(':').map(Number);
                                    const startTime = startHours + startMinutes / 60;
                                    let endTime = endHours + endMinutes / 60;
                                    if (endTime <= startTime) endTime += 24;
                                    return total + (endTime - startTime);
                                  }, 0);
                                  
                                  return (
                                    <div key={date} className="text-center" style={{ width: `${100 / displayDates.length}%` }}>
                                      <div className="font-medium mb-1">{format(parseISO(date), 'MMM dd')}</div>
                                      <div className="text-gray-500 mb-2">{format(parseISO(date), 'EEE')}</div>
                                      <div className="font-bold text-blue-600 text-lg">{dayTotal.toFixed(1)}h</div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>

                            {/* Employee Legend */}
                            <div className="mt-4">
                              <h4 className="text-sm font-medium mb-3 text-center">Employee Colors</h4>
                              <div className="flex flex-wrap gap-4 justify-center">
                                {uniqueEmployees.map((employee: any) => {
                                  const colorScheme = getEmployeeColor(employee.id);
                                  return (
                                    <div key={employee.id} className="flex items-center gap-2">
                                      <div className={`w-4 h-4 rounded border-2 ${colorScheme.bg} ${colorScheme.border}`}></div>
                                      <span className="text-sm font-medium">{employee.name}</span>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          </div>
                        );
                      })()
                    ) : (
                      <div className="text-center py-8">
                        <Clock className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                        <h3 className="text-lg font-medium">No shifts for selected period</h3>
                        <p className="text-muted-foreground">Adjust the date range to view shift timeline.</p>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Hover Tooltip */}
                {hoveredShift && (
                  <div 
                    className="fixed z-50 bg-white border border-gray-300 rounded-lg shadow-lg p-4 pointer-events-none"
                    style={{ 
                      left: `${mousePosition.x + 10}px`, 
                      top: `${mousePosition.y - 10}px`,
                      maxWidth: '300px'
                    }}
                  >
                    <div className="space-y-2">
                      <div className="font-semibold text-gray-900">{hoveredShift.employeeName}</div>
                      <div className="text-sm text-gray-600">{format(parseISO(hoveredShift.date), 'EEEE, MMM dd, yyyy')}</div>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div>
                          <span className="font-medium text-blue-700">Start:</span> {hoveredShift.startTime?.slice(0, 5)}
                        </div>
                        <div>
                          <span className="font-medium text-green-700">End:</span> {hoveredShift.endTime?.slice(0, 5)}
                        </div>
                      </div>
                      <div className="text-sm">
                        <span className="font-medium text-purple-700">Duration:</span> {hoveredShift.duration}h
                      </div>
                      <div className="text-sm">
                        <span className="font-medium text-orange-700">Type:</span> <span className="capitalize">{hoveredShift.shiftType}</span>
                      </div>
                      {hoveredShift.notes && (
                        <div className="text-sm">
                          <span className="font-medium text-gray-700">Notes:</span> {hoveredShift.notes}
                        </div>
                      )}
                      {hoveredShift.location && (
                        <div className="text-sm">
                          <span className="font-medium text-gray-700">Location:</span> {hoveredShift.location}
                        </div>
                      )}
                    </div>
                  </div>
                )}



                {/* Employee Hours Breakdown */}
                <Card>
                  <CardHeader>
                    <CardTitle>Employee Hours Summary</CardTitle>
                    <p className="text-sm text-muted-foreground">
                      Total hours per employee in selected period
                    </p>
                  </CardHeader>
                  <CardContent>
                    {Object.keys(employeeTotals).length > 0 ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {Object.entries(employeeTotals)
                          .sort(([,a], [,b]) => (b as number) - (a as number))
                          .map(([name, hours]) => (
                          <div key={name} className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-4">
                            <div className="flex items-center justify-between">
                              <div>
                                <h3 className="font-semibold text-gray-900">{name}</h3>
                                <p className="text-sm text-gray-600">
                                  {filteredShifts.filter((shift: any) => {
                                    const employee = employees.find((emp: any) => emp.id === shift.userId);
                                    return (employee?.name || `User ${shift.userId}`) === name;
                                  }).length} shifts
                                </p>
                              </div>
                              <div className="text-right">
                                <div className="text-2xl font-bold text-blue-900">{(hours as number).toFixed(1)}h</div>
                                <div className="text-xs text-blue-700">
                                  {timelineData.length > 0 ? ((hours as number) / timelineData.length).toFixed(1) : '0'}h/day avg
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8 text-gray-500">
                        No employee data for the selected period.
                      </div>
                    )}
                  </CardContent>
                </Card>
              </>
            );
          })()}
        </TabsContent>

        <TabsContent value="employees" className="space-y-6">
          {/* Daily Hours Breakdown */}
          <Card>
            <CardHeader>
              <CardTitle>Daily Hours by Employee</CardTitle>
              <p className="text-sm text-muted-foreground">
                Hours worked per day split by team members
              </p>
            </CardHeader>
            <CardContent>
              {chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={400}>
                  <BarChart data={chartData} margin={{ top: 20, right: 30, left: 40, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis 
                      label={{ value: 'Hours', angle: -90, position: 'insideLeft' }}
                      tickFormatter={(value) => `${value}h`}
                    />
                    <Tooltip 
                      formatter={(value: any, name: string) => [
                        `${Number(value).toFixed(1)}h`,
                        name
                      ]}
                    />
                    {processedEmployeeList.map((employee: any, index: number) => (
                      <Bar
                        key={employee.id}
                        dataKey={employee.name}
                        stackId="hours"
                        fill={`hsl(${(index * 137.5) % 360}, 70%, 50%)`}
                      />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="text-center py-8">
                  <Clock className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-medium">No shift data</h3>
                  <p className="text-muted-foreground">No shifts recorded for the selected period.</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Daily Summary Table */}
          <Card>
            <CardHeader>
              <CardTitle>Daily Summary</CardTitle>
            </CardHeader>
            <CardContent>
              {Object.keys(dailyData).length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left p-2">Date</th>
                        {processedEmployeeList.map((employee: any) => (
                          <th key={employee.id} className="text-left p-2">{employee.name}</th>
                        ))}
                        <th className="text-left p-2 font-bold">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(dailyData).map(([date, employeeHours]) => {
                        const totalHours = Object.values(employeeHours).reduce((sum: number, hours: any) => sum + hours, 0);
                        return (
                          <tr key={date} className="border-b">
                            <td className="p-2 font-medium">
                              {format(parseISO(date), 'MMM dd, yyyy')}
                            </td>
                            {processedEmployeeList.map((employee: any) => {
                              const hours = employeeHours[employee.id] || 0;
                              return (
                                <td key={employee.id} className="p-2">
                                  {hours > 0 ? `${hours.toFixed(1)}h` : '-'}
                                </td>
                              );
                            })}
                            <td className="p-2 font-bold">{totalHours.toFixed(1)}h</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-4">
                  <p className="text-muted-foreground">No data available for the selected period.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="employees" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Team Members</CardTitle>
              <p className="text-sm text-muted-foreground">
                Manage your team and view their performance
              </p>
            </CardHeader>
            <CardContent>
              {employeesLoading ? (
                <div className="space-y-4">
                  {[...Array(3)].map((_, i) => (
                    <Skeleton key={i} className="h-16 w-full" />
                  ))}
                </div>
              ) : employeeArray.length > 0 ? (
                <div className="space-y-4">
                  {employeeArray.map((employee: any) => (
                    <div key={employee.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center space-x-4">
                        <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                          <span className="text-sm font-medium text-blue-700">
                            {employee.name?.charAt(0) || 'U'}
                          </span>
                        </div>
                        <div>
                          <h3 className="font-medium">{employee.name}</h3>
                          <p className="text-sm text-muted-foreground">{employee.email}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <Badge variant={employee.isActive ? "default" : "secondary"}>
                          {employee.isActive ? "Active" : "Inactive"}
                        </Badge>
                        <p className="text-sm text-muted-foreground mt-1">
                          Role: {employee.role || "Employee"}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-medium">No employees found</h3>
                  <p className="text-muted-foreground">Add employees to your company to see them here.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="shifts" className="space-y-6">
          <div className="grid gap-6">
            {/* Pending Approvals */}
            <Card>
              <CardHeader>
                <CardTitle>Pending Shift Approvals</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Review and approve submitted shifts
                </p>
              </CardHeader>
              <CardContent>
                {pendingLoading ? (
                  <div className="space-y-4">
                    {[...Array(2)].map((_, i) => (
                      <Skeleton key={i} className="h-16 w-full" />
                    ))}
                  </div>
                ) : pendingList.length > 0 ? (
                  <div className="space-y-4">
                    {pendingList.map((shift: any) => (
                      <div key={shift.id} className="flex items-center justify-between p-4 border rounded-lg">
                        <div>
                          <h3 className="font-medium">User ID: {shift.userId}</h3>
                          <p className="text-sm text-muted-foreground">
                            {shift.date} • {shift.startTime} - {shift.endTime}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            Type: {shift.type}
                          </p>
                        </div>
                        <Button 
                          onClick={() => handleApproveShift(shift.id)}
                          disabled={approveShiftMutation.isPending}
                        >
                          Approve
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <UserCheck className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-medium">No pending approvals</h3>
                    <p className="text-muted-foreground">All shifts are up to date.</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Recent Shifts */}
            <Card>
              <CardHeader>
                <CardTitle>Recent Shifts</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Last 7 days of team activity
                </p>
              </CardHeader>
              <CardContent>
                {shiftsLoading ? (
                  <div className="space-y-4">
                    {[...Array(3)].map((_, i) => (
                      <Skeleton key={i} className="h-16 w-full" />
                    ))}
                  </div>
                ) : shiftList.length > 0 ? (
                  <div className="space-y-4">
                    {shiftList.map((shift: any) => (
                      <div key={shift.id} className="flex items-center justify-between p-4 border rounded-lg">
                        <div>
                          <h3 className="font-medium">User ID: {shift.userId}</h3>
                          <p className="text-sm text-muted-foreground">
                            {shift.date} • {shift.startTime} - {shift.endTime}
                          </p>
                        </div>
                        <Badge variant={shift.status === 'approved' ? 'default' : 'secondary'}>
                          {shift.status || 'pending'}
                        </Badge>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <CalendarIcon className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-medium">No shifts found</h3>
                    <p className="text-muted-foreground">No shifts recorded in the last 7 days.</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="calendar" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Team Schedule</CardTitle>
              <p className="text-sm text-muted-foreground">
                View your team's shifts in calendar format with shift details
              </p>
              <div className="flex flex-wrap gap-2 mt-3">
                <div className="flex items-center gap-1 text-xs">
                  <div className="w-3 h-3 rounded bg-yellow-100 border border-yellow-200"></div>
                  <span>Morning</span>
                </div>
                <div className="flex items-center gap-1 text-xs">
                  <div className="w-3 h-3 rounded bg-orange-100 border border-orange-200"></div>
                  <span>Afternoon</span>
                </div>
                <div className="flex items-center gap-1 text-xs">
                  <div className="w-3 h-3 rounded bg-purple-100 border border-purple-200"></div>
                  <span>Evening</span>
                </div>
                <div className="flex items-center gap-1 text-xs">
                  <div className="w-3 h-3 rounded bg-blue-100 border border-blue-200"></div>
                  <span>Night</span>
                </div>
                <div className="flex items-center gap-1 text-xs">
                  <div className="w-3 h-3 rounded bg-red-100 border border-red-200"></div>
                  <span>Double</span>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 lg:grid-cols-7 gap-4">
                {/* Calendar Grid */}
                <div className="lg:col-span-7">
                  <div className="grid grid-cols-7 gap-2 mb-4">
                    {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => (
                      <div key={day} className="text-center font-medium text-sm text-muted-foreground p-2">
                        {day}
                      </div>
                    ))}
                  </div>
                  
                  {/* Calendar Navigation */}
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentDate(subMonths(currentDate, 1))}
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <h2 className="text-lg font-semibold">
                        {format(currentDate, 'MMMM yyyy')}
                      </h2>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentDate(addMonths(currentDate, 1))}
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentDate(new Date())}
                    >
                      Today
                    </Button>
                  </div>

                  {/* Month Calendar Grid */}
                  <div className="grid grid-cols-7 gap-2">
                    {(() => {
                      const monthStart = startOfMonth(currentDate);
                      const monthEnd = endOfMonth(currentDate);
                      const startDate = startOfWeek(monthStart, { weekStartsOn: 1 });
                      const endDate = endOfWeek(monthEnd, { weekStartsOn: 1 });
                      
                      const days = [];
                      let day = startDate;
                      

                      
                      while (day <= endDate) {
                        const dateStr = format(day, 'yyyy-MM-dd');
                        const dayShifts = Array.isArray(allShifts) ? allShifts.filter((shift: any) => shift.date === dateStr) : [];
                        

                        const isCurrentMonth = day.getMonth() === currentDate.getMonth();
                        const isToday = format(day, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd');
                        
                        days.push(
                          <div key={dateStr} className={`border rounded-lg p-2 min-h-[120px] transition-colors ${
                            isCurrentMonth 
                              ? (isToday ? 'bg-blue-50 border-blue-200' : 'bg-white hover:bg-gray-50') 
                              : 'bg-gray-50 text-gray-400'
                          }`}>
                            <div className={`font-medium text-sm mb-2 ${isToday ? 'text-blue-600' : 'text-gray-700'}`}>
                              {format(day, 'd')}
                            </div>
                            <div className="space-y-1">

                              {dayShifts.slice(0, 3).map((shift: any) => {
                                const employee = Array.isArray(employees) ? employees.find((emp: any) => emp.id === shift.userId) : null;
                                const startTime = shift.startTime?.slice(0, 5);
                                const endTime = shift.endTime?.slice(0, 5);
                                const hours = (() => {
                                  if (!shift.startTime || !shift.endTime) return 0;
                                  const start = new Date(`2000-01-01T${shift.startTime}`);
                                  const end = new Date(`2000-01-01T${shift.endTime}`);
                                  if (end < start) end.setDate(end.getDate() + 1);
                                  return ((end.getTime() - start.getTime()) / (1000 * 60 * 60)).toFixed(1);
                                })();
                                
                                const getShiftColor = (type: string) => {
                                  switch (type) {
                                    case 'morning': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
                                    case 'afternoon': return 'bg-orange-100 text-orange-800 border-orange-200';
                                    case 'evening': return 'bg-purple-100 text-purple-800 border-purple-200';
                                    case 'night': return 'bg-blue-100 text-blue-800 border-blue-200';
                                    case 'double': return 'bg-red-100 text-red-800 border-red-200';
                                    default: return 'bg-gray-100 text-gray-800 border-gray-200';
                                  }
                                };
                                
                                return (
                                  <div
                                    key={shift.id}
                                    className={`text-xs p-1.5 rounded-md border ${getShiftColor(shift.shiftType)} hover:shadow-sm transition-shadow`}
                                  >
                                    <div className="font-semibold truncate text-xs" title={employee?.name}>
                                      {employee?.name?.split(' ')[0] || `User ${shift.userId}`}
                                    </div>
                                    <div className="flex justify-between items-center">
                                      <span className="text-xs">{startTime}</span>
                                      <span className="text-xs font-medium">{hours}h</span>
                                    </div>
                                  </div>
                                );
                              })}
                              {dayShifts.length > 3 && (
                                <div className="text-xs text-blue-600 font-medium">
                                  +{dayShifts.length - 3} more
                                </div>
                              )}
                            </div>
                          </div>
                        );
                        
                        day = addDays(day, 1);
                      }
                      return days;
                    })()}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analytics" className="space-y-6">
          <div className="grid gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Team Analytics</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Performance metrics for your team
                </p>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="text-center">
                    <div className="text-3xl font-bold text-blue-600">{totalEmployees}</div>
                    <p className="text-sm text-muted-foreground">Total Team Members</p>
                  </div>
                  <div className="text-center">
                    <div className="text-3xl font-bold text-green-600">{Math.round(totalWeeklyHours)}</div>
                    <p className="text-sm text-muted-foreground">Hours This Week</p>
                  </div>
                  <div className="text-center">
                    <div className="text-3xl font-bold text-orange-600">{(totalWeeklyHours / Math.max(totalEmployees, 1)).toFixed(1)}</div>
                    <p className="text-sm text-muted-foreground">Avg Hours per Employee</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="roster" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Roster Planner</CardTitle>
              <p className="text-sm text-muted-foreground">
                Plan and assign shifts to your team members
              </p>
            </CardHeader>
            <CardContent>
              {/* Week Navigation */}
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentDate(subWeeks(currentDate, 1))}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <h2 className="text-lg font-semibold">
                    Week of {format(startOfWeek(currentDate, { weekStartsOn: 1 }), 'MMM dd, yyyy')}
                  </h2>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentDate(addWeeks(currentDate, 1))}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentDate(new Date())}
                >
                  This Week
                </Button>
              </div>

              {/* Roster Grid */}
              <div className="border rounded-lg overflow-hidden">
                {/* Header Row - Days of the week */}
                <div className="grid grid-cols-8 border-b bg-gray-50">
                  <div className="p-4 font-medium text-sm border-r">Employee</div>
                  {(() => {
                    const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
                    return Array.from({ length: 7 }, (_, i) => {
                      const day = addDays(weekStart, i);
                      return (
                        <div key={i} className="p-4 text-center font-medium text-sm border-r last:border-r-0">
                          <div>{format(day, 'EEE')}</div>
                          <div className="text-xs text-gray-500 mt-1">{format(day, 'MMM dd')}</div>
                        </div>
                      );
                    });
                  })()}
                </div>

                {/* Employee Rows */}
                {employeeArray.map((employee: any) => (
                  <div key={employee.id} className="grid grid-cols-8 border-b last:border-b-0">
                    {/* Employee Name Column */}
                    <div className="p-4 border-r bg-gray-50">
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                          <span className="text-xs font-medium text-blue-700">
                            {employee.name?.charAt(0) || 'U'}
                          </span>
                        </div>
                        <div>
                          <div className="font-medium text-sm">{employee.name}</div>
                          <div className="text-xs text-gray-500">{employee.role || 'Employee'}</div>
                        </div>
                      </div>
                    </div>

                    {/* Day Columns */}
                    {(() => {
                      const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
                      return Array.from({ length: 7 }, (_, dayIndex) => {
                        const day = addDays(weekStart, dayIndex);
                        const dateStr = format(day, 'yyyy-MM-dd');
                        
                        // Find shifts for this employee on this day
                        const dayShifts = Array.isArray(rosterShifts) ? rosterShifts.filter((shift: any) => 
                          shift.userId === employee.id && shift.date === dateStr
                        ) : [];

                        return (
                          <div key={dayIndex} className="p-2 border-r last:border-r-0 min-h-[80px] bg-white hover:bg-gray-50 transition-colors">
                            {/* Existing Shifts */}
                            {dayShifts.map((shift: any) => (
                              <div
                                key={shift.id}
                                className="mb-1 p-2 bg-blue-100 border border-blue-200 rounded text-xs"
                              >
                                <div className="font-medium">
                                  {shift.startTime?.slice(0, 5)} - {shift.endTime?.slice(0, 5)}
                                </div>
                                <div className="text-gray-600 capitalize">{shift.shiftType}</div>
                                {shift.location && (
                                  <div className="text-gray-500 mt-1">{shift.location}</div>
                                )}
                                <div className="flex gap-1 mt-1">
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-4 w-4 p-0 text-gray-400 hover:text-blue-600"
                                    onClick={() => handleEditShift(shift)}
                                  >
                                    ✏️
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-4 w-4 p-0 text-gray-400 hover:text-red-600"
                                    onClick={() => handleDeleteShift(shift.id)}
                                  >
                                    🗑️
                                  </Button>
                                </div>
                              </div>
                            ))}
                            
                            {/* Add Shift Button */}
                            <Button
                              size="sm"
                              variant="ghost"
                              className="w-full h-8 text-xs text-gray-500 hover:text-blue-600 hover:bg-blue-50 border-dashed border border-gray-300 hover:border-blue-300"
                              onClick={() => handleAddShift(employee, dateStr)}
                            >
                              + Add Shift
                            </Button>
                          </div>
                        );
                      });
                    })()}
                  </div>
                ))}
              </div>

              {/* Legend */}
              <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                <h4 className="text-sm font-medium mb-2">Instructions</h4>
                <div className="text-xs text-gray-600 space-y-1">
                  <p>• Click "+ Add Shift" to assign a new shift to an employee</p>
                  <p>• Use the ✏️ icon to edit existing shifts</p>
                  <p>• Use the 🗑️ icon to delete shifts</p>
                  <p>• Navigate between weeks using the arrow buttons</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Shift Modal */}
      <Dialog open={isShiftModalOpen} onOpenChange={setIsShiftModalOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>
              {editingShift ? 'Edit Shift' : 'Add New Shift'}
            </DialogTitle>
          </DialogHeader>
          <ShiftForm
            initialData={editingShift}
            employee={selectedEmployee}
            date={selectedDate}
            onSave={handleSaveShift}
            onCancel={() => setIsShiftModalOpen(false)}
            isLoading={createRosterShiftMutation.isPending || updateRosterShiftMutation.isPending}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Shift Form Component
function ShiftForm({ 
  initialData, 
  employee, 
  date, 
  onSave, 
  onCancel, 
  isLoading 
}: {
  initialData?: any;
  employee?: any;
  date?: string;
  onSave: (data: any) => void;
  onCancel: () => void;
  isLoading: boolean;
}) {
  const form = useForm({
    defaultValues: {
      shiftType: initialData?.shiftType || 'Morning',
      startTime: initialData?.startTime || '09:00',
      endTime: initialData?.endTime || '17:00',
      location: initialData?.location || '',
      notes: initialData?.notes || ''
    }
  });

  const onSubmit = (data: any) => {
    onSave(data);
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-2">
          <Label className="text-sm font-medium">
            {employee ? `Employee: ${employee.name}` : 'Editing shift'}
          </Label>
          {date && (
            <Label className="text-sm text-gray-500">
              Date: {format(new Date(date), 'EEEE, MMMM d, yyyy')}
            </Label>
          )}
        </div>

        <FormField
          control={form.control}
          name="shiftType"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Shift Type</FormLabel>
              <FormControl>
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select shift type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Morning">Morning</SelectItem>
                    <SelectItem value="Evening">Evening</SelectItem>
                    <SelectItem value="Night">Night</SelectItem>
                    <SelectItem value="Double">Double</SelectItem>
                    <SelectItem value="Custom">Custom</SelectItem>
                  </SelectContent>
                </Select>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="startTime"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Start Time</FormLabel>
                <FormControl>
                  <Input type="time" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="endTime"
            render={({ field }) => (
              <FormItem>
                <FormLabel>End Time</FormLabel>
                <FormControl>
                  <Input type="time" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="location"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Location (Optional)</FormLabel>
              <FormControl>
                <Input placeholder="e.g. Store #1, Main Office" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="notes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Notes (Optional)</FormLabel>
              <FormControl>
                <Input placeholder="Additional notes" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" disabled={isLoading} data-testid="button-save-shift">
            {isLoading ? 'Saving...' : 'Save Shift'}
          </Button>
        </DialogFooter>
      </form>
    </Form>
  );
}