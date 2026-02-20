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
  checkSession: () => Promise<void>;
  signOut: () => Promise<void>;
  refreshToken: () => Promise<boolean>;
  fetchWithAuth: (input: RequestInfo, init?: RequestInit) => Promise<Response>;
}

const SessionContext = createContext<SessionContextType | undefined>(undefined);

const POLL_INTERVAL_MS = 5 * 60 * 1000; // Poll every 5 minutes
const REFRESH_BUFFER_S = 10; // Refresh token 10 seconds before expiry

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [expiresIn, setExpiresIn] = useState<number | null>(null);
  const router = useRouter();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Deduplicated refresh — prevents multiple simultaneous refresh calls
  const isRefreshingRef = useRef(false);
  const refreshPromiseRef = useRef<Promise<boolean> | null>(null);

  const refreshToken = useCallback(async (): Promise<boolean> => {
    // If a refresh is already in-flight, reuse the same promise
    if (isRefreshingRef.current && refreshPromiseRef.current) {
      return refreshPromiseRef.current;
    }

    isRefreshingRef.current = true;
    refreshPromiseRef.current = (async () => {
      try {
        const res = await fetch("/api/user/token/refresh");
        if (res.ok) {
          setIsAuthenticated(true);
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

  // Layer 3: Fetch wrapper — catches 401, refreshes, retries once
  const fetchWithAuth = useCallback(
    async (input: RequestInfo, init?: RequestInit): Promise<Response> => {
      const res = await fetch(input, init);

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

  // Schedule a proactive token refresh before the access token expires
  const scheduleRefresh = useCallback(
    (secondsRemaining: number) => {
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
      const delayMs = Math.max((secondsRemaining - REFRESH_BUFFER_S) * 1000, 0);
      refreshTimerRef.current = setTimeout(async () => {
        const success = await refreshToken();
        if (!success) {
          setIsAuthenticated(false);
          router.push("/");
        }
      }, delayMs);
    },
    [refreshToken, router],
  );

  // Layer 1: Polling — session check returns expiresIn or error
  const checkSession = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/auth/session");
      const data = await res.json();

      if (res.ok && data.valid) {
        setIsAuthenticated(true);
        setExpiresIn(data.expiresIn ?? null);
        if (data.expiresIn != null) {
          scheduleRefresh(data.expiresIn);
        }
      } else if (res.status === 401) {
        // Access token expired/missing — try to refresh
        const refreshed = await refreshToken();
        if (refreshed) {
          setIsAuthenticated(true);
        } else {
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
  }, [refreshToken, scheduleRefresh]);

  const signOut = useCallback(async () => {
    try {
      const res = await fetch("/api/user/sign-out", { method: "POST" });
      if (res.ok) {
        setIsAuthenticated(false);
        setExpiresIn(null);
        if (intervalRef.current) clearInterval(intervalRef.current);
        if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
        router.push("/");
      }
    } catch {
      // Optionally handle error
    }
  }, [router]);

  useEffect(() => {
    checkSession();

    // Layer 1: Poll every 5 minutes
    intervalRef.current = setInterval(checkSession, POLL_INTERVAL_MS);

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
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("focus", onFocus);
    };
  }, [checkSession]);

  return (
    <SessionContext.Provider
      value={{
        isAuthenticated,
        isLoading,
        expiresIn,
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
