"use client";
import React, { useEffect, useState } from "react";
import { useSession } from "@/lib/SessionContext";

export default function HomePage() {
  const [username, setUsername] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [refreshResult, setRefreshResult] = useState<string | null>(null);
  const [sessionResult, setSessionResult] = useState<string | null>(null);
  const {
    isAuthenticated,
    isLoading,
    checkSession,
    signOut,
    refreshToken,
    fetchWithAuth,
    csrfToken,
  } = useSession();

  const handleSignOut = async () => {
    await signOut();
  };

  const handleCheckSession = async () => {
    setSessionResult(null);
    await checkSession();
    setSessionResult(
      isAuthenticated ? "Session is valid" : "Session is invalid",
    );
  };

  const handleForceRefresh = async () => {
    setRefreshResult(null);
    const success = await refreshToken();
    setRefreshResult(
      success ? "Token refreshed successfully!" : "Refresh failed",
    );
  };

  useEffect(() => {
    const fetchUser = async () => {
      try {
        setErrorMessage(null);
        const headers: HeadersInit = {};
        const storedCsrfToken =
          typeof window !== "undefined"
            ? localStorage.getItem("csrfToken")
            : null;
        if (storedCsrfToken) headers["x-csrf-token"] = storedCsrfToken;
        const res = await fetch("/api/user/profile", { headers });
        if (res.ok) {
          const data = await res.json();
          setUsername(data.email);
        } else {
          const data = await res.json();
          setErrorMessage(
            data.message || data.error || "Failed to fetch user details",
          );
        }
      } catch (err) {
        setErrorMessage("Failed to fetch user details");
      }
    };
    fetchUser();
  }, []);

  return (
    <div className="min-h-screen bg-white dark:bg-black">
      {/* Top Menu Panel */}
      <nav className="w-full border-b border-black dark:border-white px-6 py-3 flex items-center justify-between">
        <button
          onClick={handleSignOut}
          className="text-sm font-semibold text-black dark:text-white hover:underline"
        >
          Sign Out
        </button>
      </nav>

      <div className="flex items-start justify-center pt-10">
        <main className="flex flex-col items-center justify-center p-10 bg-white dark:bg-black border border-black dark:border-white max-w-lg w-full">
          {/* Welcome Section */}
          <h1 className="text-5xl font-extrabold text-black dark:text-white mb-2 text-center">
            Welcome Home
          </h1>
          {username && (
            <p className="text-2xl font-semibold text-black dark:text-white mb-2 text-center">
              {username}
            </p>
          )}
          {errorMessage && (
            <div className="text-sm text-center text-red-600 dark:text-red-400 font-semibold px-3 py-2 border border-red-400 dark:border-red-600 my-2">
              {errorMessage}
            </div>
          )}
          <p className="text-lg text-black dark:text-white text-center mb-6">
            Your secure React webapp starts here.
          </p>

          {/* Actions Section */}
          <div className="w-full border-t border-black dark:border-white pt-6 flex flex-wrap justify-center gap-3">
            <button
              onClick={handleForceRefresh}
              className="px-4 py-1.5 text-sm bg-black text-white font-semibold hover:bg-gray-800 hover:scale-105 transition-transform dark:bg-white dark:text-black dark:hover:bg-gray-200"
            >
              Refresh Token
            </button>
            <button
              onClick={handleCheckSession}
              className="px-4 py-1.5 text-sm bg-black text-white font-semibold hover:bg-gray-800 hover:scale-105 transition-transform dark:bg-white dark:text-black dark:hover:bg-gray-200"
            >
              Check Session
            </button>
          </div>

          {/* Results Section */}
          <div className="w-full mt-6 border-t border-black dark:border-white pt-6 min-h-20">
            {refreshResult || sessionResult ? (
              <div className="flex flex-col gap-2">
                {refreshResult && (
                  <div className="text-sm text-center text-black dark:text-white font-semibold px-3 py-2 border border-black dark:border-white">
                    {refreshResult}
                  </div>
                )}
                {sessionResult && (
                  <div className="text-sm text-center text-black dark:text-white font-semibold px-3 py-2 border border-black dark:border-white">
                    {sessionResult}
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-center text-gray-400 dark:text-gray-600">
                Results will appear here.
              </p>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
