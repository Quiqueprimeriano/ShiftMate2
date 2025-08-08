import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Users, Clock, TrendingUp, DollarSign, Calendar, UserCheck, AlertTriangle, Building2 } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from "recharts";
import { useAuth } from "@/hooks/use-auth";
import { Skeleton } from "@/components/ui/skeleton";
import { useCompanyEmployees, useCompanyShifts, usePendingShifts, useApproveShift } from "@/hooks/use-business";
import { getDateRange } from "@/lib/time-utils";
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

  // Get date range for the last 7 days
  const { startDate, endDate } = getDateRange();

  // Cast user to include company properties
  const businessUser = user as User & { companyId?: number; userType?: string };

  // Fetch real company data
  const { data: employees = [], isLoading: employeesLoading } = useCompanyEmployees(businessUser?.companyId || 0);
  const { data: shifts = [], isLoading: shiftsLoading } = useCompanyShifts(businessUser?.companyId || 0, startDate, endDate);
  const { data: pendingShifts = [], isLoading: pendingLoading } = usePendingShifts(businessUser?.companyId || 0);
  const approveShiftMutation = useApproveShift();

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
  const employeeList = Array.isArray(employees) ? employees : [];
  const shiftList = Array.isArray(shifts) ? shifts : [];
  const pendingList = Array.isArray(pendingShifts) ? pendingShifts : [];

  const totalEmployees = employeeList.length;
  const activeEmployees = employeeList.filter((emp: any) => emp.isActive !== false).length;
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

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Business Dashboard</h1>
          <p className="text-slate-600">Welcome back! Here's your team overview.</p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={selectedTimeframe} onValueChange={setSelectedTimeframe}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="week">This Week</SelectItem>
              <SelectItem value="month">This Month</SelectItem>
              <SelectItem value="quarter">This Quarter</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

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
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="employees">Employees</TabsTrigger>
          <TabsTrigger value="shifts">Shifts</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {/* Charts and Overview */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Weekly Hours Trend</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={mockWeeklyData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="day" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="totalHours" fill="#3b82f6" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Department Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={mockDepartmentData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={120}
                      dataKey="value"
                    >
                      {mockDepartmentData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
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
              ) : employeeList.length > 0 ? (
                <div className="space-y-4">
                  {employeeList.map((employee: any) => (
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
                    <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-medium">No shifts found</h3>
                    <p className="text-muted-foreground">No shifts recorded in the last 7 days.</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
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
      </Tabs>
    </div>
  );
}