import axios, { AxiosError } from 'axios';
import { auth } from '../config/firebase';
import { env } from '../config/env';

// Ensure Expo connects to our explicit API URL
const API_URL = env.API_URL;

const apiClient = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to dynamically attach the Firebase ID token
apiClient.interceptors.request.use(
  async (config) => {
    const currentUser = auth.currentUser;

    if (currentUser) {
      try {
        // getIdToken(false) retrieves the cached token or refreshes it if it's expired
        const token = await currentUser.getIdToken(false);
        config.headers.Authorization = `Bearer ${token}`;
      } catch (error) {
        console.error('Error fetching Firebase ID token for interceptor:', error);
      }
    }

    return config;
  },
  (error) => {
    return Promise.reject(error);
  },
);

// Response interceptor to handle unauthorized errors (session expiry)
//
// A 401 here can be transient: the request interceptor's getIdToken(false) may
// return a cached-but-just-expired token if it expired between the refresh check
// and the request reaching the backend. Before signing the user out, force a
// token refresh (getIdToken(true)) and retry the original request once. Only if
// the retry also fails with 401 do we treat it as a genuine session end.
apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const status = error.response?.status;
    const originalConfig = error.config as (typeof error.config & { _retried?: boolean }) | undefined;

    if (status === 401 && originalConfig && !originalConfig._retried) {
      const currentUser = auth.currentUser;
      if (currentUser) {
        try {
          const freshToken = await currentUser.getIdToken(true);
          originalConfig._retried = true;
          originalConfig.headers = originalConfig.headers ?? {};
          (originalConfig.headers as Record<string, string>).Authorization = `Bearer ${freshToken}`;
          return apiClient.request(originalConfig);
        } catch (refreshError) {
          console.error('Error refreshing Firebase ID token on 401:', refreshError);
        }
      }

      // Refresh failed or no current user — genuine session end.
      try {
        await auth.signOut();
      } catch (signOutError) {
        console.error('Error signing out after 401:', signOutError);
      }
      return Promise.reject(error);
    }

    if (status === 401) {
      // Retried already and still 401 — genuine session end.
      const code = (error.response?.data as { code?: string } | undefined)?.code;
      console.warn('API returned 401 (expired/invalid token) after retry, signing out user...', code);
      try {
        await auth.signOut();
      } catch (signOutError) {
        console.error('Error signing out after 401:', signOutError);
      }
    }

    return Promise.reject(error);
  },
);

export default apiClient;
