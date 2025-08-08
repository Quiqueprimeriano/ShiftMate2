import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";

// Company hooks
export function useCompanyEmployees(companyId: number) {
  return useQuery({
    queryKey: ["/api/companies", companyId, "employees"],
    queryFn: async () => {
      const response = await fetch(`/api/companies/${companyId}/employees`);
      if (!response.ok) throw new Error("Failed to fetch employees");
      return response.json();
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
      const response = await fetch(`/api/companies/${companyId}/shifts${queryString ? `?${queryString}` : ''}`);
      if (!response.ok) throw new Error("Failed to fetch shifts");
      return response.json();
    },
    enabled: !!companyId,
  });
}

export function usePendingShifts(companyId: number) {
  return useQuery({
    queryKey: ["/api/companies", companyId, "pending-shifts"],
    queryFn: async () => {
      const response = await fetch(`/api/companies/${companyId}/pending-shifts`);
      if (!response.ok) throw new Error("Failed to fetch pending shifts");
      return response.json();
    },
    enabled: !!companyId,
  });
}

export function useCompanyWeeklyHours(companyId: number, startDate: string, endDate: string) {
  return useQuery({
    queryKey: ["/api/companies", companyId, "analytics", "weekly-hours", { startDate, endDate }],
    queryFn: async () => {
      const params = new URLSearchParams({ startDate, endDate });
      const response = await fetch(`/api/companies/${companyId}/analytics/weekly-hours?${params}`);
      if (!response.ok) throw new Error("Failed to fetch weekly hours");
      return response.json();
    },
    enabled: !!companyId && !!startDate && !!endDate,
  });
}

// Company mutations
export function useCreateCompany() {
  return useMutation({
    mutationFn: async (companyData: any) => {
      const response = await fetch("/api/companies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(companyData),
      });
      if (!response.ok) throw new Error("Failed to create company");
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