import axios from "axios";
import { isNative, getServerUrl, setPersistedRefreshToken } from "../capacitor/register";

let accessToken: string | null = null;
let refreshToken: string | null = null;
let serverUrlBase = "/api";

export function setAccessToken(token: string | null) {
  accessToken = token;
}

export function getAccessToken(): string | null {
  return accessToken;
}

export function setRefreshToken(token: string | null) {
  refreshToken = token;
}

export function getRefreshToken(): string | null {
  return refreshToken;
}

export async function initClientBaseUrl() {
  if (isNative()) {
    const url = await getServerUrl();
    if (url) {
      serverUrlBase = `${url}/api`;
    }
  }
}

const client = axios.create({
  baseURL: "/api",
  headers: {
    "Cache-Control": "no-cache, no-store, must-revalidate",
    Pragma: "no-cache",
    Expires: "0",
  },
  withCredentials: true,
});

client.interceptors.request.use((config) => {
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }

  config.baseURL = serverUrlBase;

  const lang =
    localStorage.getItem("i18nextLng") ||
    navigator.language?.slice(0, 2) ||
    "en";
  config.headers["Accept-Language"] = lang;

  return config;
});

let isRefreshing = false;
let failedQueue: Array<{
  resolve: (token: string) => void;
  reject: (err: unknown) => void;
}> = [];

function processQueue(error: unknown, token: string | null = null) {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token!);
    }
  });
  failedQueue = [];
}

client.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (
      error.response?.status === 401 &&
      !originalRequest._retry &&
      !originalRequest.url?.includes("/auth/login") &&
      !originalRequest.url?.includes("/auth/register") &&
      !originalRequest.url?.includes("/auth/verify-2fa") &&
      !originalRequest.url?.includes("/auth/refresh")
    ) {
      if (isRefreshing) {
        return new Promise<string>((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then((token) => {
          originalRequest.headers.Authorization = `Bearer ${token}`;
          return client(originalRequest);
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const body: Record<string, unknown> = { rememberMe: true };
        if (refreshToken) {
          body.refreshToken = refreshToken;
        }
        const { data } = await axios.post(`${serverUrlBase}/auth/refresh`, body, { withCredentials: true });

        setAccessToken(data.accessToken);
        setRefreshToken(data.refreshToken);
        setPersistedRefreshToken(data.refreshToken);
        processQueue(null, data.accessToken);

        originalRequest.headers.Authorization = `Bearer ${data.accessToken}`;
        return client(originalRequest);
      } catch (err) {
        console.error("[client] token refresh failed:", err);
        processQueue(err, null);
        setAccessToken(null);
        setRefreshToken(null);
        setPersistedRefreshToken(null);
        if (!isNative() || !error.config?.url?.startsWith("/tasks")) {
          window.location.href = "/login";
        }
        return Promise.reject(err);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  },
);

export { client };
