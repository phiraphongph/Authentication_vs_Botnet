"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"basic" | "rate-limit">("basic");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    success: boolean;
    message: string;
    status: number;
    duration: number;
  } | null>(null);
  const [attempts, setAttempts] = useState(0);
  const [showPassword, setShowPassword] = useState(false);

  // Particle animation state
  const [particles, setParticles] = useState<
    { id: number; x: number; y: number; size: number; speed: number; opacity: number }[]
  >([]);

  useEffect(() => {
    const generated = Array.from({ length: 40 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: Math.random() * 3 + 1,
      speed: Math.random() * 20 + 10,
      opacity: Math.random() * 0.5 + 0.1,
    }));
    setParticles(generated);
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setResult(null);

    const startTime = Date.now();

    try {
      const res = await fetch(`/api/login/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json();
      const duration = Date.now() - startTime;

      setResult({
        success: data.success || false,
        message: data.message || data.error || "Unknown response",
        status: res.status,
        duration,
      });
      setAttempts((prev) => prev + 1);
    } catch {
      setResult({
        success: false,
        message: "Connection failed — server may be down",
        status: 0,
        duration: Date.now() - startTime,
      });
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: number) => {
    if (status === 200) return "text-emerald-400";
    if (status === 429) return "text-amber-400";
    if (status === 401) return "text-red-400";
    return "text-zinc-400";
  };

  const getStatusBg = (status: number) => {
    if (status === 200) return "border-emerald-500/30 bg-emerald-500/5";
    if (status === 429) return "border-amber-500/30 bg-amber-500/5";
    if (status === 401) return "border-red-500/30 bg-red-500/5";
    return "border-zinc-500/30 bg-zinc-500/5";
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#0a0a0f]">
      {/* Animated background gradient */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-1/4 -top-1/4 h-[600px] w-[600px] rounded-full bg-purple-600/10 blur-[120px] animate-pulse" />
        <div className="absolute -bottom-1/4 -right-1/4 h-[600px] w-[600px] rounded-full bg-cyan-600/10 blur-[120px] animate-pulse" style={{ animationDelay: "1s" }} />
        <div className="absolute left-1/2 top-1/2 h-[400px] w-[400px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-rose-600/5 blur-[100px] animate-pulse" style={{ animationDelay: "2s" }} />
      </div>

      {/* Floating particles */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {particles.map((p) => (
          <div
            key={p.id}
            className="absolute rounded-full bg-white"
            style={{
              left: `${p.x}%`,
              top: `${p.y}%`,
              width: `${p.size}px`,
              height: `${p.size}px`,
              opacity: p.opacity,
              animation: `float ${p.speed}s ease-in-out infinite`,
              animationDelay: `${p.id * 0.3}s`,
            }}
          />
        ))}
      </div>

      {/* Main content */}
      <div className="relative z-10 w-full max-w-md px-4">
        {/* Header */}
        <div className="mb-8 text-center">
          <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-purple-500 to-cyan-500 text-3xl shadow-lg shadow-purple-500/20">
            🛡️
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-white">
            Authentication Lab
          </h1>
          <p className="mt-2 text-sm text-zinc-500">
            Botnet Defense Testing System
          </p>
        </div>

        {/* Login card */}
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-8 shadow-2xl backdrop-blur-xl">
          {/* Mode toggle */}
          <div className="mb-6">
            <label className="mb-2 block text-xs font-medium uppercase tracking-wider text-zinc-500">
              Security Mode
            </label>
            <div className="flex gap-2 rounded-xl bg-white/5 p-1">
              <button
                type="button"
                onClick={() => setMode("basic")}
                className={`flex-1 rounded-lg px-4 py-2.5 text-sm font-medium transition-all duration-300 ${
                  mode === "basic"
                    ? "bg-gradient-to-r from-red-500/80 to-rose-500/80 text-white shadow-lg shadow-red-500/20"
                    : "text-zinc-500 hover:text-zinc-300"
                }`}
              >
                <span className="mr-1.5">⚠️</span> Basic (No Protection)
              </button>
              <button
                type="button"
                onClick={() => setMode("rate-limit")}
                className={`flex-1 rounded-lg px-4 py-2.5 text-sm font-medium transition-all duration-300 ${
                  mode === "rate-limit"
                    ? "bg-gradient-to-r from-emerald-500/80 to-cyan-500/80 text-white shadow-lg shadow-emerald-500/20"
                    : "text-zinc-500 hover:text-zinc-300"
                }`}
              >
                <span className="mr-1.5">🛡️</span> Rate-Limited
              </button>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleLogin} className="space-y-5">
            {/* Username */}
            <div className="group">
              <label
                htmlFor="username"
                className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-zinc-500"
              >
                Username
              </label>
              <div className="relative">
                <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-600">
                  <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
                  </svg>
                </span>
                <input
                  id="username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Enter username"
                  required
                  className="w-full rounded-xl border border-white/10 bg-white/5 py-3 pl-11 pr-4 text-white placeholder-zinc-600 outline-none transition-all duration-300 focus:border-purple-500/50 focus:bg-white/[0.07] focus:ring-2 focus:ring-purple-500/20"
                />
              </div>
            </div>

            {/* Password */}
            <div className="group">
              <label
                htmlFor="password"
                className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-zinc-500"
              >
                Password
              </label>
              <div className="relative">
                <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-600">
                  <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
                  </svg>
                </span>
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password"
                  required
                  className="w-full rounded-xl border border-white/10 bg-white/5 py-3 pl-11 pr-12 text-white placeholder-zinc-600 outline-none transition-all duration-300 focus:border-purple-500/50 focus:bg-white/[0.07] focus:ring-2 focus:ring-purple-500/20"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-zinc-600 transition-colors hover:text-zinc-400"
                >
                  {showPassword ? (
                    <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 0 0 1.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.451 10.451 0 0 1 12 4.5c4.756 0 8.773 3.162 10.065 7.498a10.522 10.522 0 0 1-4.293 5.774M6.228 6.228 3 3m3.228 3.228 3.65 3.65m7.894 7.894L21 21m-3.228-3.228-3.65-3.65m0 0a3 3 0 1 0-4.243-4.243m4.242 4.242L9.88 9.88" />
                    </svg>
                  ) : (
                    <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {/* Submit button */}
            <button
              type="submit"
              disabled={loading}
              className={`relative w-full overflow-hidden rounded-xl py-3.5 text-sm font-semibold text-white transition-all duration-300 ${
                mode === "basic"
                  ? "bg-gradient-to-r from-red-500 to-rose-600 shadow-lg shadow-red-500/25 hover:shadow-red-500/40"
                  : "bg-gradient-to-r from-emerald-500 to-cyan-600 shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/40"
              } ${loading ? "opacity-70" : "hover:scale-[1.02] active:scale-[0.98]"}`}
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-25" />
                    <path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="3" strokeLinecap="round" className="opacity-75" />
                  </svg>
                  Authenticating...
                </span>
              ) : (
                `Sign In → ${mode === "basic" ? "(No Protection)" : "(Rate-Limited)"}`
              )}
            </button>
          </form>

          {/* Result display */}
          {result && (
            <div
              className={`mt-5 rounded-xl border p-4 transition-all duration-500 ${getStatusBg(result.status)}`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-lg">
                    {result.status === 200
                      ? "✅"
                      : result.status === 429
                        ? "🚫"
                        : result.status === 401
                          ? "❌"
                          : "⚠️"}
                  </span>
                  <span className={`text-sm font-semibold ${getStatusColor(result.status)}`}>
                    Status {result.status}
                  </span>
                </div>
                <span className="text-xs font-mono text-zinc-500">
                  {result.duration}ms
                </span>
              </div>
              <p className="mt-1.5 text-sm text-zinc-400">{result.message}</p>
            </div>
          )}

          {/* Attempt counter */}
          {attempts > 0 && (
            <div className="mt-4 flex items-center justify-center gap-2 text-xs text-zinc-600">
              <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
              </svg>
              <span>{attempts} login attempt{attempts !== 1 ? "s" : ""} in this session</span>
            </div>
          )}
        </div>

        {/* Footer links */}
        <div className="mt-6 flex items-center justify-center gap-4 text-sm text-zinc-600">
          <Link
            href="/"
            className="transition-colors hover:text-zinc-300"
          >
            ← Home
          </Link>
          <span>•</span>
          <Link
            href="/dashboard"
            className="transition-colors hover:text-zinc-300"
          >
            📊 Dashboard
          </Link>
        </div>

        {/* Mode info pill */}
        <div className="mt-4 text-center">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${
              mode === "basic"
                ? "bg-red-500/10 text-red-400 ring-1 ring-red-500/20"
                : "bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/20"
            }`}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                mode === "basic" ? "bg-red-400 animate-pulse" : "bg-emerald-400 animate-pulse"
              }`}
            />
            {mode === "basic"
              ? "Endpoint: /api/login/basic — No rate limiting"
              : "Endpoint: /api/login/rate-limit — Max 5 req/min per IP"}
          </span>
        </div>
      </div>

      {/* Global animations */}
      <style jsx global>{`
        @keyframes float {
          0%,
          100% {
            transform: translateY(0px) translateX(0px);
          }
          25% {
            transform: translateY(-20px) translateX(10px);
          }
          50% {
            transform: translateY(-10px) translateX(-10px);
          }
          75% {
            transform: translateY(-30px) translateX(5px);
          }
        }
      `}</style>
    </div>
  );
}
