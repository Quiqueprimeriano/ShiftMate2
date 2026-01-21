import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { Shift, InsertShift } from "@shared/schema";

// Query keys for shift-related queries
const SHIFT_QUERY_KEYS = [
  "/api/shifts",
  "/api/personal-shifts",
  "/api/roster-shifts",
  "/api/analytics/weekly-hours",
  "/api/analytics/daily-average",
  "/api/analytics/missing-entries",
] as const;

// Utility to invalidate all shift-related queries
function invalidateShiftQueries() {
  SHIFT_QUERY_KEYS.forEach((key) => {
    queryClient.invalidateQueries({ predicate: (query) => query.queryKey[0] === key });
  });
}

// Factory for creating shift fetch hooks
function createShiftHook(endpoint: string) {
  return (startDate?: string, endDate?: string) => {
    const queryKey = startDate && endDate
      ? [endpoint, { startDate, endDate }]
      : [endpoint];

    return useQuery({
      queryKey,
      queryFn: async () => {
        const url = startDate && endDate
          ? `${endpoint}?startDate=${startDate}&endDate=${endDate}`
          : endpoint;
        const response = await apiRequest('GET', url);
        return response.json();
      },
    });
  };
}

export const useShifts = createShiftHook("/api/shifts");
export const usePersonalShifts = createShiftHook("/api/personal-shifts");
export const useIndividualRosterShifts = createShiftHook("/api/roster-shifts");

export function useCreateShift() {
  return useMutation({
    mutationFn: async (shift: Omit<InsertShift, 'userId'>) => {
      const response = await apiRequest("POST", "/api/shifts", shift);
      return response.json();
    },
    onSuccess: invalidateShiftQueries,
  });
}

export function useUpdateShift() {
  return useMutation({
    mutationFn: async ({ id, ...shift }: { id: number } & Partial<InsertShift>) => {
      const response = await apiRequest("PUT", `/api/shifts/${id}`, shift);
      return response.json();
    },
    onSuccess: invalidateShiftQueries,
  });
}

export function useDeleteShift() {
  return useMutation({
    mutationFn: async (id: number) => {
      const response = await apiRequest("DELETE", `/api/shifts/${id}`);
      return response.json();
    },
    onSuccess: invalidateShiftQueries,
  });
}

export function useWeeklyHours(startDate: string, endDate: string) {
  return useQuery({
    queryKey: ["/api/analytics/weekly-hours", { startDate, endDate }],
    queryFn: async () => {
      const response = await apiRequest('GET', `/api/analytics/weekly-hours?startDate=${startDate}&endDate=${endDate}`);
      const data = await response.json();
      return data.hours as number;
    },
  });
}

export function useDailyAverage(startDate: string, endDate: string) {
  return useQuery({
    queryKey: ["/api/analytics/daily-average", { startDate, endDate }],
    queryFn: async () => {
      const response = await apiRequest('GET', `/api/analytics/daily-average?startDate=${startDate}&endDate=${endDate}`);
      const data = await response.json();
      return data.average as number;
    },
  });
}

export function useMissingEntries(startDate: string, endDate: string) {
  return useQuery({
    queryKey: ["/api/analytics/missing-entries", { startDate, endDate }],
    queryFn: async () => {
      const response = await apiRequest('GET', `/api/analytics/missing-entries?startDate=${startDate}&endDate=${endDate}`);
      const data = await response.json();
      return data.missingDates as string[];
    },
  });
}
