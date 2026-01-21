import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";

// Company hooks
export function useCompanyEmployees(companyId: number) {
  return useQuery({
    queryKey: ["/api/companies", companyId, "employees"],
    queryFn: async () => {
      const response = await apiRequest('GET', `/api/companies/${companyId}/employees`);
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
      const response = await apiRequest('GET', `/api/companies/${companyId}/shifts${queryString ? `?${queryString}` : ''}`);
      return response.json();
    },
    enabled: !!companyId,
  });
}

export function usePendingShifts(companyId: number) {
  return useQuery({
    queryKey: ["/api/companies", companyId, "pending-shifts"],
    queryFn: async () => {
      const response = await apiRequest('GET', `/api/companies/${companyId}/pending-shifts`);
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
      const response = await apiRequest('GET', `/api/companies/${companyId}/analytics/weekly-hours?${params}`);
      return response.json();
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
      queryClient.invalidateQueries({ queryKey: ["/api/companies"] });
      queryClient.invalidateQueries({ queryKey: ["/api/shifts"] });
    },
  });
}

// Roster Management Hooks
export function useRosterShifts(startDate?: string, endDate?: string) {
  const params = new URLSearchParams();
  if (startDate) params.set('startDate', startDate);
  if (endDate) params.set('endDate', endDate);
  const queryString = params.toString();

  return useQuery({
    queryKey: ["/api/roster", { startDate, endDate }],
    queryFn: async () => {
      const response = await apiRequest('GET', `/api/roster${queryString ? `?${queryString}` : ''}`);
      return response.json();
    },
  });
}

export function useCreateRosterShift() {
  return useMutation({
    mutationFn: async (shiftData: any) => {
      const response = await apiRequest("POST", "/api/roster/shifts", shiftData);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/roster"] });
      queryClient.invalidateQueries({ queryKey: ["/api/companies"] });
    },
  });
}

export function useUpdateRosterShift() {
  return useMutation({
    mutationFn: async ({ shiftId, shiftData }: { shiftId: number; shiftData: any }) => {
      const response = await apiRequest("PUT", `/api/roster/shifts/${shiftId}`, shiftData);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/roster"] });
      queryClient.invalidateQueries({ queryKey: ["/api/companies"] });
    },
  });
}

export function useDeleteRosterShift() {
  return useMutation({
    mutationFn: async (shiftId: number) => {
      const response = await apiRequest("DELETE", `/api/roster/shifts/${shiftId}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/roster"] });
      queryClient.invalidateQueries({ queryKey: ["/api/companies"] });
    },
  });
}
