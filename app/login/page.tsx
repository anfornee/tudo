"use client";

import { auth } from "@/lib/firebase-client";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
} from "firebase/auth";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sendTokenToBackend = async (idToken: string) => {
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ idToken }),
    });

    if (!response.ok) {
      throw new Error("Unable to create your session.");
    }

    await auth.signOut();

    router.push("/dashboard");
    router.refresh();
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    setLoading(true);
    setError(null);

    try {
      const userCredential =
        mode === "signin"
          ? await signInWithEmailAndPassword(auth, email, password)
          : await createUserWithEmailAndPassword(auth, email, password);

      const idToken = await userCredential.user.getIdToken();

      await sendTokenToBackend(idToken);
    } catch (error) {
      console.error(error);

      setError(
        mode === "signin"
          ? "Unable to sign in. Check your email and password."
          : "Unable to create your account."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mb-3 text-sm font-medium tracking-[0.2em] text-muted-foreground uppercase">
            Life Tracker
          </div>

          <h1 className="text-3xl font-semibold tracking-tight">
            Welcome back
          </h1>

          <p className="mt-2 text-sm text-muted-foreground">
            Your life, without all the noise.
          </p>
        </div>

        <Card className="border-border/60 bg-card/80 shadow-xl backdrop-blur">
          <CardHeader>
            <CardTitle>
              {mode === "signin" ? "Sign in" : "Create account"}
            </CardTitle>

            <CardDescription>
              {mode === "signin"
                ? "Enter your credentials to continue."
                : "Create an account to get started."}
            </CardDescription>
          </CardHeader>

          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>

                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  disabled={loading}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>

                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete={
                      mode === "signin"
                        ? "current-password"
                        : "new-password"
                    }
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    disabled={loading}
                    className="pr-10"
                    required
                  />

                  <button
                    type="button"
                    onClick={() => setShowPassword((current) => !current)}
                    disabled={loading}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground disabled:pointer-events-none disabled:opacity-50"
                  >
                    {showPassword ? (
                      <EyeOff className="size-4" />
                    ) : (
                      <Eye className="size-4" />
                    )}
                  </button>
                </div>
              </div>

              {error && (
                <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {error}
                </div>
              )}
            </CardContent>

            <CardFooter className="mt-6 flex flex-col gap-4">
              <Button
                type="submit"
                className="w-full"
                disabled={loading}
              >
                {loading && (
                  <Loader2 className="mr-2 size-4 animate-spin" />
                )}

                {mode === "signin"
                  ? "Sign in"
                  : "Create account"}
              </Button>

              <button
                type="button"
                className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                onClick={() => {
                  setMode((current) =>
                    current === "signin"
                      ? "signup"
                      : "signin"
                  );

                  setError(null);
                }}
                disabled={loading}
              >
                {mode === "signin"
                  ? "Don't have an account? Create one"
                  : "Already have an account? Sign in"}
              </button>
            </CardFooter>
          </form>
        </Card>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Private by default.
        </p>
      </div>
    </main>
  );
}