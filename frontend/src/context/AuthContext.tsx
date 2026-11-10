"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import {
  type User,
  registerUser,
  loginUser,
  loginWithGoogle,
  loginWithFacebook,
  fetchMe,
} from "../lib/api";

interface AuthContextValue {
  user: User | null;
  token: string | null;
  loading: boolean;
  register: (payload: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
  }) => Promise<void>;
  login: (payload: { email: string; password: string }) => Promise<void>;
  loginGoogle: (idToken: string) => Promise<void>;
  loginFacebook: (accessToken: string) => Promise<void>;
  logout: () => void;
  updateUser: (user: User) => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const TOKEN_KEY = "tapakila_token";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const storedToken = localStorage.getItem(TOKEN_KEY);
    if (!storedToken) {
      setLoading(false);
      return;
    }

    fetchMe(storedToken)
      .then(({ user }) => {
        setUser(user);
        setToken(storedToken);
      })
      .catch(() => {
        localStorage.removeItem(TOKEN_KEY);
      })
      .finally(() => setLoading(false));
  }, []);

  function persistSession(authUser: User, authToken: string) {
    localStorage.setItem(TOKEN_KEY, authToken);
    setUser(authUser);
    setToken(authToken);
  }

  async function register(payload: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
  }) {
    const { user, token } = await registerUser(payload);
    persistSession(user, token);
  }

  async function login(payload: { email: string; password: string }) {
    const { user, token } = await loginUser(payload);
    persistSession(user, token);
  }

  async function loginGoogle(idToken: string) {
    const { user, token } = await loginWithGoogle(idToken);
    persistSession(user, token);
  }

  async function loginFacebook(accessToken: string) {
    const { user, token } = await loginWithFacebook(accessToken);
    persistSession(user, token);
  }

  function logout() {
    localStorage.removeItem(TOKEN_KEY);
    setUser(null);
    setToken(null);
  }

  function updateUser(updated: User) {
    setUser(updated);
  }

  return (
    <AuthContext.Provider
      value={{ user, token, loading, register, login, loginGoogle, loginFacebook, logout, updateUser }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth doit être utilisé à l'intérieur d'un AuthProvider");
  }
  return ctx;
}