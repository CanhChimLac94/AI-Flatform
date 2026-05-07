"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";

export default function RegisterPage() {
  const { register } = useAuth();
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await register(email, name, password, username || undefined);
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
          <h1 className="text-2xl font-bold text-white">Create account</h1>
          <p className="text-gray-400 text-sm mt-1">Join Omni AI Chat — free to start</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <p className="text-sm text-red-400 bg-red-900/20 border border-red-800 rounded-lg px-3 py-2">
              {error}
            </p>
          )}
          <input
            type="text"
            placeholder="Họ và tên"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="w-full bg-input-bg border border-gray-600 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-500 outline-none focus:border-accent transition-colors"
          />
          <input
            type="text"
            placeholder="Tên đăng nhập (tuỳ chọn)"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            className="w-full bg-input-bg border border-gray-600 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-500 outline-none focus:border-accent transition-colors"
          />
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
            placeholder="Password (min 8 chars)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={8}
            required
            className="w-full bg-input-bg border border-gray-600 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-500 outline-none focus:border-accent transition-colors"
          />
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-accent hover:bg-accent-hover text-white py-3 rounded-xl text-sm font-medium transition-colors disabled:opacity-60"
          >
            {loading ? "Creating account…" : "Get started"}
          </button>
        </form>

        <p className="text-center text-sm text-gray-500">
          Already have an account?{" "}
          <Link href="/auth/login" className="text-accent hover:text-accent-hover">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
