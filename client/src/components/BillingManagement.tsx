import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  DollarSign, 
  Plus, 
  Edit2, 
  Trash2, 
  Calendar,
  Calculator,
  Clock,
  TrendingUp,
  Building2
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";

interface RateTier {
  id: number;
  companyId: number;
  shiftType: string;
  tierOrder: number;
  hoursInTier: number;
  ratePerHour: number;
  dayType: string;
  currency: string;
  validFrom: string;
  validTo: string;
}

interface PublicHoliday {
  id: number;
  date: string;
  description: string;
}

interface BillingManagementProps {
  companyId: number;
}

export function BillingManagement({ companyId }: BillingManagementProps) {
  const { toast } = useToast();
  const [showRateTierDialog, setShowRateTierDialog] = useState(false);
  const [showHolidayDialog, setShowHolidayDialog] = useState(false);
  const [editingRateTier, setEditingRateTier] = useState<RateTier | null>(null);
  
  // Calculator state
  const [calculatorShiftType, setCalculatorShiftType] = useState("morning");
  const [calculatorDate, setCalculatorDate] = useState("");
  const [calculatorHours, setCalculatorHours] = useState(8);
  const [calculatorResult, setCalculatorResult] = useState<any>(null);

  // Fetch rate tiers
  const { data: rateTiers = [], isLoading: rateLoading, refetch: refetchRates } = useQuery<RateTier[]>({
    queryKey: ['/api/rate-tiers'],
  });

  // Fetch holidays
  const { data: holidays = [], isLoading: holidaysLoading, refetch: refetchHolidays } = useQuery<PublicHoliday[]>({
    queryKey: ['/api/public-holidays'],
  });

  // Mutations
  const createRateTierMutation = useMutation({
    mutationFn: (data: Partial<RateTier>) => apiRequest('POST', '/api/rate-tiers', data),
    onSuccess: () => {
      toast({ title: "Rate tier created successfully" });
      setShowRateTierDialog(false);
      setEditingRateTier(null);
      refetchRates();
    },
    onError: () => {
      toast({ title: "Failed to create rate tier", variant: "destructive" });
    },
  });

  const createHolidayMutation = useMutation({
    mutationFn: (data: Partial<PublicHoliday>) => apiRequest('POST', '/api/public-holidays', data),
    onSuccess: () => {
      toast({ title: "Holiday added successfully" });
      setShowHolidayDialog(false);
      refetchHolidays();
    },
    onError: () => {
      toast({ title: "Failed to add holiday", variant: "destructive" });
    },
  });

  // Group rate tiers by shift type and day type
  const groupedRates = rateTiers.reduce((acc, tier) => {
    const key = `${tier.shiftType}-${tier.dayType}`;
    if (!acc[key]) {
      acc[key] = [];
    }
    acc[key].push(tier);
    return acc;
  }, {} as Record<string, RateTier[]>);

  // Calculate preview using backend billing engine
  const calculatePreview = async () => {
    if (!calculatorDate || !calculatorHours) {
      toast({ title: "Please fill in all calculator fields", variant: "destructive" });
      return;
    }

    try {
      // Calculate start and end times based on hours
      const startHour = 9; // Default start at 9 AM
      const endHour = startHour + calculatorHours;
      const endTime = endHour >= 24 
        ? `${(endHour - 24).toString().padStart(2, '0')}:00`
        : `${endHour.toString().padStart(2, '0')}:00`;
      
      const previewData = {
        shiftType: calculatorShiftType,
        date: calculatorDate,
        startTime: "09:00",
        endTime: endTime,
        hoursWorked: calculatorHours
      };

      const response = await apiRequest('POST', '/api/billing/preview', previewData);

      if (response.ok) {
        const result = await response.json();
        setCalculatorResult(result);
      } else {
        const errorData = await response.json();
        toast({ 
          title: "Failed to calculate preview", 
          description: errorData.message || "Unknown error",
          variant: "destructive" 
        });
      }
    } catch (error) {
      console.error('Preview calculation error:', error);
      toast({ title: "Failed to calculate preview", variant: "destructive" });
    }
  };

  const getDayType = (dateString: string): string => {
    const date = new Date(dateString);
    const dayOfWeek = date.getDay();
    
    // Check if it's a holiday
    if (holidays.some(h => h.date === dateString)) {
      return 'holiday';
    }
    
    if (dayOfWeek === 0) return 'sunday';
    if (dayOfWeek === 6) return 'saturday';
    return 'weekday';
  };

  const formatCurrency = (amount: number, currency: string = 'USD') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
    }).format(amount);
  };

  const getShiftTypeLabel = (shiftType: string) => {
    const labels: Record<string, string> = {
      morning: 'Morning',
      afternoon: 'Afternoon', 
      evening: 'Evening',
      night: 'Night',
      double: 'Double',
      custom: 'Custom'
    };
    return labels[shiftType] || shiftType;
  };

  const getDayTypeLabel = (dayType: string) => {
    const labels: Record<string, string> = {
      weekday: 'Weekday',
      saturday: 'Saturday',
      sunday: 'Sunday',
      holiday: 'Holiday'
    };
    return labels[dayType] || dayType;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Billing Management</h2>
          <p className="text-slate-600">Configure rate tiers, holidays, and payment structures</p>
        </div>
        <div className="flex items-center gap-2">
          <Building2 className="h-5 w-5 text-slate-500" />
          <span className="text-sm text-slate-600">Company ID: {companyId}</span>
        </div>
      </div>

      <Tabs defaultValue="rates" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="rates">Rate Tiers</TabsTrigger>
          <TabsTrigger value="holidays">Holidays</TabsTrigger>
          <TabsTrigger value="calculator">Calculator</TabsTrigger>
          <TabsTrigger value="overview">Overview</TabsTrigger>
        </TabsList>

        {/* Rate Tiers Tab */}
        <TabsContent value="rates" className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Rate Tier Configuration</h3>
            <Dialog open={showRateTierDialog} onOpenChange={setShowRateTierDialog}>
              <DialogTrigger asChild>
                <Button data-testid="add-rate-tier">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Rate Tier
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                  <DialogTitle>
                    {editingRateTier ? 'Edit Rate Tier' : 'Add New Rate Tier'}
                  </DialogTitle>
                </DialogHeader>
                <RateTierForm 
                  initialData={editingRateTier}
                  onSubmit={(data) => createRateTierMutation.mutate(data)}
                  isLoading={createRateTierMutation.isPending}
                />
              </DialogContent>
            </Dialog>
          </div>

          {rateLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map(i => (
                <Skeleton key={i} className="h-24 w-full" />
              ))}
            </div>
          ) : (
            <div className="space-y-4">
              {Object.entries(groupedRates).map(([key, tiers]) => {
                const [shiftType, dayType] = key.split('-');
                return (
                  <Card key={key} data-testid={`rate-group-${key}`}>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <DollarSign className="h-5 w-5" />
                        {getShiftTypeLabel(shiftType)} - {getDayTypeLabel(dayType)}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {tiers.sort((a, b) => a.tierOrder - b.tierOrder).map((tier) => (
                          <div 
                            key={tier.id} 
                            className="flex items-center justify-between p-3 border rounded-lg"
                            data-testid={`rate-tier-${tier.id}`}
                          >
                            <div className="flex items-center gap-4">
                              <div className="text-sm font-medium">Tier {tier.tierOrder}</div>
                              <div className="text-sm text-slate-600">
                                {tier.hoursInTier} hours at {formatCurrency(tier.ratePerHour)}/hour
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setEditingRateTier(tier);
                                  setShowRateTierDialog(true);
                                }}
                                data-testid={`edit-tier-${tier.id}`}
                              >
                                <Edit2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
              
              {rateTiers.length === 0 && (
                <Card>
                  <CardContent className="flex flex-col items-center justify-center py-12">
                    <DollarSign className="h-12 w-12 text-slate-400 mb-4" />
                    <h3 className="text-lg font-semibold text-slate-600 mb-2">No Rate Tiers Configured</h3>
                    <p className="text-slate-500 text-center mb-4">
                      Set up tiered payment rates for different shift types and day types
                    </p>
                    <Button 
                      onClick={() => setShowRateTierDialog(true)}
                      data-testid="create-first-rate-tier"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Create Your First Rate Tier
                    </Button>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </TabsContent>

        {/* Holidays Tab */}
        <TabsContent value="holidays" className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Public Holidays</h3>
            <Dialog open={showHolidayDialog} onOpenChange={setShowHolidayDialog}>
              <DialogTrigger asChild>
                <Button data-testid="add-holiday">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Holiday
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add Public Holiday</DialogTitle>
                </DialogHeader>
                <HolidayForm 
                  onSubmit={(data) => createHolidayMutation.mutate(data)}
                  isLoading={createHolidayMutation.isPending}
                />
              </DialogContent>
            </Dialog>
          </div>

          {holidaysLoading ? (
            <div className="space-y-4">
              {[1, 2].map(i => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : (
            <div className="space-y-4">
              {holidays.map((holiday) => (
                <Card key={holiday.id} data-testid={`holiday-${holiday.id}`}>
                  <CardContent className="flex items-center justify-between p-4">
                    <div className="flex items-center gap-3">
                      <Calendar className="h-5 w-5 text-blue-600" />
                      <div>
                        <div className="font-medium">{holiday.description}</div>
                        <div className="text-sm text-slate-600">
                          {new Date(holiday.date).toLocaleDateString('en-US', {
                            weekday: 'long',
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric'
                          })}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
              
              {holidays.length === 0 && (
                <Card>
                  <CardContent className="flex flex-col items-center justify-center py-12">
                    <Calendar className="h-12 w-12 text-slate-400 mb-4" />
                    <h3 className="text-lg font-semibold text-slate-600 mb-2">No Holidays Configured</h3>
                    <p className="text-slate-500 text-center mb-4">
                      Add public holidays to apply special holiday rates
                    </p>
                    <Button 
                      onClick={() => setShowHolidayDialog(true)}
                      data-testid="create-first-holiday"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add Your First Holiday
                    </Button>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </TabsContent>

        {/* Calculator Tab */}
        <TabsContent value="calculator" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calculator className="h-5 w-5" />
                Pay Calculator
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="calc-shift-type">Shift Type</Label>
                  <Select value={calculatorShiftType} onValueChange={setCalculatorShiftType}>
                    <SelectTrigger data-testid="calc-shift-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="morning">Morning</SelectItem>
                      <SelectItem value="afternoon">Afternoon</SelectItem>
                      <SelectItem value="evening">Evening</SelectItem>
                      <SelectItem value="night">Night</SelectItem>
                      <SelectItem value="double">Double</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <Label htmlFor="calc-date">Date</Label>
                  <Input
                    id="calc-date"
                    type="date"
                    value={calculatorDate}
                    onChange={(e) => setCalculatorDate(e.target.value)}
                    data-testid="calc-date"
                  />
                </div>
                
                <div>
                  <Label htmlFor="calc-hours">Hours Worked</Label>
                  <Input
                    id="calc-hours"
                    type="number"
                    step="0.25"
                    min="0"
                    max="24"
                    value={calculatorHours}
                    onChange={(e) => setCalculatorHours(parseFloat(e.target.value))}
                    data-testid="calc-hours"
                  />
                </div>
              </div>
              
              <Button 
                onClick={calculatePreview} 
                className="w-full"
                data-testid="calculate-pay"
              >
                <Calculator className="h-4 w-4 mr-2" />
                Calculate Pay
              </Button>

              {calculatorResult && (
                <Card className="mt-4">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="font-semibold">Calculation Result</h4>
                      <div className="text-2xl font-bold text-green-600">
                        {formatCurrency(calculatorResult.totalAmount, calculatorResult.currency)}
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <div className="text-sm text-slate-600">
                        <strong>Shift Details:</strong> {calculatorHours} hours on {getDayTypeLabel(calculatorResult.dayType)}
                      </div>
                      
                      {calculatorResult.tiers?.map((tier: any, index: number) => (
                        <div key={index} className="text-sm bg-slate-50 p-2 rounded">
                          Tier {tier.tierOrder}: {tier.hoursWorked} hours × {formatCurrency(tier.ratePerHour)} = {formatCurrency(tier.amount)}
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center">
                  <DollarSign className="h-8 w-8 text-green-600 mr-3" />
                  <div>
                    <div className="text-2xl font-bold">{rateTiers.length}</div>
                    <p className="text-xs text-slate-600">Rate Tiers</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center">
                  <Calendar className="h-8 w-8 text-blue-600 mr-3" />
                  <div>
                    <div className="text-2xl font-bold">{holidays.length}</div>
                    <p className="text-xs text-slate-600">Holidays</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center">
                  <Clock className="h-8 w-8 text-purple-600 mr-3" />
                  <div>
                    <div className="text-2xl font-bold">
                      {Object.keys(groupedRates).length}
                    </div>
                    <p className="text-xs text-slate-600">Rate Groups</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center">
                  <TrendingUp className="h-8 w-8 text-orange-600 mr-3" />
                  <div>
                    <div className="text-2xl font-bold">
                      {rateTiers.length > 0 ? formatCurrency(Math.max(...rateTiers.map(r => r.ratePerHour))) : formatCurrency(0)}
                    </div>
                    <p className="text-xs text-slate-600">Highest Rate</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Rate Configuration Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {Object.entries(groupedRates).map(([key, tiers]) => {
                  const [shiftType, dayType] = key.split('-');
                  const totalTiers = tiers.length;
                  const rateRange = tiers.length > 0 ? {
                    min: Math.min(...tiers.map(t => t.ratePerHour)),
                    max: Math.max(...tiers.map(t => t.ratePerHour))
                  } : { min: 0, max: 0 };
                  
                  return (
                    <div key={key} className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <div className="font-medium">
                          {getShiftTypeLabel(shiftType)} - {getDayTypeLabel(dayType)}
                        </div>
                        <div className="text-sm text-slate-600">
                          {totalTiers} tier{totalTiers !== 1 ? 's' : ''} configured
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-medium">
                          {formatCurrency(rateRange.min)} - {formatCurrency(rateRange.max)}
                        </div>
                        <div className="text-sm text-slate-600">Rate range</div>
                      </div>
                    </div>
                  );
                })}
                
                {Object.keys(groupedRates).length === 0 && (
                  <div className="text-center py-8 text-slate-500">
                    No rate configurations found. Add rate tiers to get started.
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// Rate Tier Form Component
function RateTierForm({ 
  initialData, 
  onSubmit, 
  isLoading 
}: { 
  initialData?: RateTier | null;
  onSubmit: (data: any) => void;
  isLoading: boolean;
}) {
  const [formData, setFormData] = useState({
    shiftType: initialData?.shiftType || 'morning',
    tierOrder: initialData?.tierOrder || 1,
    hoursInTier: initialData?.hoursInTier || 4,
    ratePerHour: initialData?.ratePerHour || 25,
    dayType: initialData?.dayType || 'weekday',
    currency: initialData?.currency || 'USD',
    validFrom: initialData?.validFrom || '2024-01-01',
    validTo: initialData?.validTo || '2025-12-31'
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="shift-type">Shift Type</Label>
          <Select value={formData.shiftType} onValueChange={(value) => setFormData({...formData, shiftType: value})}>
            <SelectTrigger data-testid="rate-shift-type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="morning">Morning</SelectItem>
              <SelectItem value="afternoon">Afternoon</SelectItem>
              <SelectItem value="evening">Evening</SelectItem>
              <SelectItem value="night">Night</SelectItem>
              <SelectItem value="double">Double</SelectItem>
            </SelectContent>
          </Select>
        </div>
        
        <div>
          <Label htmlFor="day-type">Day Type</Label>
          <Select value={formData.dayType} onValueChange={(value) => setFormData({...formData, dayType: value})}>
            <SelectTrigger data-testid="rate-day-type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="weekday">Weekday</SelectItem>
              <SelectItem value="saturday">Saturday</SelectItem>
              <SelectItem value="sunday">Sunday</SelectItem>
              <SelectItem value="holiday">Holiday</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="tier-order">Tier Order</Label>
          <Input
            id="tier-order"
            type="number"
            min="1"
            value={formData.tierOrder}
            onChange={(e) => setFormData({...formData, tierOrder: parseInt(e.target.value)})}
            data-testid="rate-tier-order"
          />
        </div>
        
        <div>
          <Label htmlFor="hours-in-tier">Hours in Tier</Label>
          <Input
            id="hours-in-tier"
            type="number"
            step="0.25"
            min="0.25"
            value={formData.hoursInTier}
            onChange={(e) => setFormData({...formData, hoursInTier: parseFloat(e.target.value)})}
            data-testid="rate-hours-in-tier"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="rate-per-hour">Rate per Hour</Label>
          <Input
            id="rate-per-hour"
            type="number"
            step="0.01"
            min="0"
            value={formData.ratePerHour}
            onChange={(e) => setFormData({...formData, ratePerHour: parseFloat(e.target.value)})}
            data-testid="rate-per-hour"
          />
        </div>
        
        <div>
          <Label htmlFor="currency">Currency</Label>
          <Select value={formData.currency} onValueChange={(value) => setFormData({...formData, currency: value})}>
            <SelectTrigger data-testid="rate-currency">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="USD">USD</SelectItem>
              <SelectItem value="EUR">EUR</SelectItem>
              <SelectItem value="GBP">GBP</SelectItem>
              <SelectItem value="CAD">CAD</SelectItem>
              <SelectItem value="AUD">AUD</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="valid-from">Valid From</Label>
          <Input
            id="valid-from"
            type="date"
            value={formData.validFrom}
            onChange={(e) => setFormData({...formData, validFrom: e.target.value})}
            data-testid="rate-valid-from"
          />
        </div>
        
        <div>
          <Label htmlFor="valid-to">Valid To</Label>
          <Input
            id="valid-to"
            type="date"
            value={formData.validTo}
            onChange={(e) => setFormData({...formData, validTo: e.target.value})}
            data-testid="rate-valid-to"
          />
        </div>
      </div>

      <DialogFooter>
        <Button type="submit" disabled={isLoading} data-testid="save-rate-tier">
          {isLoading ? "Saving..." : "Save Rate Tier"}
        </Button>
      </DialogFooter>
    </form>
  );
}

// Holiday Form Component
function HolidayForm({ 
  onSubmit, 
  isLoading 
}: { 
  onSubmit: (data: any) => void;
  isLoading: boolean;
}) {
  const [formData, setFormData] = useState({
    date: '',
    description: ''
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label htmlFor="holiday-date">Date</Label>
        <Input
          id="holiday-date"
          type="date"
          value={formData.date}
          onChange={(e) => setFormData({...formData, date: e.target.value})}
          required
          data-testid="holiday-date"
        />
      </div>
      
      <div>
        <Label htmlFor="holiday-description">Description</Label>
        <Input
          id="holiday-description"
          value={formData.description}
          onChange={(e) => setFormData({...formData, description: e.target.value})}
          placeholder="e.g., New Year's Day"
          required
          data-testid="holiday-description"
        />
      </div>

      <DialogFooter>
        <Button type="submit" disabled={isLoading} data-testid="save-holiday">
          {isLoading ? "Saving..." : "Add Holiday"}
        </Button>
      </DialogFooter>
    </form>
  );
}