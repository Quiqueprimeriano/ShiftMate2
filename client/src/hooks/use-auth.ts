import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { login, logout, getCurrentUser, type User } from "@/lib/auth";

export function useAuth() {
  const { data: auth, isLoading, error } = useQuery({
    queryKey: ["/api/auth/me"],
    queryFn: getCurrentUser,
    retry: (failureCount, error: any) => {
      // Retry network errors but not auth errors
      if (error?.message?.includes('401')) {
        return false;
      }
      return failureCount < 3;
    },
    staleTime: 1000 * 60 * 10, // 10 minutes - longer cache for persistent sessions
    gcTime: 1000 * 60 * 60, // 1 hour - extend garbage collection for mobile
    refetchOnWindowFocus: true, // Check auth when app becomes active
    refetchOnMount: true, // Always check auth on component mount
  });

  const loginMutation = useMutation({
    mutationFn: ({ email, name, rememberMe = false }: { email: string; name: string; rememberMe?: boolean }) => 
      login(email, name, rememberMe),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
    },
  });

  const logoutMutation = useMutation({
    mutationFn: logout,
    onSuccess: () => {
      // Clear all data on logout for mobile security
      queryClient.setQueryData(["/api/auth/me"], null);
      queryClient.clear();
      // Force page reload to clear any cached state
      window.location.href = '/login';
    },
  });

  return {
    user: auth?.user,
    isAuthenticated: !!auth?.user,
    isLoading,
    login: loginMutation.mutate,
    logout: logoutMutation.mutate,
    isLoggingIn: loginMutation.isPending,
    isLoggingOut: logoutMutation.isPending,
  };
}
