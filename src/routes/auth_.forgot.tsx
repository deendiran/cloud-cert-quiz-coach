import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Loader2, MailCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/auth_/forgot")({
  ssr: false,
  component: ForgotPasswordPage,
});

function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setBusy(true);
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(
      email.trim(),
      { redirectTo: `${window.location.origin}/auth/reset` }
    );
    setBusy(false);
    if (resetError) {
      setError(
        "We couldn't send the reset email just now. Please check the address and try again."
      );
      return;
    }
    setSent(true);
  };

  return (
    <div className="flex flex-1 items-center justify-center px-0 py-8">
      <div className="w-full max-w-md">
        <Card className="rounded-2xl">
          {sent ? (
            <CardContent className="p-6 text-center">
              <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-correct-soft">
                <MailCheck className="size-7 text-correct-foreground" aria-hidden="true" />
              </div>
              <CardTitle className="mt-4 text-xl">Check your email</CardTitle>
              <CardDescription className="mt-2">
                If an account exists for <strong>{email.trim()}</strong>, a
                password-reset link is on its way. The link opens the page where
                you can set a new password.
              </CardDescription>
              <Button variant="outline" className="mt-6" asChild>
                <Link to="/auth">Back to sign in</Link>
              </Button>
            </CardContent>
          ) : (
            <CardContent className="p-6 pt-4">
              <CardHeader className="p-0 pb-4">
                <CardTitle className="text-lg">Reset your password</CardTitle>
                <CardDescription>
                  Enter your account email and we'll send you a reset link.
                </CardDescription>
              </CardHeader>
              <form onSubmit={submit} className="space-y-4" noValidate>
                <div className="space-y-1.5">
                  <Label htmlFor="forgot-email">Email</Label>
                  <Input
                    id="forgot-email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                  />
                </div>
                {error && (
                  <p role="alert" className="rounded-lg bg-incorrect-soft px-3 py-2 text-sm text-incorrect-foreground">
                    {error}
                  </p>
                )}
                <Button type="submit" className="w-full" disabled={busy}>
                  {busy && <Loader2 className="animate-spin" aria-hidden="true" />}
                  Send reset link
                </Button>
              </form>
              <p className="mt-4 text-center text-sm text-muted-foreground">
                <Link to="/auth" className="underline underline-offset-4 hover:text-foreground">
                  Back to sign in
                </Link>
              </p>
            </CardContent>
          )}
        </Card>
      </div>
    </div>
  );
}
