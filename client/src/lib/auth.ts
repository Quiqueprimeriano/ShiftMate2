import { apiRequest } from "./queryClient";

export interface User {
  id: number;
  email: string;
  name: string;
  createdAt: string;
}

export interface AuthResponse {
  user: User;
}

export async function login(email: string, name: string, rememberMe = false): Promise<AuthResponse & { accessToken?: string }> {
  const response = await apiRequest("POST", "/api/auth/login", { email, name, rememberMe });
  const data = await response.json();
  
  // Store access token if provided
  if (data.accessToken) {
    const { setAccessToken } = await import('@/lib/queryClient');
    setAccessToken(data.accessToken);
  }

  return data;
}

export async function logout(): Promise<void> {
  await apiRequest("POST", "/api/auth/logout");
  // Clear stored access token
  const { setAccessToken } = await import('@/lib/queryClient');
  setAccessToken(null);
}

export async function getCurrentUser(): Promise<AuthResponse | null> {
  try {
    const response = await apiRequest("GET", "/api/auth/me");
    return response.json();
  } catch (error) {
    return null;
  }
}
