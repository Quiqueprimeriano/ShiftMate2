import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import type { TimeOffRequest } from "@shared/schema";

interface CreateTimeOffRequest {
  startDate: string;
  endDate: string;
  startTime?: string;
  endTime?: string;
  isFullDay: boolean;
  reason?: string;
}

interface UpdateTimeOffRequest extends Partial<CreateTimeOffRequest> {
  id: number;
}

// Get all time-off requests for current user
export function useTimeOffRequests() {
  return useQuery<TimeOffRequest[]>({
    queryKey: ["/api/time-off"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/time-off");
      return res.json();
    },
  });
}

// Get time-off requests for a date range
export function useTimeOffRequestsByRange(startDate: string, endDate: string) {
  return useQuery<TimeOffRequest[]>({
    queryKey: ["/api/time-off/range", startDate, endDate],
    queryFn: async () => {
      const res = await apiRequest(
        "GET",
        `/api/time-off/range?startDate=${startDate}&endDate=${endDate}`
      );
      return res.json();
    },
    enabled: !!startDate && !!endDate,
  });
}

// Create a new time-off request
export function useCreateTimeOffRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateTimeOffRequest) => {
      const res = await apiRequest("POST", "/api/time-off", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/time-off"] });
      queryClient.invalidateQueries({ queryKey: ["/api/time-off/range"] });
      queryClient.invalidateQueries({ queryKey: ["/api/company"] });
    },
  });
}

// Update an existing time-off request
export function useUpdateTimeOffRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...data }: UpdateTimeOffRequest) => {
      const res = await apiRequest("PUT", `/api/time-off/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/time-off"] });
      queryClient.invalidateQueries({ queryKey: ["/api/time-off/range"] });
      queryClient.invalidateQueries({ queryKey: ["/api/company"] });
    },
  });
}

// Delete a time-off request
export function useDeleteTimeOffRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("DELETE", `/api/time-off/${id}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/time-off"] });
      queryClient.invalidateQueries({ queryKey: ["/api/time-off/range"] });
      queryClient.invalidateQueries({ queryKey: ["/api/company"] });
    },
  });
}

// Manager: Get company time-off requests
export function useCompanyTimeOffRequests(companyId: number | undefined) {
  return useQuery<TimeOffRequest[]>({
    queryKey: ["/api/company", companyId, "time-off"],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/company/${companyId}/time-off`);
      return res.json();
    },
    enabled: !!companyId,
  });
}

// Manager: Get company time-off requests for a date range (for roster planner)
export function useCompanyTimeOffByRange(companyId: number | undefined, startDate: string, endDate: string) {
  return useQuery<TimeOffRequest[]>({
    queryKey: ["/api/company", companyId, "time-off/range", startDate, endDate],
    queryFn: async () => {
      const res = await apiRequest(
        "GET",
        `/api/company/${companyId}/time-off/range?startDate=${startDate}&endDate=${endDate}`
      );
      return res.json();
    },
    enabled: !!companyId && !!startDate && !!endDate,
  });
}

// Manager: Approve time-off request
export function useApproveTimeOffRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("POST", `/api/time-off/${id}/approve`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/time-off"] });
      queryClient.invalidateQueries({ queryKey: ["/api/company"] });
    },
  });
}

// Manager: Reject time-off request
export function useRejectTimeOffRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, reason }: { id: number; reason: string }) => {
      const res = await apiRequest("POST", `/api/time-off/${id}/reject`, { reason });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/time-off"] });
      queryClient.invalidateQueries({ queryKey: ["/api/company"] });
    },
  });
}
