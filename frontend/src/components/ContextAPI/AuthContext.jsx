import React, { createContext, useState, useEffect } from "react";
import axios from "axios";
import Cookies from "js-cookie";
import { API_ENDPOINTS, AXIOS_CONFIG } from "../../api/ApiConfig";

export const AuthContext = createContext();

let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [userId, setUserId] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);

  // ================================
  // Axios interceptor for 401 errors
  // ================================
  useEffect(() => {
    const interceptor = axios.interceptors.response.use(
      (res) => res,
      async (error) => {
        const originalRequest = error.config;

        if (!originalRequest || !originalRequest.url) return Promise.reject(error);

        // Avoid infinite loop on refresh endpoint or if not logged in
        if (
          error.response?.status === 401 &&
          !originalRequest._retry &&
          !originalRequest.url.includes("/auth/refresh") &&
          isAuthenticated
        ) {

          if (isRefreshing) {
            // If refresh is already in progress, queue this request
            return new Promise((resolve, reject) => {
              failedQueue.push({ resolve, reject });
            })
              .then(() => axios(originalRequest))
              .catch((err) => Promise.reject(err));
          }

          originalRequest._retry = true;
          isRefreshing = true;

          try {
            // Attempt to get a new session
            await axios.post(API_ENDPOINTS.AUTH.REFRESH, {}, AXIOS_CONFIG);

            isRefreshing = false;
            processQueue(null); // Resolve all waiting requests

            return axios(originalRequest);
          } catch (refreshError) {
            isRefreshing = false;
            processQueue(refreshError); // Reject all waiting requests
            await handleLogout();
            return Promise.reject(refreshError);
          }
        }

        return Promise.reject(error);
      }
    );

    return () => axios.interceptors.response.eject(interceptor);
  }, [isAuthenticated]);

  // ================================
  // Initialize auth on app load
  // ================================
  useEffect(() => {
    const initializeAuth = async () => {
      setLoading(true);
      const cookieData = Cookies.get("userData");

      if (!cookieData) {
        setIsAuthenticated(false);
        setLoading(false);
        return;
      }

      try {
        // Try to refresh access_token if expired
        await axios.post(API_ENDPOINTS.AUTH.REFRESH, {}, AXIOS_CONFIG);
        const response = await axios.get(API_ENDPOINTS.USERS.PROFILE_DATA, AXIOS_CONFIG);


        setUser(response.data);
        setUserId(response.data.id);
        setIsAuthenticated(true);
      } catch (_) {
        // Refresh failed → logout
        console.error("Session restoration failed");
        await handleLogout();
      } finally {
        setLoading(false);
      }
    };

    initializeAuth();
  }, []);

  // ================================
  // Login
  // ================================
  const login = (userData) => {

    const normalizedUser = {
      id: Number(userData.id),
      username: userData.username,
      email: userData.email,
      profilePicture: userData.profilePicture,
      status: userData.status,
    };

    const { profilePicture, ...cookieData } = normalizedUser;
    Cookies.set("userData", JSON.stringify(cookieData), { expires: 1 });
    setUser(normalizedUser);
    setIsAuthenticated(true);
  };


  // ================================
  // Logout
  // ================================
  const handleLogout = async () => {
    try {
      await axios.post(API_ENDPOINTS.AUTH.LOGOUT, {}, AXIOS_CONFIG);
    } catch (_) { }
    Cookies.remove("userData");
    setUser(null);
    setUserId(null);
    setIsAuthenticated(false);
  };

  return (
    <AuthContext.Provider value={{ user, setUser, isAuthenticated, login, logout: handleLogout, loading }}>
      {children}
    </AuthContext.Provider>
  );
};
