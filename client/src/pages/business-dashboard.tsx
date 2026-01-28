import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { Users, Clock, TrendingUp, DollarSign, Calendar as CalendarIcon, UserCheck, AlertTriangle, Building2, Filter, ChevronLeft, ChevronRight, Mail, Send } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from "recharts";
import { useAuth } from "@/hooks/use-auth";
import { Skeleton } from "@/components/ui/skeleton";
import { useCompanyEmployees, useCompanyShifts, usePendingShifts, useApproveShift, useRosterShifts, useCreateRosterShift, useUpdateRosterShift, useDeleteRosterShift, useCopyRosterWeek, useClearRosterWeek } from "@/hooks/use-business";
import { useSendRosterEmail, useSendAllRosterEmails } from "@/hooks/use-email";
import { useCompanyTimeOffByRange } from "@/hooks/use-time-off";
import { Copy, CalendarOff, UserX, UserMinus, Trash2, Download } from "lucide-react";
import html2canvas from "html2canvas";
import { TeamAvailability } from "@/components/TeamAvailability";
import { useToast } from "@/hooks/use-toast";
import { BillingManagement } from "@/components/BillingManagement";
import { EmployeeRatesManagement } from "@/components/EmployeeRatesManagement";
import { EmployeeReportsManagement } from "@/components/EmployeeReportsManagement";
import { EmployeeManagement } from "@/components/EmployeeManagement";
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

interface BusinessDashboardProps {
  defaultTab?: string;
}

