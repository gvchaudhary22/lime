"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Eye, EyeOff, ShieldCheck, Loader2, Check } from "lucide-react";
import AuthLayout from "@/components/auth/AuthLayout";
import { api } from "@/lib/api";

function SetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const prefillEmail = searchParams.get("email") || "";

  const [email, setEmail] = useState(prefillEmail);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const passwordChecks = [
    { label: "At least 8 characters", met: password.length >= 8 },
    { label: "Contains a number", met: /\d/.test(password) },
    { label: "Contains uppercase", met: /[A-Z]/.test(password) },
    { label: "Passwords match", met: password.length > 0 && password === confirmPassword },
  ];

  const allChecksMet = passwordChecks.every((c) => c.met);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setLoading(true);

    try {
      const res = await api.register({
        email,
        password,
        confirm_password: confirmPassword,
      });
      if (res.success && res.data) {
        localStorage.setItem("mars_token", res.data.token);
        localStorage.setItem("mars_user", JSON.stringify(res.data.user));
        router.push("/chat");
      } else {
        setError(res.error || "Registration failed");
      }
    } catch {
      setError("Unable to connect to server");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      {/* Header */}
      <h2 className="text-3xl font-bold text-white mb-2">
        Set your password
      </h2>
      <p className="text-slate-400 mb-8">
        This activates your account from the invite.
      </p>

      {/* Error */}
      {error && (
        <div className="mb-6 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Email */}
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">
            Email address
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@shiprocket.com"
            required
            className="w-full px-4 py-3.5 rounded-xl bg-white/[0.05] border border-purple-400/[0.1] text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500/40 focus:border-purple-500/40 transition-all text-sm"
          />
        </div>

        {/* New Password */}
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">
            New password
          </label>
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••••"
              required
              className="w-full px-4 py-3.5 rounded-xl bg-white/[0.05] border border-purple-400/[0.1] text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500/40 focus:border-purple-500/40 transition-all text-sm pr-12"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
            >
              {showPassword ? (
                <EyeOff className="w-5 h-5" />
              ) : (
                <Eye className="w-5 h-5" />
              )}
            </button>
          </div>
        </div>

        {/* Confirm Password */}
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">
            Confirm password
          </label>
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Re-enter your password"
            required
            className="w-full px-4 py-3.5 rounded-xl bg-white/[0.05] border border-purple-400/[0.1] text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500/40 focus:border-purple-500/40 transition-all text-sm"
          />
        </div>

        {/* Password strength indicators */}
        {password.length > 0 && (
          <div className="space-y-2 p-4 rounded-xl bg-purple-500/[0.03] border border-purple-400/[0.08]">
            {passwordChecks.map(({ label, met }) => (
              <div key={label} className="flex items-center gap-2.5">
                <div
                  className={`w-4 h-4 rounded-full flex items-center justify-center transition-colors ${
                    met
                      ? "bg-emerald-500/20 text-emerald-400"
                      : "bg-white/[0.05] text-slate-600"
                  }`}
                >
                  <Check className="w-3 h-3" />
                </div>
                <span
                  className={`text-xs transition-colors ${
                    met ? "text-emerald-400" : "text-slate-500"
                  }`}
                >
                  {label}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Submit */}
        <button
          type="submit"
          disabled={loading || !allChecksMet}
          className="w-full py-3.5 rounded-xl bg-gradient-to-r from-purple-600 to-violet-600 hover:from-purple-500 hover:to-violet-500 text-white font-semibold text-sm transition-all duration-200 flex items-center justify-center gap-2 shadow-lg shadow-purple-500/20 hover:shadow-purple-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <>
              <ShieldCheck className="w-4 h-4" />
              Set password
            </>
          )}
        </button>

        {/* Back to sign in */}
        <p className="text-center text-sm text-slate-400 mt-4">
          Already have an account?{" "}
          <a
            href="/"
            className="text-purple-400 hover:text-purple-300 font-medium transition-colors"
          >
            Sign in
          </a>
        </p>
      </form>
    </div>
  );
}

export default function SetPasswordPage() {
  return (
    <AuthLayout>
      <Suspense fallback={<div className="text-slate-400">Loading...</div>}>
        <SetPasswordForm />
      </Suspense>
    </AuthLayout>
  );
}
