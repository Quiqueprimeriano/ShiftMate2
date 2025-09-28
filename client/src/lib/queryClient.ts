import { QueryClient, QueryFunction } from "@tanstack/react-query";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

// Storage for JWT tokens with persistence
let accessToken: string | null = null;
let refreshPromise: Promise<void> | null = null;
let isInitialized = false;

// Initialize token from localStorage on first access
function initializeToken() {
  if (!isInitialized) {
    try {
      const stored = localStorage.getItem('shiftmate_access_token');
      accessToken = stored;
      isInitialized = true;
      console.log('Token initialized from localStorage:', accessToken ? 'token present' : 'null');
    } catch (error) {
      console.error('Failed to initialize token from localStorage:', error);
      isInitialized = true;
    }
  }
}

export function setAccessToken(token: string | null) {
  initializeToken();
  accessToken = token;
  try {
    if (token) {
      localStorage.setItem('shiftmate_access_token', token);
    } else {
      localStorage.removeItem('shiftmate_access_token');
    }
  } catch (error) {
    console.error('Failed to store token in localStorage:', error);
  }
  console.log('setAccessToken called with:', token ? 'token present' : 'null');
}

export function getAccessToken(): string | null {
  initializeToken();
  console.log('getAccessToken called, returning:', accessToken ? 'token present' : 'null');
  return accessToken;
}

// Refresh access token using refresh token
export async function refreshAccessToken(): Promise<boolean> {
  if (refreshPromise) {
    await refreshPromise;
    return !!accessToken;
  }

  refreshPromise = (async () => {
    try {
      const response = await fetch('/api/auth/refresh', {
        method: 'POST',
        credentials: 'include'
      });

      if (response.ok) {
        const data = await response.json();
        setAccessToken(data.accessToken);
      } else {
        setAccessToken(null);
      }
    } catch (error) {
      console.error('Token refresh failed:', error);
      setAccessToken(null);
    } finally {
      refreshPromise = null;
    }
  })();

  await refreshPromise;
  return !!accessToken;
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  const makeRequest = async (token?: string) => {
    const headers: HeadersInit = {
      ...(data ? { "Content-Type": "application/json" } : {}),
      ...(token ? { "Authorization": `Bearer ${token}` } : {})
    };

    return fetch(url, {
      method,
      headers,
      body: data ? JSON.stringify(data) : undefined,
      credentials: "include",
    });
  };

  // Ensure we have an access token, refresh if null
  let currentToken = getAccessToken();
  
  // If no token available, try to refresh first
  if (!currentToken) {
    console.log('No access token available for API request, attempting refresh');
    const refreshed = await refreshAccessToken();
    currentToken = getAccessToken();
    console.log('After refresh attempt, token:', currentToken ? 'present' : 'still null');
  }
  
  let res = await makeRequest(currentToken || undefined);
  console.log(`API Request: ${method} ${url} with token: ${currentToken ? 'present' : 'none'}`);

  // If 401, try to refresh (whether we had a token or not)
  if (res.status === 401) {
    console.log('401 error, attempting token refresh');
    const refreshed = await refreshAccessToken();
    const newToken = getAccessToken();
    if (refreshed && newToken) {
      console.log('Token refreshed automatically, retrying request');
      res = await makeRequest(newToken);
    } else {
      console.log('Token refresh failed or no new token received');
    }
  }

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const makeRequest = async (token?: string) => {
      const headers: HeadersInit = {
        ...(token ? { "Authorization": `Bearer ${token}` } : {})
      };
      
      console.log(`Making query request to ${queryKey[0]} with token: ${token ? 'present' : 'none'}`);
      console.log('Headers being sent:', JSON.stringify(headers));

      return fetch(queryKey[0] as string, {
        headers,
        credentials: "include",
      });
    };

    // Ensure we have the latest access token, refresh if null
    let currentToken = getAccessToken();
    
    // If no token available, try to refresh first
    if (!currentToken) {
      console.log('No access token available, attempting refresh');
      const refreshed = await refreshAccessToken();
      currentToken = getAccessToken();
      console.log('After refresh attempt, token:', currentToken ? 'present' : 'still null');
    }
    
    console.log(`Query Request: ${queryKey[0]} with token: ${currentToken ? 'present' : 'none'}`);
    let res = await makeRequest(currentToken || undefined);

    // If 401, try to refresh (whether we had a token or not)
    if (res.status === 401) {
      console.log('Query 401 error, attempting token refresh');
      const refreshed = await refreshAccessToken();
      const newToken = getAccessToken();
      if (refreshed && newToken) {
        console.log('Token refreshed, retrying query');
        res = await makeRequest(newToken);
        console.log(`Retry Query Request: ${queryKey[0]} with token: ${newToken ? 'present' : 'none'}`);
      } else {
        console.log('Token refresh failed or no new token received');
      }
    }

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
