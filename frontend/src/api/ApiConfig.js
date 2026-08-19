import axios from 'axios';

export const BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8080";

export const API_ENDPOINTS = {
    // === AUTH & SIGNUP ===
    AUTH: {
        LOGIN: `${BASE_URL}/auth/login`,
        LOGOUT: `${BASE_URL}/auth/logout`,
        REFRESH: `${BASE_URL}/auth/refresh`,
        REGISTER: `${BASE_URL}/signUp/register`,
        REGISTER_OTP: `${BASE_URL}/signUp/send-otp`,
        REGISTER_VERIFY_OTP: `${BASE_URL}/signUp/verify-otp`,

    },

    // === FORGOT PASSWORD ===
    FORGOT_PASSWORD: {
        GET_OTP: `${BASE_URL}/forgot-password/get-otp`,
        CHANGE_PASSWORD: `${BASE_URL}/forgot-password/change-password`,
    },

    // === CONNECTIONS / FRIENDS ===
    CONNECTION: {
        GET_ALL: `${BASE_URL}/connection/getAllConnections`,
        UNREAD_COUNT: `${BASE_URL}/connection/unread-count`,
        SEND_REQUEST: (targetId) => `${BASE_URL}/connection/sendRequest/${targetId}`,
        // Dynamic actions: accept/reject/cancel
        ACTION: (action, requestId) => `${BASE_URL}/connection/${action}/${requestId}`,
        CANCEL: (requestId) => `${BASE_URL}/connection/cancel/${requestId}`,
    },

    // === MESSAGES & NOTIFICATIONS ===
    MESSAGES: {
        GET_HISTORY: (roomId) => `${BASE_URL}/messages/${roomId}`,
        SEND: `${BASE_URL}/messages/send`,
        MARK_READ: (roomId) => `${BASE_URL}/messages/${roomId}/mark-read`,
        CLEAR_CHAT: (roomId) => `${BASE_URL}/messages/${roomId}/clearChat`,
        MARK_SEEN_ALL: `${BASE_URL}/requests/mark-seen`,
        WS_URL: `${BASE_URL}/ws`,
    },

    // === USERS & SEARCH ===
    USERS: {
        PROFILE_DATA: `${BASE_URL}/users/profile-data`,
        UPDATE_PIC: `${BASE_URL}/users/profile-picture`,
        SEARCH: (query) => `${BASE_URL}/users/search?query=${query}`,
    },

    // === CONTACTS ===
    CONTACTS: {
        GET_ALL: `${BASE_URL}/contacts/allContacts`,
    },

    // === INVITATIONS ===
    INVITATIONS: {
        SEND: `${BASE_URL}/invitations/sendInvite`,
    },

    // === WEBSOCKET ===
    WEBSOCKETS:{
        CONNECT: `${BASE_URL}/ws`,
    }
};

export const AXIOS_CONFIG = { withCredentials: true };

