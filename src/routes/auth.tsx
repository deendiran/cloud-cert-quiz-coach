import { createFileRoute, Link, redirect, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Loader2, MailCheck } from "lucide-react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { safeRedirectPath } from "@/lib/redirect";

export const Route = createFileRoute("/auth")({
  ssr: false,
  validateSearch: (
    search: Record<string, unknown>
  ): { next?: string | undefined } => ({
    next: typeof search["next"] === "string" ? search["next"] : undefined,
  }),
  beforeLoad: async ({ search }) => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      throw redirect({ href: safeRedirectPath(search.next) });
    }
  },
  component: AuthPage,
});

function friendlyAuthError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("invalid login credentials"))
    return "That password doesn't match this email. Try again, or reset your password below.";
  if (m.includes("email not confirmed"))
    return "Please confirm your email first — check your inbox for the confirmation link.";
  if (m.includes("already registered") || m.includes("user already exists"))
    return "An account already exists with this email. Try signing in instead.";
  if (m.includes("weak_password") || m.includes("weak") || m.includes("easy to guess") || m.includes("pwned"))
    return "This password is known to be weak or compromised in data breaches. Please choose a stronger, unique password.";
  if (m.includes("at least") && m.includes("character"))
    return "Password must be at least 8 characters long.";
  if (m.includes("rate limit") || m.includes("too many requests"))
    return "Too many attempts just now. Please wait a minute and try again.";
  if (m.includes("failed to fetch") || m.includes("network"))
    return "We couldn't reach the server. Check your connection and try again.";
  if (message.trim().length > 0 && !m.includes("internal server") && !m.includes("database error"))
    return message;
  return "Something went wrong. Please try again.";
}

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface FieldErrors {
  displayName?: string;
  email?: string;
  password?: string;
}

function AuthPage() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const nextPath = safeRedirectPath(search.next);

  return (
    <div className="flex flex-1 items-center justify-center px-0 py-8">
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
          <Tabs defaultValue="signin">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="signin">Sign in</TabsTrigger>
              <TabsTrigger value="signup">Sign up</TabsTrigger>
            </TabsList>
            <TabsContent value="signin">
              <SignInForm
                nextPath={nextPath}
                onSignedIn={() => navigate({ to: nextPath })}
              />
            </TabsContent>
            <TabsContent value="signup">
              <SignUpForm nextPath={nextPath} />
            </TabsContent>
          </Tabs>
        </Card>
      </div>
    </div>
  );
}

async function triggerGoogleSignIn(nextPath: string): Promise<{ error?: string }> {
  try {
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.redirected) return {};
    if (!result.error) return {};
  } catch {
    // Fall through to native Supabase OAuth (e.g. on localhost)
  }

  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(nextPath)}`,
    },
  });

  if (error) {
    const errLow = error.message.toLowerCase();
    if (errLow.includes("missing oauth secret") || errLow.includes("unsupported provider")) {
      return {
        error:
          "Google sign-in is not yet configured in your Supabase project (missing Google Client ID/Secret in Supabase Auth -> Providers). Please sign in with email & password, or configure Google OAuth in Supabase.",
      };
    }
    return { error: friendlyAuthError(error.message) };
  }
  return {};
}

function SignInForm({
  nextPath,
  onSignedIn,
}: {
  nextPath: string;
  onSignedIn: () => void;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [needsConfirmation, setNeedsConfirmation] = useState(false);
  const [resendMessage, setResendMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setNeedsConfirmation(false);
    setResendMessage(null);
    setBusy(true);
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    setBusy(false);
    if (signInError) {
      const friendly = friendlyAuthError(signInError.message);
      setError(friendly);
      if (friendly.includes("confirm your email")) setNeedsConfirmation(true);
      return;
    }
    onSignedIn();
  };

  const resendConfirmation = async () => {
    setResendMessage(null);
    const { error: resendError } = await supabase.auth.resend({
      type: "signup",
      email: email.trim(),
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(nextPath)}`,
      },
    });
    setResendMessage(
      resendError
        ? "We couldn't resend the email just now. Please try again in a minute."
        : "Confirmation email sent. Check your inbox (and spam folder)."
    );
  };

  const handleGoogle = async () => {
    setError(null);
    const { error: gError } = await triggerGoogleSignIn(nextPath);
    if (gError) setError(gError);
  };

  return (
    <CardContent className="p-6 pt-4">
      <CardHeader className="p-0 pb-4">
        <CardTitle className="text-lg">Welcome back</CardTitle>
        <CardDescription>Sign in to continue practising.</CardDescription>
      </CardHeader>
      <form onSubmit={submit} className="space-y-4" noValidate>
        <div className="space-y-1.5">
          <Label htmlFor="signin-email">Email</Label>
          <Input
            id="signin-email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="signin-password">Password</Label>
          <Input
            id="signin-password"
            type="password"
            autoComplete="current-password"
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
        {needsConfirmation && (
          <Button type="button" variant="outline" size="sm" onClick={resendConfirmation}>
            Resend confirmation email
          </Button>
        )}
        {resendMessage && (
          <p className="text-sm text-muted-foreground" aria-live="polite">
            {resendMessage}
          </p>
        )}
        <Button type="submit" className="w-full" disabled={busy}>
          {busy && <Loader2 className="animate-spin" aria-hidden="true" />}
          Sign in
        </Button>
      </form>
      <div className="my-4 flex items-center gap-3 text-xs text-muted-foreground">
        <span className="h-px flex-1 bg-border" />
        or
        <span className="h-px flex-1 bg-border" />
      </div>
      <Button type="button" variant="outline" className="w-full" onClick={handleGoogle}>
        Continue with Google
      </Button>
      <p className="mt-4 text-center text-sm text-muted-foreground">
        <Link to="/auth/forgot" className="underline underline-offset-4 hover:text-foreground">
          Forgot your password?
        </Link>
      </p>
    </CardContent>
  );
}

