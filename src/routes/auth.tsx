import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { safeRedirectPath } from "@/lib/redirect";

export const Route = createFileRoute("/auth")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Sign in — Azure Quiz Coach" },
      { name: "description", content: "Sign in with Google to start practising." },
    ],
  }),
  validateSearch: (search: Record<string, unknown>): { next?: string } => {
    const raw = search["next"];
    return typeof raw === "string" && raw.length > 0 ? { next: raw } : {};
  },
  beforeLoad: async ({ search }) => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) throw redirect({ href: safeRedirectPath(search.next) });
  },
  component: AuthPage,
});

function AuthPage() {
  const search = Route.useSearch();
  const nextPath = safeRedirectPath(search.next);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGoogle = async () => {
    setError(null);
    setBusy(true);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: `${window.location.origin}/auth/callback?next=${encodeURIComponent(nextPath)}`,
    });
    if (result.error) {
      setBusy(false);
      setError("Google sign-in couldn't start. Please try again.");
      return;
    }
    if (result.redirected) return;
    // Session set in place (preview popup flow): go straight to the destination.
    window.location.assign(nextPath);
  };

  return (
    <div className="flex flex-1 items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-extrabold tracking-tight text-foreground">
            Azure Quiz Coach
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Unofficial study aid. Not affiliated with or endorsed by Microsoft.
          </p>
        </div>
        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle className="text-lg">Sign in to practise</CardTitle>
            <CardDescription>
              Use your Google account. New here? Signing in creates your account.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button size="lg" className="w-full" onClick={handleGoogle} disabled={busy}>
              {busy && <Loader2 className="animate-spin" aria-hidden="true" />}
              Continue with Google
            </Button>
            {error && (
              <p role="alert" className="rounded-lg bg-incorrect-soft px-3 py-2 text-sm text-incorrect-foreground">
                {error}
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
