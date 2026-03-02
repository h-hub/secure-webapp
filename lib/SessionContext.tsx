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

const POLL_INTERVAL_S = 10; // 2 seconds

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
      const start = performance.now();
      try {
        const res = await fetch("/api/user/token/refresh", { method: "GET" });
        const end = performance.now();
        console.log(
          `⏱️ /api/user/token/refresh response time: ${(end - start).toFixed(1)} ms`,
        );
        if (res.ok) {
          console.log(
            `✅ Token refresh successful at ${new Date().toLocaleString()}`,
          );
          setIsAuthenticated(true);
          const data = await res.json();
          if (data.newCsrfToken) {
            setCsrfToken(data.newCsrfToken);
          }
          setExpiresIn(data.expiresIn ?? null);
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

  // --- Polling helpers (not hooks) ---
  const checkAndMaybeRefresh = useCallback(() => {
    console.log(
      `--- Polling session validity | expiresIn: ${expiresIn} s | POLL_INTERVAL_S: ${POLL_INTERVAL_S} s | ${new Date().toLocaleString()} ---`,
    );
    // Add a buffer (in seconds) to refresh before expiry
    const REFRESH_BUFFER_S = 5;
    if (expiresIn != null && expiresIn < POLL_INTERVAL_S + REFRESH_BUFFER_S) {
      console.log(
        `Proactively refreshing token before expiry (expiresIn: ${expiresIn}s, buffer: ${POLL_INTERVAL_S + REFRESH_BUFFER_S}s)...`,
      );
      refreshToken();
    } else {
      checkSession();
    }
  }, [expiresIn, refreshToken, checkSession]);

  const startPolling = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    intervalRef.current = setInterval(
      checkAndMaybeRefresh,
      POLL_INTERVAL_S * 1000,
    );
  }, [checkAndMaybeRefresh]);

  useEffect(() => {
    let cancelled = false;
    // Only start polling after the first session check completes and user is authenticated
    (async () => {
      await checkSession();
      if (!cancelled && isAuthenticated) {
        checkAndMaybeRefresh();
        startPolling();
      } else if (!isAuthenticated && intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    })();

    return () => {
      cancelled = true;
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
    // eslint-disable-next-line
  }, [isAuthenticated, checkAndMaybeRefresh, startPolling]);

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
