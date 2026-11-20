import { useState } from "react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { toast } from "sonner";
import { useStore } from "../state/store";
import { LANDING_URL } from "../../lib/db";
import { LogIn, ShieldCheck } from "lucide-react";

/**
 * In-app login. The app is backend-first: every session must be a real
 * backend account (stored in the DB) so that Managers/Cashiers the Admin
 * creates are real users who can sign in on the landing page. This screen
 * signs the current user in directly and stores the backend JWT locally —
 * the same token the landing page would have handed over via cookie.
 */
export function Login() {
  const { login } = useStore();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      toast.error("Please enter your email and password");
      return;
    }
    setSubmitting(true);
    try {
      await login(email.trim(), password);
      toast.success("Signed in successfully");
    } catch (error) {
      console.error("Login failed:", error);
      toast.error((error as Error).message || "Invalid email or password");
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4 bg-gradient-to-br from-indigo-50 via-white to-purple-50">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center text-center mb-8">
          <div className="flex items-center gap-2.5 mb-4">
            <img
              src="/icon.png"
              alt="SellSync"
              className="w-12 h-12 rounded-xl object-cover shadow-xl shadow-indigo-100"
            />
            <span className="text-3xl font-black tracking-tight text-[#3B82F6]">
              SellSync
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-gray-900">
            Sign in to your account
          </h1>
          <p className="text-sm font-medium text-gray-500 mt-2 max-w-sm">
            Sign in with the account you created on the SellSync landing page.
            Everyone the Admin adds — Managers and Cashiers — logs in with the
            same account details.
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-white rounded-[2rem] shadow-2xl shadow-indigo-100/60 border border-gray-100 p-8 sm:p-10 space-y-6"
        >
          <div className="space-y-2">
            <Label
              htmlFor="login-email"
              className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1"
            >
              Email *
            </Label>
            <Input
              id="login-email"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              className="h-12 rounded-2xl bg-gray-50 border-gray-100 focus:bg-white transition-all font-medium"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label
              htmlFor="login-password"
              className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1"
            >
              Password *
            </Label>
            <Input
              id="login-password"
              type="password"
              autoComplete="current-password"
              placeholder="Your password"
              className="h-12 rounded-2xl bg-gray-50 border-gray-100 focus:bg-white transition-all font-medium"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <Button
            type="submit"
            disabled={submitting}
            className="w-full h-14 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-black shadow-xl shadow-indigo-100 transition-all active:scale-[0.98]"
          >
            {submitting ? "Signing in..." : "Sign In"}
          </Button>

          <div className="text-center">
            <a
              href={`${LANDING_URL}/signup`}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-600 hover:text-indigo-700"
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              Don't have an account? Create one on the landing page
            </a>
          </div>

          <div className="flex items-center gap-2 pt-2">
            <LogIn className="w-3.5 h-3.5 text-gray-300 shrink-0" />
            <p className="text-[10px] font-bold text-gray-400 leading-relaxed">
              Managers and Cashiers created from the Team page are real
              accounts — they sign in here or on the landing page with the
              credentials the Admin assigned them.
            </p>
          </div>
        </form>
      </div>
    </div>
  );
}