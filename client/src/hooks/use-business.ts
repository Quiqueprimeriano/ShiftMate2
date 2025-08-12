import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";

// Company hooks
export function useCompanyEmployees(companyId: number) {
  return useQuery({
    queryKey: ["/api/companies", companyId, "employees"],
    queryFn: async () => {
      console.log('useCompanyEmployees queryFn called for company:', companyId);
      const response = await apiRequest('GET', `/api/companies/${companyId}/employees`);
      const data = await response.json();
      console.log('useCompanyEmployees data received:', data.length, 'employees');
      return data;
    },
    enabled: !!companyId,
  });
}

export function useCompanyShifts(companyId: number, startDate?: string, endDate?: string) {
  const params = new URLSearchParams();
  if (startDate) params.set('startDate', startDate);
  if (endDate) params.set('endDate', endDate);
  const queryString = params.toString();
  
  return useQuery({
    queryKey: ["/api/companies", companyId, "shifts", { startDate, endDate }],
    queryFn: async () => {
      console.log('useCompanyShifts queryFn called for company:', companyId, startDate ? `${startDate} to ${endDate}` : 'all shifts');
      const response = await apiRequest('GET', `/api/companies/${companyId}/shifts${queryString ? `?${queryString}` : ''}`);
      const data = await response.json();
      console.log('useCompanyShifts data received:', data.length, 'shifts');
      return data;
    },
    enabled: !!companyId,
  });
}

export function usePendingShifts(companyId: number) {
  return useQuery({
    queryKey: ["/api/companies", companyId, "pending-shifts"],
    queryFn: async () => {
      console.log('usePendingShifts queryFn called for company:', companyId);
      const response = await apiRequest('GET', `/api/companies/${companyId}/pending-shifts`);
      const data = await response.json();
      console.log('usePendingShifts data received:', data.length, 'pending shifts');
      return data;
    },
    enabled: !!companyId,
  });
}

export function useCompanyWeeklyHours(companyId: number, startDate: string, endDate: string) {
  return useQuery({
    queryKey: ["/api/companies", companyId, "analytics", "weekly-hours", { startDate, endDate }],
    queryFn: async () => {
      console.log('useCompanyWeeklyHours queryFn called for company:', companyId, `${startDate} to ${endDate}`);
      const params = new URLSearchParams({ startDate, endDate });
      const response = await apiRequest('GET', `/api/companies/${companyId}/analytics/weekly-hours?${params}`);
      const data = await response.json();
      console.log('useCompanyWeeklyHours data received:', data);
      return data;
    },
    enabled: !!companyId && !!startDate && !!endDate,
  });
}

// Company mutations
export function useCreateCompany() {
  return useMutation({
    mutationFn: async (companyData: any) => {
      const response = await apiRequest("POST", "/api/companies", companyData);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/companies"] });
    },
  });
}

export function useApproveShift() {
  return useMutation({
    mutationFn: async ({ shiftId, approvedBy }: { shiftId: number; approvedBy: number }) => {
      const response = await fetch(`/api/shifts/${shiftId}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ approvedBy }),
      });
      if (!response.ok) throw new Error("Failed to approve shift");
      return response.json();
    },
    onSuccess: () => {
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: ["/api/companies"] });
      queryClient.invalidateQueries({ queryKey: ["/api/shifts"] });
    },
  });
}