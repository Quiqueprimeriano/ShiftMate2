import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { FileText, Download, User, Calendar, Clock, DollarSign, TrendingUp, FileDown, FileSpreadsheet } from "lucide-react";
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

  const exportToCSV = () => {
    if (!reportData) return;

    const headers = [
      'Shift Date',
      'Day Type', 
      'Shift Type',
      'Hours Worked',
      'Rate Calculations',
      'Total Amount'
    ];

    const rows = reportData.shifts.map(shift => [
      format(new Date(shift.date), 'yyyy-MM-dd'),
      formatRateType(shift.day_type),
      shift.shift_type,
      shift.total_hours.toFixed(1),
      shift.billing.map(tier => `${tier.hours.toFixed(1)}h × ${formatCurrency(tier.rate)}/h = ${formatCurrency(tier.subtotal)}`).join('; '),
      formatCurrency(shift.total_amount)
    ]);

    // Add summary row
    rows.push([]);
    rows.push(['SUMMARY', '', '', '', '', '']);
    rows.push(['Total Hours', '', '', reportData.summary.totalHours.toFixed(1), '', '']);
    rows.push(['Total Amount', '', '', '', '', formatCurrency(reportData.summary.totalAmount)]);
    
    // Add rate type breakdown
    rows.push([]);
    rows.push(['RATE TYPE BREAKDOWN', '', '', '', '', '']);
    if (reportData.summary.weekdayHours > 0) {
      rows.push(['Weekday', '', '', reportData.summary.weekdayHours.toFixed(1), '', formatCurrency(reportData.summary.weekdayAmount)]);
    }
    if (reportData.summary.weeknightHours > 0) {
      rows.push(['Weeknight', '', '', reportData.summary.weeknightHours.toFixed(1), '', formatCurrency(reportData.summary.weeknightAmount)]);
    }
    if (reportData.summary.saturdayHours > 0) {
      rows.push(['Saturday', '', '', reportData.summary.saturdayHours.toFixed(1), '', formatCurrency(reportData.summary.saturdayAmount)]);
    }
    if (reportData.summary.sundayHours > 0) {
      rows.push(['Sunday', '', '', reportData.summary.sundayHours.toFixed(1), '', formatCurrency(reportData.summary.sundayAmount)]);
    }
    if (reportData.summary.publicHolidayHours > 0) {
      rows.push(['Public Holiday', '', '', reportData.summary.publicHolidayHours.toFixed(1), '', formatCurrency(reportData.summary.publicHolidayAmount)]);
    }

    const csvContent = [headers, ...rows]
      .map(row => row.map(cell => `"${cell}"`).join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `billing-report-${reportData.employee.name.replace(/\s+/g, '-')}-${formatDateRange(reportData.period.startDate, reportData.period.endDate).replace(/\s+/g, '-')}.csv`;
    link.click();

    toast({
      title: "CSV Export Complete",
      description: "Report has been downloaded as CSV file",
    });
  };

  const exportToPDF = () => {
    if (!reportData) return;

    // Create a printable HTML version
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Billing Report - ${reportData.employee.name}</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; color: #333; }
          .header { text-align: center; border-bottom: 2px solid #333; padding-bottom: 20px; margin-bottom: 30px; }
          .employee-info { margin-bottom: 20px; }
          .summary-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; margin-bottom: 30px; }
          .summary-item { text-align: center; padding: 15px; background: #f8f9fa; border-radius: 8px; }
          .summary-item .value { font-size: 24px; font-weight: bold; color: #2563eb; }
          .summary-item .label { font-size: 12px; color: #666; margin-top: 5px; }
          .rate-breakdown { margin-bottom: 30px; }
          .rate-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 15px; margin-bottom: 20px; }
          .rate-item { text-align: center; padding: 10px; background: #f1f5f9; border-radius: 6px; }
          .rate-item .hours { font-size: 16px; font-weight: 600; }
          .rate-item .amount { font-size: 14px; color: #059669; font-weight: 500; }
          .shifts-section { margin-top: 30px; }
          .shift-item { border: 1px solid #e5e7eb; border-radius: 8px; padding: 15px; margin-bottom: 15px; }
          .shift-header { display: flex; justify-content: between; align-items: center; margin-bottom: 10px; }
          .shift-meta { display: flex; gap: 15px; align-items: center; }
          .shift-amount { text-align: right; }
          .shift-amount .total { font-size: 18px; font-weight: bold; color: #059669; }
          .shift-amount .hours { font-size: 12px; color: #666; }
          .rate-calc { background: #f8f9fa; padding: 10px; border-radius: 6px; margin-top: 10px; }
          .rate-calc-title { font-size: 12px; font-weight: 600; color: #374151; margin-bottom: 8px; }
          .rate-calc-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
          .rate-calc-item { font-size: 11px; display: flex; justify-content: space-between; }
          .badge { display: inline-block; padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: 500; }
          .badge-weekday { background: #dbeafe; color: #1d4ed8; }
          .badge-weeknight { background: #ede9fe; color: #7c3aed; }
          .badge-saturday { background: #dcfce7; color: #16a34a; }
          .badge-sunday { background: #fed7aa; color: #ea580c; }
          .badge-publicHoliday { background: #fee2e2; color: #dc2626; }
          @media print {
            body { margin: 0; }
            .no-print { display: none; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>Employee Billing Report</h1>
          <div class="employee-info">
            <h2>${reportData.employee.name}</h2>
            <p>${reportData.employee.email}</p>
            <p><strong>Period:</strong> ${formatDateRange(reportData.period.startDate, reportData.period.endDate)}</p>
          </div>
        </div>
        
        <div class="summary-grid">
          <div class="summary-item">
            <div class="value">${reportData.shifts.length}</div>
            <div class="label">Total Shifts</div>
          </div>
          <div class="summary-item">
            <div class="value">${reportData.summary.totalHours.toFixed(1)}</div>
            <div class="label">Total Hours</div>
          </div>
          <div class="summary-item">
            <div class="value">${formatCurrency(reportData.summary.totalAmount)}</div>
            <div class="label">Total Amount</div>
          </div>
          <div class="summary-item">
            <div class="value">${reportData.summary.totalHours > 0 ? formatCurrency(reportData.summary.totalAmount / reportData.summary.totalHours * 100) : '$0.00'}</div>
            <div class="label">Avg Rate/Hour</div>
          </div>
        </div>

        <div class="rate-breakdown">
          <h3>Rate Type Breakdown</h3>
          <div class="rate-grid">
            ${[
              { type: 'weekday', label: 'Weekday', hours: reportData.summary.weekdayHours, amount: reportData.summary.weekdayAmount },
              { type: 'weeknight', label: 'Weeknight', hours: reportData.summary.weeknightHours, amount: reportData.summary.weeknightAmount },
              { type: 'saturday', label: 'Saturday', hours: reportData.summary.saturdayHours, amount: reportData.summary.saturdayAmount },
              { type: 'sunday', label: 'Sunday', hours: reportData.summary.sundayHours, amount: reportData.summary.sundayAmount },
              { type: 'publicHoliday', label: 'Public Holiday', hours: reportData.summary.publicHolidayHours, amount: reportData.summary.publicHolidayAmount },
            ].filter(item => item.hours > 0).map(item => `
              <div class="rate-item">
                <div class="badge badge-${item.type}">${item.label}</div>
                <div class="hours">${item.hours.toFixed(1)}h</div>
                <div class="amount">${formatCurrency(item.amount)}</div>
              </div>
            `).join('')}
          </div>
        </div>

        <div class="shifts-section">
          <h3>Detailed Shift Breakdown</h3>
          ${reportData.shifts.map((shift, index) => `
            <div class="shift-item">
              <div class="shift-header">
                <div class="shift-meta">
                  <span><strong>Shift #${index + 1}</strong></span>
                  <span class="badge badge-${shift.day_type}">${formatRateType(shift.day_type)}</span>
                  <span>${format(new Date(shift.date), 'MMM dd, yyyy')}</span>
                </div>
                <div class="shift-amount">
                  <div class="total">${formatCurrency(shift.total_amount)}</div>
                  <div class="hours">${shift.total_hours.toFixed(1)} hours</div>
                </div>
              </div>
              ${shift.billing.length > 0 ? `
                <div class="rate-calc">
                  <div class="rate-calc-title">Rate Calculation</div>
                  <div class="rate-calc-grid">
                    ${shift.billing.map(tier => `
                      <div class="rate-calc-item">
                        <span>${tier.hours.toFixed(1)}h × ${formatCurrency(tier.rate)}/h</span>
                        <span><strong>${formatCurrency(tier.subtotal)}</strong></span>
                      </div>
                    `).join('')}
                  </div>
                </div>
              ` : ''}
            </div>
          `).join('')}
        </div>

        <div class="no-print" style="margin-top: 30px; text-align: center;">
          <button onclick="window.print()">Print Report</button>
          <button onclick="window.close()" style="margin-left: 10px;">Close</button>
        </div>
      </body>
      </html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();

    // Auto-trigger print dialog
    setTimeout(() => {
      printWindow.print();
      toast({
        title: "PDF Export Ready",
        description: "Use your browser's print dialog to save as PDF",
      });
    }, 500);
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

          {/* Preview Table */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Invoice Preview
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Summary of daily hours, rates, and totals before generating the detailed invoice.
              </p>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse border border-gray-200 rounded-lg">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="border border-gray-200 px-4 py-3 text-left font-semibold">Date</th>
                      <th className="border border-gray-200 px-4 py-3 text-center font-semibold">Time</th>
                      <th className="border border-gray-200 px-4 py-3 text-center font-semibold">Hours</th>
                      <th className="border border-gray-200 px-4 py-3 text-center font-semibold">Rate Type</th>
                      <th className="border border-gray-200 px-4 py-3 text-center font-semibold">Rates</th>
                      <th className="border border-gray-200 px-4 py-3 text-right font-semibold">Daily Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      // Group shifts by date
                      const dailySummary = reportData.shifts.reduce((acc, shift) => {
                        const date = shift.date;
                        if (!acc[date]) {
                          acc[date] = {
                            date,
                            totalHours: 0,
                            totalAmount: 0,
                            rateTypes: new Set<string>(),
                            rates: new Map<string, number>(),
                            times: [],
                            shifts: []
                          };
                        }
                        acc[date].totalHours += shift.total_hours;
                        acc[date].totalAmount += shift.total_amount;
                        acc[date].rateTypes.add(shift.day_type);
                        
                        // Extract rate from billing data
                        if (shift.billing && shift.billing.length > 0) {
                          shift.billing.forEach(billing => {
                            acc[date].rates.set(shift.day_type, billing.rate);
                          });
                        }
                        
                        // Add time range for this shift
                        if (shift.start_time && shift.end_time) {
                          acc[date].times.push(`${shift.start_time} - ${shift.end_time}`);
                        }
                        
                        acc[date].shifts.push(shift);
                        return acc;
                      }, {} as Record<string, any>);

                      return Object.values(dailySummary).map((day: any) => (
                        <tr key={day.date} className="hover:bg-gray-50">
                          <td className="border border-gray-200 px-4 py-3">
                            <div className="font-medium">
                              {format(new Date(day.date), 'EEEE, MMM dd, yyyy')}
                            </div>
                          </td>
                          <td className="border border-gray-200 px-4 py-3 text-center">
                            <div className="flex flex-col gap-1">
                              {day.times.map((timeRange: string, index: number) => (
                                <div key={index} className="text-sm font-mono text-gray-700">
                                  {timeRange}
                                </div>
                              ))}
                            </div>
                          </td>
                          <td className="border border-gray-200 px-4 py-3 text-center">
                            <span className="font-semibold text-blue-600">
                              {day.totalHours.toFixed(1)}h
                            </span>
                          </td>
                          <td className="border border-gray-200 px-4 py-3 text-center">
                            <div className="flex flex-wrap gap-1 justify-center">
                              {Array.from(day.rateTypes as Set<string>).map((rateType: string) => (
                                <Badge 
                                  key={rateType} 
                                  className={`${getRateTypeBadgeColor(rateType)} text-xs`}
                                >
                                  {formatRateType(rateType)}
                                </Badge>
                              ))}
                            </div>
                          </td>
                          <td className="border border-gray-200 px-4 py-3 text-center">
                            <div className="flex flex-col gap-1">
                              {Array.from(day.rates as Map<string, number>).map(([rateType, rate]) => (
                                <div key={rateType} className="text-sm">
                                  <span className="font-medium text-gray-700">
                                    {formatCurrency(rate)}/hr
                                  </span>
                                  <span className="text-xs text-gray-500 ml-1">
                                    ({formatRateType(rateType)})
                                  </span>
                                </div>
                              ))}
                            </div>
                          </td>
                          <td className="border border-gray-200 px-4 py-3 text-right">
                            <span className="font-bold text-green-600 text-lg">
                              {formatCurrency(day.totalAmount)}
                            </span>
                          </td>
                        </tr>
                      ));
                    })()}
                  </tbody>
                  <tfoot>
                    <tr className="bg-green-50 border-t-2 border-green-200">
                      <td className="border border-gray-200 px-4 py-3 font-bold">TOTAL</td>
                      <td className="border border-gray-200 px-4 py-3 text-center">
                        <span className="text-sm text-gray-600">All Times</span>
                      </td>
                      <td className="border border-gray-200 px-4 py-3 text-center font-bold text-blue-600">
                        {reportData.summary.totalHours.toFixed(1)}h
                      </td>
                      <td className="border border-gray-200 px-4 py-3 text-center">
                        <span className="text-sm text-gray-600">All Types</span>
                      </td>
                      <td className="border border-gray-200 px-4 py-3 text-center">
                        <span className="text-sm text-gray-600">Various</span>
                      </td>
                      <td className="border border-gray-200 px-4 py-3 text-right font-bold text-green-600 text-xl">
                        {formatCurrency(reportData.summary.totalAmount)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Professional Invoice */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Professional Invoice
                </CardTitle>
                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    className="flex items-center gap-2"
                    onClick={exportToCSV}
                    data-testid="button-export-csv"
                  >
                    <FileSpreadsheet className="h-4 w-4" />
                    Export CSV
                  </Button>
                  <Button 
                    variant="outline" 
                    className="flex items-center gap-2"
                    onClick={exportToPDF}
                    data-testid="button-export-pdf"
                  >
                    <FileDown className="h-4 w-4" />
                    Print Invoice
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="bg-white p-8 border border-gray-200 rounded-lg font-mono text-sm space-y-6">
                {/* Invoice Header */}
                <div className="text-center text-2xl font-bold mb-8">
                  INVOICE
                </div>
                
                {/* Billing Information */}
                <div className="grid grid-cols-2 gap-8 mb-8">
                  <div>
                    <div className="font-bold mb-2">BILLED TO:</div>
                    <div className="space-y-1">
                      <div className="font-semibold">[OWNERS NAME]</div>
                      <div>[ADDRESS FROM OWNER]</div>
                    </div>
                  </div>
                  <div className="text-right space-y-1">
                    <div>Invoice No. {reportData.employee.id.toString().padStart(3, '0')}</div>
                    <div>{format(new Date(), 'MMMM dd, yyyy').toUpperCase()}</div>
                  </div>
                </div>
                
                {/* Invoice Items */}
                <div className="border-t border-b border-gray-300 py-4">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="text-left py-2">Item</th>
                        <th className="text-right py-2 w-32">Unit Price</th>
                        <th className="text-right py-2 w-32">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td className="py-4 pr-4">
                          <div>Support hours for {reportData.employee.name} -</div>
                          <div className="text-gray-600 mt-1">
                            {formatDateRange(reportData.period.startDate, reportData.period.endDate)}
                          </div>
                        </td>
                        <td className="text-right py-4">
                          {reportData.summary.totalHours > 0 
                            ? formatCurrency(Math.round(reportData.summary.totalAmount / reportData.summary.totalHours * 100))
                            : formatCurrency(0)
                          }/hr
                        </td>
                        <td className="text-right py-4 font-semibold">
                          {formatCurrency(reportData.summary.totalAmount)}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                
                {/* Totals Section */}
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span>Subtotal</span>
                    <span className="font-semibold">{formatCurrency(reportData.summary.totalAmount)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>GST (0%)</span>
                    <span className="font-semibold">$0</span>
                  </div>
                  <div className="border-t border-gray-300 pt-3">
                    <div className="flex justify-between text-lg font-bold">
                      <span>Total</span>
                      <span>{formatCurrency(reportData.summary.totalAmount)}</span>
                    </div>
                  </div>
                </div>
                
                {/* Payment Information */}
                <div className="mt-8 pt-6 border-t border-gray-300">
                  <div className="font-bold mb-4">PAYMENT INFORMATION</div>
                  <div className="grid grid-cols-2 gap-8">
                    <div className="space-y-1">
                      <div>Account Name: {reportData.employee.name}</div>
                      <div>Account No: [EMPLOYEE NUMBER]</div>
                      <div>BSB: [EMPLOYEE BSB]</div>
                    </div>
                    <div className="text-right space-y-1">
                      <div className="font-semibold">{reportData.employee.name}</div>
                      <div>[EMPLOYEE ADDRESS]</div>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}