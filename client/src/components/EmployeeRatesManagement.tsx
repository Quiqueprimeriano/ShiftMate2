import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { 
  DollarSign, 
  Users, 
  Save,
  Edit2,
  Check,
  X,
  User,
  Clock,
  Calendar,
  Moon,
  Sun,
  Star
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";

interface EmployeeRate {
  userId: number;
  weekdayRate: number;
  weeknightRate: number;
  saturdayRate: number;
  sundayRate: number;
  publicHolidayRate: number;
}

interface Employee {
  id: number;
  name: string;
  email: string;
  companyId: number;
}

interface EmployeeRatesManagementProps {
  companyId: number;
}

export function EmployeeRatesManagement({ companyId }: EmployeeRatesManagementProps) {
  const { toast } = useToast();
  const [editingEmployeeId, setEditingEmployeeId] = useState<number | null>(null);
  const [editingRates, setEditingRates] = useState<Partial<EmployeeRate>>({});

  // Fetch employees
  const { data: employees = [], isLoading: employeesLoading } = useQuery<Employee[]>({
    queryKey: ['/api/companies', companyId, 'employees'],
  });

  // Fetch employee rates for all employees
  const { data: allEmployeeRates = [], isLoading: ratesLoading, refetch: refetchRates } = useQuery<EmployeeRate[]>({
    queryKey: ['/api/companies', companyId, 'employee-rates'],
    queryFn: async () => {
      const response = await apiRequest('GET', `/api/companies/${companyId}/employee-rates`);
      return response.json();
    },
    enabled: !!companyId,
  });

  // Create a map for easy lookup of rates by userId
  const ratesMap = allEmployeeRates.reduce((acc, rate) => {
    acc[rate.userId] = rate;
    return acc;
  }, {} as Record<number, EmployeeRate>);

  // Update employee rates mutation
  const updateRatesMutation = useMutation({
    mutationFn: ({ userId, rates }: { userId: number; rates: Partial<EmployeeRate> }) => 
      apiRequest('PUT', `/api/employee-rates/${userId}`, rates),
    onSuccess: () => {
      toast({ title: "Employee rates updated successfully" });
      setEditingEmployeeId(null);
      setEditingRates({});
      refetchRates();
    },
    onError: (error: any) => {
      toast({ 
        title: "Failed to update rates", 
        description: error.message || "An error occurred",
        variant: "destructive" 
      });
    }
  });

  // Create employee rates mutation
  const createRatesMutation = useMutation({
    mutationFn: (rates: EmployeeRate) => 
      apiRequest('POST', '/api/employee-rates', rates),
    onSuccess: () => {
      toast({ title: "Employee rates created successfully" });
      setEditingEmployeeId(null);
      setEditingRates({});
      refetchRates();
    },
    onError: (error: any) => {
      toast({ 
        title: "Failed to create rates", 
        description: error.message || "An error occurred",
        variant: "destructive" 
      });
    }
  });

  const handleEditClick = (employeeId: number) => {
    const existingRates = ratesMap[employeeId];
    setEditingEmployeeId(employeeId);
    setEditingRates(existingRates || {
      weekdayRate: 25,
      weeknightRate: 30,
      saturdayRate: 35,
      sundayRate: 40,
      publicHolidayRate: 50
    });
  };

  const handleSaveClick = (employeeId: number) => {
    const existingRates = ratesMap[employeeId];
    const finalRates = {
      userId: employeeId,
      weekdayRate: editingRates.weekdayRate || 25,
      weeknightRate: editingRates.weeknightRate || 30,
      saturdayRate: editingRates.saturdayRate || 35,
      sundayRate: editingRates.sundayRate || 40,
      publicHolidayRate: editingRates.publicHolidayRate || 50
    };

    if (existingRates) {
      updateRatesMutation.mutate({ userId: employeeId, rates: finalRates });
    } else {
      createRatesMutation.mutate(finalRates);
    }
  };

  const handleCancelClick = () => {
    setEditingEmployeeId(null);
    setEditingRates({});
  };

  const handleRateChange = (rateType: keyof EmployeeRate, value: string) => {
    const numValue = parseFloat(value) || 0;
    setEditingRates(prev => ({
      ...prev,
      [rateType]: numValue
    }));
  };

  const getRateTypeIcon = (rateType: string) => {
    switch (rateType) {
      case 'weekdayRate': return <Clock className="h-4 w-4" />;
      case 'weeknightRate': return <Moon className="h-4 w-4" />;
      case 'saturdayRate': return <Calendar className="h-4 w-4" />;
      case 'sundayRate': return <Sun className="h-4 w-4" />;
      case 'publicHolidayRate': return <Star className="h-4 w-4" />;
      default: return <DollarSign className="h-4 w-4" />;
    }
  };

  const getRateTypeLabel = (rateType: string) => {
    switch (rateType) {
      case 'weekdayRate': return 'Weekday';
      case 'weeknightRate': return 'Weeknight';
      case 'saturdayRate': return 'Saturday';
      case 'sundayRate': return 'Sunday';
      case 'publicHolidayRate': return 'Public Holiday';
      default: return rateType;
    }
  };

  if (employeesLoading || ratesLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Employee Rate Management
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <Skeleton key={i} className="h-20 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          Employee Rate Management
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Set hourly rates for each employee across different shift types and day categories.
        </p>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {employees.map(employee => {
            const existingRates = ratesMap[employee.id];
            const isEditing = editingEmployeeId === employee.id;
            const displayRates = isEditing ? editingRates : existingRates;

            return (
              <Card key={employee.id} className="border-l-4 border-l-blue-500">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center justify-center w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900">
                        <User className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                      </div>
                      <div>
                        <h3 className="font-semibold">{employee.name}</h3>
                        <p className="text-sm text-muted-foreground">{employee.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {existingRates ? (
                        <Badge variant="secondary">Rates Set</Badge>
                      ) : (
                        <Badge variant="outline">No Rates</Badge>
                      )}
                      {isEditing ? (
                        <div className="flex gap-2">
                          <Button 
                            size="sm" 
                            onClick={() => handleSaveClick(employee.id)}
                            disabled={updateRatesMutation.isPending || createRatesMutation.isPending}
                            data-testid={`button-save-rates-${employee.id}`}
                          >
                            <Check className="h-4 w-4" />
                          </Button>
                          <Button 
                            size="sm" 
                            variant="outline" 
                            onClick={handleCancelClick}
                            data-testid={`button-cancel-rates-${employee.id}`}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ) : (
                        <Button 
                          size="sm" 
                          variant="outline" 
                          onClick={() => handleEditClick(employee.id)}
                          data-testid={`button-edit-rates-${employee.id}`}
                        >
                          <Edit2 className="h-4 w-4" />
                          {existingRates ? 'Edit' : 'Set'} Rates
                        </Button>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                    {['weekdayRate', 'weeknightRate', 'saturdayRate', 'sundayRate', 'publicHolidayRate'].map(rateType => (
                      <div key={rateType} className="space-y-2">
                        <Label className="flex items-center gap-2 text-xs font-medium">
                          {getRateTypeIcon(rateType)}
                          {getRateTypeLabel(rateType)}
                        </Label>
                        {isEditing ? (
                          <div className="relative">
                            <DollarSign className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                              type="number"
                              step="0.50"
                              min="0"
                              value={displayRates?.[rateType as keyof EmployeeRate] || ''}
                              onChange={(e) => handleRateChange(rateType as keyof EmployeeRate, e.target.value)}
                              className="pl-8"
                              placeholder="0.00"
                              data-testid={`input-${rateType}-${employee.id}`}
                            />
                          </div>
                        ) : (
                          <div className="flex items-center gap-1 text-sm">
                            <DollarSign className="h-3 w-3 text-muted-foreground" />
                            <span className="font-medium" data-testid={`text-${rateType}-${employee.id}`}>
                              {displayRates?.[rateType as keyof EmployeeRate]?.toFixed(2) || '0.00'}
                            </span>
                            <span className="text-muted-foreground">/hr</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            );
          })}

          {employees.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No employees found in this company.</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}