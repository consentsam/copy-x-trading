/**
 * Centralized API Client with automatic response unwrapping
 */

import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import { ApiResponse } from '@/types/alphaengine';

class ApiClient {
  private client: AxiosInstance;
  private walletAddress: string | null = null;

  constructor() {
    const baseURL = process.env.NEXT_PUBLIC_ALPHAENGINE_API_URL || 'http://localhost:3001';

    // Validate environment configuration
    if (!baseURL || baseURL.includes('localhost:3000')) {
      console.warn('[ApiClient] NEXT_PUBLIC_ALPHAENGINE_API_URL should point to backend (3001), not frontend (3000)');
    }

    this.client = axios.create({
      baseURL,
      timeout: 30000, // 30 seconds
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Request interceptor for auth tokens and wallet address
    this.client.interceptors.request.use(
      (config) => {
        // Add wallet address header if available
        if (this.walletAddress) {
          config.headers['X-Wallet-Address'] = this.walletAddress;
        }

        // Add auth token if available
        // const token = localStorage.getItem('authToken');
        // if (token) {
        //   config.headers.Authorization = `Bearer ${token}`;
        // }
        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
    );

    // Response interceptor to unwrap backend API responses
    this.client.interceptors.response.use(
      (response: AxiosResponse) => {
        // Check if response has the wrapped format
        if (response.data && typeof response.data === 'object' && 'data' in response.data) {
          const apiResponse = response.data as ApiResponse;
          
          // Check if the request was successful (backend uses isSuccess)
          if (apiResponse.isSuccess === false || apiResponse.success === false) {
            // Backend indicated failure (checking both for compatibility)
            const error = new Error(apiResponse.message || 'Request failed') as Error & { response?: AxiosResponse; isApiError?: boolean };
            error.response = response;
            error.isApiError = true;
            return Promise.reject(error);
          }
          
          // Return the unwrapped data
          return apiResponse.data;
        }
        
        // Return as-is if not wrapped
        return response.data;
      },
      (error) => {
        // Handle errors
        return Promise.reject(error);
      }
    );
  }

  /**
   * GET request
   */
  async get<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
    return this.client.get<T>(url, config) as Promise<T>;
  }

  /**
   * POST request
   */
  async post<T>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T> {
    return this.client.post<T>(url, data, config) as Promise<T>;
  }

  /**
   * PUT request
   */
  async put<T>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T> {
    return this.client.put<T>(url, data, config) as Promise<T>;
  }

  /**
   * DELETE request
   */
  async delete<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
    return this.client.delete<T>(url, config) as Promise<T>;
  }

  /**
   * PATCH request
   */
  async patch<T>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T> {
    return this.client.patch<T>(url, data, config) as Promise<T>;
  }

  /**
   * Set the wallet address for automatic header inclusion
   */
  setWalletAddress(address: string | null) {
    this.walletAddress = address;
  }

  /**
   * Clear the wallet address
   */
  clearWalletAddress() {
    this.walletAddress = null;
  }

  /**
   * Get the current wallet address
   */
  getWalletAddress(): string | null {
    return this.walletAddress;
  }

  /**
   * Get the underlying axios instance for advanced usage
   */
  getAxiosInstance(): AxiosInstance {
    return this.client;
  }
}

// Export singleton instance
export const apiClient = new ApiClient();

// Export the class for testing or multiple instances
export default ApiClient;