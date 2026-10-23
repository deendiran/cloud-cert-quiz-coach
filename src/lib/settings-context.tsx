import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { db, useAuth } from "@/lib/auth-context";

export interface AppSettings {
  large_text: boolean;
  dyslexia_font: boolean;
  high_contrast: boolean;
  read_aloud: boolean;
  speech_rate: number;
  dark_mode: boolean;
  language: string;
}

export const DEFAULT_SETTINGS: AppSettings = {
  large_text: false,
  dyslexia_font: false,
  high_contrast: false,
  read_aloud: false,
  speech_rate: 1,
  dark_mode: false,
  language: "en",
};

/** Speech synthesis language tag for a stored language code. */
export function langTag(language: string): string {
  return language === "sw" ? "sw-KE" : "en-US";
}

function applySettings(settings: AppSettings) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.classList.toggle("a11y-large", settings.large_text);
  root.classList.toggle("a11y-dyslexia", settings.dyslexia_font);
  root.classList.toggle("a11y-contrast", settings.high_contrast);
  root.classList.toggle("dark", settings.dark_mode);
}

interface SettingsContextValue {
  settings: AppSettings;
  loading: boolean;
  update: (patch: Partial<AppSettings>) => Promise<void>;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    if (!user) {
      setSettings(DEFAULT_SETTINGS);
      applySettings(DEFAULT_SETTINGS);
      setLoading(false);
      return;
    }
    setLoading(true);
    void (async () => {
      try {
        const [{ data: stored }, { data: profile }] = await Promise.all([
          db
            .from("user_settings")
            .select("large_text, dyslexia_font, high_contrast, read_aloud, speech_rate, dark_mode")
            .eq("user_id", user.id)
            .maybeSingle(),
          db.from("profiles").select("language").eq("id", user.id).maybeSingle(),
        ]);
        const loaded: AppSettings = {
          ...DEFAULT_SETTINGS,
          ...(stored ?? {}),
          language: profile?.language ?? DEFAULT_SETTINGS.language,
        };
        if (!cancelled) {
          setSettings(loaded);
          applySettings(loaded);
        }
      } catch {
        // keep defaults; the settings page still works and saves over them
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  const update = useCallback(
    async (patch: Partial<AppSettings>) => {
      const next = { ...settings, ...patch };
      setSettings(next);
      applySettings(next);
      if (!user) return;
      const { language, ...columns } = next;
      try {
        await db.from("user_settings").upsert(
          { user_id: user.id, ...columns },
          { onConflict: "user_id" }
        );
        if (patch.language) {
          await db.from("profiles").update({ language }).eq("id", user.id);
        }
      } catch {
        // optimistic UI already applied; a reload re-reads stored values
      }
    },
    [settings, user]
  );

  const value = useMemo(
    () => ({ settings, loading, update }),
    [settings, loading, update]
  );

  return (
    <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>
  );
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error("useSettings must be used inside SettingsProvider");
  return ctx;
}
