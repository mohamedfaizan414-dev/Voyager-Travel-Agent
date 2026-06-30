"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2, Compass } from "lucide-react";

export default function SignUpClient() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Sign up failed."); return; }
      // Auto-sign-in after registration
      const result = await signIn("credentials", { email, password, redirect: false, callbackUrl: "/plan" });
      if (result?.error) { router.push("/auth/signin"); return; }
      router.push("/plan");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="ticket w-full max-w-md px-8 py-10">
      <div className="flex items-center gap-2 font-display text-xl text-paper">
        <Compass className="h-5 w-5 text-brass" strokeWidth={1.75} />
        Voyager
      </div>
      <h1 className="mt-6 font-display text-3xl">Create account</h1>
      <p className="mt-2 text-sm text-paper/60">Save trips, confirm bookings, and track your travel history.</p>

      <form onSubmit={handleSignUp} className="mt-8 space-y-4">
        <div>
          <label className="block text-xs text-paper/60 mb-1.5">Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-xl border border-white/10 bg-ink-700/60 px-4 py-2.5 text-sm text-paper placeholder:text-paper/30 focus:border-brass/50 focus:outline-none"
            placeholder="Your name"
          />
        </div>
        <div>
          <label className="block text-xs text-paper/60 mb-1.5">Email</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-xl border border-white/10 bg-ink-700/60 px-4 py-2.5 text-sm text-paper placeholder:text-paper/30 focus:border-brass/50 focus:outline-none"
            placeholder="you@example.com"
          />
        </div>
        <div>
          <label className="block text-xs text-paper/60 mb-1.5">Password</label>
          <input
            type="password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-xl border border-white/10 bg-ink-700/60 px-4 py-2.5 text-sm text-paper placeholder:text-paper/30 focus:border-brass/50 focus:outline-none"
            placeholder="At least 6 characters"
          />
        </div>

        {error && <p className="text-sm text-coral">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-coral py-3 font-medium text-ink-900 transition hover:bg-coral-light disabled:opacity-60"
        >
          {loading && <Loader2 className="h-4 w-4 animate-spin" />}
          Create account
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-paper/50">
        Already have an account?{" "}
        <Link href="/auth/signin" className="text-brass hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
