import axios, { AxiosInstance } from 'axios';
import { useAuthStore } from '../hooks/useAuth';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

class ApiService {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: API_URL,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Add auth token to requests
    this.client.interceptors.request.use((config) => {
      const authStore = useAuthStore.getState();
      if (authStore.token) {
        config.headers.Authorization = `Bearer ${authStore.token}`;
      }
      return config;
    });

    // Handle 401 errors
    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 401) {
          useAuthStore.getState().logout();
          window.location.href = '/login';
        }
        return Promise.reject(error);
      },
    );
  }

  // Auth endpoints
  async signup(email: string, password: string, fullName?: string) {
    return this.client.post('/auth/signup', { email, password, fullName });
  }

  async login(email: string, password: string) {
    return this.client.post('/auth/login', { email, password });
  }

  // Integrations endpoints
  async getIntegrations() {
    return this.client.get('/integrations');
  }

  async getOAuthUrl(provider: string) {
    return this.client.get(`/integrations/${provider}/authorize`);
  }

  async disconnectIntegration(id: string) {
    return this.client.delete(`/integrations/${id}`);
  }

  // Syncs endpoints
  async getSyncs() {
    return this.client.get('/syncs');
  }

  async getSync(id: string) {
    return this.client.get(`/syncs/${id}`);
  }

  async createSync(data: any) {
    return this.client.post('/syncs', data);
  }

  async updateSync(id: string, data: any) {
    return this.client.put(`/syncs/${id}`, data);
  }

  async deleteSync(id: string) {
    return this.client.delete(`/syncs/${id}`);
  }

  async getSyncStatus(id: string) {
    return this.client.get(`/syncs/${id}/status`);
  }

  async triggerSync(id: string) {
    return this.client.post(`/syncs/${id}/run`);
  }

  // User endpoints
  async getProfile() {
    return this.client.get('/user/profile');
  }
}

export const apiService = new ApiService();
