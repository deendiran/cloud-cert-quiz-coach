/**
 * Settings context — reads user_settings from Supabase, applies CSS classes
 * to <html>, and provides a typed update function.
 *
 * Wrap the app (already done in __root.tsx via AuthProvider chain) with
 * <SettingsProvider>. useSettings() gives components access to current values
 * and the updater.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { db } from "@/lib/auth-context";
import { useAuth } from "@/lib/auth-context";

export interface UserSettings {
  large_text: boolean;
  dyslexia_font: boolean;
  high_contrast: boolean;
  read_aloud: boolean;
  speech_rate: number;
  dark_mode: boolean;
}

const DEFAULT_SETTINGS: UserSettings = {
  large_text: false,
  dyslexia_font: false,
  high_contrast: false,
  read_aloud: false,
  speech_rate: 1,
  dark_mode: false,
};

interface SettingsContextValue {
  settings: UserSettings;
  loading: boolean;
  update: (patch: Partial<UserSettings>) => Promise<void>;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

/** Apply/remove a11y CSS classes on <html> without touching other classes. */
function applyToHtml(settings: UserSettings) {
  const html = document.documentElement;
  html.classList.toggle("a11y-large", settings.large_text);
  html.classList.toggle("a11y-dyslexia", settings.dyslexia_font);
  html.classList.toggle("a11y-contrast", settings.high_contrast);
  html.classList.toggle("dark", settings.dark_mode);
}

export function SettingsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);

  // Load from Supabase whenever user changes
  useEffect(() => {
    if (!user) {
      setSettings(DEFAULT_SETTINGS);
      applyToHtml(DEFAULT_SETTINGS);
      setLoading(false);
      return;
    }
    setLoading(true);
    void (async () => {
      try {
        const { data } = await db
          .from("user_settings")
          .select("*")
          .eq("user_id", user.id)
          .maybeSingle();

        const s: UserSettings = {
          large_text: data?.large_text ?? false,
          dyslexia_font: data?.dyslexia_font ?? false,
          high_contrast: data?.high_contrast ?? false,
          read_aloud: data?.read_aloud ?? false,
          speech_rate: data?.speech_rate ?? 1,
          dark_mode: data?.dark_mode ?? false,
        };
        setSettings(s);
        applyToHtml(s);
      } finally {
        setLoading(false);
      }
    })();
  }, [user]);

  const update = useCallback(
    async (patch: Partial<UserSettings>) => {
      if (!user) return;
      const next = { ...settings, ...patch };
      setSettings(next);
      applyToHtml(next);
      await db.from("user_settings").upsert(
        { user_id: user.id, ...next, updated_at: new Date().toISOString() },
        { onConflict: "user_id" }
      );
    },
    [settings, user]
  );

  const value = useMemo(() => ({ settings, loading, update }), [settings, loading, update]);

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error("useSettings must be used inside SettingsProvider");
  return ctx;
}
