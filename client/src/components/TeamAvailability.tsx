import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Users, UserCheck, UserX, UserMinus, CalendarOff, ChevronLeft, ChevronRight, Filter, BarChart3 } from "lucide-react";
import { useCompanyTimeOffByRange } from "@/hooks/use-time-off";
import { useRosterShifts } from "@/hooks/use-business";
import { format, startOfWeek, endOfWeek, addDays, addWeeks, subWeeks } from "date-fns";

interface TeamAvailabilityProps {
  companyId: number;
  employees: any[];
  currentDate: Date;
  rosterShifts: any[];
  companyTimeOff: any[];
}

type AvailabilityStatus = "available" | "partial" | "unavailable";

const STATUS_COLORS: Record<AvailabilityStatus, { bg: string; text: string; label: string }> = {
  available: { bg: "bg-green-100", text: "text-green-700", label: "Available" },
  partial: { bg: "bg-amber-100", text: "text-amber-700", label: "Partial" },
  unavailable: { bg: "bg-red-100", text: "text-red-700", label: "Unavailable" },
};

export function TeamAvailability({
  companyId,
  employees,
  currentDate,
  rosterShifts,
  companyTimeOff,
}: TeamAvailabilityProps) {
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [historyEmployee, setHistoryEmployee] = useState<any>(null);
  const [showCoverage, setShowCoverage] = useState(false);

  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  // Fetch 4-week history data for the history dialog
  const historyStart = format(subWeeks(weekStart, 3), "yyyy-MM-dd");
  const historyEnd = format(endOfWeek(currentDate, { weekStartsOn: 1 }), "yyyy-MM-dd");
  const { data: historyTimeOff = [] } = useCompanyTimeOffByRange(
    historyEmployee ? companyId : undefined,
    historyStart,
    historyEnd
  );

  // Fetch roster shifts for history range
  const { data: historyRosterShifts = [] } = useRosterShifts(
    historyEmployee ? historyStart : undefined,
    historyEmployee ? historyEnd : undefined
  );

  const activeEmployees = useMemo(
    () => employees.filter((e: any) => e.isActive !== false),
    [employees]
  );

  // Get unique roles for filter
  const roles = useMemo(() => {
    const roleSet = new Set<string>();
    activeEmployees.forEach((e: any) => {
      if (e.role) roleSet.add(e.role);
    });
    return Array.from(roleSet).sort();
  }, [activeEmployees]);

  // Filter employees
  const filteredEmployees = useMemo(() => {
    if (roleFilter === "all") return activeEmployees;
    return activeEmployees.filter((e: any) => e.role === roleFilter);
  }, [activeEmployees, roleFilter]);

  // Get availability for a specific employee on a specific date
  const getAvailability = (employeeId: number, dateStr: string): AvailabilityStatus => {
    const timeOffs = companyTimeOff.filter(
      (to: any) =>
        to.userId === employeeId &&
        to.startDate <= dateStr &&
        to.endDate >= dateStr &&
        (to.status === "confirmed" || to.status === "approved" || to.status === "pending")
    );
    if (timeOffs.length === 0) return "available";
    if (timeOffs.some((to: any) => to.isFullDay)) return "unavailable";
    return "partial";
  };

  // Get availability from history time-off data
  const getHistoryAvailability = (employeeId: number, dateStr: string): AvailabilityStatus => {
    const timeOffs = historyTimeOff.filter(
      (to: any) =>
        to.userId === employeeId &&
        to.startDate <= dateStr &&
        to.endDate >= dateStr &&
        (to.status === "confirmed" || to.status === "approved" || to.status === "pending")
    );
    if (timeOffs.length === 0) return "available";
    if (timeOffs.some((to: any) => to.isFullDay)) return "unavailable";
    return "partial";
  };

  // Calculate hours assigned per employee per day
  const getAssignedHours = (employeeId: number, dateStr: string): number => {
    const shifts = Array.isArray(rosterShifts)
      ? rosterShifts.filter((s: any) => s.userId === employeeId && s.date === dateStr)
      : [];
    return shifts.reduce((sum: number, s: any) => {
      if (!s.startTime || !s.endTime) return sum;
      const [sh, sm] = s.startTime.split(":").map(Number);
      const [eh, em] = s.endTime.split(":").map(Number);
      return sum + Math.max(0, eh + em / 60 - (sh + sm / 60));
    }, 0);
  };

  // Coverage: count employees scheduled per day
  const coverageData = useMemo(() => {
    return weekDays.map((day) => {
      const dateStr = format(day, "yyyy-MM-dd");
      const scheduledEmployees = new Set<number>();
      if (Array.isArray(rosterShifts)) {
        rosterShifts.forEach((s: any) => {
          if (s.date === dateStr) scheduledEmployees.add(s.userId);
        });
      }
      const availableCount = activeEmployees.filter(
        (e: any) => getAvailability(e.id, dateStr) !== "unavailable"
      ).length;
      return {
        date: day,
        dateStr,
        scheduled: scheduledEmployees.size,
        available: availableCount,
        total: activeEmployees.length,
      };
    });
  }, [weekDays, rosterShifts, activeEmployees, companyTimeOff]);

  // History weeks for the dialog
  const historyWeeks = useMemo(() => {
    return Array.from({ length: 4 }, (_, i) => {
      const ws = subWeeks(weekStart, 3 - i);
      return {
        label: format(ws, "MMM dd"),
        days: Array.from({ length: 7 }, (_, j) => addDays(ws, j)),
      };
    });
  }, [weekStart]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="h-4 w-4" />
            Team Availability
          </CardTitle>
          <div className="flex items-center gap-2">
            {/* AC-006-2: Role filter */}
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="w-[140px] h-8 text-xs">
                <Filter className="h-3 w-3 mr-1" />
                <SelectValue placeholder="Filter role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Roles</SelectItem>
                {roles.map((role) => (
                  <SelectItem key={role} value={role}>
                    {role.charAt(0).toUpperCase() + role.slice(1)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {/* AC-006-6: Toggle coverage view */}
            <Button
              variant={showCoverage ? "default" : "outline"}
              size="sm"
              className="h-8 text-xs"
              onClick={() => setShowCoverage(!showCoverage)}
            >
              <BarChart3 className="h-3 w-3 mr-1" />
              Coverage
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* AC-006-3: Legend */}
        <div className="flex items-center gap-3 mb-3 text-xs">
          {Object.entries(STATUS_COLORS).map(([key, val]) => (
            <div key={key} className="flex items-center gap-1">
              <div className={`w-3 h-3 rounded ${val.bg}`} />
              <span className="text-muted-foreground">{val.label}</span>
            </div>
          ))}
        </div>

        {/* AC-006-6: Coverage summary */}
        {showCoverage && (
          <div className="mb-4 p-3 bg-gray-50 rounded-lg">
            <h4 className="text-xs font-medium mb-2">Daily Coverage (Scheduled / Available / Total)</h4>
            <div className="grid grid-cols-7 gap-1">
              {coverageData.map((c) => {
                const deficit = c.available > 0 && c.scheduled < Math.ceil(c.available * 0.5);
                return (
                  <div
                    key={c.dateStr}
                    className={`text-center p-2 rounded text-xs ${
                      deficit ? "bg-red-50 border border-red-200" : "bg-white border"
                    }`}
                  >
                    <div className="font-medium">{format(c.date, "EEE")}</div>
                    <div className="text-muted-foreground">{format(c.date, "dd")}</div>
                    <div className={`font-semibold mt-1 ${deficit ? "text-red-600" : "text-green-600"}`}>
                      {c.scheduled}/{c.available}
                    </div>
                    <div className="text-muted-foreground">{c.total} total</div>
                    {deficit && (
                      <Badge variant="destructive" className="text-[10px] mt-1 px-1">
                        Low
                      </Badge>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* AC-006-1: Availability grid/matrix */}
        <div className="border rounded-lg overflow-hidden">
          {/* Header */}
          <div className="grid grid-cols-[180px_repeat(7,1fr)] bg-gray-50 border-b">
            <div className="p-2 text-xs font-medium border-r">Employee</div>
            {weekDays.map((day, i) => (
              <div key={i} className="p-2 text-center text-xs font-medium border-r last:border-r-0">
                <div>{format(day, "EEE")}</div>
                <div className="text-muted-foreground">{format(day, "MMM dd")}</div>
              </div>
            ))}
          </div>

          {/* Employee rows */}
          <div className="max-h-[400px] overflow-y-auto">
            {filteredEmployees.length === 0 ? (
              <div className="p-4 text-center text-sm text-muted-foreground">
                No employees match the selected filter.
              </div>
            ) : (
              filteredEmployees.map((employee: any) => (
                <div
                  key={employee.id}
                  className="grid grid-cols-[180px_repeat(7,1fr)] border-b last:border-b-0 hover:bg-gray-50/50"
                >
                  {/* Employee name + role */}
                  <div
                    className="p-2 border-r flex items-center gap-2 cursor-pointer hover:bg-gray-100"
                    onClick={() => setHistoryEmployee(employee)}
                    title="Click to view availability history"
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-medium truncate">{employee.name}</div>
                      {employee.role && (
                        <div className="text-[10px] text-muted-foreground capitalize">{employee.role}</div>
                      )}
                    </div>
                  </div>

                  {/* Day cells */}
                  {weekDays.map((day, i) => {
                    const dateStr = format(day, "yyyy-MM-dd");
                    const status = getAvailability(employee.id, dateStr);
                    const hours = getAssignedHours(employee.id, dateStr);
                    const colors = STATUS_COLORS[status];

                    return (
                      <div
                        key={i}
                        className={`p-2 border-r last:border-r-0 text-center ${colors.bg}`}
                        title={`${employee.name}: ${colors.label} on ${format(day, "EEE MMM dd")}${hours > 0 ? ` (${hours.toFixed(1)}h assigned)` : ""}`}
                      >
                        {status === "available" ? (
                          <UserCheck className={`h-3.5 w-3.5 mx-auto ${colors.text}`} />
                        ) : status === "partial" ? (
                          <UserMinus className={`h-3.5 w-3.5 mx-auto ${colors.text}`} />
                        ) : (
                          <UserX className={`h-3.5 w-3.5 mx-auto ${colors.text}`} />
                        )}
                        {hours > 0 && (
                          <div className="text-[10px] font-medium mt-0.5">{hours.toFixed(1)}h</div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Summary row */}
        <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
          <span>{filteredEmployees.length} employees shown</span>
          <span>
            Click employee name to view 4-week history
          </span>
        </div>

        {/* AC-006-4: Employee availability history dialog */}
        <Dialog open={!!historyEmployee} onOpenChange={(open) => !open && setHistoryEmployee(null)}>
          <DialogContent className="sm:max-w-[600px]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <CalendarOff className="h-4 w-4" />
                Availability History - {historyEmployee?.name}
              </DialogTitle>
            </DialogHeader>
            {historyEmployee && (
              <div className="space-y-3">
                <p className="text-xs text-muted-foreground">
                  Last 4 weeks of availability for {historyEmployee.name}
                  {historyEmployee.role && ` (${historyEmployee.role})`}
                </p>

                {historyWeeks.map((week, wi) => (
                  <div key={wi} className="border rounded-lg overflow-hidden">
                    <div className="bg-gray-50 px-3 py-1.5 text-xs font-medium border-b">
                      Week of {week.label}
                    </div>
                    <div className="grid grid-cols-7">
                      {week.days.map((day, di) => {
                        const dateStr = format(day, "yyyy-MM-dd");
                        const status = getHistoryAvailability(historyEmployee.id, dateStr);
                        const colors = STATUS_COLORS[status];

                        // Count assigned hours from history
                        const shifts = Array.isArray(historyRosterShifts)
                          ? historyRosterShifts.filter(
                              (s: any) => s.userId === historyEmployee.id && s.date === dateStr
                            )
                          : [];
                        const hours = shifts.reduce((sum: number, s: any) => {
                          if (!s.startTime || !s.endTime) return sum;
                          const [sh, sm] = s.startTime.split(":").map(Number);
                          const [eh, em] = s.endTime.split(":").map(Number);
                          return sum + Math.max(0, eh + em / 60 - (sh + sm / 60));
                        }, 0);

                        return (
                          <div
                            key={di}
                            className={`p-2 text-center border-r last:border-r-0 ${colors.bg}`}
                          >
                            <div className="text-[10px] text-muted-foreground">{format(day, "EEE")}</div>
                            <div className="text-xs font-medium">{format(day, "dd")}</div>
                            {status === "available" ? (
                              <UserCheck className={`h-3 w-3 mx-auto mt-1 ${colors.text}`} />
                            ) : status === "partial" ? (
                              <UserMinus className={`h-3 w-3 mx-auto mt-1 ${colors.text}`} />
                            ) : (
                              <UserX className={`h-3 w-3 mx-auto mt-1 ${colors.text}`} />
                            )}
                            {hours > 0 && (
                              <div className="text-[10px] mt-0.5">{hours.toFixed(1)}h</div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}

                {/* Legend */}
                <div className="flex items-center gap-3 text-xs pt-2 border-t">
                  {Object.entries(STATUS_COLORS).map(([key, val]) => (
                    <div key={key} className="flex items-center gap-1">
                      <div className={`w-3 h-3 rounded ${val.bg}`} />
                      <span className="text-muted-foreground">{val.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
