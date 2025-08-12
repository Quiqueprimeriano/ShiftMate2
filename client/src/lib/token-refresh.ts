import { refreshAccessToken, setAccessToken } from './queryClient';
import { queryClient } from './queryClient';

// Initialize token refresh system
export function initializeTokenRefresh() {
  // Try to refresh token on app start
  refreshAccessToken().then(success => {
    if (success) {
      console.log('Token refreshed on app initialization');
      // Invalidate auth query to get fresh user data
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
    } else {
      console.log('No valid refresh token found');
    }
  }).catch(error => {
    console.error('Token refresh initialization failed:', error);
  });

  // Set up periodic token refresh (every 10 minutes)
  setInterval(async () => {
    try {
      const success = await refreshAccessToken();
      if (success) {
        console.log('Token refreshed automatically');
      }
    } catch (error) {
      console.error('Automatic token refresh failed:', error);
    }
  }, 10 * 60 * 1000); // 10 minutes

  // Refresh token when page becomes visible (mobile app return)
  document.addEventListener('visibilitychange', async () => {
    if (!document.hidden) {
      try {
        const success = await refreshAccessToken();
        if (success) {
          console.log('Token refreshed on visibility change');
          queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
        }
      } catch (error) {
        console.error('Visibility change token refresh failed:', error);
      }
    }
  });
}