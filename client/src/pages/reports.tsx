import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Download, FileText, FileSpreadsheet } from "lucide-react";
import { useShifts } from "@/hooks/use-shifts";
import { exportToCSV, exportToPDF, type ExportOptions } from "@/lib/export";
import { useToast } from "@/hooks/use-toast";

export default function Reports() {
  const { toast } = useToast();
  const [startDate, setStartDate] = useState(() => {
    const date = new Date();
    date.setDate(1); // First day of current month
    return date.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => {
    const date = new Date();
    return date.toISOString().split('T')[0];
  });
  const [format, setFormat] = useState<'pdf' | 'csv'>('pdf');
  const [includeDetails, setIncludeDetails] = useState(true);
  const [includeSummary, setIncludeSummary] = useState(true);
  const [includeAverages, setIncludeAverages] = useState(false);
  const [includeMissing, setIncludeMissing] = useState(false);

  const { data: shifts = [] } = useShifts(startDate, endDate);

  const handleExport = () => {
    if (!startDate || !endDate) {
      toast({
        title: "Error",
        description: "Please select both start and end dates",
        variant: "destructive",
      });
      return;
    }

    if (shifts.length === 0) {
      toast({
        title: "No Data",
        description: "No shifts found for the selected date range",
        variant: "destructive",
      });
      return;
    }

    const options: ExportOptions = {
      format,
      startDate,
      endDate,
      includeDetails,
      includeSummary,
      includeAverages,
      includeMissing,
    };

    try {
      if (format === 'csv') {
        exportToCSV(shifts, options);
      } else {
        exportToPDF(shifts, options);
      }

      toast({
        title: "Success",
        description: `Report exported successfully as ${format.toUpperCase()}`,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to export report. Please try again.",
        variant: "destructive",
      });
    }
  };

  const recentReports = [
    {
      name: "November 2024 Report",
      type: "pdf",
      date: "Nov 1, 2024",
      icon: FileText,
    },
    {
      name: "Q3 2024 Summary",
      type: "csv", 
      date: "Oct 1, 2024",
      icon: FileSpreadsheet,
    },
  ];

  return (
    <div className="p-4 lg:p-8">
      <Card>
        <div className="p-6 border-b border-slate-200">
          <h3 className="text-lg font-semibold text-slate-900">Export Reports</h3>
          <p className="text-sm text-slate-500 mt-1">Generate and download your shift reports</p>
        </div>
        
        <CardContent className="p-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Export Options */}
            <div>
              <h4 className="text-md font-medium text-slate-900 mb-4">Export Options</h4>
              <div className="space-y-4">
                <div>
                  <Label className="text-sm font-medium text-slate-700 mb-2 block">Date Range</Label>
                  <div className="grid grid-cols-2 gap-3">
                    <Input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                    />
                    <Input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                    />
                  </div>
                </div>

                <div>
                  <Label className="text-sm font-medium text-slate-700 mb-2 block">Format</Label>
                  <RadioGroup value={format} onValueChange={(value: 'pdf' | 'csv') => setFormat(value)}>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="pdf" id="pdf" />
                      <Label htmlFor="pdf" className="text-sm">PDF Report</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="csv" id="csv" />
                      <Label htmlFor="csv" className="text-sm">CSV Spreadsheet</Label>
                    </div>
                  </RadioGroup>
                </div>

                <div>
                  <Label className="text-sm font-medium text-slate-700 mb-2 block">Include</Label>
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="details"
                        checked={includeDetails}
                        onCheckedChange={setIncludeDetails}
                      />
                      <Label htmlFor="details" className="text-sm">Shift details</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="summary"
                        checked={includeSummary}
                        onCheckedChange={setIncludeSummary}
                      />
                      <Label htmlFor="summary" className="text-sm">Total hours summary</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="averages"
                        checked={includeAverages}
                        onCheckedChange={setIncludeAverages}
                      />
                      <Label htmlFor="averages" className="text-sm">Daily averages</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="missing"
                        checked={includeMissing}
                        onCheckedChange={setIncludeMissing}
                      />
                      <Label htmlFor="missing" className="text-sm">Missing entries</Label>
                    </div>
                  </div>
                </div>

                <Button onClick={handleExport} className="w-full">
                  <Download className="h-4 w-4 mr-2" />
                  Generate Report
                </Button>
              </div>
            </div>

            {/* Recent Reports */}
            <div>
              <h4 className="text-md font-medium text-slate-900 mb-4">Recent Reports</h4>
              <div className="space-y-3">
                {recentReports.map((report, index) => {
                  const Icon = report.icon;
                  return (
                    <div
                      key={index}
                      className="flex items-center justify-between p-3 border border-slate-200 rounded-lg"
                    >
                      <div className="flex items-center space-x-3">
                        <Icon className={`h-5 w-5 ${
                          report.type === 'pdf' ? 'text-red-500' : 'text-green-500'
                        }`} />
                        <div>
                          <p className="text-sm font-medium text-slate-900">{report.name}</p>
                          <p className="text-xs text-slate-500">Generated {report.date}</p>
                        </div>
                      </div>
                      <Button variant="ghost" size="sm">
                        Download
                      </Button>
                    </div>
                  );
                })}
                
                {recentReports.length === 0 && (
                  <div className="text-sm text-slate-500 text-center py-8">
                    No recent reports
                  </div>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