function SignUpForm({ nextPath }: { nextPath: string }) {
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [error, setError] = useState<string | null>(null);
  const [signedUp, setSignedUp] = useState(false);
  const [busy, setBusy] = useState(false);
  const [resendMessage, setResendMessage] = useState<string | null>(null);

  const validate = (): boolean => {
    const errors: FieldErrors = {};
    if (!displayName.trim()) errors.displayName = "Please enter a display name.";
    if (!emailPattern.test(email.trim()))
      errors.email = "Please enter a valid email address.";
    if (password.length < 8)
      errors.password = "Password must be at least 8 characters.";
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setResendMessage(null);
    if (!validate()) return;
    setBusy(true);
    const { error: signUpError } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: { display_name: displayName.trim() },
        emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(nextPath)}`,
      },
    });
    setBusy(false);
    if (signUpError) {
      setError(friendlyAuthError(signUpError.message));
      return;
    }
    setSignedUp(true);
  };

  const resendConfirmation = async () => {
    setResendMessage(null);
    const { error: resendError } = await supabase.auth.resend({
      type: "signup",
      email: email.trim(),
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(nextPath)}`,
      },
    });
    setResendMessage(
      resendError
        ? "We couldn't resend the email just now. Please try again in a minute."
        : "Confirmation email sent. Check your inbox (and spam folder)."
    );
  };

  const handleGoogle = async () => {
    setError(null);
    const { error: gError } = await triggerGoogleSignIn(nextPath);
    if (gError) setError(gError);
  };

  if (signedUp) {
    return (
      <CardContent className="p-6 pt-4 text-center">
        <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-correct-soft">
          <MailCheck className="size-7 text-correct-foreground" aria-hidden="true" />
        </div>
        <CardTitle className="mt-4 text-xl">Check your email</CardTitle>
        <CardDescription className="mt-2">
          We sent a confirmation link to <strong>{email.trim()}</strong>. Click it
          to activate your account, then sign in.
        </CardDescription>
        <div className="mt-6 space-y-3">
          <Button variant="outline" className="w-full" onClick={resendConfirmation}>
            Resend confirmation email
          </Button>
          {resendMessage && (
            <p className="text-sm text-muted-foreground" aria-live="polite">
              {resendMessage}
            </p>
          )}
        </div>
        <Button variant="ghost" className="mt-4" onClick={() => setSignedUp(false)}>
          Back to sign in
        </Button>
      </CardContent>
    );
  }

  return (
    <CardContent className="p-6 pt-4">
      <CardHeader className="p-0 pb-4">
        <CardTitle className="text-lg">Create your account</CardTitle>
        <CardDescription>
          Free to use. You'll confirm your email to finish signing up.
        </CardDescription>
      </CardHeader>
      <form onSubmit={submit} className="space-y-4" noValidate>
        <div className="space-y-1.5">
          <Label htmlFor="signup-name">Display name</Label>
          <Input
            id="signup-name"
            autoComplete="name"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="How should we greet you?"
          />
          {fieldErrors.displayName && (
            <p className="text-sm text-incorrect-foreground">{fieldErrors.displayName}</p>
          )}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="signup-email">Email</Label>
          <Input
            id="signup-email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
          />
          {fieldErrors.email && (
            <p className="text-sm text-incorrect-foreground">{fieldErrors.email}</p>
          )}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="signup-password">Password</Label>
          <Input
            id="signup-password"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {fieldErrors.password ? (
            <p className="text-sm text-incorrect-foreground">{fieldErrors.password}</p>
          ) : (
            <p className="text-xs text-muted-foreground">At least 8 characters.</p>
          )}
        </div>
        {error && (
          <p role="alert" className="rounded-lg bg-incorrect-soft px-3 py-2 text-sm text-incorrect-foreground">
            {error}
          </p>
        )}
        <Button type="submit" className="w-full" disabled={busy}>
          {busy && <Loader2 className="animate-spin" aria-hidden="true" />}
          Create account
        </Button>
      </form>
      <div className="my-4 flex items-center gap-3 text-xs text-muted-foreground">
        <span className="h-px flex-1 bg-border" />
        or
        <span className="h-px flex-1 bg-border" />
      </div>
      <Button type="button" variant="outline" className="w-full" onClick={handleGoogle}>
        Continue with Google
      </Button>
    </CardContent>
  );
}
