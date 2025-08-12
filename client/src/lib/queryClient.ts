import { QueryClient, QueryFunction } from "@tanstack/react-query";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

// Storage for JWT tokens
let accessToken: string | null = null;
let refreshPromise: Promise<void> | null = null;

export function setAccessToken(token: string | null) {
  accessToken = token;
}

export function getAccessToken(): string | null {
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

  // First attempt with current token
  let res = await makeRequest(accessToken || undefined);

  // If 401 and we have a token, try to refresh
  if (res.status === 401 && accessToken) {
    const refreshed = await refreshAccessToken();
    if (refreshed && accessToken) {
      res = await makeRequest(accessToken);
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

      return fetch(queryKey[0] as string, {
        headers,
        credentials: "include",
      });
    };

    // First attempt with current token
    let res = await makeRequest(accessToken || undefined);

    // If 401 and we have a token, try to refresh
    if (res.status === 401 && accessToken) {
      const refreshed = await refreshAccessToken();
      if (refreshed && accessToken) {
        res = await makeRequest(accessToken);
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
