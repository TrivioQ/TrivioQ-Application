import axios from 'axios';
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
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const status = error.response?.status;
    const code = error.response?.data?.code;

    if (status === 401 && (code === 'auth/id-token-expired' || !code)) {
      console.warn('API returned 401 (expired/invalid token), signing out user...');
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
