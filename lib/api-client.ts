import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import { Platform } from "react-native";

export const STORAGE_KEYS = {
  ACCESS_TOKEN: "@stylist_access_token",
  REFRESH_TOKEN: "@stylist_refresh_token",
};

type StylingSourceMode = "photo_only" | "saved_wardrobe" | "saved_wardrobe_plus";
type WardrobeSuggestModel = "auto" | "uform" | "llava";
type WardrobeSuggestion = {
  name: string;
  category: string;
  color: string;
  shade: string;
  pattern: string;
  confidence: number;
  modelUsed: "uform" | "llava" | "";
};

export type SocialLoginPayload =
  | {
      provider: "google";
      idToken: string;
      email?: string;
      name?: string;
    }
  | {
      provider: "apple";
      identityToken: string;
      email?: string;
      name?: string;
    };

const NETWORK_DEBUG_ENABLED = process.env.EXPO_PUBLIC_DEBUG_NETWORK === "true";

function shouldDebugNetwork(): boolean {
  return __DEV__ || NETWORK_DEBUG_ENABLED;
}

function createRequestId(): string {
  return `req-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function extractErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return String(error);
}

function withApiPortIfNeeded(hostOrDomain: string): string {
  const trimmed = hostOrDomain.trim();
  if (!trimmed) return trimmed;

  const hasPort = /:\d+$/.test(trimmed);
  if (hasPort) return trimmed;

  const isLocalHost =
    trimmed === "localhost" ||
    trimmed === "127.0.0.1" ||
    trimmed === "0.0.0.0";
  if (isLocalHost) {
    return `${trimmed}:5000`;
  }

  return trimmed;
}

function getApiBaseUrl(): string {
  const extra: any = Constants.expoConfig?.extra || {};
  if (typeof extra.apiBaseUrl === "string" && extra.apiBaseUrl.length > 0) {
    return extra.apiBaseUrl;
  }

  if (process.env.EXPO_PUBLIC_API_BASE_URL) {
    return process.env.EXPO_PUBLIC_API_BASE_URL;
  }

  if (Platform.OS === "web" && typeof window !== "undefined") {
    const { protocol, hostname, port, origin } = window.location;
    const isLocalhost = hostname === "localhost" || hostname === "127.0.0.1";
    if (isLocalhost && port !== "5000") {
      return `${protocol}//${hostname}:5000`;
    }
    return origin;
  }

  if (process.env.EXPO_PUBLIC_DOMAIN) {
    return `https://${withApiPortIfNeeded(process.env.EXPO_PUBLIC_DOMAIN)}`;
  }

  const hostUri =
    Constants.expoConfig?.hostUri ||
    (Constants as any).manifest?.hostUri ||
    (Constants as any).manifest2?.extra?.expoClient?.hostUri;

  if (hostUri) {
    const host = hostUri.split(":")[0];
    if (host) {
      if (host === "localhost" || host === "127.0.0.1") {
        return "http://localhost:5000";
      }
      const isIpv4 = /^\d{1,3}(?:\.\d{1,3}){3}$/.test(host);
      if (isIpv4) {
        return `http://${host}:5000`;
      }
      return `https://${withApiPortIfNeeded(host)}`;
    }
  }

  return "http://localhost:5000";
}

const API_BASE_URL = getApiBaseUrl();

class ApiClient {
  private accessToken: string | null = null;
  private refreshToken: string | null = null;
  private refreshPromise: Promise<boolean> | null = null;

