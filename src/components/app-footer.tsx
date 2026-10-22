import { useRouterState } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";

export function AppFooter() {
  const { location } = useRouterState();
  const { user } = useAuth();

  // If user is on an authenticated page, the fixed bottom navigation bar (h-16) is shown.
  // We add extra bottom padding so footer text is never obscured by the bottom nav.
  const isAuthPage = Boolean(
    user && location.pathname !== "/" && !location.pathname.startsWith("/auth")
  );

  return (
    <footer
      className={`border-t border-border/40 bg-card/40 px-4 transition-all ${
        isAuthPage ? "pb-24 pt-6" : "py-6"
      }`}
    >
      <div className="mx-auto max-w-3xl space-y-1.5 text-center">
        <p className="text-xs leading-relaxed text-muted-foreground">
          Unofficial study aid. Not affiliated with or endorsed by Microsoft. Built-in questions are original.
        </p>
        <p className="text-xs font-medium text-muted-foreground/80">
          @2026 Azure Quiz Coach
        </p>
      </div>
    </footer>
  );
}
