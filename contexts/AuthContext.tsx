import { createContext, useContext, useState, useEffect, useMemo, ReactNode } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

interface User {
  id: string;
  email: string;
  name: string;
  provider?: "email" | "apple" | "google";
}

interface AuthContextValue {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  socialLogin: (user: { id: string; email: string; name: string; provider: "apple" | "google" }) => Promise<void>;
  logout: () => Promise<void>;
  deleteAccount: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadUser();
  }, []);

  async function loadUser() {
    try {
      const stored = await AsyncStorage.getItem("@stylist_user");
      if (stored) {
        setUser(JSON.parse(stored));
      }
    } catch (e) {
      console.error("Failed to load user:", e);
    } finally {
      setIsLoading(false);
    }
  }

  async function login(email: string, password: string) {
    const users = JSON.parse((await AsyncStorage.getItem("@stylist_users")) || "[]");
    const found = users.find((u: any) => u.email === email && u.password === password);
    if (!found) throw new Error("Invalid email or password");
    const userData: User = { id: found.id, email: found.email, name: found.name, provider: "email" };
    await AsyncStorage.setItem("@stylist_user", JSON.stringify(userData));
    setUser(userData);
  }

  async function register(name: string, email: string, password: string) {
    const users = JSON.parse((await AsyncStorage.getItem("@stylist_users")) || "[]");
    if (users.find((u: any) => u.email === email)) {
      throw new Error("An account with this email already exists");
    }
    const newUser = { id: Date.now().toString(), email, name, password };
    users.push(newUser);
    await AsyncStorage.setItem("@stylist_users", JSON.stringify(users));
    const userData: User = { id: newUser.id, email, name, provider: "email" };
    await AsyncStorage.setItem("@stylist_user", JSON.stringify(userData));
    setUser(userData);
  }

  async function socialLogin(socialUser: { id: string; email: string; name: string; provider: "apple" | "google" }) {
    const userData: User = {
      id: socialUser.id,
      email: socialUser.email,
      name: socialUser.name,
      provider: socialUser.provider,
    };
    await AsyncStorage.setItem("@stylist_user", JSON.stringify(userData));
    const users = JSON.parse((await AsyncStorage.getItem("@stylist_users")) || "[]");
    const exists = users.find((u: any) => u.email === socialUser.email);
    if (!exists) {
      users.push({ ...socialUser });
      await AsyncStorage.setItem("@stylist_users", JSON.stringify(users));
    }
    setUser(userData);
  }

  async function logout() {
    await AsyncStorage.removeItem("@stylist_user");
    setUser(null);
  }

  async function deleteAccount() {
    if (!user) return;
    const users = JSON.parse((await AsyncStorage.getItem("@stylist_users")) || "[]");
    const filtered = users.filter((u: any) => u.id !== user.id);
    await AsyncStorage.setItem("@stylist_users", JSON.stringify(filtered));
    await AsyncStorage.removeItem("@stylist_user");
    await AsyncStorage.removeItem(`@stylist_credits_${user.id}`);
    await AsyncStorage.removeItem(`@stylist_sub_${user.id}`);
    await AsyncStorage.removeItem("@stylist_wardrobe");
    await AsyncStorage.removeItem("@stylist_outfits");
    setUser(null);
  }

  const value = useMemo(
    () => ({ user, isLoading, login, register, socialLogin, logout, deleteAccount }),
    [user, isLoading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}
