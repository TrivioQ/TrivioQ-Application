import axios from 'axios';
import { Platform } from 'react-native';
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

export default apiClient;
