import { QueryClient, QueryFunction } from "@tanstack/react-query";

// Get the API URL from environment variable or default to the current origin
const API_URL = import.meta.env.VITE_API_URL || window.location.origin;

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      refetchOnWindowFocus: false,
    },
  },
});

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: "An error occurred" }));
    throw new Error(`${res.status}: ${JSON.stringify(error)}`);
  }
}

export async function apiRequest(
  url: string,
  method: string,
  data?: unknown,
): Promise<Response> {
  // Use API_URL for all requests
  const fullUrl = url.startsWith('http') ? url : `${API_URL}${url}`;

  try {
    const headers: Record<string, string> = {};
    let body = data;

    // Only set Content-Type for non-FormData
    if (data && !(data instanceof FormData)) {
      headers["Content-Type"] = "application/json";
      body = JSON.stringify(data);
    }

    console.log(`Making ${method} request to ${fullUrl}`);
    
    const res = await fetch(fullUrl, {
      method,
      headers,
      body,
      credentials: "include",
    });

    await throwIfResNotOk(res);
    return res;
  } catch (error) {
    console.error('API Request failed:', error);
    throw error;
  }
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const url = queryKey[0] as string;
    const fullUrl = url.startsWith('http') ? url : `${API_URL}${url}`;
    
    const res = await fetch(fullUrl, {
      credentials: "include",
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };
