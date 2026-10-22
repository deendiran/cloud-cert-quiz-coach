import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import {
  Volume2,
  Square,
  Play,
  Type,
  Eye,
  Languages,
  Moon,
  Sparkles,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";
import { useAuth, db } from "@/lib/auth-context";
import { useSettings } from "@/lib/settings-context";
import {
  speechSupported,
  speakSequence,
  stopSpeaking,
} from "@/lib/speech";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

export const Route = createFileRoute("/_authenticated/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  const { user, profile, refreshProfile } = useAuth();
  const { settings, update, loading } = useSettings();

  const [isTestingSpeech, setIsTestingSpeech] = useState(false);
  const [langSaving, setLangSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  const hasSpeech = speechSupported();
  const currentLanguage = profile?.language ?? "en";

  const handleLanguageChange = async (newLang: "en" | "sw") => {
    if (!user || newLang === currentLanguage) return;
    setLangSaving(true);
    setSaveMessage(null);
    try {
      await db.from("profiles").update({ language: newLang }).eq("id", user.id);
      await refreshProfile();
      setSaveMessage(
        newLang === "sw"
          ? "Lugha imebadilishwa kuwa Kiswahili."
          : "Language changed to English."
      );
      setTimeout(() => setSaveMessage(null), 3000);
    } catch (err) {
      console.error("Failed to update language:", err);
    } finally {
      setLangSaving(false);
    }
  };

  const handleTestSpeech = () => {
    if (!hasSpeech) return;
    stopSpeaking();
    setIsTestingSpeech(true);

    const testText =
      currentLanguage === "sw"
        ? "Huu ni mfano wa sauti na kasi ya kusoma maswali ya Azure Quiz Coach."
        : "This is a preview of the Azure Quiz Coach speech reader and speed setting.";

    speakSequence([testText], {
      rate: settings.speech_rate || 1,
      lang: currentLanguage === "sw" ? "sw-KE" : "en-US",
      onEnd: () => setIsTestingSpeech(false),
      onError: () => setIsTestingSpeech(false),
    });
  };

  const handleStopSpeech = () => {
    stopSpeaking();
    setIsTestingSpeech(false);
  };

  return (
    <div className="mx-auto max-w-3xl space-y-8 py-6">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-foreground sm:text-3xl">
          Settings & Accessibility
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Customise display, fonts, language, and automated question speech to match how you study best.
        </p>
      </div>

      {saveMessage && (
        <div className="flex items-center gap-2 rounded-xl border border-correct/30 bg-correct-soft p-3 text-sm text-correct-foreground">
          <CheckCircle2 className="size-4 shrink-0" />
          <span>{saveMessage}</span>
        </div>
      )}

      {/* 1. Visual & Accessibility */}
      <Card className="rounded-2xl border bg-card shadow-sm">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Eye className="size-5 text-primary" />
            <CardTitle className="text-lg">Display & Typography</CardTitle>
          </div>
          <CardDescription>
            Tailor the app font, text scale, and contrast for maximum readability.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Large text */}
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <Label htmlFor="large-text-toggle" className="text-base font-medium">
                Large text (+25%)
              </Label>
              <p className="text-xs text-muted-foreground">
                Increases the root font size across all screens to reduce eye strain.
              </p>
            </div>
            <Switch
              id="large-text-toggle"
              checked={settings.large_text}
              disabled={loading}
              onCheckedChange={(val) => void update({ large_text: val })}
            />
          </div>

          {/* Dyslexia font */}
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <Label htmlFor="dyslexia-font-toggle" className="text-base font-medium">
                Dyslexia-friendly font
              </Label>
              <p className="text-xs text-muted-foreground">
                Switches the typeface to Verdana with wider letter, word, and line spacing for clearer letter distinction.
              </p>
            </div>
            <Switch
              id="dyslexia-font-toggle"
              checked={settings.dyslexia_font}
              disabled={loading}
              onCheckedChange={(val) => void update({ dyslexia_font: val })}
            />
          </div>

          {/* High contrast */}
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <Label htmlFor="high-contrast-toggle" className="text-base font-medium">
                High contrast
              </Label>
              <p className="text-xs text-muted-foreground">
                Sharpens card borders, button boundaries, and option outlines.
              </p>
            </div>
            <Switch
              id="high-contrast-toggle"
              checked={settings.high_contrast}
              disabled={loading}
              onCheckedChange={(val) => void update({ high_contrast: val })}
            />
          </div>

          {/* Dark Mode */}
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <Label htmlFor="dark-mode-toggle" className="text-base font-medium">
                Dark mode
              </Label>
              <p className="text-xs text-muted-foreground">
                Use a soft dark background for night study sessions.
              </p>
            </div>
            <Switch
              id="dark-mode-toggle"
              checked={settings.dark_mode}
              disabled={loading}
              onCheckedChange={(val) => void update({ dark_mode: val })}
            />
          </div>
        </CardContent>
      </Card>

      {/* 2. Speech & Audio */}
      <Card className="rounded-2xl border bg-card shadow-sm">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Volume2 className="size-5 text-primary" />
            <CardTitle className="text-lg">Speech & Read Aloud</CardTitle>
          </div>
          <CardDescription>
            Configure hands-free question reading powered by your browser's speech synthesiser.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {!hasSpeech && (
            <div className="flex items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive-foreground">
              <AlertCircle className="size-5 shrink-0 text-destructive" />
              <div>
                <p className="font-semibold">Speech synthesis not supported</p>
                <p className="text-xs text-muted-foreground">
                  Your current browser does not support SpeechSynthesis. Try Chrome, Edge, Safari, or Firefox on desktop or mobile.
                </p>
              </div>
            </div>
          )}

          {/* Read aloud toggle */}
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <Label htmlFor="read-aloud-toggle" className="text-base font-medium">
                Read aloud automatically
              </Label>
              <p className="text-xs text-muted-foreground">
                Speaks each question and its 4 options automatically as soon as it appears, then reads the answer and explanation after you submit.
              </p>
            </div>
            <Switch
              id="read-aloud-toggle"
              checked={settings.read_aloud}
              disabled={!hasSpeech || loading}
              onCheckedChange={(val) => void update({ read_aloud: val })}
            />
          </div>

          {/* Speech speed slider */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="speech-rate-slider" className="text-sm font-medium">
                Speech speed
              </Label>
              <span className="rounded-md bg-secondary px-2.5 py-0.5 text-xs font-semibold text-secondary-foreground">
                {settings.speech_rate.toFixed(1)}x
              </span>
            </div>
            <Slider
              id="speech-rate-slider"
              min={0.5}
              max={2.0}
              step={0.1}
              value={[settings.speech_rate]}
              disabled={!hasSpeech || loading}
              onValueChange={([val]) => {
                if (val !== undefined) void update({ speech_rate: val });
              }}
              className="py-1"
            />
            <div className="flex justify-between text-[11px] text-muted-foreground">
              <span>0.5x (Slower)</span>
              <span>1.0x (Normal)</span>
              <span>2.0x (Faster)</span>
            </div>
          </div>

          {/* Preview & Stop buttons */}
          <div className="flex flex-wrap items-center gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!hasSpeech}
              onClick={handleTestSpeech}
              className="gap-1.5"
            >
              <Play className="size-3.5" />
              <span>{isTestingSpeech ? "Replay speech sample" : "Test speech sample"}</span>
            </Button>

            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={!hasSpeech}
              onClick={handleStopSpeech}
              className="gap-1.5"
            >
              <Square className="size-3.5" />
              <span>Stop speaking</span>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 3. Study Language */}
      <Card className="rounded-2xl border bg-card shadow-sm">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Languages className="size-5 text-primary" />
            <CardTitle className="text-lg">Study Language</CardTitle>
          </div>
          <CardDescription>
            Choose your preferred language for study questions and AI explanations.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <RadioGroup
            value={currentLanguage}
            onValueChange={(val) => void handleLanguageChange(val as "en" | "sw")}
            disabled={langSaving}
            className="grid gap-3 sm:grid-cols-2"
          >
            <div
              className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition-colors ${
                currentLanguage === "en"
                  ? "border-primary bg-primary/5"
                  : "border-border hover:bg-muted/50"
              }`}
              onClick={() => void handleLanguageChange("en")}
            >
              <RadioGroupItem value="en" id="lang-en" className="mt-0.5" />
              <div className="space-y-1">
                <Label htmlFor="lang-en" className="cursor-pointer font-semibold">
                  English
                </Label>
                <p className="text-xs text-muted-foreground">
                  Default Azure terminology with concise English explanations.
                </p>
              </div>
            </div>

            <div
              className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition-colors ${
                currentLanguage === "sw"
                  ? "border-primary bg-primary/5"
                  : "border-border hover:bg-muted/50"
              }`}
              onClick={() => void handleLanguageChange("sw")}
            >
              <RadioGroupItem value="sw" id="lang-sw" className="mt-0.5" />
              <div className="space-y-1">
                <Label htmlFor="lang-sw" className="cursor-pointer font-semibold">
                  Kiswahili
                </Label>
                <p className="text-xs text-muted-foreground">
                  Maelezo na vidokezo vya maswali katika lugha ya Kiswahili.
                </p>
              </div>
            </div>
          </RadioGroup>
        </CardContent>
      </Card>
    </div>
  );
}
