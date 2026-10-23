import { Link, useNavigate } from "@tanstack/react-router";
import { LogOut, Settings, ShieldCheck } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/lib/auth-context";
import { stopSpeaking } from "@/lib/speech";

function initials(name: string | null | undefined, email: string | null | undefined) {
  const source = (name ?? email ?? "?").trim();
  const parts = source.split(/\s+/).filter(Boolean);
  const first = parts[0] ?? "?";
  if (parts.length <= 1) return first.slice(0, 2).toUpperCase();
  const last = parts[parts.length - 1] ?? "";
  return ((first[0] ?? "?") + (last[0] ?? "")).toUpperCase() || "?";
}

export function AppHeader() {
  const { user, profile, isAdmin, signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    stopSpeaking();
    await signOut();
    navigate({ to: "/auth", replace: true });
  };

  return (
    <header className="sticky top-0 z-20 border-b bg-background/90 backdrop-blur">
      <div className="mx-auto flex h-14 w-full max-w-3xl items-center justify-between px-4">
        <Link
          to="/practise"
          className="rounded-lg text-base font-bold tracking-tight text-primary focus-visible:outline focus-visible:outline-2"
        >
          Azure Quiz Coach
        </Link>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              aria-label="Account menu"
              className="gap-2"
            >
              <Avatar className="size-7">
                <AvatarFallback className="bg-secondary text-xs font-semibold text-secondary-foreground">
                  {initials(profile?.display_name, user?.email ?? null)}
                </AvatarFallback>
              </Avatar>
              <span className="max-w-28 truncate text-sm font-medium">
                {profile?.display_name ?? user?.email ?? "Account"}
              </span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="truncate">
              {user?.email}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link to="/settings" className="flex w-full items-center gap-2">
                <Settings className="size-4" aria-hidden="true" /> Settings
              </Link>
            </DropdownMenuItem>
            {isAdmin && (
              <DropdownMenuItem asChild>
                <Link
                  to="/admin/questions"
                  className="flex w-full items-center gap-2"
                >
                  <ShieldCheck className="size-4" aria-hidden="true" /> Manage
                  questions
                </Link>
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={(event) => {
                event.preventDefault();
                void handleSignOut();
              }}
              className="gap-2"
            >
              <LogOut className="size-4" aria-hidden="true" /> Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
