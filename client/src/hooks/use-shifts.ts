import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { Shift, InsertShift } from "@shared/schema";

export function useShifts(startDate?: string, endDate?: string) {
  const queryKey = startDate && endDate 
    ? ["/api/shifts", { startDate, endDate }]
    : ["/api/shifts"];

  return useQuery({
    queryKey,
    queryFn: async () => {
      const url = startDate && endDate 
        ? `/api/shifts?startDate=${startDate}&endDate=${endDate}`
        : "/api/shifts";
      const response = await fetch(url, { credentials: "include" });
      if (!response.ok) throw new Error("Failed to fetch shifts");
      return response.json() as Promise<Shift[]>;
    },
  });
}

export function useCreateShift() {
  return useMutation({
    mutationFn: async (shift: Omit<InsertShift, 'userId'>) => {
      const response = await apiRequest("POST", "/api/shifts", shift);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/shifts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/analytics/weekly-hours"] });
      queryClient.invalidateQueries({ queryKey: ["/api/analytics/daily-average"] });
      queryClient.invalidateQueries({ queryKey: ["/api/analytics/missing-entries"] });
    },
  });
}

export function useUpdateShift() {
  return useMutation({
    mutationFn: async ({ id, ...shift }: { id: number } & Partial<InsertShift>) => {
      const response = await apiRequest("PUT", `/api/shifts/${id}`, shift);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/shifts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/analytics/weekly-hours"] });
      queryClient.invalidateQueries({ queryKey: ["/api/analytics/daily-average"] });
      queryClient.invalidateQueries({ queryKey: ["/api/analytics/missing-entries"] });
    },
  });
}

export function useDeleteShift() {
  return useMutation({
    mutationFn: async (id: number) => {
      const response = await apiRequest("DELETE", `/api/shifts/${id}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/shifts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/analytics/weekly-hours"] });
      queryClient.invalidateQueries({ queryKey: ["/api/analytics/daily-average"] });
      queryClient.invalidateQueries({ queryKey: ["/api/analytics/missing-entries"] });
    },
  });
}

export function useWeeklyHours(startDate: string, endDate: string) {
  return useQuery({
    queryKey: ["/api/analytics/weekly-hours", { startDate, endDate }],
    queryFn: async () => {
      const response = await fetch(`/api/analytics/weekly-hours?startDate=${startDate}&endDate=${endDate}`, {
        credentials: "include"
      });
      if (!response.ok) throw new Error("Failed to fetch weekly hours");
      const data = await response.json();
      return data.hours as number;
    },
  });
}

export function useDailyAverage(startDate: string, endDate: string) {
  return useQuery({
    queryKey: ["/api/analytics/daily-average", { startDate, endDate }],
    queryFn: async () => {
      const response = await fetch(`/api/analytics/daily-average?startDate=${startDate}&endDate=${endDate}`, {
        credentials: "include"
      });
      if (!response.ok) throw new Error("Failed to fetch daily average");
      const data = await response.json();
      return data.average as number;
    },
  });
}

export function useMissingEntries(startDate: string, endDate: string) {
  return useQuery({
    queryKey: ["/api/analytics/missing-entries", { startDate, endDate }],
    queryFn: async () => {
      const response = await fetch(`/api/analytics/missing-entries?startDate=${startDate}&endDate=${endDate}`, {
        credentials: "include"
      });
      if (!response.ok) throw new Error("Failed to fetch missing entries");
      const data = await response.json();
      return data.missingDates as string[];
    },
  });
}
