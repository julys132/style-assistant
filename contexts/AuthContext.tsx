import { createContext, useContext, useState, useEffect, useMemo, ReactNode } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

interface User {
  id: string;
  email: string;
  name: string;
}

interface AuthContextValue {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
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
    const userData: User = { id: found.id, email: found.email, name: found.name };
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
    const userData: User = { id: newUser.id, email, name };
    await AsyncStorage.setItem("@stylist_user", JSON.stringify(userData));
    setUser(userData);
  }

  async function logout() {
    await AsyncStorage.removeItem("@stylist_user");
    setUser(null);
  }

  const value = useMemo(
    () => ({ user, isLoading, login, register, logout }),
    [user, isLoading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}
