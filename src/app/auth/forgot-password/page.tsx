"use client";

import { useState } from "react";
import Link from "next/link";
import { sendResetPasswordEmail } from "@/lib/auth";
import AuthShell, { authInputClass, authLabelClass } from "@/components/auth/AuthShell";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);

    try {
      await sendResetPasswordEmail(email);
      setSuccess("Password reset email sent. Please check your inbox and spam folder.");
    } catch (err) {
      const code = (err as { code?: string } | null)?.code;
      if (code === "auth/invalid-email") {
        setError("Please enter a valid email address.");
      } else if (code === "auth/user-not-found") {
        setError("No account found with this email.");
      } else {
        setError("Could not send reset email. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell mode="forgot">
      <div className="mx-auto w-full max-w-2xl">
        <div className="mb-9 lg:text-center">
          <h1 className="text-2xl font-bold tracking-tight lg:text-3xl lg:uppercase" style={{ fontFamily: '"Ubuntu", ui-sans-serif, system-ui, sans-serif' }}>Forgot password</h1>
          <p className="mt-1 text-sm text-white/50">Enter your email and we will send a reset link.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-7">
          {error ? <p role="alert" className="text-sm text-[#ff9d62]">{error}</p> : null}
          {success ? <p role="status" className="text-sm text-emerald-300">{success}</p> : null}
          <div className="space-y-2">
            <label htmlFor="forgot-email" className={authLabelClass}>Email</label>
            <input
              id="forgot-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
              required
              className={authInputClass}
            />
          </div>
          <button type="submit" disabled={loading} className="w-full rounded-xl bg-[#f5f0de] px-4 py-3.5 text-base font-bold text-[#211f20] transition hover:bg-white disabled:opacity-60 lg:mx-auto lg:block lg:w-56 lg:rounded-full lg:bg-[#ff7a1a] lg:text-[#0b0b0b] lg:shadow-[0_6px_15px_rgba(255,122,26,0.25)] lg:hover:bg-[#ff8c35]">
            {loading ? "Sending…" : "Send reset link"}
          </button>
        </form>

        <p className="mt-7 text-center text-sm text-white/55 lg:text-center">
          <Link href="/auth/login" className="font-semibold text-[#ffb36b] hover:text-[#ff8d3b]">Back to sign in</Link>
        </p>
      </div>
    </AuthShell>
  );
}
