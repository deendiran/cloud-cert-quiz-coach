import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
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

export const Route = createFileRoute("/auth_/reset")({
  ssr: false,
  component: ResetPasswordPage,
});

type Stage = "waiting" | "ready" | "done" | "expired";

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [stage, setStage] = useState<Stage>("waiting");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const url = new URL(window.location.href);
    const params = url.searchParams;
    if (params.get("error") || params.get("error_description")) {
      setStage("expired");
      return;
    }
    // detectSessionInUrl signs the user in from the recovery link; poll briefly.
    let attempts = 0;
    const check = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        setStage("ready");
      } else if (attempts < 10) {
        attempts += 1;
        window.setTimeout(check, 500);
      } else {
        setStage("expired");
      }
    };
    void check();
  }, []);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    setBusy(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (updateError) {
      setError(
        "We couldn't update your password just now. The link may have expired — request a new one."
      );
      return;
    }
    setStage("done");
  };

  return (
    <div className="flex flex-1 items-center justify-center px-0 py-8">
      <div className="w-full max-w-md">
        <Card className="rounded-2xl">
          {stage === "waiting" && (
            <CardContent className="flex flex-col items-center gap-3 p-10 text-center text-muted-foreground">
              <Loader2 className="size-6 animate-spin" aria-hidden="true" />
              <p className="text-sm">Checking your reset link…</p>
            </CardContent>
          )}
          {stage === "expired" && (
            <CardContent className="p-6 text-center">
              <CardTitle className="text-xl">Link expired</CardTitle>
              <CardDescription className="mt-2">
                This reset link has expired or was already used. Request a new
                one to set a new password.
              </CardDescription>
              <Button className="mt-6" asChild>
                <Link to="/auth/forgot">Request a new link</Link>
              </Button>
            </CardContent>
          )}
          {stage === "ready" && (
            <CardContent className="p-6 pt-4">
              <CardHeader className="p-0 pb-4">
                <CardTitle className="text-lg">Set a new password</CardTitle>
                <CardDescription>Choose a password of at least 8 characters.</CardDescription>
              </CardHeader>
              <form onSubmit={submit} className="space-y-4" noValidate>
                <div className="space-y-1.5">
                  <Label htmlFor="reset-password">New password</Label>
                  <Input
                    id="reset-password"
                    type="password"
                    autoComplete="new-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
                {error && (
                  <p role="alert" className="rounded-lg bg-incorrect-soft px-3 py-2 text-sm text-incorrect-foreground">
                    {error}
                  </p>
                )}
                <Button type="submit" className="w-full" disabled={busy}>
                  {busy && <Loader2 className="animate-spin" aria-hidden="true" />}
                  Save new password
                </Button>
              </form>
            </CardContent>
          )}
          {stage === "done" && (
            <CardContent className="p-6 text-center">
              <CardTitle className="text-xl">Password updated</CardTitle>
              <CardDescription className="mt-2">
                Your new password is saved. You're signed in — off you go.
              </CardDescription>
              <Button className="mt-6" onClick={() => navigate({ to: "/practise" })}>
                Start practising
              </Button>
            </CardContent>
          )}
        </Card>
      </div>
    </div>
  );
}
