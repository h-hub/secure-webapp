"use client";
import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
} from "react";
import { useRouter } from "next/navigation";

interface SessionContextType {
  isAuthenticated: boolean;
  isLoading: boolean;
  expiresIn: number | null;
  csrfToken: string | null;
  setCsrfToken: (token: string | null) => void;
  checkSession: () => Promise<void>;
  signOut: () => Promise<void>;
  refreshToken: () => Promise<boolean>;
  fetchWithAuth: (input: RequestInfo, init?: RequestInit) => Promise<Response>;
}

const SessionContext = createContext<SessionContextType | undefined>(undefined);

const POLL_INTERVAL_S = 10; // 1 minute

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [expiresIn, setExpiresIn] = useState<number | null>(null);
  const [csrfToken, setCsrfTokenState] = useState<string | null>(
    typeof window !== "undefined" ? localStorage.getItem("csrfToken") : null,
  );
  const router = useRouter();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isRefreshingRef = useRef(false);
  const refreshPromiseRef = useRef<Promise<boolean> | null>(null);

  const setCsrfToken = useCallback((token: string | null) => {
    setCsrfTokenState(token);
    if (typeof window !== "undefined") {
      if (token) {
        localStorage.setItem("csrfToken", token);
      } else {
        localStorage.removeItem("csrfToken");
      }
    }
  }, []);

  const refreshToken = useCallback(async (): Promise<boolean> => {
    // If a refresh is already in-flight, reuse the same promise
    if (isRefreshingRef.current && refreshPromiseRef.current) {
      return refreshPromiseRef.current;
    }

    isRefreshingRef.current = true;
    refreshPromiseRef.current = (async () => {
      try {
        const res = await fetch("/api/user/token/refresh", { method: "GET" });
        if (res.ok) {
          setIsAuthenticated(true);
          const data = await res.json();
          if (data.newCsrfToken) {
            setCsrfToken(data.newCsrfToken);
          }
          return true;
        }
        setIsAuthenticated(false);
        return false;
      } catch {
        setIsAuthenticated(false);
        return false;
      } finally {
        isRefreshingRef.current = false;
        refreshPromiseRef.current = null;
      }
    })();

    return refreshPromiseRef.current;
  }, []);

  const fetchWithAuth = useCallback(
    async (input: RequestInfo, init?: RequestInit): Promise<Response> => {
      const res = await fetch(input, init);
      // const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null); // removed polling
      if (res.status === 401) {
        const refreshed = await refreshToken();
        if (refreshed) {
          return fetch(input, init); // retry with new token in cookie
        }
        // Refresh failed — session is dead
        setIsAuthenticated(false);
        router.push("/");
      }

      return res;
    },
    [refreshToken, router],
  );

  const checkSession = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/auth/session");
      const data = await res.json();

      if (res.ok && data.valid) {
        setIsAuthenticated(true);
        setExpiresIn(data.expiresIn ?? null);
      } else if (res.status === 401) {
        console.log(
          `Session invalid (401). expiresIn: ${expiresIn}, time: ${new Date().toLocaleString()}, attempting to refresh token...`,
        );
        const refreshed = await refreshToken();
        if (refreshed) {
          setIsAuthenticated(true);
        } else {
          console.log("Token refresh failed, session is dead.");
          setIsAuthenticated(false);
          setExpiresIn(null);
        }
      } else {
        setIsAuthenticated(false);
        setExpiresIn(null);
      }
    } catch {
      setIsAuthenticated(false);
      setExpiresIn(null);
    } finally {
      setIsLoading(false);
    }
  }, [refreshToken]);

  const signOut = useCallback(async () => {
    try {
      const res = await fetch("/api/user/sign-out", { method: "POST" });
      if (res.ok) {
        setIsAuthenticated(false);
        setExpiresIn(null);
        if (intervalRef.current) clearInterval(intervalRef.current);
        router.push("/");
      }
    } catch {
      // Optionally handle error
    }
  }, [router]);

  useEffect(() => {
    if (!isAuthenticated) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }

    if (intervalRef.current) clearInterval(intervalRef.current);

    intervalRef.current = setInterval(() => {
      // Always check session

      checkSession();
      console.log(
        `--- Polling session validity 1 | expiresIn: ${expiresIn} s | POLL_INTERVAL_S: ${POLL_INTERVAL_S} s | ${new Date().toLocaleString()} ---`,
      );
      // If token is expiring before the next interval, refresh proactively
      if (expiresIn != null && expiresIn * 2 < POLL_INTERVAL_S) {
        refreshToken();
      }
    }, POLL_INTERVAL_S * 1000);

    // On mount, do the same logic immediately
    checkSession();
    console.log(
      `--- Polling session validity 2 | expiresIn: ${expiresIn} s | POLL_INTERVAL_S: ${POLL_INTERVAL_S} s | ${new Date().toLocaleString()} ---`,
    );
    if (expiresIn != null && expiresIn * 2 < POLL_INTERVAL_S) {
      refreshToken();
    }

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isAuthenticated, refreshToken, checkSession, expiresIn]);

  useEffect(() => {
    if (!isAuthenticated) return;

    checkSession();

    // Layer 2: Refresh on visibility change + window focus
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        checkSession();
      }
    };
    const onFocus = () => checkSession();

    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("focus", onFocus);

    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("focus", onFocus);
    };
  }, [isAuthenticated, checkSession]);

  return (
    <SessionContext.Provider
      value={{
        isAuthenticated,
        isLoading,
        expiresIn,
        csrfToken,
        setCsrfToken,
        checkSession,
        signOut,
        refreshToken,
        fetchWithAuth,
      }}
    >
      {children}
    </SessionContext.Provider>
  );
}

export function useSession() {
  const context = useContext(SessionContext);
  if (!context) {
    throw new Error("useSession must be used within a SessionProvider");
  }
  return context;
}
