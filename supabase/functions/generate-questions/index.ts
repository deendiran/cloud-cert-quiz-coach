import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DAILY_LIMIT = 20;

// -----------------------------------------------------------------------
// System prompt (notes-only — never adds outside facts)
// -----------------------------------------------------------------------
const SYSTEM_PROMPT = `You write practice questions for an UNOFFICIAL study aid. You are given a learner's own notes. Use ONLY facts stated in those notes.

RULES
1. Never add facts, numbers, product details or names that are not in the notes. If the notes are too thin for the requested count, return fewer questions.
2. Each question tests one idea and has exactly one best answer.
3. Write 4 options. Wrong options must be plausible misunderstandings of the same material, not silly and not copied from unrelated notes text.
4. No 'all of the above' or 'none of the above'. Keep options similar in length.
5. Do not reproduce or imitate real certification exam questions.
6. Explanation: state the correct idea in one sentence, then say why the most tempting wrong option is wrong. Add a short memory hook (an analogy or rule).
7. Match the language requested (en or sw). Be encouraging and neutral in tone.

INPUT: { "notes": string, "count": number, "language": "en" | "sw" }

OUTPUT: ONLY valid JSON, no markdown, no commentary:
{ "questions": [ {
  "stem": string,
  "options": [ { "id": "a", "text": string }, { "id": "b", "text": string }, { "id": "c", "text": string }, { "id": "d", "text": string } ],
  "correct_ids": [string],
  "explanation": string,
  "memory_hook": string,
  "hint": string,
  "difficulty": 1 | 2 | 3
} ] }

If you cannot comply: { "questions": [], "error": "<short reason>" }`;

// -----------------------------------------------------------------------
// Validation helpers
// -----------------------------------------------------------------------
function validateQuestion(q: unknown): boolean {
  if (!q || typeof q !== "object") return false;
  const item = q as Record<string, unknown>;
  if (typeof item.stem !== "string" || item.stem.trim() === "") return false;
  if (!Array.isArray(item.options) || item.options.length < 3 || item.options.length > 4) return false;
  if (!Array.isArray(item.correct_ids) || item.correct_ids.length !== 1) return false;
  if (typeof item.explanation !== "string" || item.explanation.trim() === "") return false;
  // Options must be distinct
  const texts = (item.options as Array<{ text?: unknown }>).map((o) => String(o.text ?? "").toLowerCase());
  if (new Set(texts).size !== texts.length) return false;
  // correct_ids must reference a real option
  const optIds = (item.options as Array<{ id?: unknown }>).map((o) => String(o.id ?? ""));
  const correctId = String(item.correct_ids[0]);
  if (!optIds.includes(correctId)) return false;
  return true;
}

function stripCodeFences(raw: string): string {
  return raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "").trim();
}

// -----------------------------------------------------------------------
// Main handler
// -----------------------------------------------------------------------
serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // 1. Parse JWT — Supabase injects SUPABASE_URL and SUPABASE_ANON_KEY automatically
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");

  if (!anthropicKey) {
    return new Response(JSON.stringify({ error: "AI service not configured" }), {
      status: 502,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Client scoped to the calling user (respects RLS)
  const userClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  // Service client for ai_usage writes and question inserts
  const serviceClient = createClient(supabaseUrl, supabaseServiceKey);

  // 2. Verify caller
  const { data: { user }, error: authError } = await userClient.auth.getUser();
  if (authError || !user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // 3. Parse request body
  let body: { note_id?: string; count?: number };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid request body" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { note_id, count } = body;
  if (!note_id || typeof note_id !== "string") {
    return new Response(JSON.stringify({ error: "note_id is required" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const questionCount = Number(count) || 5;
  if (![3, 5, 8].includes(questionCount)) {
    return new Response(JSON.stringify({ error: "count must be 3, 5 or 8" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // 4. Load note (confirms ownership via RLS)
  const { data: note, error: noteError } = await userClient
    .from("notes")
    .select("id, title, body, user_id")
    .eq("id", note_id)
    .maybeSingle();

  if (noteError || !note) {
    return new Response(JSON.stringify({ error: "Note not found" }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  if (note.user_id !== user.id) {
    return new Response(JSON.stringify({ error: "Forbidden" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // 5. Rate limit check (service role reads/writes ai_usage)
  const today = new Date().toISOString().slice(0, 10);
  const { data: usage } = await serviceClient
    .from("ai_usage")
    .select("calls")
    .eq("user_id", user.id)
    .eq("day", today)
    .maybeSingle();

  const currentCalls = usage?.calls ?? 0;
  if (currentCalls >= DAILY_LIMIT) {
    return new Response(JSON.stringify({ error: "Daily limit reached. Try again tomorrow." }), {
      status: 429,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // 6. Load user language preference
  const { data: profile } = await userClient
    .from("profiles")
    .select("language")
    .eq("id", user.id)
    .maybeSingle();
  const language = profile?.language ?? "en";

  // 7. Call Claude
  const claudePayload = {
    model: "claude-3-5-haiku-20241022",
    max_tokens: 4096,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: JSON.stringify({ notes: note.body, count: questionCount, language }),
      },
    ],
  };

  let claudeText: string;
  try {
    const claudeResponse = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": anthropicKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify(claudePayload),
    });

    if (!claudeResponse.ok) {
      const errText = await claudeResponse.text();
      console.error("Claude API error:", claudeResponse.status, errText);
      return new Response(JSON.stringify({ error: "AI service unavailable" }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const claudeData = await claudeResponse.json();
    claudeText = claudeData.content?.[0]?.text ?? "";
  } catch (err) {
    console.error("Claude fetch error:", err);
    return new Response(JSON.stringify({ error: "AI service unavailable" }), {
      status: 502,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // 8. Parse and validate Claude output
  let parsed: { questions: unknown[]; error?: string };
  try {
    const clean = stripCodeFences(claudeText);
    parsed = JSON.parse(clean);
  } catch {
    console.error("Failed to parse Claude JSON:", claudeText.slice(0, 500));
    return new Response(JSON.stringify({ error: "AI returned invalid output" }), {
      status: 502,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const validQuestions = (parsed.questions ?? []).filter(validateQuestion);
  if (validQuestions.length === 0) {
    return new Response(JSON.stringify({ error: "AI returned no valid questions" }), {
      status: 502,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // 9. Insert valid questions
  const topicLabel = `My notes: ${note.title}`;
  const rows = validQuestions.map((q) => {
    const item = q as Record<string, unknown>;
    return {
      owner_id: user.id,
      note_id: note.id,
      topic_label: topicLabel,
      stem: item.stem,
      options: item.options,
      correct_ids: item.correct_ids,
      explanation: item.explanation,
      memory_hook: item.memory_hook ?? null,
      hint: item.hint ?? null,
      difficulty: item.difficulty ?? 2,
      source: "ai_generated",
      is_published: false,
    };
  });

  const { data: inserted, error: insertError } = await serviceClient
    .from("questions")
    .insert(rows)
    .select();

  if (insertError) {
    console.error("Insert error:", insertError);
    return new Response(JSON.stringify({ error: "Failed to save questions" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // 10. Update ai_usage
  await serviceClient.from("ai_usage").upsert(
    { user_id: user.id, day: today, calls: currentCalls + 1 },
    { onConflict: "user_id,day" }
  );

  return new Response(JSON.stringify({ questions: inserted }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
