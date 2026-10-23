import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const DAILY_CALL_LIMIT = 20;
const GEMINI_MODEL = "gemini-2.5-flash";

const SYSTEM_PROMPT = `You write practice questions from a learner's personal study notes for a cloud-fundamentals exam.

Strict rules:
- Base every question only on facts stated in the notes. Never add outside facts, product names, or numbers that the notes do not contain. If the notes are too thin for a question, make fewer questions rather than inventing content.
- Do NOT write superficial fill-in-the-blank or trivial sentence-completion questions. Instead, formulate conceptual questions or realistic scenarios testing trade-offs, decisions, or core principles that require the learner to think and internalize the material.
- Each question has a clear stem, 3-4 answer options with ids "a", "b", "c", "d", and exactly one correct option.
- Distractors must be plausible and thoughtful, testing common misconceptions while remaining unambiguously wrong to someone who understands the notes.
- explanation: 2-3 clear, educational sentences that explain the core principle, why the correct answer is right according to the notes, and why the main distractor is incorrect.
- memory_hook: one short, vivid mnemonic or metaphor (about 12 words or fewer) whenever the concept allows.
- hint: a thoughtful nudge that guides the learner's reasoning without revealing the answer.
- Plain, encouraging, learner-friendly language. Return JSON only.`;

