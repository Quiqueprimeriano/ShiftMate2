import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, ChevronUp, DollarSign, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

interface Shift {
  id: number;
  date: string;
  startTime: string;
  endTime: string;
  shiftType: string;
}

interface PayBreakdownProps {
  shift: Shift;
}

interface BillingData {
  shiftId: number;
  totalAmount: number;
  currency: string;
  dayType: string;
  shiftDuration: number;
  tiers: Array<{
    tierOrder: number;
    hoursInTier: number;
    hoursWorked: number;
    ratePerHour: number;
    amount: number;
    currency: string;
  }>;
  breakdown: {
    formatted: string;
    details: string;
  };
}

export function PayBreakdown({ shift }: PayBreakdownProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const { data: billingData, isLoading, error } = useQuery<BillingData>({
    queryKey: [`/api/billing/shift/${shift.id}`],
    enabled: !!shift.id,
  });

  if (isLoading) {
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-slate-600">Pay Breakdown</span>
          <Skeleton className="h-6 w-20" />
        </div>
        <Skeleton className="h-8 w-full" />
      </div>
    );
  }

  if (error || !billingData) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
        <div className="flex items-center gap-2">
          <DollarSign className="h-4 w-4 text-yellow-600" />
          <div className="text-sm text-yellow-800">
            <div className="font-medium">Pay Calculation Unavailable</div>
            <div className="text-xs">Rate tiers may not be configured for this shift type</div>
          </div>
        </div>
      </div>
    );
  }

  const formatCurrency = (amount: number, currency: string = 'USD') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
    }).format(amount);
  };

  const formatDayType = (dayType: string) => {
    switch (dayType) {
      case 'weekday': return 'Weekday';
      case 'saturday': return 'Saturday';
      case 'sunday': return 'Sunday';  
      case 'holiday': return 'Holiday';
      default: return dayType;
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-slate-600">Pay Breakdown</span>
        <div className="text-lg font-semibold text-green-600">
          {formatCurrency(billingData.totalAmount || 0, billingData.currency || 'USD')}
        </div>
      </div>

      {/* Summary Card */}
      <div className="bg-green-50 border border-green-200 rounded-lg p-3">
        <div className="flex items-center gap-2 mb-2">
          <DollarSign className="h-4 w-4 text-green-600" />
          <div className="text-sm font-medium text-green-800">Total Earnings</div>
        </div>
        <div className="text-xs text-green-700 space-y-1">
          <div>• {(billingData.shiftDuration || 0).toFixed(1)} hours worked</div>
          <div>• {formatDayType(billingData.dayType || 'weekday')} rates applied</div>
          <div>• {(billingData.tiers || []).length} rate tier{(billingData.tiers || []).length !== 1 ? 's' : ''} used</div>
        </div>
      </div>

      {/* Expandable Details */}
      <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
        <CollapsibleTrigger asChild>
          <Button 
            variant="ghost" 
            size="sm" 
            className="w-full justify-between text-slate-600 hover:text-slate-900"
            data-testid="expand-pay-breakdown"
          >
            <span className="text-sm">View detailed breakdown</span>
            {isExpanded ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </Button>
        </CollapsibleTrigger>
        
        <CollapsibleContent className="space-y-3 mt-3">
          {/* Tier-by-tier breakdown */}
          <div className="space-y-2">
            <div className="text-sm font-medium text-slate-700 mb-2">Rate Tiers</div>
            {(billingData.tiers || []).map((tier, index) => (
              <div 
                key={tier.tierOrder} 
                className="bg-slate-50 rounded-lg p-3 border border-slate-200"
                data-testid={`pay-tier-${tier.tierOrder}`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="text-sm font-medium text-slate-700">
                    Tier {tier.tierOrder}
                  </div>
                  <div className="text-sm font-semibold text-slate-900">
                    {formatCurrency(tier.amount || 0, tier.currency || 'USD')}
                  </div>
                </div>
                <div className="text-xs text-slate-600 space-y-1">
                  <div className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    <span>
                      {(tier.hoursWorked || 0).toFixed(1)} of {tier.hoursInTier || 0} hours at {formatCurrency(tier.ratePerHour || 0, tier.currency || 'USD')}/hour
                    </span>
                  </div>
                  {(tier.hoursWorked || 0) < (tier.hoursInTier || 0) && (
                    <div className="text-slate-500 text-xs">
                      ({((tier.hoursInTier || 0) - (tier.hoursWorked || 0)).toFixed(1)} hours remaining in this tier)
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Calculation Details */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <div className="text-sm font-medium text-blue-800 mb-2">Calculation Details</div>
            <div className="text-xs text-blue-700 whitespace-pre-line">
              {billingData.breakdown?.details || 'Calculation details not available'}
            </div>
          </div>

          {/* Total Summary */}
          <div className="border-t border-slate-200 pt-3">
            <div className="flex items-center justify-between">
              <div className="text-sm font-medium text-slate-700">Total Pay</div>
              <div className="text-lg font-bold text-green-600">
                {formatCurrency(billingData.totalAmount || 0, billingData.currency || 'USD')}
              </div>
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}