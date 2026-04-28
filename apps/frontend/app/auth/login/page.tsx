"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(email, password);
      router.replace("/chat");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-chat-bg px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-white">Welcome back</h1>
          <p className="text-gray-400 text-sm mt-1">Sign in to Omni AI Chat</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <p className="text-sm text-red-400 bg-red-900/20 border border-red-800 rounded-lg px-3 py-2">
              {error}
            </p>
          )}
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full bg-input-bg border border-gray-600 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-500 outline-none focus:border-accent transition-colors"
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="w-full bg-input-bg border border-gray-600 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-500 outline-none focus:border-accent transition-colors"
          />
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-accent hover:bg-accent-hover text-white py-3 rounded-xl text-sm font-medium transition-colors disabled:opacity-60"
          >
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <p className="text-center text-sm text-gray-500">
          No account?{" "}
          <Link href="/auth/register" className="text-accent hover:text-accent-hover">
            Create one
          </Link>
        </p>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-700" />
          </div>
          <div className="relative flex justify-center text-xs">
            <span className="bg-chat-bg px-2 text-gray-500">hoặc</span>
          </div>
        </div>

        <Link
          href="/chat"
          className="block w-full text-center border border-gray-600 hover:border-gray-400 text-gray-400 hover:text-white py-3 rounded-xl text-sm transition-colors"
        >
          Tiếp tục không cần đăng nhập
        </Link>
      </div>
    </div>
  );
}
