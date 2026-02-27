"use client";
import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/lib/SessionContext";

export default function SignInPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [responseMsg, setResponseMsg] = useState<string | null>(null);
  const router = useRouter();
  const { checkSession, setCsrfToken } = useSession();

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setResponseMsg(null);
    try {
      const res = await fetch("/api/user/sign-in", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (res.ok) {
        setResponseMsg("Sign-in successful!");
        if (data.newCsrfToken) {
          setCsrfToken(data.newCsrfToken);
        }
        await checkSession();
        router.push("/home");
      } else {
        setResponseMsg(data.message || "Sign-in failed");
      }
    } catch (err) {
      setResponseMsg("An error occurred. Please try again.");
    }
  };

  return (
    <div className="min-h-screen bg-white dark:bg-black">
      <div className="flex items-start justify-center pt-10">
        <main className="flex flex-col items-center justify-center p-10 bg-white dark:bg-black border border-black dark:border-white max-w-md w-full">
          <h1 className="text-5xl font-extrabold text-black dark:text-white mb-6 text-center">
            Sign In
          </h1>
          <form className="w-full flex flex-col gap-4" onSubmit={handleSubmit}>
            <div>
              <label
                htmlFor="email"
                className="block mb-1 text-sm font-semibold text-black dark:text-white"
              >
                Email
              </label>
              <input
                type="email"
                id="email"
                name="email"
                required
                className="w-full px-3 py-2 border border-black dark:border-white bg-white dark:bg-black text-black dark:text-white focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div>
              <label
                htmlFor="password"
                className="block mb-1 text-sm font-semibold text-black dark:text-white"
              >
                Password
              </label>
              <input
                type="password"
                id="password"
                name="password"
                required
                className="w-full px-3 py-2 border border-black dark:border-white bg-white dark:bg-black text-black dark:text-white focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <button
              type="submit"
              className="w-full py-2 mt-2 font-semibold bg-black text-white hover:bg-gray-800 hover:scale-105 transition-transform dark:bg-white dark:text-black dark:hover:bg-gray-200"
            >
              Sign In
            </button>
          </form>
          {responseMsg && (
            <div className="w-full mt-4 text-sm text-center text-black dark:text-white font-semibold px-3 py-2 border border-black dark:border-white">
              {responseMsg}
            </div>
          )}
          <p className="mt-6 text-sm text-black dark:text-white">
            Don&apos;t have an account?{" "}
            <a href="/sign-up" className="font-semibold hover:underline">
              Sign up
            </a>
          </p>
        </main>
      </div>
    </div>
  );
}
