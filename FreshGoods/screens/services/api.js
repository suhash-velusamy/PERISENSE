import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL } from '../config/env';

/**
 * Centralized API service — the one HTTP client every screen should use to
 * talk to this app's own backend. External integrations (Pusher, Expo push,
 * OpenRouteService/Nominatim, map WebViews) intentionally keep their own
 * clients and do not go through this instance.
 *
 * Handles:
 * - Base URL (see screens/config/env.js)
 * - Automatic auth token injection
 * - Timeout handling
 * - Consistent 401/403/network error behavior
 */
const api = axios.create({
    baseURL: API_BASE_URL,
    timeout: 15000,
    headers: {
        'Content-Type': 'application/json',
    },
});

// Lazily resolved to avoid a hard circular import at module-eval time
// (App.js imports screens which import this file). Only ever accessed
// inside the response-error handler below, well after App.js has run.
let navigationRef = null;
const getNavigationRef = () => {
    if (!navigationRef) {
        try {
            navigationRef = require('../../App').navigationRef;
        } catch (e) {
            navigationRef = null;
        }
    }
    return navigationRef;
};

// Request interceptor - add auth token
api.interceptors.request.use(
    async (config) => {
        try {
            const token = await AsyncStorage.getItem('token');
            if (token) {
                config.headers.Authorization = `Bearer ${token}`;
            }
        } catch (error) {
            console.warn('Failed to get auth token:', error.message);
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

// Response interceptor - handle errors consistently across the app
api.interceptors.response.use(
    (response) => response,
    async (error) => {
        const status = error.response?.status;

        if (status === 401) {
            // Session is invalid/expired: clear it and bounce to Login so the
            // app never sits "visually logged in" while requests are failing.
            await AsyncStorage.multiRemove(['token', 'userId', 'role']);

            const ref = getNavigationRef();
            if (ref?.isReady?.()) {
                ref.reset({ index: 0, routes: [{ name: 'Login' }] });
            }
        }

        // Standardize error response so every screen can rely on the same shape
        const errorMessage = status === 401
            ? 'Your session has expired. Please log in again.'
            : status === 403
                ? (error.response?.data?.message || error.response?.data?.error || 'You are not authorized to do that.')
                : status === 404
                    ? 'The requested resource was not found.'
                    : status >= 500
                        ? 'Server error. Please try again shortly.'
                        : !error.response
                            ? 'Network error. Check your connection and try again.'
                            : (error.response?.data?.message || error.response?.data?.error || error.message || 'An unexpected error occurred');

        return Promise.reject({
            ...error,
            message: errorMessage,
            status,
        });
    }
);

export default api;

// Helper methods for common operations
export const apiHelpers = {
    /**
     * GET request with optional params
     */
    get: (url, params = {}) => api.get(url, { params }),

    /**
     * POST request with data
     */
    post: (url, data) => api.post(url, data),

    /**
     * PUT request with data
     */
    put: (url, data) => api.put(url, data),

    /**
     * DELETE request
     */
    delete: (url) => api.delete(url),
};
