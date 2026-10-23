import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Loader2, Trash2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { db, useAuth } from "@/lib/auth-context";
import { useSettings } from "@/lib/settings-context";
import { deleteMyAccount } from "@/lib/server/delete-account.functions";

export const Route = createFileRoute("/_authenticated/settings")({
  component: SettingsPage,
});

function ToggleRow({
  label,
  description,
  checked,
  onCheckedChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onCheckedChange: (value: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-3">
      <div>
        <p className="text-sm font-medium text-foreground">{label}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
      </div>
      <Switch
        checked={checked}
        onCheckedChange={onCheckedChange}
        aria-label={label}
      />
    </div>
  );
}

function SettingsPage() {
  const navigate = useNavigate();
  const { user, profile, refreshProfile } = useAuth();
  const { settings, update, loading } = useSettings();
  const [displayName, setDisplayName] = useState(profile?.display_name ?? "");
  const [savingName, setSavingName] = useState(false);
  const [nameSaved, setNameSaved] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const saveDisplayName = async () => {
    if (!user) return;
    setSavingName(true);
    setNameSaved(false);
    const trimmed = displayName.trim();
    try {
      if (trimmed) {
        await db.from("profiles").update({ display_name: trimmed }).eq("id", user.id);
        await refreshProfile();
      }
      setNameSaved(true);
    } finally {
      setSavingName(false);
    }
  };

  const deleteAccount = async () => {
    setDeleting(true);
    setDeleteError(null);
    const result = await deleteMyAccount();
    if (!result.ok) {
      setDeleting(false);
      setDeleteError(result.message);
      return;
    }
    await supabase.auth.signOut();
    navigate({ to: "/", replace: true });
  };

  return (
    <div className="space-y-6 py-8">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight text-foreground">Settings</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Make the app comfortable for you. Changes save automatically.
        </p>
      </div>

      <Card className="rounded-2xl">
        <CardHeader className="pb-1">
          <CardTitle className="text-lg">Reading & display</CardTitle>
        </CardHeader>
        <CardContent className="divide-y divide-border">
          <ToggleRow
            label="Large text"
            description="Makes all text about 25% bigger."
            checked={settings.large_text}
            onCheckedChange={(value) => void update({ large_text: value })}
          />
          <ToggleRow
            label="Dyslexia-friendly font"
            description="Switches to Verdana with wider letter and line spacing."
            checked={settings.dyslexia_font}
            onCheckedChange={(value) => void update({ dyslexia_font: value })}
          />
          <ToggleRow
            label="High contrast"
            description="Stronger borders and darker text for easier reading."
            checked={settings.high_contrast}
            onCheckedChange={(value) => void update({ high_contrast: value })}
          />
          <ToggleRow
            label="Dark mode"
            description="A calm dark-blue theme for evening study."
            checked={settings.dark_mode}
            onCheckedChange={(value) => void update({ dark_mode: value })}
          />
        </CardContent>
      </Card>

      <Card className="rounded-2xl">
        <CardHeader className="pb-1">
          <CardTitle className="text-lg">Read aloud</CardTitle>
        </CardHeader>
        <CardContent>
          <ToggleRow
            label="Read aloud automatically"
            description="Speaks each question with its options when it appears, then the answer after you respond."
            checked={settings.read_aloud}
            onCheckedChange={(value) => void update({ read_aloud: value })}
          />
          <div className="py-3">
            <div className="flex items-baseline justify-between">
              <Label htmlFor="speech-rate">Speech speed</Label>
              <span className="text-sm font-medium text-foreground" aria-live="polite">
                {settings.speech_rate.toFixed(1)}x
              </span>
            </div>
            <Slider
              id="speech-rate"
              className="mt-3"
              min={0.5}
              max={2}
              step={0.1}
              value={[settings.speech_rate]}
              onValueChange={([value]) => void update({ speech_rate: value })}
              aria-label="Speech speed"
            />
            <div className="mt-1 flex justify-between text-xs text-muted-foreground">
              <span>0.5x</span>
              <span>2x</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-2xl">
        <CardHeader className="pb-1">
          <CardTitle className="text-lg">Your profile</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="display-name">Display name</Label>
            <div className="flex gap-2">
              <Input
                id="display-name"
                value={displayName}
                onChange={(e) => {
                  setDisplayName(e.target.value);
                  setNameSaved(false);
                }}
                placeholder="Your name"
              />
              <Button variant="outline" onClick={saveDisplayName} disabled={savingName}>
                {savingName && <Loader2 className="animate-spin" aria-hidden="true" />}
                Save
              </Button>
            </div>
            {nameSaved && (
              <p aria-live="polite" className="text-xs text-muted-foreground">
                Name saved.
              </p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="language">Language</Label>
            <Select
              value={settings.language}
              onValueChange={(value) => void update({ language: value })}
            >
              <SelectTrigger id="language" className="w-56">
                <SelectValue placeholder="Choose language" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="en">English</SelectItem>
                <SelectItem value="sw">Kiswahili</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <p className="text-xs text-muted-foreground">
            Signed in as {user?.email}
          </p>
        </CardContent>
      </Card>

      <Card className="rounded-2xl">
        <CardHeader className="pb-1">
          <CardTitle className="text-lg">Danger zone</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Deleting your account permanently removes your profile, notes,
            questions and quiz history.
          </p>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" className="mt-3">
                <Trash2 aria-hidden="true" />
                Delete my account
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete your account?</AlertDialogTitle>
                <AlertDialogDescription>
                  This permanently removes your account and all your data. This
                  action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={deleting}>Keep my account</AlertDialogCancel>
                <AlertDialogAction
                  onClick={(event) => {
                    event.preventDefault();
                    void deleteAccount();
                  }}
                  disabled={deleting}
                >
                  {deleting && <Loader2 className="animate-spin" aria-hidden="true" />}
                  Yes, delete everything
                </AlertDialogAction>
              </AlertDialogFooter>
              {deleteError && (
                <p className="rounded-lg bg-incorrect-soft px-3 py-2 text-sm text-incorrect-foreground">
                  {deleteError}
                </p>
              )}
            </AlertDialogContent>
          </AlertDialog>
        </CardContent>
      </Card>
      {loading && <p className="sr-only">Loading settings…</p>}
    </div>
  );
}
