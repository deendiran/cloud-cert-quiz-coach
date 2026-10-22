import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { safeRedirectPath } from "@/lib/redirect";

export const Route = createFileRoute("/auth_/callback")({
  ssr: false,
  validateSearch: (
    search: Record<string, unknown>
  ): { next?: string | undefined } => ({
    next: typeof search["next"] === "string" ? search["next"] : undefined,
  }),
  component: AuthCallbackPage,
});

function AuthCallbackPage() {
  const navigate = useNavigate();
  const search = Route.useSearch();
  const [error, setError] = useState<string | null>(null);
  const navigating = useRef(false);

  useEffect(() => {
    const destination = safeRedirectPath(search.next);
    const go = () => {
      if (navigating.current) return;
      navigating.current = true;
      void navigate({ to: destination });
    };

    const processAuth = async () => {
      try {
        const url = new URL(window.location.href);

        // 1. Check for error in query or hash
        const urlError =
          url.searchParams.get("error_description") ||
          url.searchParams.get("error") ||
          (url.hash.match(/error_description=([^&]+)/)?.[1] ?? null);

        if (urlError) {
          setError(
            decodeURIComponent(urlError.replace(/\+/g, " ")) ||
              "We couldn't complete the sign-in. Please try again."
          );
          return;
        }

        // 2. PKCE flow: if code is present in query parameters, exchange it explicitly
        const code = url.searchParams.get("code");
        if (code) {
          const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
          if (exchangeError) {
            console.error("Exchange code error:", exchangeError);
            setError(exchangeError.message || "Could not complete authorization code exchange.");
            return;
          }
          if (data.session || data.user) {
            go();
            return;
          }
        }

        // 3. Implicit flow: tokens in hash fragment (#access_token=...&refresh_token=...)
        if (url.hash && url.hash.includes("access_token")) {
          const hashParams = new URLSearchParams(url.hash.replace(/^#/, ""));
          const accessToken = hashParams.get("access_token");
          const refreshToken = hashParams.get("refresh_token") ?? "";
          if (accessToken) {
            const { data, error: setSessionError } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            });
            if (setSessionError) {
              console.error("Set session error:", setSessionError);
              setError(setSessionError.message || "Failed to establish session from tokens.");
              return;
            }
            if (data.session || data.user) {
              go();
              return;
            }
          }
        }

        // 4. Check existing session
        const { data: sessionData } = await supabase.auth.getSession();
        if (sessionData.session?.user) {
          go();
          return;
        }

        // 5. Polling fallback for background listeners/storage sync
        let attempts = 0;
        const interval = window.setInterval(async () => {
          attempts += 1;
          const { data: pollData } = await supabase.auth.getUser();
          if (pollData.user) {
            window.clearInterval(interval);
            go();
          } else if (attempts >= 10) {
            window.clearInterval(interval);
            setError("Sign-in took too long. Please try signing in again from the sign-in page.");
          }
        }, 500);
      } catch (err: any) {
        console.error("Auth callback exception:", err);
        setError(err?.message || "An unexpected error occurred during sign-in.");
      }
    };

    void processAuth();
  }, [navigate, search.next]);

  return (
    <div className="flex flex-1 items-center justify-center px-4 py-10">
      <Card className="w-full max-w-md rounded-2xl">
        <CardContent className="flex flex-col items-center gap-3 p-10 text-center">
          {error ? (
            <>
              <p className="text-base font-semibold text-foreground">
                Sign-in didn't complete
              </p>
              <p className="text-sm text-muted-foreground">{error}</p>
              <Button className="mt-2" asChild>
                <a href="/auth">Back to sign in</a>
              </Button>
            </>
          ) : (
            <>
              <Loader2 className="size-6 animate-spin text-primary" aria-hidden="true" />
              <p className="text-sm text-muted-foreground">Signing you in…</p>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
