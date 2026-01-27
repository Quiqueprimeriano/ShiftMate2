import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { DollarSign, Clock, TrendingUp, Calendar, Info } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

interface Rates {
  id?: number;
  userId: number;
  weekdayRate: number;
  weeknightRate: number;
  saturdayRate: number;
  sundayRate: number;
  publicHolidayRate: number;
  currency: string;
}

interface EarningsBreakdown {
  type: string;
  hours: number;
  rate: number;
  earnings: number;
}

interface EarningsData {
  totalEarnings: number;
  totalHours: number;
  breakdown: EarningsBreakdown[];
  currency: string;
  periodStart: string;
  periodEnd: string;
}

export default function MyEarnings() {
  // Date range for earnings - default "From" to the most recent Saturday
  const now = new Date();
  const dayOfWeek = now.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat
  const daysSinceSaturday = dayOfWeek === 6 ? 0 : dayOfWeek + 1;
  const mostRecentSaturday = new Date(now);
  mostRecentSaturday.setDate(now.getDate() - daysSinceSaturday);

  const [startDate, setStartDate] = useState(mostRecentSaturday.toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(now.toISOString().split('T')[0]);

  // Fetch rates (read-only)
  const { data: rates, isLoading: ratesLoading } = useQuery<Rates>({
    queryKey: ["/api/my-rates"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/my-rates");
      return res.json();
    },
  });

  // Fetch earnings
  const { data: earnings, isLoading: earningsLoading } = useQuery<EarningsData>({
    queryKey: ["/api/my-earnings", startDate, endDate],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/my-earnings?startDate=${startDate}&endDate=${endDate}`);
      return res.json();
    },
  });

  const formatCurrency = (cents: number, currency: string = "USD") => {
    const amount = cents / 100;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
    }).format(amount);
  };

  const rateTypes = [
    { key: "weekdayRate" as const, label: "Weekday", description: "Mon-Fri daytime" },
    { key: "weeknightRate" as const, label: "Weeknight", description: "Mon-Fri evening/night" },
    { key: "saturdayRate" as const, label: "Saturday", description: "All day Saturday" },
    { key: "sundayRate" as const, label: "Sunday", description: "All day Sunday" },
    { key: "publicHolidayRate" as const, label: "Public Holiday", description: "National holidays" },
  ];

  const hasRates = rates && (rates.weekdayRate > 0 || rates.weeknightRate > 0 || rates.saturdayRate > 0 || rates.sundayRate > 0 || rates.publicHolidayRate > 0);

  if (ratesLoading) {
    return (
      <div className="p-4 lg:p-8 space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-8 space-y-6 pb-24 lg:pb-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">My Earnings</h1>
          <p className="text-slate-500 text-sm">View your rates and track earnings</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Earnings Summary Card - First on mobile */}
        <Card className="order-1">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-blue-600" />
              Earnings Summary
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Date Range Selector */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pb-4 border-b border-slate-100">
              <div>
                <Label className="text-xs text-slate-500">From</Label>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-xs text-slate-500">To</Label>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="mt-1"
                />
              </div>
            </div>

            {earningsLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-32 w-full" />
              </div>
            ) : earnings ? (
              <>
                {/* Total Earnings */}
                <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg p-4">
                  <p className="text-sm text-slate-600 mb-1">Total Earnings</p>
                  <p className="text-3xl font-bold text-green-700">
                    {formatCurrency(earnings.totalEarnings, earnings.currency)}
                  </p>
                  <p className="text-sm text-slate-500 mt-1 flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {earnings.totalHours.toFixed(1)} hours worked
                  </p>
                </div>

                {/* Breakdown by Type */}
                {earnings.breakdown && earnings.breakdown.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-slate-700">Breakdown</p>
                    {earnings.breakdown.map((item, index) => (
                      <div key={index} className="flex items-center justify-between py-2 text-sm">
                        <div>
                          <span className="text-slate-700 capitalize">{item.type.replace('_', ' ')}</span>
                          <span className="text-slate-400 ml-2">
                            ({item.hours.toFixed(1)}h x {formatCurrency(item.rate, earnings.currency)})
                          </span>
                        </div>
                        <span className="font-medium text-slate-900">
                          {formatCurrency(item.earnings, earnings.currency)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {earnings.breakdown?.length === 0 && (
                  <div className="text-center py-8 text-slate-500">
                    <Calendar className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>No shifts found in this period</p>
                    <p className="text-xs mt-1">Try selecting a different date range</p>
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-8 text-slate-500">
                <p>Unable to load earnings data</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Rates Card - Read Only (second on mobile) */}
        <Card className="order-2">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-green-600" />
              Hourly Rates
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {!hasRates && (
              <div className="flex items-start gap-3 p-3 bg-amber-50 rounded-lg mb-4">
                <Info className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm">
                  <p className="font-medium text-amber-800">Rates not configured</p>
                  <p className="text-amber-700">Contact your manager to set up your hourly rates.</p>
                </div>
              </div>
            )}
            {rateTypes.map(({ key, label, description }) => (
              <div key={key} className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0">
                <div>
                  <p className="font-medium text-slate-900">{label}</p>
                  <p className="text-xs text-slate-500">{description}</p>
                </div>
                <span className="font-semibold text-slate-900">
                  {formatCurrency(rates?.[key] || 0, rates?.currency)}/hr
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Quick Stats */}
      {earnings && earnings.totalHours > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-4">
              <p className="text-xs text-slate-500">Avg. Hourly</p>
              <p className="text-xl font-bold text-slate-900">
                {formatCurrency(Math.round(earnings.totalEarnings / earnings.totalHours), earnings.currency)}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <p className="text-xs text-slate-500">Total Hours</p>
              <p className="text-xl font-bold text-slate-900">
                {earnings.totalHours.toFixed(1)}h
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <p className="text-xs text-slate-500">Shift Types</p>
              <p className="text-xl font-bold text-slate-900">
                {earnings.breakdown?.length || 0}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <p className="text-xs text-slate-500">Best Rate</p>
              <p className="text-xl font-bold text-slate-900">
                {earnings.breakdown?.length > 0
                  ? formatCurrency(Math.max(...earnings.breakdown.map(b => b.rate)), earnings.currency)
                  : formatCurrency(0, earnings.currency)}
              </p>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
