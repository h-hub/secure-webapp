"use client";
import { useState } from "react";

export default function SignUpPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    if (!email || !password || !confirmPassword) {
      setError("All fields are required.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/user/sign-up", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Sign up failed");
      } else {
        setSuccess("Sign up successful! Please check your email.");
        setEmail("");
        setPassword("");
        setConfirmPassword("");
      }
    } catch (err) {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white dark:bg-black">
      <div className="flex items-start justify-center pt-10">
        <main className="flex flex-col items-center justify-center p-10 bg-white dark:bg-black border border-black dark:border-white max-w-md w-full">
          <h1 className="text-5xl font-extrabold text-black dark:text-white mb-6 text-center">
            Sign Up
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
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 border border-black dark:border-white bg-white dark:bg-black text-black dark:text-white focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white"
                autoComplete="email"
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
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2 border border-black dark:border-white bg-white dark:bg-black text-black dark:text-white focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white"
                autoComplete="new-password"
              />
            </div>
            <div>
              <label
                htmlFor="confirmPassword"
                className="block mb-1 text-sm font-semibold text-black dark:text-white"
              >
                Confirm Password
              </label>
              <input
                type="password"
                id="confirmPassword"
                name="confirmPassword"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-3 py-2 border border-black dark:border-white bg-white dark:bg-black text-black dark:text-white focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white"
                autoComplete="new-password"
              />
            </div>
            <button
              type="submit"
              className="w-full py-2 mt-2 font-semibold bg-black text-white hover:bg-gray-800 hover:scale-105 transition-transform dark:bg-white dark:text-black dark:hover:bg-gray-200 disabled:opacity-60"
              disabled={loading}
            >
              {loading ? "Signing Up..." : "Sign Up"}
            </button>
          </form>
          {error && (
            <div className="w-full mt-4 text-sm text-center text-black dark:text-white font-semibold px-3 py-2 border border-black dark:border-white">
              {error}
            </div>
          )}
          {success && (
            <div className="w-full mt-4 text-sm text-center text-black dark:text-white font-semibold px-3 py-2 border border-black dark:border-white">
              {success}
            </div>
          )}
          <p className="mt-6 text-sm text-black dark:text-white">
            Already have an account?{" "}
            <a href="/" className="font-semibold hover:underline">
              Sign in
            </a>
          </p>
        </main>
      </div>
    </div>
  );
}
