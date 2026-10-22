import { Link, useRouterState } from "@tanstack/react-router";
import { BookOpenCheck, NotebookPen, Radar, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { to: "/practise", label: "Practise", icon: BookOpenCheck },
  { to: "/notes", label: "Notes", icon: NotebookPen },
  { to: "/readiness", label: "Readiness", icon: Radar },
  { to: "/settings", label: "Settings", icon: Settings },
] as const;

export function BottomNav() {
  const { location } = useRouterState();
  const pathname = location.pathname;

  return (
    <nav
      aria-label="Main navigation"
      className="fixed bottom-0 left-0 right-0 z-30 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80"
    >
      <div className="mx-auto flex h-16 max-w-3xl items-stretch px-2">
        {navItems.map(({ to, label, icon: Icon }) => {
          const active =
            pathname === to ||
            (to === "/practise" && (pathname.startsWith("/quiz") || pathname.startsWith("/results")));
          return (
            <Link
              key={to}
              to={to}
              aria-label={label}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex flex-1 flex-col items-center justify-center gap-1 rounded-xl text-xs font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring",
                active
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon
                className={cn("size-5", active && "text-primary")}
                aria-hidden="true"
              />
              <span>{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
