"use client";

import { Suspense, useState } from "react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { ArrowRight, Lock, Mail } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

function LoginForm({ className }: { className?: string }) {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw error;
      toast.success("Welcome back");
      router.push(params.get("redirect") || "/app/dashboard");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Sign-in failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      className={cn("flex flex-col gap-5", className)}
    >
      <div className="space-y-1">
        <h2 className="text-xl font-semibold tracking-tight text-foreground">
          Sign in
        </h2>
        <p className="text-sm text-muted-foreground">
          Access inventory, sales, and remittances.
        </p>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <div className="relative">
            <Mail className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="email"
              type="email"
              required
              autoComplete="email"
              className="h-11 bg-background/80 pl-9"
              placeholder="you@fourty.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <div className="relative">
            <Lock className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="password"
              type="password"
              required
              autoComplete="current-password"
              className="h-11 bg-background/80 pl-9"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
        </div>
      </div>

      <Button
        type="submit"
        size="lg"
        disabled={loading}
        className="h-11 w-full gap-2 bg-accent text-accent-foreground hover:bg-accent/90 focus-visible:border-accent focus-visible:ring-accent/40"
      >
        {loading ? "Signing in…" : "Sign in"}
        {!loading && <ArrowRight className="size-4" />}
      </Button>
    </form>
  );
}

function BrandMark({ size = "lg" }: { size?: "sm" | "lg" }) {
  const mark = size === "lg" ? "size-16 text-2xl" : "size-12 text-lg";
  return (
    <div
      className={cn(
        "flex items-center justify-center rounded-xl bg-accent font-bold tracking-tight text-accent-foreground shadow-sm",
        mark
      )}
      aria-hidden
    >
      40
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="relative h-dvh w-screen overflow-hidden">
      {/* Full-bleed background — locked to viewport */}
      <Image
        src="/login-background.jpg"
        alt=""
        fill
        priority
        className="scale-105 object-cover blur-[2.5px]"
        sizes="100vw"
      />
      <div className="absolute inset-0 bg-[oklch(0.22_0.05_255)]/55" />
      <div className="absolute inset-0 bg-gradient-to-br from-[oklch(0.28_0.07_255)]/70 via-transparent to-[oklch(0.45_0.14_30)]/35" />

      <div className="relative z-10 grid h-full w-full lg:grid-cols-[1.15fr_minmax(22rem,26rem)]">
        {/* Brand stage */}
        <section className="relative hidden h-full flex-col justify-between p-10 text-white lg:flex xl:p-14">
          <div className="animate-in fade-in slide-in-from-left-3 duration-700">
            <div className="flex items-center gap-3">
              <BrandMark size="lg" />
              <div>
                <p className="text-2xl font-semibold tracking-tight">Fourty</p>
                <p className="text-sm text-white/65">Distribution ops</p>
              </div>
            </div>
          </div>

          <div className="max-w-md animate-in fade-in slide-in-from-bottom-4 duration-700 fill-mode-both [animation-delay:120ms]">
            <p className="text-[0.7rem] font-medium uppercase tracking-[0.22em] text-accent">
              Field to ledger
            </p>
            <h1 className="mt-3 text-4xl font-semibold leading-[1.1] tracking-tight xl:text-5xl">
              Stock, sales, and remittances — one desk.
            </h1>
            <p className="mt-4 text-base leading-relaxed text-white/70">
              Built for storekeepers and subagents who move cartons by day and
              close the books by night.
            </p>
          </div>

          <p className="text-xs text-white/45 animate-in fade-in duration-700 [animation-delay:220ms] fill-mode-both">
            Authorized access only
          </p>
        </section>

        {/* Sign-in panel — fills remaining viewport */}
        <section className="flex h-full w-full items-center justify-center p-5 sm:p-8 lg:bg-card/95 lg:p-10 lg:backdrop-blur-xl lg:shadow-[-24px_0_60px_-20px_rgba(0,0,0,0.35)]">
          <div className="w-full max-w-[22rem] animate-in fade-in slide-in-from-right-4 duration-700">
            {/* Mobile brand header */}
            <div className="mb-8 flex flex-col items-center text-center lg:hidden">
              <BrandMark size="sm" />
              <h1 className="mt-4 text-2xl font-semibold tracking-tight text-white drop-shadow-sm">
                Fourty
              </h1>
              <p className="mt-1 text-sm text-white/75">
                Inventory & sales management
              </p>
            </div>

            <div className="rounded-lg border border-white/15 bg-card/92 p-6 shadow-xl backdrop-blur-md sm:p-7 lg:rounded-none lg:border-0 lg:bg-transparent lg:p-0 lg:shadow-none lg:backdrop-blur-none">
              <div className="mb-6 hidden lg:block">
                <div className="mb-5 h-1 w-10 rounded-full bg-accent" />
                <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                  Team access
                </p>
              </div>

              <Suspense
                fallback={
                  <div className="h-64 animate-pulse rounded-xl bg-muted/60" />
                }
              >
                <LoginForm />
              </Suspense>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
