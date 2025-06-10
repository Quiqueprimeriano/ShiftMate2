import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { login, logout, getCurrentUser, type User } from "@/lib/auth";

export function useAuth() {
  const { data: auth, isLoading } = useQuery({
    queryKey: ["/api/auth/me"],
    queryFn: getCurrentUser,
    retry: false,
    staleTime: 1000 * 60 * 5, // 5 minutes - longer cache for mobile
    gcTime: 1000 * 60 * 30, // 30 minutes - extend garbage collection
  });

  const loginMutation = useMutation({
    mutationFn: ({ email, name }: { email: string; name: string }) => login(email, name),
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