interface ValidQuestion {
  stem: string;
  options: { id: string; text: string }[];
  correct_id: string;
  explanation: string;
  memory_hook: string | null;
  hint: string | null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function validateQuestion(raw: any): ValidQuestion | null {
  if (!raw || typeof raw !== "object") return null;
  const stem = typeof raw.stem === "string" ? raw.stem.trim() : "";
  if (stem.length < 8 || stem.length > 500) return null;

  const options = Array.isArray(raw.options) ? raw.options : null;
  if (!options || options.length < 3 || options.length > 4) return null;
  const seenIds = new Set<string>();
  const seenTexts = new Set<string>();
  const cleanOptions: { id: string; text: string }[] = [];
  for (const option of options) {
    const id = typeof option?.id === "string" ? option.id.toLowerCase().trim() : "";
    const text = typeof option?.text === "string" ? option.text.trim() : "";
    if (
      !/^[a-d]$/.test(id) ||
      text.length === 0 ||
      text.length > 200 ||
      seenIds.has(id) ||
      seenTexts.has(text.toLowerCase())
    )
      return null;
    seenIds.add(id);
    seenTexts.add(text.toLowerCase());
    cleanOptions.push({ id, text });
  }

  const correct = typeof raw.correct_id === "string" ? raw.correct_id.toLowerCase().trim() : "";
  if (!seenIds.has(correct)) return null;

  const explanation = typeof raw.explanation === "string" ? raw.explanation.trim() : "";
  if (explanation.length < 10 || explanation.length > 1200) return null;

  const memoryHook =
    typeof raw.memory_hook === "string" && raw.memory_hook.trim()
      ? raw.memory_hook.trim().slice(0, 160)
      : null;
  const hint =
    typeof raw.hint === "string" && raw.hint.trim() ? raw.hint.trim().slice(0, 200) : null;

  return {
    stem,
    options: cleanOptions,
    correct_id: correct,
    explanation,
    memory_hook: memoryHook,
    hint,
  };
}

export const generateQuestionsForNote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => {
    const parsed = (input ?? {}) as { note_id?: unknown; count?: unknown };
    if (typeof parsed.note_id !== "string" || parsed.note_id.length === 0) {
      throw new Error("note_id is required");
    }
    const count =
      typeof parsed.count === "number" && Number.isFinite(parsed.count)
        ? Math.min(Math.max(Math.round(parsed.count), 1), 12)
        : 5;
    return { note_id: parsed.note_id, count };
  })
  .handler(async ({ data, context }) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { supabase, userId } = context as { supabase: any; userId: string };

    // The note must belong to the caller (RLS also enforces this).
    const { data: note } = await supabase
      .from("notes")
      .select("id, title, body")
      .eq("id", data.note_id)
      .maybeSingle();
    if (!note) {
      return { ok: false as const, status: 404 as const, reason: "not_found" as const };
    }

    // Daily usage limit, tracked server-side (ai_usage is read-only to users).
    let usage: { calls: number } | null = null;
    let hasAdmin = false;
    const today = new Date().toISOString().slice(0, 10);

    if (process.env["SUPABASE_SERVICE_ROLE_KEY"]) {
      try {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data } = await supabaseAdmin
          .from("ai_usage")
          .select("calls")
          .eq("user_id", userId)
          .eq("day", today)
          .maybeSingle();
        usage = data;
        hasAdmin = true;
        if ((usage?.calls ?? 0) >= DAILY_CALL_LIMIT) {
          return { ok: false as const, status: 429 as const, reason: "daily_limit" as const };
        }
      } catch (adminErr) {
        console.warn("Could not check ai_usage via supabaseAdmin:", adminErr);
      }
    }

    const apiKey = process.env["GOOGLE_API_KEY"] || process.env["GEMINI_API_KEY"];
    if (!apiKey) {
      return { ok: false as const, status: 502 as const, reason: "missing_key" as const };
    }

    // Note contents are sent to the model for processing but never logged.
    const userPrompt = `Notes:\n"""\n${note.body}\n"""\n\nCreate ${data.count} multiple-choice question(s) from these notes. Respond with JSON of shape {"questions":[{"stem":string,"options":[{"id":"a","text":string}],"correct_id":"a","explanation":string,"memory_hook":string,"hint":string}]}.`;

    let response: Response;
    try {
      response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": apiKey,
          },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
            contents: [{ role: "user", parts: [{ text: userPrompt }] }],
            generationConfig: {
              temperature: 0.3,
              responseMimeType: "application/json",
              maxOutputTokens: 4096,
            },
          }),
        }
      );
    } catch {
      return { ok: false as const, status: 502 as const, reason: "network" as const };
    }

    if (!response.ok) {
      return {
        ok: false as const,
        status: (response.status === 429 ? 429 : 502) as 429 | 502,
        reason: "ai_error" as const,
      };
    }

    const payload = (await response.json().catch(() => null)) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    } | null;
    const text =
      payload?.candidates?.[0]?.content?.parts
        ?.map((part) => part.text ?? "")
        .join("") ?? "";
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let parsed: any;
    try {
      parsed = JSON.parse(text);
    } catch {
      return { ok: false as const, status: 502 as const, reason: "bad_ai_output" as const };
    }
    const rawList = Array.isArray(parsed) ? parsed : parsed?.questions;
    if (!Array.isArray(rawList)) {
      return { ok: false as const, status: 502 as const, reason: "bad_ai_output" as const };
    }
    const valid = rawList
      .map(validateQuestion)
      .filter((q): q is ValidQuestion => q !== null)
      .slice(0, data.count);
    if (valid.length === 0) {
      return { ok: false as const, status: 502 as const, reason: "no_valid_questions" as const };
    }

    const rows = valid.map((question) => ({
      owner_id: userId,
      note_id: note.id,
      topic_label: `My notes: ${note.title}`,
      difficulty: 2,
      type: "mcq",
      stem: question.stem,
      options: question.options,
      correct_ids: [question.correct_id],
      explanation: question.explanation,
      memory_hook: question.memory_hook,
      hint: question.hint,
      source: "ai_generated",
      is_published: false,
    }));

    const { data: inserted, error: insertError } = await supabase
      .from("questions")
      .insert(rows)
      .select();
    if (insertError || !inserted) {
      return { ok: false as const, status: 502 as const, reason: "insert_failed" as const };
    }

    // Record the call if admin client is available.
    if (hasAdmin) {
      try {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        if (usage) {
          await supabaseAdmin
            .from("ai_usage")
            .update({ calls: (usage.calls ?? 0) + 1 })
            .eq("user_id", userId)
            .eq("day", today);
        } else {
          await supabaseAdmin
            .from("ai_usage")
            .insert({ user_id: userId, day: today, calls: 1 });
        }
      } catch (adminErr) {
        console.warn("Could not record ai_usage:", adminErr);
      }
    }

    return { ok: true as const, questions: inserted };
  });
