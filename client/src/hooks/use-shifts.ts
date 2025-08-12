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
      console.log('useShifts queryFn called for:', startDate && endDate ? `${startDate} to ${endDate}` : 'all shifts');
      const url = startDate && endDate 
        ? `/api/shifts?startDate=${startDate}&endDate=${endDate}`
        : "/api/shifts";
      const response = await apiRequest('GET', url);
      const data = await response.json();
      console.log('useShifts data received:', data.length, 'shifts');
      return data;
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
      queryClient.invalidateQueries({ predicate: (query) => 
        query.queryKey[0] === "/api/shifts" 
      });
      queryClient.invalidateQueries({ predicate: (query) => 
        query.queryKey[0] === "/api/analytics/weekly-hours" 
      });
      queryClient.invalidateQueries({ predicate: (query) => 
        query.queryKey[0] === "/api/analytics/daily-average" 
      });
      queryClient.invalidateQueries({ predicate: (query) => 
        query.queryKey[0] === "/api/analytics/missing-entries" 
      });
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
      queryClient.invalidateQueries({ predicate: (query) => 
        query.queryKey[0] === "/api/shifts" 
      });
      queryClient.invalidateQueries({ predicate: (query) => 
        query.queryKey[0] === "/api/analytics/weekly-hours" 
      });
      queryClient.invalidateQueries({ predicate: (query) => 
        query.queryKey[0] === "/api/analytics/daily-average" 
      });
      queryClient.invalidateQueries({ predicate: (query) => 
        query.queryKey[0] === "/api/analytics/missing-entries" 
      });
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
      queryClient.invalidateQueries({ predicate: (query) => 
        query.queryKey[0] === "/api/shifts" 
      });
      queryClient.invalidateQueries({ predicate: (query) => 
        query.queryKey[0] === "/api/analytics/weekly-hours" 
      });
      queryClient.invalidateQueries({ predicate: (query) => 
        query.queryKey[0] === "/api/analytics/daily-average" 
      });
      queryClient.invalidateQueries({ predicate: (query) => 
        query.queryKey[0] === "/api/analytics/missing-entries" 
      });
    },
  });
}

export function useWeeklyHours(startDate: string, endDate: string) {
  return useQuery({
    queryKey: ["/api/analytics/weekly-hours", { startDate, endDate }],
    queryFn: async () => {
      console.log('useWeeklyHours queryFn called for:', `${startDate} to ${endDate}`);
      const response = await apiRequest('GET', `/api/analytics/weekly-hours?startDate=${startDate}&endDate=${endDate}`);
      const data = await response.json();
      console.log('useWeeklyHours data received:', data);
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
