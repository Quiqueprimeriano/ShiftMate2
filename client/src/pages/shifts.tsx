import { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Edit, Trash2, Check, Clock, Filter, Search, Calendar, FileText, BarChart3 } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LabelList } from "recharts";
import { usePersonalShifts, useIndividualRosterShifts, useUpdateShift, useDeleteShift } from "@/hooks/use-shifts";
import { generateTimeOptions, formatTime, calculateDuration, formatDateRange, getWeekDates } from "@/lib/time-utils";
import { exportToCSV, exportToPDF } from "@/lib/export";
import { useToast } from "@/hooks/use-toast";
import type { Shift } from "@shared/schema";

// Extended type for shifts with roster indicator
type ExtendedShift = Shift & { isRosterShift: boolean };

export default function Shifts() {
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [shiftToEdit, setShiftToEdit] = useState<ExtendedShift | null>(null);
  
  // Date range filter state
  const currentWeek = getWeekDates(new Date());
  const [startDate, setStartDate] = useState(currentWeek.start);
  const [endDate, setEndDate] = useState(currentWeek.end);
  
  // Fetch both personal and roster shifts separately
  const { data: personalShifts = [], isLoading: isLoadingPersonal } = usePersonalShifts();
  const { data: rosterShifts = [], isLoading: isLoadingRoster } = useIndividualRosterShifts();
  
  const shiftsLoading = isLoadingPersonal || isLoadingRoster;
  
  // Combine shifts with type indicators
  const allShifts = useMemo((): ExtendedShift[] => [
    ...personalShifts.map((shift: Shift) => ({ ...shift, isRosterShift: false })),
    ...rosterShifts.map((shift: Shift) => ({ ...shift, isRosterShift: true }))
  ], [personalShifts, rosterShifts]);
  
  const updateShiftMutation = useUpdateShift();
  const deleteShiftMutation = useDeleteShift();
  const { toast } = useToast();

  const timeOptions = generateTimeOptions();

  // Filter shifts by date range, search term, and type
  const filteredShifts = useMemo(() => {
    if (!allShifts) return [];
    
    return allShifts.filter(shift => {
      // Date range filter
      const shiftDate = shift.date;
      const isInDateRange = shiftDate >= startDate && shiftDate <= endDate;
      
      // Search filter
      const matchesSearch = shift.shiftType.toLowerCase().includes(searchTerm.toLowerCase()) ||
        shift.date.includes(searchTerm) ||
        (shift.notes && shift.notes.toLowerCase().includes(searchTerm.toLowerCase()));
      
      // Type filter
      const matchesType = filterType === "all" || shift.shiftType === filterType;
      
      return isInDateRange && matchesSearch && matchesType;
    });
  }, [allShifts, startDate, endDate, searchTerm, filterType]);

  // Calculate total hours for filtered shifts
  const totalFilteredHours = useMemo(() => {
    return filteredShifts.reduce((total, shift) => 
      total + calculateDuration(shift.startTime, shift.endTime), 0
    );
  }, [filteredShifts]);

  // Prepare chart data for filtered shifts (including all days in range)
  const chartData = useMemo(() => {
    // Generate all dates in the selected range
    const startDateObj = new Date(startDate);
    const endDateObj = new Date(endDate);
    const dateRange: Date[] = [];
    
    for (let d = new Date(startDateObj); d <= endDateObj; d.setDate(d.getDate() + 1)) {
      dateRange.push(new Date(d));
    }

    // Group shifts by date
    const shiftsByDate = filteredShifts.reduce((acc, shift) => {
      const date = shift.date;
      if (!acc[date]) {
        acc[date] = [];
      }
      acc[date].push(shift);
      return acc;
    }, {} as Record<string, any[]>);

    // Create chart data for each date in the range (including days with no shifts)
    return dateRange.map((currentDate) => {
      const dateString = currentDate.toISOString().split('T')[0];
      const dayName = currentDate.toLocaleDateString('en-US', { weekday: 'short' });
      const formattedDate = `${dayName} ${currentDate.getMonth() + 1}/${currentDate.getDate()}`;
      
      const shifts = shiftsByDate[dateString] || [];
      
      // Calculate total hours and shift type breakdown
      const totalHours = shifts.reduce((sum, shift) => 
        sum + calculateDuration(shift.startTime, shift.endTime), 0);
      
      const shiftTypeHours = {
        morningHours: 0,
        eveningHours: 0,
        nightHours: 0,
        doubleHours: 0,
        customHours: 0
      };
      
      shifts.forEach((shift) => {
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

      return {
        day: formattedDate,
        date: dateString,
        totalHours: Number(totalHours.toFixed(2)),
        shiftsCount: shifts.length,
        shifts: shifts,
        ...shiftTypeHours
      };
    });
  }, [filteredShifts, startDate, endDate]);

  // Handle report generation
  const handleGenerateReport = (format: 'pdf' | 'csv') => {
    const options = {
      format,
      startDate,
      endDate,
      includeDetails: true,
      includeSummary: true,
      includeAverages: true,
      includeMissing: false
    };

    if (format === 'csv') {
      exportToCSV(filteredShifts, options);
    } else {
      exportToPDF(filteredShifts, options);
    }

    toast({
      title: "Report Generated",
      description: `${format.toUpperCase()} report for ${formatDateRange(startDate, endDate)} has been downloaded.`,
    });
  };

  // Sort filtered shifts by date (most recent first)
  const displayShifts = useMemo(() => {
    return filteredShifts.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [filteredShifts]);

  const handleEditShift = (shift: ExtendedShift) => {
    // Only allow editing personal shifts, not roster shifts
    if (shift.isRosterShift) {
      toast({
        title: "Cannot Edit Roster Shift",
        description: "This shift was assigned by your manager and cannot be edited.",
        variant: "destructive",
      });
      return;
    }
    setShiftToEdit(shift);
    setShowEditDialog(true);
  };

  const handleUpdateShift = async (shiftData: any) => {
    if (!shiftToEdit) return;

    try {
      await updateShiftMutation.mutateAsync({ 
        id: shiftToEdit.id, 
        ...shiftData 
      });
      
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

  const handleDeleteShift = async (shift: ExtendedShift) => {
    // Only allow deleting personal shifts, not roster shifts
    if (shift.isRosterShift) {
      toast({
        title: "Cannot Delete Roster Shift",
        description: "This shift was assigned by your manager and cannot be deleted.",
        variant: "destructive",
      });
      return;
    }
    
    try {
      await deleteShiftMutation.mutateAsync(shift.id);
      toast({
        title: "Success",
        description: "Shift deleted successfully!",
      });
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
    evening: 'bg-amber-500',
    night: 'bg-indigo-500',
    double: 'bg-red-500',
    custom: 'bg-violet-500'
  };

  const getShiftTypeVariant = (type: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      morning: "default",
      evening: "secondary", 
      night: "outline",
      double: "destructive",
      custom: "secondary"
    };
    return variants[type] || "outline";
  };

  return (
    <div className="p-4 lg:p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">All Shifts</h1>
        <p className="text-slate-600">View, edit, and manage your shift history</p>
      </div>

      {/* Enhanced Search, Filter, and Date Range Controls */}
      <Card>
        <CardContent className="p-6">
          <div className="space-y-4">
            {/* Date Range Filter */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="start-date" className="text-sm font-medium text-slate-700">
                  Start Date
                </Label>
                <Input
                  id="start-date"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="end-date" className="text-sm font-medium text-slate-700">
                  End Date
                </Label>
                <Input
                  id="end-date"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="mt-1"
                />
              </div>
            </div>

            {/* Search and Type Filter */}
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 h-4 w-4" />
                  <Input
                    placeholder="Search shifts by type, date, notes, or time..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              <div className="sm:w-48">
                <Select value={filterType} onValueChange={setFilterType}>
                  <SelectTrigger>
                    <Filter className="h-4 w-4 mr-2" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="morning">Morning</SelectItem>
                    <SelectItem value="evening">Evening</SelectItem>
                    <SelectItem value="night">Night</SelectItem>
                    <SelectItem value="double">Double</SelectItem>
                    <SelectItem value="custom">Custom</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Total Hours and Report Generation */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-4 bg-slate-50 rounded-lg">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <Clock className="h-5 w-5 text-slate-600" />
                  <div>
                    <p className="text-sm font-medium text-slate-900">
                      Total Hours: {totalFilteredHours.toFixed(2)}
                    </p>
                    <p className="text-xs text-slate-600">
                      {formatDateRange(startDate, endDate)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-slate-600" />
                  <div>
                    <p className="text-sm font-medium text-slate-900">
                      {filteredShifts.length} Shifts
                    </p>
                    <p className="text-xs text-slate-600">
                      {chartData.length} Days
                    </p>
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleGenerateReport('csv')}
                  disabled={filteredShifts.length === 0}
                >
                  <FileText className="h-4 w-4 mr-2" />
                  CSV Report
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleGenerateReport('pdf')}
                  disabled={filteredShifts.length === 0}
                >
                  <FileText className="h-4 w-4 mr-2" />
                  PDF Report
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Bar Chart for Selected Date Range */}
      {chartData.length > 0 && (
        <Card>
          <CardContent className="p-6">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">Daily Hours Breakdown</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="day" 
                    tick={{ fontSize: 12 }}
                    angle={-45}
                    textAnchor="end"
                    height={60}
                  />
                  <YAxis 
                    tick={{ fontSize: 12 }}
                    label={{ value: 'Hours', angle: -90, position: 'insideLeft' }}
                  />
                  <Tooltip
                    content={({ active, payload, label }) => {
                      if (active && payload && payload.length > 0) {
                        const data = payload[0].payload;
                        return (
                          <div className="bg-white p-3 border border-slate-200 rounded-lg shadow-lg">
                            <p className="font-medium text-slate-900 mb-2">{label}</p>
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
          </CardContent>
        </Card>
      )}

      {chartData.length === 0 && filteredShifts.length === 0 && (
        <Card>
          <CardContent className="p-6">
            <div className="text-center py-8">
              <BarChart3 className="h-12 w-12 mx-auto mb-3 text-slate-300" />
              <p className="text-lg font-medium text-slate-900">No shifts found</p>
              <p className="text-slate-600">Try adjusting your date range or search filters</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Shifts List */}
      <Card>
        <CardContent className="p-0">
          {shiftsLoading ? (
            <div className="divide-y divide-slate-200">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="p-6 flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <Skeleton className="w-3 h-3 rounded-full" />
                    <div>
                      <Skeleton className="h-4 w-32 mb-1" />
                      <Skeleton className="h-3 w-24" />
                    </div>
                  </div>
                  <div className="text-right">
                    <Skeleton className="h-4 w-40 mb-1" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                  <div className="flex gap-2">
                    <Skeleton className="h-8 w-8" />
                    <Skeleton className="h-8 w-8" />
                  </div>
                </div>
              ))}
            </div>
          ) : filteredShifts.length > 0 ? (
            <div className="divide-y divide-slate-200">
              {filteredShifts.map((shift) => (
                <div key={shift.id} className="p-6 flex items-center justify-between hover:bg-slate-50 transition-colors">
                  <div className="flex items-center space-x-4">
                    <div className={`w-3 h-3 rounded-full ${
                      shiftTypeColors[shift.shiftType as keyof typeof shiftTypeColors] || 'bg-gray-500'
                    }`}></div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-medium text-slate-900 capitalize">
                          {shift.shiftType} Shift
                        </p>
                        <Badge variant={getShiftTypeVariant(shift.shiftType)} className="text-xs">
                          {shift.shiftType}
                        </Badge>
                      </div>
                      <p className="text-sm text-slate-500">
                        {new Date(shift.date).toLocaleDateString('en-US', { 
                          weekday: 'short',
                          month: 'short', 
                          day: 'numeric', 
                          year: 'numeric' 
                        })}
                      </p>
                      {shift.notes && (
                        <p className="text-xs text-slate-400 mt-1 max-w-xs truncate">
                          {shift.notes}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-medium text-slate-900">
                      {formatTime(shift.startTime)} - {formatTime(shift.endTime)}
                    </p>
                    <p className="text-sm text-slate-500">
                      {calculateDuration(shift.startTime, shift.endTime).toFixed(2)} hours
                    </p>
                  </div>
                  <div className="flex items-center gap-2 ml-4">
                    {shift.isRosterShift ? (
                      <div className="flex items-center gap-2 px-2 py-1 bg-blue-50 rounded-lg">
                        <Calendar className="h-3 w-3 text-blue-600" />
                        <span className="text-xs text-blue-800 font-medium">Roster Shift</span>
                      </div>
                    ) : (
                      <>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="touch-target h-8 w-8 p-0"
                          onClick={() => handleEditShift(shift)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="touch-target h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                          onClick={() => handleDeleteShift(shift)}
                          disabled={deleteShiftMutation.isPending}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-12 text-center">
              <Clock className="h-12 w-12 text-slate-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-slate-900 mb-2">No shifts found</h3>
              <p className="text-slate-500">
                {searchTerm || filterType !== "all" 
                  ? "Try adjusting your search or filter criteria" 
                  : "Start tracking your shifts to see them here"
                }
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Shift Modal */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-md w-[calc(100%-2rem)] sm:w-full mx-auto">
          <DialogHeader>
            <DialogTitle>Edit Shift</DialogTitle>
          </DialogHeader>

          {shiftToEdit && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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

          <DialogFooter className="flex-col-reverse sm:flex-row gap-2">
            <Button
              variant="outline"
              onClick={() => setShowEditDialog(false)}
              className="w-full sm:w-auto"
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (shiftToEdit) {
                  const { id, userId, createdAt, ...updateData } = shiftToEdit;
                  handleUpdateShift(updateData);
                }
              }}
              disabled={updateShiftMutation.isPending}
              className="flex items-center justify-center gap-2 w-full sm:w-auto"
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