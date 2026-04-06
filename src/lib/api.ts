const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

export interface ApiOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  body?: any;
  headers?: Record<string, string>;
}

export async function apiRequest<T = any>(
  endpoint: string,
  options: ApiOptions = {}
): Promise<T> {
  const { method = 'GET', body, headers = {} } = options;
  
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  
  const requestHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    ...headers,
  };
  
  if (token) {
    requestHeaders['Authorization'] = `Bearer ${token}`;
  }
  
  const config: RequestInit = {
    method,
    headers: requestHeaders,
  };
  
  if (body && method !== 'GET') {
    config.body = JSON.stringify(body);
  }
  
  const response = await fetch(`${API_URL}${endpoint}`, config);
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'An error occurred' }));
    throw new Error(error.message || `HTTP error! status: ${response.status}`);
  }
  
  if (response.status === 204) {
    return null as T;
  }
  
  return response.json();
}

export function getImageUrl(path: string): string {
  if (!path) return '';
  if (path.startsWith('http')) return path;
  return `${process.env.NEXT_PUBLIC_CLOUDINARY_URL || ''}${path}`;
}
