import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { apiClient, type SocialLoginPayload } from "@/lib/api-client";

export interface User {
  id: string;
  email: string;
  name: string;
  provider?: "email" | "apple" | "google";
  credits?: number;
  subscription?: string | null;
  styleGender?: "female" | "male" | "non_binary" | null;
  stylePreferences?: string[];
  favoriteLooks?: string[];
  notificationsEnabled?: boolean;
}

interface AuthContextValue {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  socialLogin: (payload: SocialLoginPayload) => Promise<void>;
  logout: () => Promise<void>;
  deleteAccount: () => Promise<void>;
  refreshUser: () => Promise<void>;
  updateProfile: (payload: {
    name?: string;
    styleGender?: "female" | "male" | "non_binary" | null;
    stylePreferences?: string[];
    favoriteLooks?: string[];
    notificationsEnabled?: boolean;
  }) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

async function cleanupLegacyLocalData() {
  const keys = await AsyncStorage.getAllKeys();
  const legacyKeys = keys.filter(
    (key) =>
      key === "@stylist_user" ||
      key === "@stylist_users" ||
      key === "@stylist_wardrobe" ||
      key === "@stylist_outfits" ||
      key.startsWith("@stylist_credits_") ||
      key.startsWith("@stylist_sub_"),
  );
  if (legacyKeys.length > 0) {
    await AsyncStorage.multiRemove(legacyKeys);
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        await apiClient.init();
        await cleanupLegacyLocalData();
        if (apiClient.isAuthenticated()) {
          const profile = await apiClient.getProfile();
          setUser(profile);
        }
      } catch (error) {
        const status = (error as { status?: number } | null)?.status;
        if (status !== 401) {
          console.error("Failed to initialize auth:", error);
        }
        await apiClient.clearAuth();
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  async function refreshUser() {
    if (!apiClient.isAuthenticated()) {
      setUser(null);
      return;
    }
    try {
      const profile = await apiClient.getProfile();
      setUser(profile);
    } catch (error) {
      const status = (error as { status?: number } | null)?.status;
      if (status === 401) {
        await apiClient.clearAuth();
        setUser(null);
        return;
      }
      throw error;
    }
  }

  async function login(email: string, password: string) {
    const { user: userData } = await apiClient.login(email, password);
    setUser(userData);
  }

  async function register(name: string, email: string, password: string) {
    const { user: userData } = await apiClient.register(name, email, password);
    setUser(userData);
  }

  async function socialLogin(payload: SocialLoginPayload) {
    const { user: userData } = await apiClient.socialLogin(payload);
    setUser(userData);
  }

  async function updateProfile(payload: {
    name?: string;
    styleGender?: "female" | "male" | "non_binary" | null;
    stylePreferences?: string[];
    favoriteLooks?: string[];
    notificationsEnabled?: boolean;
  }) {
    const updated = await apiClient.updateProfile(payload);
    setUser(updated);
  }

  async function logout() {
    try {
      await apiClient.logout();
    } catch (error) {
      console.error("Logout request failed, clearing local auth state:", error);
    } finally {
      setUser(null);
    }
  }

  async function deleteAccount() {
    const currentUserId = user?.id;
    await apiClient.deleteAccount();
    setUser(null);
    if (currentUserId) {
      await AsyncStorage.multiRemove([
        `@stylist_wardrobe_${currentUserId}`,
        `@stylist_outfits_${currentUserId}`,
      ]);
    }
    await cleanupLegacyLocalData();
  }

  const value = useMemo(
    () => ({
      user,
      isLoading,
      login,
      register,
      socialLogin,
      logout,
      deleteAccount,
      refreshUser,
      updateProfile,
    }),
    [user, isLoading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}