export default function BusinessDashboard({ defaultTab = "overview" }: BusinessDashboardProps) {
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
  
  // Drag selection state
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<{date: string, hour: number} | null>(null);
  const [dragEnd, setDragEnd] = useState<{date: string, hour: number} | null>(null);
  const [dragPreview, setDragPreview] = useState<{date: string, startHour: number, endHour: number} | null>(null);
  
  // Email notification state
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
  const [emailSending, setEmailSending] = useState(false);
  const [emailResults, setEmailResults] = useState<any>(null);

  // Employee rates configuration state
  const [isRatesModalOpen, setIsRatesModalOpen] = useState(false);
  const [selectedEmployeeForRates, setSelectedEmployeeForRates] = useState<number | null>(null);

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
  const copyRosterWeekMutation = useCopyRosterWeek();
  const clearRosterWeekMutation = useClearRosterWeek();
  const rosterExportRef = useRef<HTMLDivElement>(null);
  const [isExporting, setIsExporting] = useState(false);

  const handleExportRosterImage = async () => {
    if (!rosterExportRef.current) return;
    setIsExporting(true);
    try {
      // Build a clean export-only DOM
      const exportDiv = document.createElement('div');
      exportDiv.style.cssText = 'padding:24px;background:#fff;font-family:system-ui,-apple-system,sans-serif;width:900px';

      // Header
      exportDiv.innerHTML = `
        <div style="text-align:center;padding-bottom:16px;margin-bottom:16px;border-bottom:2px solid #e5e7eb">
          <h2 style="font-size:20px;font-weight:700;color:#111827;margin:0">Weekly Roster</h2>
          <p style="font-size:13px;color:#6b7280;margin:6px 0 0">${weekStart} — ${weekEnd}</p>
        </div>
      `;

      // Get data for the table
      const ws = startOfWeek(currentDate, { weekStartsOn: 1 });
      const exportDays = Array.from({ length: 7 }, (_, i) => addDays(ws, i));
      const templates = [
        { label: 'Morning', time: '8:00 - 11:00', startTime: '08:00', endTime: '11:00' },
        { label: 'Afternoon', time: '12:30 - 5:00', startTime: '12:30', endTime: '17:00' },
        { label: 'Night', time: '5:30 - 11:00', startTime: '17:30', endTime: '23:00' },
      ];
      const empList = (activeEmployeeArray || []).filter((emp: any) => emp.id !== businessUser?.id);
      const trimT = (t: string) => t?.substring(0, 5) || '';
      const COLORS_HEX = ['#bfdbfe','#a7f3d0','#fed7aa','#fbcfe8','#a5f3fc','#fde68a','#ddd6fe','#fecdd3','#d9f99d','#c7d2fe'];

      // Build table
      let tableHTML = `<table style="width:100%;border-collapse:collapse;font-size:13px">`;
      // Header row
      tableHTML += `<tr style="background:#f9fafb"><th style="padding:10px 8px;border:1px solid #e5e7eb;text-align:left;font-size:12px;color:#374151">Shift</th>`;
      exportDays.forEach(day => {
        const isToday = format(day, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd');
        tableHTML += `<th style="padding:10px 6px;border:1px solid #e5e7eb;text-align:center;font-size:12px;color:${isToday ? '#2563eb' : '#374151'};${isToday ? 'background:#eff6ff' : ''}">${format(day, 'EEE')}<br><span style="font-size:11px;color:${isToday ? '#3b82f6' : '#9ca3af'}">${format(day, 'MMM dd')}</span></th>`;
      });
      tableHTML += `</tr>`;

      // Template rows
      templates.forEach(tpl => {
        tableHTML += `<tr><td style="padding:10px 8px;border:1px solid #e5e7eb;background:#f9fafb;font-weight:600;color:#1f2937">${tpl.label}<br><span style="font-size:11px;font-weight:400;color:#9ca3af">${tpl.time}</span></td>`;
        exportDays.forEach(day => {
          const dateStr = format(day, 'yyyy-MM-dd');
          const cellShifts = Array.isArray(rosterShifts) ? rosterShifts.filter((s: any) =>
            s.date === dateStr && trimT(s.startTime) === tpl.startTime && trimT(s.endTime) === tpl.endTime
          ) : [];
          let cellHTML = '';
          cellShifts.forEach((shift: any) => {
            const emp = empList.find((e: any) => e.id === shift.userId);
            if (!emp) return;
            const idx = empList.findIndex((e: any) => e.id === emp.id);
            const bgColor = COLORS_HEX[idx % COLORS_HEX.length];
            const name = emp.name.split(' ')[0] + (emp.name.split(' ')[1] ? ' ' + emp.name.split(' ')[1][0] + '.' : '');
            cellHTML += `<div style="background:${bgColor};border-radius:4px;padding:4px 8px;margin:2px 0;font-size:12px;font-weight:600;color:#1f2937">${name}</div>`;
          });
          if (!cellHTML) cellHTML = `<span style="color:#d1d5db;font-size:11px">—</span>`;
          tableHTML += `<td style="padding:6px;border:1px solid #e5e7eb;text-align:center;vertical-align:top">${cellHTML}</td>`;
        });
        tableHTML += `</tr>`;
      });
      tableHTML += `</table>`;

      // Legend
      let legendHTML = `<div style="margin-top:12px;display:flex;flex-wrap:wrap;gap:10px;font-size:11px;color:#6b7280">`;
      empList.forEach((emp: any, idx: number) => {
        const bgColor = COLORS_HEX[idx % COLORS_HEX.length];
        legendHTML += `<span style="display:inline-flex;align-items:center;gap:4px"><span style="width:12px;height:12px;border-radius:3px;background:${bgColor};display:inline-block"></span>${emp.name}</span>`;
      });
      legendHTML += `</div>`;

      exportDiv.innerHTML += tableHTML + legendHTML;
      document.body.appendChild(exportDiv);

      const canvas = await html2canvas(exportDiv, {
        backgroundColor: '#ffffff',
        scale: 2,
        useCORS: true,
        logging: false,
      });

      document.body.removeChild(exportDiv);

      const link = document.createElement('a');
      link.download = `roster-${weekStart}-to-${weekEnd}.jpg`;
      link.href = canvas.toDataURL('image/jpeg', 0.95);
      link.click();
    } catch (error) {
      console.error('Export failed:', error);
      toast({ title: "Error", description: "Failed to export roster image", variant: "destructive" });
    } finally {
      setIsExporting(false);
    }
  };

  // Time-off requests for availability indicators (AC-005-3)
  const { data: companyTimeOff = [] } = useCompanyTimeOffByRange(businessUser?.companyId, weekStart, weekEnd);

  const approveShiftMutation = useApproveShift();

  const { toast } = useToast();

  // Email mutations
  const sendRosterEmailMutation = useSendRosterEmail(businessUser?.companyId || 0);
  const sendAllRosterEmailsMutation = useSendAllRosterEmails(businessUser?.companyId || 0);

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
  const activeEmployeeArray = employeeArray.filter((emp: any) => emp.isActive !== false);
  const shiftList = Array.isArray(shifts) ? shifts : [];
  const pendingList = Array.isArray(pendingShifts) ? pendingShifts : [];

  const totalEmployees = employeeArray.length;
  const activeEmployees = activeEmployeeArray.length;
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
    console.log('Editing shift:', shift); // Debug log
    setEditingShift(shift);
    setSelectedEmployee(null);
    setSelectedDate(shift.date || "");
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

  // Copy roster from previous week (AC-005-7)
  const handleCopyFromPreviousWeek = async () => {
    const previousWeekStart = format(subWeeks(startOfWeek(currentDate, { weekStartsOn: 1 }), 1), 'yyyy-MM-dd');

    if (confirm(`Copy all shifts from week of ${previousWeekStart} to current week?`)) {
      try {
        const result = await copyRosterWeekMutation.mutateAsync({
          sourceWeekStart: previousWeekStart,
          targetWeekStart: weekStart
        });
        toast({
          title: "Roster Copied",
          description: `Successfully copied ${result.shifts?.length || 0} shifts from previous week`,
        });
      } catch (error: any) {
        toast({
          title: "Error",
          description: error.message || "Failed to copy roster",
          variant: "destructive"
        });
      }
    }
  };

  // Helper to get employee availability for a specific date (AC-005-3)
  const getEmployeeAvailability = (employeeId: number, dateStr: string) => {
    const timeOffs = companyTimeOff.filter((to: any) =>
      to.userId === employeeId &&
      to.startDate <= dateStr &&
      to.endDate >= dateStr &&
      (to.status === 'confirmed' || to.status === 'approved' || to.status === 'pending')
    );

    if (timeOffs.length === 0) return 'available';
    if (timeOffs.some((to: any) => to.isFullDay)) return 'unavailable';
    return 'partial';
  };

  // Conflict detection helper
  const checkForConflicts = (employeeId: number, date: string, startTime: string, endTime: string, excludeShiftId?: number) => {
    const conflicts = Array.isArray(rosterShifts) ? rosterShifts.filter((shift: any) => {
      // Skip the shift being edited
      if (excludeShiftId && shift.id === excludeShiftId) return false;
      
      // Only check shifts for the same employee and date
      if (shift.userId !== employeeId || shift.date !== date) return false;
      
      // Parse times
      const newStart = new Date(`2000-01-01T${startTime}:00`);
      const newEnd = new Date(`2000-01-01T${endTime}:00`);
      const existingStart = new Date(`2000-01-01T${shift.startTime}:00`);
      const existingEnd = new Date(`2000-01-01T${shift.endTime}:00`);
      
      // Check for overlap: shifts overlap if new start < existing end AND new end > existing start
      return newStart < existingEnd && newEnd > existingStart;
    }) : [];
    
    return conflicts;
  };

  const handleSaveShift = async (shiftData: any) => {
    try {
      const employeeId = selectedEmployee?.id || editingShift?.userId;
      const date = selectedDate || editingShift?.date;
      
      // Check for conflicts before saving
      const conflicts = checkForConflicts(
        employeeId,
        date,
        shiftData.startTime,
        shiftData.endTime,
        editingShift?.id
      );
      
      if (conflicts.length > 0) {
        const conflictTimes = conflicts.map((shift: any) =>
          `${shift.startTime} - ${shift.endTime}`
        ).join(', ');

        const shouldContinue = confirm(
          `⚠️ Schedule Conflict Detected!\n\nThis employee already has shifts scheduled at:\n${conflictTimes}\n\nDo you want to proceed anyway?`
        );

        if (!shouldContinue) {
          return;
        }
      }

      // AC-006-5: Check if employee is unavailable on this date
      const availability = getEmployeeAvailability(employeeId, date);
      if (availability !== 'available') {
        const statusLabel = availability === 'unavailable' ? 'UNAVAILABLE' : 'PARTIALLY AVAILABLE';
        const timeOffs = companyTimeOff.filter((to: any) =>
          to.userId === employeeId &&
          to.startDate <= date &&
          to.endDate >= date &&
          (to.status === 'confirmed' || to.status === 'approved' || to.status === 'pending')
        );
        const reasons = timeOffs
          .filter((to: any) => to.reason)
          .map((to: any) => to.reason)
          .join('; ');

        const shouldContinue = confirm(
          `⚠️ Availability Conflict!\n\nThis employee is ${statusLabel} on ${date}.${reasons ? `\nReason: ${reasons}` : ''}\n\nDo you want to assign this shift anyway?`
        );

        if (!shouldContinue) {
          return;
        }
      }

      if (editingShift && editingShift.id) {
        // Update existing shift
        console.log('Updating shift - editingShift:', editingShift); // Debug log
        console.log('Shift ID for update:', editingShift.id); // Debug log
        await updateRosterShiftMutation.mutateAsync({
          shiftId: editingShift.id,
          shiftData: {
            ...shiftData,
            userId: parseInt(shiftData.employeeId),
            date: editingShift.date
          }
        });
      } else {
        // Create new shift
        await createRosterShiftMutation.mutateAsync({
          ...shiftData,
          userId: parseInt(shiftData.employeeId) || selectedEmployee?.id,
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

  const handleAddShiftAtTime = (date: string, time: string) => {
    setSelectedDate(date);
    setSelectedEmployee(null);
    setEditingShift({
      startTime: time,
      endTime: time.replace(/\d{2}:/, (match) => {
        const hour = parseInt(match.slice(0, 2));
        return `${(hour + 3).toString().padStart(2, '0')}:`;
      })
    });
    setIsShiftModalOpen(true);
  };

  // Drag selection handlers
  const handleMouseDown = (date: string, hour: number, event: any) => {
    // Prevent drag if clicking on existing shift
    if ((event.target as Element).closest('.shift-block')) {
      return;
    }
    
    event.preventDefault();
    setIsDragging(true);
    setDragStart({ date, hour });
    setDragEnd({ date, hour });
    setDragPreview({ date, startHour: hour, endHour: hour });
  };

  const handleMouseEnter = (date: string, hour: number) => {
    if (isDragging && dragStart) {
      // Only allow dragging within the same day
      if (date === dragStart.date) {
        const startHour = Math.min(dragStart.hour, hour);
        const endHour = Math.max(dragStart.hour, hour);
        setDragEnd({ date, hour });
        setDragPreview({ date, startHour, endHour });
      }
    }
  };

  const handleMouseUp = () => {
    if (isDragging && dragStart && dragEnd && dragPreview) {
      const startTime = `${dragPreview.startHour.toString().padStart(2, '0')}:00`;
      const endTime = `${(dragPreview.endHour + 1).toString().padStart(2, '0')}:00`;
      
      // Open shift creation modal with calculated times
      setSelectedDate(dragPreview.date);
      setSelectedEmployee(null);
      setEditingShift({
        startTime,
        endTime
      });
      setIsShiftModalOpen(true);
    }
    
    // Reset drag state
    setIsDragging(false);
    setDragStart(null);
    setDragEnd(null);
    setDragPreview(null);
  };

  // Add global mouse up listener
  useEffect(() => {
    const handleGlobalMouseUp = () => {
      if (isDragging) {
        handleMouseUp();
      }
    };

    document.addEventListener('mouseup', handleGlobalMouseUp);
    return () => document.removeEventListener('mouseup', handleGlobalMouseUp);
  }, [isDragging, dragStart, dragEnd, dragPreview]);

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

      {/* Main Content - Conditional rendering based on defaultTab */}
      {defaultTab === "overview" && (
        <div className="space-y-6">
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
            // Filter to only include uploaded shifts (exclude roster shifts)
            const filteredShifts = Array.isArray(allShifts) 
              ? allShifts.filter((shift: any) => 
                  shift.date >= overviewStartDate && 
                  shift.date <= overviewEndDate &&
                  (!shift.createdBy || shift.createdBy === shift.userId)
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
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  <Card className="border-gray-200 shadow-sm hover:shadow-md transition-shadow duration-200">
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between mb-3">
                        <p className="text-sm font-medium text-gray-600">Total Hours</p>
                        <div className="w-11 h-11 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center shadow-md">
                          <Clock className="h-6 w-6 text-white" />
                        </div>
                      </div>
                      <div className="text-3xl font-bold text-gray-900 mb-1">{totalPeriodHours.toFixed(1)}<span className="text-xl text-gray-600 ml-1">hrs</span></div>
                      <p className="text-xs text-gray-600">
                        {format(parseISO(overviewStartDate), 'MMM dd')} - {format(parseISO(overviewEndDate), 'MMM dd')}
                      </p>
                    </CardContent>
                  </Card>

                  <Card className="border-gray-200 shadow-sm hover:shadow-md transition-shadow duration-200">
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between mb-3">
                        <p className="text-sm font-medium text-gray-600">Total Shifts</p>
                        <div className="w-11 h-11 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl flex items-center justify-center shadow-md">
                          <CalendarIcon className="h-6 w-6 text-white" />
                        </div>
                      </div>
                      <div className="text-3xl font-bold text-gray-900 mb-1">{filteredShifts.length}</div>
                      <p className="text-xs text-gray-600">
                        {timelineData.length} days worked
                      </p>
                    </CardContent>
                  </Card>

                  <Card className="border-gray-200 shadow-sm hover:shadow-md transition-shadow duration-200">
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between mb-3">
                        <p className="text-sm font-medium text-gray-600">Daily Average</p>
                        <div className="w-11 h-11 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl flex items-center justify-center shadow-md">
                          <TrendingUp className="h-6 w-6 text-white" />
                        </div>
                      </div>
                      <div className="text-3xl font-bold text-gray-900 mb-1">
                        {timelineData.length > 0 ? (totalPeriodHours / timelineData.length).toFixed(1) : '0'}<span className="text-xl text-gray-600 ml-1">hrs</span>
                      </div>
                      <p className="text-xs text-gray-600">
                        Per working day
                      </p>
                    </CardContent>
                  </Card>

                  <Card className="border-gray-200 shadow-sm hover:shadow-md transition-shadow duration-200">
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between mb-3">
                        <p className="text-sm font-medium text-gray-600">Active Employees</p>
                        <div className="w-11 h-11 bg-gradient-to-br from-amber-500 to-amber-600 rounded-xl flex items-center justify-center shadow-md">
                          <Users className="h-6 w-6 text-white" />
                        </div>
                      </div>
                      <div className="text-3xl font-bold text-gray-900 mb-1">{Object.keys(employeeTotals).length}</div>
                      <p className="text-xs text-gray-600">
                        In this period
                      </p>
                    </CardContent>
                  </Card>
                </div>

                {/* Timeline Chart - Days vs Hours */}
                <Card className="border-gray-200 shadow-sm">
                  <CardHeader>
                    <div className="flex items-center space-x-3">
                      <div className="w-11 h-11 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center shadow-md">
                        <CalendarIcon className="h-6 w-6 text-white" />
                      </div>
                      <div>
                        <CardTitle className="text-lg font-semibold text-gray-900">Shift Timeline</CardTitle>
                        <p className="text-sm text-gray-600">
                          Days (x-axis) vs Hours (y-axis) showing when shifts occur
                        </p>
                      </div>
                    </div>
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
        </div>
      )}

      {defaultTab === "employees" && (
        <div className="space-y-6">
          <EmployeeManagement
            companyId={businessUser?.companyId || 1}
            onConfigureRates={(employeeId) => {
              setSelectedEmployeeForRates(employeeId);
              setIsRatesModalOpen(true);
            }}
          />
        </div>
      )}

        {/* Employee Rates Configuration Modal */}
        <Dialog open={isRatesModalOpen} onOpenChange={setIsRatesModalOpen}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5" />
                Configure Employee Rates
              </DialogTitle>
              <DialogDescription>
                Set hourly rates for different shift types and day categories.
              </DialogDescription>
            </DialogHeader>
            {selectedEmployeeForRates && (
              <EmployeeRatesManagement
                companyId={businessUser?.companyId || 1}
                initialEmployeeId={selectedEmployeeForRates}
              />
            )}
          </DialogContent>
        </Dialog>

      {defaultTab === "roster" && (
        <div className="space-y-6">
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
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentDate(new Date())}
                  >
                    This Week
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleCopyFromPreviousWeek}
                    disabled={copyRosterWeekMutation.isPending}
                    data-testid="button-copy-previous-week"
                    title="Copy all shifts from the previous week"
                  >
                    {copyRosterWeekMutation.isPending ? (
                      <>
                        <Clock className="h-4 w-4 mr-2 animate-spin" />
                        Copying...
                      </>
                    ) : (
                      <>
                        <Copy className="h-4 w-4 mr-2" />
                        Copy Previous Week
                      </>
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleExportRosterImage}
                    disabled={isExporting}
                  >
                    {isExporting ? (
                      <><Clock className="h-4 w-4 mr-2 animate-spin" />Exporting...</>
                    ) : (
                      <><Download className="h-4 w-4 mr-2" />Export JPG</>
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={async () => {
                      if (!confirm('Are you sure you want to clear ALL roster shifts for this week? This cannot be undone.')) return;
                      try {
                        const result = await clearRosterWeekMutation.mutateAsync({ startDate: weekStart, endDate: weekEnd });
                        toast({ title: "Week Cleared", description: result.message });
                      } catch (error: any) {
                        toast({ title: "Error", description: error.message || "Failed to clear week", variant: "destructive" });
                      }
                    }}
                    disabled={clearRosterWeekMutation.isPending}
                    className="text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
                  >
                    {clearRosterWeekMutation.isPending ? (
                      <><Clock className="h-4 w-4 mr-2 animate-spin" />Clearing...</>
                    ) : (
                      <><Trash2 className="h-4 w-4 mr-2" />Clear Week</>
                    )}
                  </Button>
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => {
                      sendAllRosterEmailsMutation.mutate({
                        weekStart,
                        weekEnd
                      });
                    }}
                    disabled={sendAllRosterEmailsMutation.isPending}
                    data-testid="button-send-all-roster-emails"
                  >
                    {sendAllRosterEmailsMutation.isPending ? (
                      <>
                        <Clock className="h-4 w-4 mr-2 animate-spin" />
                        Sending...
                      </>
                    ) : (
                      <>
                        <Send className="h-4 w-4 mr-2" />
                        Email Roster to All
                      </>
                    )}
                  </Button>
                </div>
              </div>

              {/* Shift Template Roster Grid */}
              <div ref={rosterExportRef} className="bg-white p-2">
              {(() => {
                const ws = startOfWeek(currentDate, { weekStartsOn: 1 });
                const days = Array.from({ length: 7 }, (_, i) => addDays(ws, i));

                // Pre-fixed shift templates
                const shiftTemplates = [
                  { id: 'morning', label: 'Morning', time: '8:00 - 11:00 AM', startTime: '08:00', endTime: '11:00', shiftType: 'morning' },
                  { id: 'afternoon', label: 'Afternoon', time: '12:30 - 5:00 PM', startTime: '12:30', endTime: '17:00', shiftType: 'afternoon' },
                  { id: 'night', label: 'Night', time: '5:30 - 11:00 PM', startTime: '17:30', endTime: '23:00', shiftType: 'night' },
                ];

                // Employee colors palette (unique per employee)
                const EMPLOYEE_COLORS = [
                  { bg: 'bg-blue-200', border: 'border-blue-400', text: 'text-blue-900', dot: 'bg-blue-500' },
                  { bg: 'bg-emerald-200', border: 'border-emerald-400', text: 'text-emerald-900', dot: 'bg-emerald-500' },
                  { bg: 'bg-orange-200', border: 'border-orange-400', text: 'text-orange-900', dot: 'bg-orange-500' },
                  { bg: 'bg-pink-200', border: 'border-pink-400', text: 'text-pink-900', dot: 'bg-pink-500' },
                  { bg: 'bg-cyan-200', border: 'border-cyan-400', text: 'text-cyan-900', dot: 'bg-cyan-500' },
                  { bg: 'bg-amber-200', border: 'border-amber-400', text: 'text-amber-900', dot: 'bg-amber-500' },
                  { bg: 'bg-violet-200', border: 'border-violet-400', text: 'text-violet-900', dot: 'bg-violet-500' },
                  { bg: 'bg-rose-200', border: 'border-rose-400', text: 'text-rose-900', dot: 'bg-rose-500' },
                  { bg: 'bg-lime-200', border: 'border-lime-400', text: 'text-lime-900', dot: 'bg-lime-500' },
                  { bg: 'bg-indigo-200', border: 'border-indigo-400', text: 'text-indigo-900', dot: 'bg-indigo-500' },
                ];

                // Assignable employees (exclude the owner)
                const assignableEmployees = activeEmployeeArray.filter((emp: any) => emp.id !== businessUser?.id);

                const trimTime = (t: string) => t?.substring(0, 5) || '';

                // Helper to check if a shift matches any template
                const isTemplateShift = (s: any) => shiftTemplates.some(
                  tpl => trimTime(s.startTime) === tpl.startTime && trimTime(s.endTime) === tpl.endTime
                );

                const getEmployeeColor = (empId: number) => {
                  const idx = assignableEmployees.findIndex((e: any) => e.id === empId);
                  return EMPLOYEE_COLORS[idx % EMPLOYEE_COLORS.length];
                };

                // Check which employees are unavailable on a given date
                const getUnavailableEmployeeIds = (dateStr: string): Set<number> => {
                  const ids = new Set<number>();
                  assignableEmployees.forEach((emp: any) => {
                    if (getEmployeeAvailability(emp.id, dateStr) === 'unavailable') {
                      ids.add(emp.id);
                    }
                  });
                  return ids;
                };

                return (
                  <>
                    <div className="border rounded-lg overflow-x-auto">
                      {/* Header - Days */}
                      <div className="grid grid-cols-[100px_repeat(7,minmax(90px,1fr))] border-b bg-gray-50 sticky top-0 z-10 min-w-[730px]">
                        <div className="p-2 font-medium text-xs border-r">Shift</div>
                        {days.map((day, i) => {
                          const isToday = format(day, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd');
                          return (
                            <div key={i} className={`p-2 text-center font-medium text-xs border-r last:border-r-0 ${isToday ? 'bg-blue-50' : ''}`}>
                              <div className={isToday ? 'text-blue-600' : ''}>{format(day, 'EEE')}</div>
                              <div className={`text-xs ${isToday ? 'text-blue-500' : 'text-gray-500'}`}>{format(day, 'MMM dd')}</div>
                            </div>
                          );
                        })}
                      </div>

                      {/* Shift template rows */}
                      {shiftTemplates.map((template) => (
                        <div key={template.id} className="grid grid-cols-[100px_repeat(7,minmax(90px,1fr))] border-b last:border-b-0 min-w-[730px]">
                          {/* Template label */}
                          <div className="p-3 border-r bg-gray-50">
                            <div className="text-sm font-semibold text-gray-800">{template.label}</div>
                            <div className="text-xs text-gray-500">{template.time}</div>
                          </div>

                          {/* Day cells */}
                          {days.map((day, dayIndex) => {
                            const dateStr = format(day, 'yyyy-MM-dd');
                            const unavailableIds = getUnavailableEmployeeIds(dateStr);

                            // Find shifts matching this template slot (compare HH:MM only, DB may return HH:MM:SS)
                            const cellShifts = Array.isArray(rosterShifts) ? rosterShifts.filter((s: any) =>
                              s.date === dateStr &&
                              trimTime(s.startTime) === template.startTime &&
                              trimTime(s.endTime) === template.endTime
                            ) : [];

                            return (
                              <div
                                key={dayIndex}
                                className="relative border-r last:border-r-0 min-h-[80px] p-1.5 group min-w-0"
                              >
                                {/* Unavailability background */}
                                {unavailableIds.size > 0 && (
                                  <div className="absolute inset-0 pointer-events-none">
                                    <div className="absolute inset-0 bg-red-50 opacity-40" style={{ backgroundImage: 'repeating-linear-gradient(135deg, transparent, transparent 4px, rgba(239,68,68,0.12) 4px, rgba(239,68,68,0.12) 8px)' }} />
                                    <div className="absolute bottom-1 left-1 right-1 flex flex-wrap gap-0.5">
                                      {assignableEmployees
                                        .filter((emp: any) => unavailableIds.has(emp.id))
                                        .map((emp: any) => {
                                          const color = getEmployeeColor(emp.id);
                                          return (
                                            <span
                                              key={emp.id}
                                              className={`inline-flex items-center gap-0.5 px-1 py-0 rounded text-[9px] font-medium ${color.bg} ${color.text} opacity-70`}
                                              title={`${emp.name} - Unavailable`}
                                            >
                                              <span className={`w-1.5 h-1.5 rounded-full ${color.dot}`} />
                                              {emp.name.split(' ')[0]}
                                            </span>
                                          );
                                        })
                                      }
                                    </div>
                                  </div>
                                )}

                                {/* Assigned employee chips */}
                                <div className="space-y-0.5 min-w-0">
                                  {cellShifts.map((shift: any) => {
                                    const emp = assignableEmployees.find((e: any) => e.id === shift.userId);
                                    if (!emp) return null;
                                    const color = getEmployeeColor(emp.id);
                                    const isUnavail = unavailableIds.has(emp.id);

                                    return (
                                      <div
                                        key={shift.id}
                                        className={`rounded px-1.5 py-1 text-[11px] font-semibold border cursor-pointer hover:shadow-md transition-shadow flex items-center min-w-0 max-w-full ${color.bg} ${color.border} ${color.text} ${isUnavail ? 'ring-2 ring-red-400' : ''}`}
                                        onClick={() => handleEditShift(shift)}
                                        title={isUnavail ? `${emp.name} is unavailable!` : emp.name}
                                      >
                                        <span className="leading-tight">{emp.name.split(' ')[0]}{emp.name.split(' ')[1] ? ` ${emp.name.split(' ')[1][0]}.` : ''}</span>
                                        <button
                                          className="ml-1 opacity-0 group-hover:opacity-100 hover:text-red-600 flex-shrink-0"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleDeleteShift(shift.id);
                                          }}
                                        >
                                          x
                                        </button>
                                      </div>
                                    );
                                  })}
                                </div>

                                {/* Add employee button */}
                                <div className="mt-1">
                                  <select
                                    className="w-full text-xs border border-dashed border-gray-300 rounded px-1 py-1 text-gray-400 bg-transparent hover:border-blue-400 hover:text-blue-500 cursor-pointer focus:outline-none focus:border-blue-500 focus:text-blue-600"
                                    value=""
                                    onChange={async (e) => {
                                      const empId = parseInt(e.target.value);
                                      if (!empId) return;

                                      // Check availability
                                      const avail = getEmployeeAvailability(empId, dateStr);
                                      if (avail !== 'available') {
                                        const emp = assignableEmployees.find((em: any) => em.id === empId);
                                        const shouldContinue = confirm(
                                          `${emp?.name} is ${avail === 'unavailable' ? 'UNAVAILABLE' : 'PARTIALLY AVAILABLE'} on ${dateStr}.\n\nAssign anyway?`
                                        );
                                        if (!shouldContinue) return;
                                      }

                                      try {
                                        await createRosterShiftMutation.mutateAsync({
                                          userId: empId,
                                          date: dateStr,
                                          startTime: template.startTime,
                                          endTime: template.endTime,
                                          shiftType: template.shiftType,
                                          status: 'scheduled'
                                        });
                                      } catch (error: any) {
                                        toast({
                                          title: "Error",
                                          description: error.message || "Failed to assign shift",
                                          variant: "destructive"
                                        });
                                      }
                                    }}
                                  >
                                    <option value="">+ Assign</option>
                                    {assignableEmployees.map((emp: any) => {
                                      const isAlreadyAssigned = cellShifts.some((s: any) => s.userId === emp.id);
                                      const isUnavail = unavailableIds.has(emp.id);
                                      return (
                                        <option
                                          key={emp.id}
                                          value={emp.id}
                                          disabled={isAlreadyAssigned}
                                        >
                                          {emp.name}{isAlreadyAssigned ? ' (assigned)' : ''}{isUnavail ? ' ⚠️' : ''}
                                        </option>
                                      );
                                    })}
                                  </select>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ))}

                      {/* Custom shifts row */}
                      <div className="grid grid-cols-[100px_repeat(7,minmax(90px,1fr))] border-b last:border-b-0 min-w-[730px]">
                        <div className="p-3 border-r bg-gray-50">
                          <div className="text-sm font-semibold text-gray-800">Custom</div>
                          <div className="text-xs text-gray-500">Any hours</div>
                        </div>
                        {days.map((day, dayIndex) => {
                          const dateStr = format(day, 'yyyy-MM-dd');
                          const unavailableIds = getUnavailableEmployeeIds(dateStr);
                          const customShifts = Array.isArray(rosterShifts) ? rosterShifts.filter((s: any) =>
                            s.date === dateStr && !isTemplateShift(s)
                          ) : [];

                          return (
                            <div key={dayIndex} className="relative border-r last:border-r-0 min-h-[80px] p-1.5 group min-w-0">
                              {/* Custom shift chips */}
                              <div className="space-y-0.5 min-w-0">
                                {customShifts.map((shift: any) => {
                                  const emp = assignableEmployees.find((e: any) => e.id === shift.userId);
                                  if (!emp) return null;
                                  const color = getEmployeeColor(emp.id);
                                  const isUnavail = unavailableIds.has(emp.id);
                                  return (
                                    <div
                                      key={shift.id}
                                      className={`rounded px-1.5 py-1 text-[11px] font-semibold border cursor-pointer hover:shadow-md transition-shadow flex items-center min-w-0 max-w-full ${color.bg} ${color.border} ${color.text} ${isUnavail ? 'ring-2 ring-red-400' : ''}`}
                                      onClick={() => handleEditShift(shift)}
                                      title={`${emp.name} ${trimTime(shift.startTime)}-${trimTime(shift.endTime)}`}
                                    >
                                      <span className="leading-tight">{emp.name.split(' ')[0]} {trimTime(shift.startTime)}-{trimTime(shift.endTime)}</span>
                                      <button
                                        className="ml-1 opacity-0 group-hover:opacity-100 hover:text-red-600 flex-shrink-0"
                                        onClick={(e) => { e.stopPropagation(); handleDeleteShift(shift.id); }}
                                      >x</button>
                                    </div>
                                  );
                                })}
                              </div>
                              {/* Add custom shift button */}
                              <div className="mt-1">
                                <button
                                  className="w-full text-xs border border-dashed border-gray-300 rounded px-1 py-1 text-gray-400 bg-transparent hover:border-blue-400 hover:text-blue-500 cursor-pointer"
                                  onClick={() => {
                                    setSelectedDate(dateStr);
                                    setSelectedEmployee(null);
                                    setEditingShift(null);
                                    setIsShiftModalOpen(true);
                                  }}
                                >
                                  + Custom
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Employee color legend */}
                    <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-gray-600">
                      <span className="font-medium text-gray-500">Employees:</span>
                      {assignableEmployees.map((emp: any) => {
                        const color = getEmployeeColor(emp.id);
                        return (
                          <div key={emp.id} className="flex items-center gap-1">
                            <div className={`w-3 h-3 rounded ${color.dot}`} />
                            <span>{emp.name}</span>
                          </div>
                        );
                      })}
                      <span className="text-gray-400 ml-2">|</span>
                      <div className="flex items-center gap-1 ml-1">
                        <div className="w-4 h-3 rounded-sm opacity-40" style={{ backgroundImage: 'repeating-linear-gradient(135deg, transparent, transparent 2px, rgba(239,68,68,0.2) 2px, rgba(239,68,68,0.2) 4px)', backgroundColor: 'rgba(254,226,226,0.5)' }} />
                        <span className="text-gray-400">= Unavailable</span>
                      </div>
                    </div>

                    {/* Weekly Hours Summary per Employee */}
                    {(() => {
                      const empHours = assignableEmployees.map((emp: any) => {
                        const color = getEmployeeColor(emp.id);
                        let totalMinutes = 0;
                        const dailyMinutes: number[] = [];

                        days.forEach((day) => {
                          const dateStr = format(day, 'yyyy-MM-dd');
                          const empShifts = Array.isArray(rosterShifts) ? rosterShifts.filter((s: any) =>
                            s.date === dateStr && s.userId === emp.id && (s.status === 'scheduled')
                          ) : [];
                          let dayMins = 0;
                          empShifts.forEach((s: any) => {
                            const [sh, sm] = s.startTime.split(':').map(Number);
                            const [eh, em] = s.endTime.split(':').map(Number);
                            let diff = (eh * 60 + em) - (sh * 60 + sm);
                            if (diff < 0) diff += 24 * 60;
                            dayMins += diff;
                          });
                          totalMinutes += dayMins;
                          dailyMinutes.push(dayMins);
                        });

                        const totalHours = Math.round(totalMinutes / 60 * 10) / 10;
                        return { emp, color, totalMinutes, totalHours, dailyMinutes };
                      });

                      const grandTotalMins = empHours.reduce((sum, e) => sum + e.totalMinutes, 0);
                      const grandTotalHours = Math.round(grandTotalMins / 60 * 10) / 10;

                      return (
                        <div className="mt-4 border rounded-lg overflow-hidden">
                          <div className="bg-gray-50 px-3 py-2 border-b">
                            <h4 className="text-sm font-semibold text-gray-700">Weekly Hours Summary</h4>
                          </div>
                          <div className="overflow-x-auto">
                            <table className="w-full text-xs">
                              <thead>
                                <tr className="border-b bg-gray-50">
                                  <th className="text-left px-3 py-1.5 font-medium text-gray-600">Employee</th>
                                  {days.map((day, i) => (
                                    <th key={i} className="text-center px-2 py-1.5 font-medium text-gray-600">{format(day, 'EEE')}</th>
                                  ))}
                                  <th className="text-center px-3 py-1.5 font-semibold text-gray-800">Total</th>
                                </tr>
                              </thead>
                              <tbody>
                                {empHours.map(({ emp, color, totalHours, dailyMinutes }) => (
                                  <tr key={emp.id} className="border-b last:border-b-0 hover:bg-gray-50">
                                    <td className="px-3 py-1.5 font-medium flex items-center gap-1.5">
                                      <span className={`w-2.5 h-2.5 rounded-full ${color.dot}`} />
                                      {emp.name}
                                    </td>
                                    {dailyMinutes.map((mins, i) => (
                                      <td key={i} className={`text-center px-2 py-1.5 ${mins > 0 ? 'text-gray-900' : 'text-gray-300'}`}>
                                        {mins > 0 ? `${Math.round(mins / 60 * 10) / 10}h` : '-'}
                                      </td>
                                    ))}
                                    <td className="text-center px-3 py-1.5 font-bold text-gray-900">{totalHours}h</td>
                                  </tr>
                                ))}
                              </tbody>
                              <tfoot>
                                <tr className="bg-gray-100 font-semibold">
                                  <td className="px-3 py-1.5 text-gray-700">Total</td>
                                  {days.map((day, i) => {
                                    const dayTotal = empHours.reduce((sum, e) => sum + e.dailyMinutes[i], 0);
                                    return (
                                      <td key={i} className="text-center px-2 py-1.5 text-gray-700">
                                        {dayTotal > 0 ? `${Math.round(dayTotal / 60 * 10) / 10}h` : '-'}
                                      </td>
                                    );
                                  })}
                                  <td className="text-center px-3 py-1.5 text-blue-700 font-bold">{grandTotalHours}h</td>
                                </tr>
                              </tfoot>
                            </table>
                          </div>
                        </div>
                      );
                    })()}
                  </>
                );
              })()}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {defaultTab === "billing" && (
        <div className="space-y-6">
          <Tabs defaultValue="employee-rates" className="space-y-4">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="employee-rates" data-testid="tab-employee-rates">Employee Rates</TabsTrigger>
              <TabsTrigger value="employee-reports" data-testid="tab-employee-reports">Employee Reports</TabsTrigger>
              <TabsTrigger value="legacy-tiers" data-testid="tab-legacy-tiers">Legacy Rate Tiers</TabsTrigger>
            </TabsList>

            <TabsContent value="employee-rates">
              <EmployeeRatesManagement companyId={businessUser?.companyId || 1} />
            </TabsContent>

            <TabsContent value="employee-reports">
              <EmployeeReportsManagement companyId={businessUser?.companyId || 1} />
            </TabsContent>

            <TabsContent value="legacy-tiers">
              <BillingManagement companyId={businessUser?.companyId || 1} />
            </TabsContent>
          </Tabs>
        </div>
      )}

      {/* Shift Modal */}
      <Dialog open={isShiftModalOpen} onOpenChange={setIsShiftModalOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>
              {editingShift ? 'Edit Shift' : 'Add New Shift'}
            </DialogTitle>
            <DialogDescription>
              {editingShift ? 'Modify the shift details below.' : 'Create a new shift assignment for your team.'}
            </DialogDescription>
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
  const { data: employees = [] } = useCompanyEmployees(1); // Replace with dynamic company ID
  
  const form = useForm({
    defaultValues: {
      employeeId: (employee?.id || initialData?.userId || '').toString(),
      shiftType: initialData?.shiftType || 'Morning',
      startTime: initialData?.startTime || '09:00',
      endTime: initialData?.endTime || '17:00',
      location: initialData?.location || '',
      notes: initialData?.notes || ''
    }
  });

  // Reset form when initialData changes (for editing)
  useEffect(() => {
    if (initialData) {
      form.reset({
        employeeId: (initialData.userId || '').toString(),
        shiftType: initialData.shiftType || 'Morning',
        startTime: initialData.startTime || '09:00',
        endTime: initialData.endTime || '17:00',
        location: initialData.location || '',
        notes: initialData.notes || ''
      });
    } else if (employee) {
      form.reset({
        employeeId: employee.id.toString(),
        shiftType: 'Morning',
        startTime: '09:00',
        endTime: '17:00',
        location: '',
        notes: ''
      });
    }
  }, [initialData, employee, form]);

  // Preset shift templates
  const shiftTemplates = [
    { name: 'Morning', start: '08:00', end: '11:00', type: 'Morning' },
    { name: 'Afternoon', start: '12:30', end: '17:00', type: 'Afternoon' },
    { name: 'Night', start: '17:30', end: '23:00', type: 'Night' },
    { name: 'Full Day', start: '09:00', end: '17:00', type: 'Full Day' }
  ];

  const applyTemplate = (template: any) => {
    console.log('Applying template:', template); // Debug log
    form.setValue('startTime', template.start);
    form.setValue('endTime', template.end);
    form.setValue('shiftType', template.type);
  };

  const onSubmit = (data: any) => {
    console.log('Form submitted with data:', data); // Debug log
    console.log('Initial data for editing:', initialData); // Debug log

    // Validate that start and end times are not the same
    if (data.startTime === data.endTime) {
      form.setError('endTime', {
        type: 'manual',
        message: 'End time must be different from start time'
      });
      return;
    }

    // Parse times for validation
    const parseTime = (time: string) => {
      const [hours, minutes] = time.split(':').map(Number);
      return hours * 60 + minutes;
    };

    const startMins = parseTime(data.startTime);
    const endMins = parseTime(data.endTime);

    // For normal shifts (not overnight), end should be after start
    // Overnight shifts (end < start) are valid - they cross midnight
    const isOvernightShift = endMins < startMins;

    // Only warn if the shift is suspiciously short (less than 30 mins) and not overnight
    if (!isOvernightShift && (endMins - startMins) < 30) {
      const confirmed = window.confirm('This shift is less than 30 minutes. Are you sure you want to create it?');
      if (!confirmed) return;
    }

    onSave({
      ...data,
      userId: data.employeeId
    });
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-2">
          {date && (
            <Label className="text-sm text-gray-500">
              Date: {format(new Date(date), 'EEEE, MMMM d, yyyy')}
            </Label>
          )}
        </div>

        {/* Preset Templates - Only show when not using a template */}
        {!initialData?.isTemplate && (
          <div>
            <Label className="text-sm font-medium mb-2 block">Quick Templates</Label>
            <div className="grid grid-cols-2 gap-2">
              {shiftTemplates.map((template) => (
                <Button
                  key={template.name}
                  type="button"
                  variant="outline"
                  size="sm"
                  className="text-xs"
                  onClick={() => applyTemplate(template)}
                >
                  {template.name}
                  <span className="ml-1 text-gray-500">
                    {template.start}-{template.end}
                  </span>
                </Button>
              ))}
            </div>
          </div>
        )}

        {/* Template Info - Show when using a template */}
        {initialData?.isTemplate && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <div className="text-sm font-medium text-blue-900 capitalize">
              {initialData.shiftType} Shift
            </div>
            <div className="text-sm text-blue-700">
              {initialData.startTime} - {initialData.endTime}
            </div>
            <div className="text-xs text-blue-600 mt-1">
              Select an employee to assign this shift
            </div>
          </div>
        )}

        {/* Employee Selection */}
        <FormField
          control={form.control}
          name="employeeId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Employee</FormLabel>
              <FormControl>
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select an employee" />
                  </SelectTrigger>
                  <SelectContent>
                    {employees.filter((emp: any) => emp.isActive !== false).map((emp: any) => (
                      <SelectItem key={emp.id} value={emp.id.toString()}>
                        {emp.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Shift Type - Only show when not using a template */}
        {!initialData?.isTemplate && (
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
        )}

        {/* Time Fields - Only show when not using a template */}
        {!initialData?.isTemplate && (
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
        )}

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