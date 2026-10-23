import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { safeRedirectPath } from "@/lib/redirect";

export const Route = createFileRoute("/auth_/callback")({
  ssr: false,
  validateSearch: (search: Record<string, unknown>): { next?: string } => ({
    next: typeof search["next"] === "string" ? search["next"] : undefined,
  }),
  component: AuthCallbackPage,
});

function AuthCallbackPage() {
  const navigate = useNavigate();
  const { search } = Route.useSearch();
  const [error, setError] = useState<string | null>(null);
  const navigating = useRef(false);

  useEffect(() => {
    const url = new URL(window.location.href);
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

    const destination = safeRedirectPath(search.next);
    const go = () => {
      if (navigating.current) return;
      navigating.current = true;
      void navigate({ to: destination });
    };

    // detectSessionInUrl exchanges the code automatically; wait for the user.
    let attempts = 0;
    const check = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        go();
      } else if (attempts < 10) {
        attempts += 1;
        window.setTimeout(check, 500);
      } else {
        setError(
          "Sign-in took too long. Please try signing in again from the sign-in page."
        );
      }
    };
    void check();
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
