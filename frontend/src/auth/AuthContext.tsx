import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { AuthUser } from "shared";
import { authApi } from "../api/client";

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  setupRequired: boolean;
  login(email: string, password: string): Promise<void>;
  setup(input: {
    fullName: string;
    email: string;
    password: string;
  }): Promise<void>;
  registerDoctor(input: {
    fullName: string;
    email: string;
    password: string;
    specialty: string;
    phone?: string;
    licenseNumber?: string;
  }): Promise<void>;
  logout(): Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [setupRequired, setSetupRequired] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const status = await authApi.setupStatus();
        setSetupRequired(status.setupRequired);
        if (!status.setupRequired) setUser((await authApi.me()).user);
      } catch {
        setUser(null);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function login(email: string, password: string) {
    setUser((await authApi.login({ email, password })).user);
  }
  async function setup(input: {
    fullName: string;
    email: string;
    password: string;
  }) {
    setUser((await authApi.setup(input)).user);
    setSetupRequired(false);
  }
  async function registerDoctor(input: {
    fullName: string;
    email: string;
    password: string;
    specialty: string;
    phone?: string;
    licenseNumber?: string;
  }) {
    setUser((await authApi.registerDoctor(input)).user);
  }
  async function logout() {
    await authApi.logout();
    setUser(null);
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        setupRequired,
        login,
        setup,
        registerDoctor,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}
