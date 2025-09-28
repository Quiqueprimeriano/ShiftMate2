import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { FileText, Download, User, Calendar, Clock, DollarSign, TrendingUp } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

interface Employee {
  id: number;
  name: string;
  email: string;
}

interface ShiftBilling {
  shift_id: string | number;
  total_hours: number;
  total_amount: number;
  date: string;
  day_type: string;
  shift_type: string;
  billing: Array<{
    tier: number;
    rate: number;
    hours: number;
    subtotal: number;
  }>;
}

interface EmployeeReport {
  employee: {
    id: number;
    name: string;
    email: string;
  };
  period: {
    startDate: string;
    endDate: string;
  };
  shifts: ShiftBilling[];
  summary: {
    totalHours: number;
    weekdayHours: number;
    weeknightHours: number;
    saturdayHours: number;
    sundayHours: number;
    publicHolidayHours: number;
    totalAmount: number;
    weekdayAmount: number;
    weeknightAmount: number;
    saturdayAmount: number;
    sundayAmount: number;
    publicHolidayAmount: number;
  };
}

interface EmployeeReportsManagementProps {
  companyId: number;
}

export function EmployeeReportsManagement({ companyId }: EmployeeReportsManagementProps) {
  const { toast } = useToast();
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reportData, setReportData] = useState<EmployeeReport | null>(null);
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);

  // Fetch employees
  const { data: employees = [], isLoading: employeesLoading } = useQuery<Employee[]>({
    queryKey: ['/api/companies', companyId, 'employees'],
    queryFn: async () => {
      const response = await apiRequest('GET', `/api/companies/${companyId}/employees`);
      return response.json();
    },
    enabled: !!companyId,
  });

  const handleGenerateReport = async () => {
    if (!selectedEmployeeId || !startDate || !endDate) {
      toast({
        title: "Missing Information",
        description: "Please select an employee and date range",
        variant: "destructive"
      });
      return;
    }

    setIsGeneratingReport(true);
    try {
      const response = await apiRequest('GET', 
        `/api/billing/employee-report?employeeId=${selectedEmployeeId}&startDate=${startDate}&endDate=${endDate}`
      );
      const data = await response.json();
      
      setReportData(data);
      toast({
        title: "Report Generated",
        description: `Billing report created for ${data.employee.name}`,
      });
    } catch (error: any) {
      toast({
        title: "Failed to Generate Report",
        description: error.message || "An error occurred",
        variant: "destructive"
      });
    } finally {
      setIsGeneratingReport(false);
    }
  };

  const formatCurrency = (amountInCents: number): string => {
    return new Intl.NumberFormat('en-AU', {
      style: 'currency',
      currency: 'AUD',
    }).format(amountInCents / 100);
  };

  const formatDateRange = (start: string, end: string): string => {
    const startFormatted = format(new Date(start), 'MMM dd, yyyy');
    const endFormatted = format(new Date(end), 'MMM dd, yyyy');
    return `${startFormatted} - ${endFormatted}`;
  };

  const getRateTypeBadgeColor = (rateType: string): string => {
    switch (rateType) {
      case 'weekday': return 'bg-blue-100 text-blue-800';
      case 'weeknight': return 'bg-purple-100 text-purple-800';
      case 'saturday': return 'bg-green-100 text-green-800';
      case 'sunday': return 'bg-orange-100 text-orange-800';
      case 'publicHoliday': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const formatRateType = (rateType: string): string => {
    switch (rateType) {
      case 'weekday': return 'Weekday';
      case 'weeknight': return 'Weeknight';
      case 'saturday': return 'Saturday';
      case 'sunday': return 'Sunday';
      case 'publicHoliday': return 'Public Holiday';
      default: return rateType;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Employee Billing Reports
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Generate detailed billing reports for individual employees across specific date ranges for invoicing purposes.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Employee Selection */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="employee-select">Employee</Label>
              {employeesLoading ? (
                <Skeleton className="h-10 w-full" />
              ) : (
                <Select 
                  value={selectedEmployeeId} 
                  onValueChange={setSelectedEmployeeId}
                  data-testid="employee-select"
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select employee" />
                  </SelectTrigger>
                  <SelectContent>
                    {employees.map((employee) => (
                      <SelectItem key={employee.id} value={employee.id.toString()}>
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4" />
                          {employee.name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="start-date">Start Date</Label>
              <Input
                id="start-date"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                data-testid="input-start-date"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="end-date">End Date</Label>
              <Input
                id="end-date"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                data-testid="input-end-date"
              />
            </div>
          </div>

          <Button 
            onClick={handleGenerateReport}
            disabled={isGeneratingReport || !selectedEmployeeId || !startDate || !endDate}
            className="w-full md:w-auto"
            data-testid="button-generate-report"
          >
            {isGeneratingReport ? (
              <>Generating Report...</>
            ) : (
              <>
                <FileText className="h-4 w-4 mr-2" />
                Generate Report
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Report Display */}
      {reportData && (
        <div className="space-y-6">
          {/* Report Header */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <User className="h-5 w-5" />
                    {reportData.employee.name}
                  </CardTitle>
                  <p className="text-sm text-muted-foreground">{reportData.employee.email}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-muted-foreground">Period</p>
                  <p className="font-medium">{formatDateRange(reportData.period.startDate, reportData.period.endDate)}</p>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">{reportData.shifts.length}</div>
                  <div className="text-sm text-muted-foreground">Total Shifts</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">{reportData.summary.totalHours.toFixed(1)}</div>
                  <div className="text-sm text-muted-foreground">Total Hours</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-purple-600">{formatCurrency(reportData.summary.totalAmount)}</div>
                  <div className="text-sm text-muted-foreground">Total Amount</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-orange-600">
                    {reportData.summary.totalHours > 0 ? formatCurrency(reportData.summary.totalAmount / reportData.summary.totalHours * 100) : '$0.00'}
                  </div>
                  <div className="text-sm text-muted-foreground">Avg Rate/Hour</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Rate Type Summary */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Rate Type Breakdown
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                {[
                  { type: 'weekday', label: 'Weekday', hours: reportData.summary.weekdayHours, amount: reportData.summary.weekdayAmount },
                  { type: 'weeknight', label: 'Weeknight', hours: reportData.summary.weeknightHours, amount: reportData.summary.weeknightAmount },
                  { type: 'saturday', label: 'Saturday', hours: reportData.summary.saturdayHours, amount: reportData.summary.saturdayAmount },
                  { type: 'sunday', label: 'Sunday', hours: reportData.summary.sundayHours, amount: reportData.summary.sundayAmount },
                  { type: 'publicHoliday', label: 'Public Holiday', hours: reportData.summary.publicHolidayHours, amount: reportData.summary.publicHolidayAmount },
                ].map(({ type, label, hours, amount }) => (
                  hours > 0 && (
                    <div key={type} className="text-center p-4 bg-gray-50 rounded-lg">
                      <Badge className={`mb-2 ${getRateTypeBadgeColor(type)}`}>
                        {label}
                      </Badge>
                      <div className="text-lg font-semibold">{hours.toFixed(1)}h</div>
                      <div className="text-sm font-medium text-green-600">{formatCurrency(amount)}</div>
                    </div>
                  )
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Detailed Shift List */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  Detailed Shift Breakdown
                </CardTitle>
                <Button variant="outline" className="flex items-center gap-2">
                  <Download className="h-4 w-4" />
                  Export PDF
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {reportData.shifts.map((shift, index) => (
                  <div key={shift.shift_id} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="text-sm font-medium">
                          Shift #{index + 1}
                        </div>
                        <Badge className={getRateTypeBadgeColor(shift.day_type)}>
                          {formatRateType(shift.day_type)}
                        </Badge>
                        <div className="text-sm text-muted-foreground">
                          {format(new Date(shift.date), 'MMM dd, yyyy')}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-semibold text-green-600">
                          {formatCurrency(shift.total_amount)}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {shift.total_hours.toFixed(1)} hours
                        </div>
                      </div>
                    </div>
                    
                    {shift.billing.length > 0 && (
                      <div className="bg-gray-50 rounded p-3 mt-3">
                        <div className="text-xs font-medium text-gray-600 mb-2">Rate Calculation</div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-xs">
                          {shift.billing.map((tier, tierIndex) => (
                            <div key={tierIndex} className="flex justify-between">
                              <span>{tier.hours.toFixed(1)}h × {formatCurrency(tier.rate)}/h</span>
                              <span className="font-medium">{formatCurrency(tier.subtotal)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}