  async init(): Promise<void> {
    this.accessToken = await AsyncStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
    this.refreshToken = await AsyncStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN);
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
    requireAuth: boolean = true,
  ): Promise<T> {
    const url = `${API_BASE_URL}/api${endpoint}`;
    const requestId = createRequestId();
    const requestStartedAt = Date.now();
    const headers: HeadersInit = {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    };
    (headers as Record<string, string>)["X-Client-Request-Id"] = requestId;
    (headers as Record<string, string>)["X-Client-Platform"] = Platform.OS;

    if (requireAuth && this.accessToken) {
      (headers as Record<string, string>).Authorization = `Bearer ${this.accessToken}`;
    }

    if (requireAuth && !this.accessToken && this.refreshToken) {
      const refreshed = await this.refreshAccessToken();
      if (refreshed && this.accessToken) {
        (headers as Record<string, string>).Authorization = `Bearer ${this.accessToken}`;
      }
    }

    if (shouldDebugNetwork()) {
      console.log(`[API][start][${requestId}] ${options.method || "GET"} ${url}`);
    }

    const doFetch = async () => {
      try {
        return await fetch(url, { ...options, headers });
      } catch (error) {
        const err: any = new Error(
          `Could not connect to API (${API_BASE_URL}). Make sure backend server is running.`,
        );
        err.cause = error;
        err.requestId = requestId;
        throw err;
      }
    };

    let response = await doFetch();
    let data: any = null;
    let textBody = "";
    let contentType = response.headers.get("content-type") || "";

    try {
      textBody = await response.text();
      const likelyJson =
        contentType.includes("application/json") ||
        textBody.trimStart().startsWith("{") ||
        textBody.trimStart().startsWith("[");
      data = textBody && likelyJson ? JSON.parse(textBody) : null;
    } catch {
      data = null;
    }

    if (requireAuth && response.status === 401 && this.refreshToken) {
      const refreshed = await this.refreshAccessToken();
      if (refreshed) {
        if (this.accessToken) {
          (headers as Record<string, string>).Authorization = `Bearer ${this.accessToken}`;
        }
        response = await doFetch();
        try {
          textBody = await response.text();
          const nextContentType = response.headers.get("content-type") || "";
          contentType = nextContentType;
          const likelyJson =
            nextContentType.includes("application/json") ||
            textBody.trimStart().startsWith("{") ||
            textBody.trimStart().startsWith("[");
          data = textBody && likelyJson ? JSON.parse(textBody) : null;
        } catch {
          data = null;
        }
      }
    }

    if (!response.ok) {
      const message = data?.error || data?.message || `HTTP ${response.status}`;
      const err: any = new Error(message);
      err.status = response.status;
      err.data = data;
      err.rawText = textBody;
      err.requestId = requestId;
      throw err;
    }

    if (data === null) {
      const preview = textBody.trim().slice(0, 120);
      const err: any = new Error(
        `Unexpected API response from ${url}. Expected JSON but got ${contentType || "unknown content-type"}${preview ? ` (${preview}...)` : ""}.`,
      );
      err.status = response.status;
      err.rawText = textBody;
      err.requestId = requestId;
      throw err;
    }

    if (shouldDebugNetwork()) {
      console.log(
        `[API][ok][${requestId}] ${response.status} ${options.method || "GET"} ${endpoint} in ${Date.now() - requestStartedAt}ms`,
      );
    }

    return data as T;
  }

  private async refreshAccessToken(): Promise<boolean> {
    if (!this.refreshToken) return false;
    if (this.refreshPromise) return this.refreshPromise;

    this.refreshPromise = (async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/auth/refresh`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refreshToken: this.refreshToken }),
        });
        if (!response.ok) {
          await this.clearAuth();
          return false;
        }
        const data = await response.json();
        await this.setAuth(data.accessToken, data.refreshToken);
        return true;
      } catch {
        await this.clearAuth();
        return false;
      } finally {
        this.refreshPromise = null;
      }
    })();

    return this.refreshPromise;
  }

  async setAuth(accessToken: string, refreshToken: string): Promise<void> {
    this.accessToken = accessToken;
    this.refreshToken = refreshToken;
    await AsyncStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, accessToken);
    await AsyncStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, refreshToken);
  }

  async clearAuth(): Promise<void> {
    this.accessToken = null;
    this.refreshToken = null;
    await AsyncStorage.multiRemove([STORAGE_KEYS.ACCESS_TOKEN, STORAGE_KEYS.REFRESH_TOKEN]);
  }

  isAuthenticated(): boolean {
    return !!this.accessToken;
  }

  async register(name: string, email: string, password: string) {
    const data = await this.request<{
      user: any;
      accessToken: string;
      refreshToken: string;
    }>(
      "/auth/register",
      {
        method: "POST",
        body: JSON.stringify({ name, email, password }),
      },
      false,
    );
    await this.setAuth(data.accessToken, data.refreshToken);
    return data;
  }

  async login(email: string, password: string) {
    const data = await this.request<{
      user: any;
      accessToken: string;
      refreshToken: string;
    }>(
      "/auth/login",
      {
        method: "POST",
        body: JSON.stringify({ email, password }),
      },
      false,
    );
    await this.setAuth(data.accessToken, data.refreshToken);
    return data;
  }

  async resetPassword(email: string, newPassword: string) {
    return this.request<{ success: boolean; message: string }>(
      "/auth/reset-password",
      {
        method: "POST",
        body: JSON.stringify({ email, newPassword }),
      },
      false,
    );
  }

  async socialLogin(payload: SocialLoginPayload) {
    const data = await this.request<{
      user: any;
      accessToken: string;
      refreshToken: string;
    }>(
      "/auth/social",
      {
        method: "POST",
        body: JSON.stringify(payload),
      },
      false,
    );
    await this.setAuth(data.accessToken, data.refreshToken);
    return data;
  }

  async logout(): Promise<void> {
    try {
      await this.request(
        "/auth/logout",
        {
          method: "POST",
          body: JSON.stringify({ refreshToken: this.refreshToken }),
        },
        true,
      );
    } finally {
      await this.clearAuth();
    }
  }

  async deleteAccount(): Promise<void> {
    await this.request("/auth/account", { method: "DELETE" }, true);
    await this.clearAuth();
  }

  async getProfile() {
    return this.request<any>("/profile", {}, true);
  }

  async updateProfile(payload: {
    name?: string;
    styleGender?: "female" | "male" | "non_binary" | null;
    stylePreferences?: string[];
    favoriteLooks?: string[];
    notificationsEnabled?: boolean;
  }) {
    return this.request<any>(
      "/profile",
      {
        method: "PUT",
        body: JSON.stringify(payload),
      },
      true,
    );
  }

  async healthCheck() {
    try {
      const response = await this.request<{
        status: string;
        service: string;
        timestamp: string;
        requestId?: string | null;
      }>("/health", {}, false);
      if (shouldDebugNetwork()) {
        console.log(`[API][health] reachable`, response);
      }
      return response;
    } catch (error) {
      if (shouldDebugNetwork()) {
        console.warn(`[API][health] failed: ${extractErrorMessage(error)}`);
      }
      throw error;
    }
  }

  async getCredits() {
    return this.request<{ credits: number; subscription: string | null }>("/credits", {}, true);
  }

  async getCreditPackages() {
    return this.request<any[]>("/credits/packages", {}, true);
  }

  async getCreditTransactions() {
    return this.request<any[]>("/credits/transactions", {}, true);
  }

  async useCredit(feature: string) {
    return this.request<{ success: boolean; credits: number }>(
      "/credits/use",
      {
        method: "POST",
        body: JSON.stringify({ feature }),
      },
      true,
    );
  }

  async grantDevCredits(amount?: number) {
    return this.request<{ success: boolean; grantedCredits: number; credits: number }>(
      "/credits/dev-grant",
      {
        method: "POST",
        body: JSON.stringify(typeof amount === "number" ? { amount } : {}),
      },
      true,
    );
  }

  async createCheckoutSession(payload: {
    itemType: "package" | "subscription";
    itemId: string;
    successUrl?: string;
    cancelUrl?: string;
  }) {
    return this.request<{ url: string; sessionId: string }>(
      "/credits/checkout",
      {
        method: "POST",
        body: JSON.stringify(payload),
      },
      true,
    );
  }

  async verifyPaymentSession(sessionId: string | string[]) {
    const normalizedSessionId = Array.isArray(sessionId) ? sessionId[0] : sessionId;
    if (!normalizedSessionId) {
      throw new Error("Missing payment session ID");
    }
    return this.request<{ success: boolean; credits: number; subscription: string | null }>(
      `/credits/verify-session/${encodeURIComponent(normalizedSessionId)}`,
      {},
      true,
    );
  }

  async verifyApplePurchase(receiptData: string, productId: string) {
    return this.request<{ success: boolean; credits: number; error?: string }>(
      "/credits/apple-verify",
      {
        method: "POST",
        body: JSON.stringify({ receiptData, productId }),
      },
      true,
    );
  }

  async verifyGooglePurchase(purchaseToken: string, productId: string) {
    return this.request<{ success: boolean; credits: number; error?: string; bypass?: boolean }>(
      "/credits/google-verify",
      {
        method: "POST",
        body: JSON.stringify({ purchaseToken, productId }),
      },
      true,
    );
  }

  async suggestWardrobeDetails(payload: {
    imageBase64: string;
    mimeType?: string;
    model?: WardrobeSuggestModel;
  }) {
    return this.request<WardrobeSuggestion>(
      "/wardrobe/suggest",
      {
        method: "POST",
        body: JSON.stringify(payload),
      },
      true,
    );
  }

  async generateStyle(payload: {
    items: { name: string; category: string; color: string; description?: string }[];
    occasion: string;
    gender?: "female" | "male" | "non_binary";
    customPrompt: string;
    event?: string;
    season?: string;
    aesthetic?: string;
    colorPalette?: string;
    requiredPieces?: string[];
    outputMode: "text" | "image";
    imageInputMode: "single_item" | "multi_item";
    photos: { base64: string; mimeType?: string }[];
    sourceMode: StylingSourceMode;
    allowExtraPieces?: boolean;
  }) {
    return this.request<{
      lookName: string;
      description: string;
      tips: string[];
      usedPieces: string[];
      imageBase64?: string;
      outputMode: "text" | "image";
      creditsCharged: number;
    }>(
      "/style",
      {
        method: "POST",
        body: JSON.stringify(payload),
      },
      true,
    );
  }

  async modifyStyle(payload: {
    originalDescription: string;
    originalTips: string[];
    modifyRequest: string;
    items: { name: string; category: string; color: string; description?: string }[];
    occasion: string;
    gender?: "female" | "male" | "non_binary";
    event?: string;
    season?: string;
    aesthetic?: string;
    colorPalette?: string;
    customPrompt?: string;
    requiredPieces?: string[];
    outputMode: "text" | "image";
    imageInputMode: "single_item" | "multi_item";
    photos?: { base64: string; mimeType?: string }[];
    sourceMode: StylingSourceMode;
    allowExtraPieces?: boolean;
  }) {
    return this.request<{
      lookName: string;
      description: string;
      tips: string[];
      usedPieces: string[];
      imageBase64?: string;
      outputMode: "text" | "image";
      creditsCharged: number;
    }>(
      "/style/modify",
      {
        method: "POST",
        body: JSON.stringify(payload),
      },
      true,
    );
  }
}

export const apiClient = new ApiClient();
export { getApiBaseUrl, API_BASE_URL };
