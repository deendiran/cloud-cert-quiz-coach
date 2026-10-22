/**
 * AI Question Generator for Azure Quiz Coach.
 *
 * Supports:
 * 1. Direct Google Gemini API (Free tier: 15 req/min, 1M tokens/day with no credit card required)
 * 2. Supabase Edge Function (if deployed and configured)
 * 3. Smart local generator (offline backup)
 */

import { supabase } from "@/integrations/supabase/client";
import { generateFallbackQuestions, type FallbackQuestion } from "@/lib/fallback-generator";

export interface GeneratedQuestion {
  stem: string;
  options: { id: string; text: string }[];
  correct_ids: string[];
  explanation: string;
  memory_hook: string | null;
  hint: string | null;
  difficulty: 1 | 2 | 3;
  source: "ai_generated" | "local_generated";
}

const GEMINI_STORAGE_KEY = "quiz_coach_gemini_api_key";

export function getStoredGeminiKey(): string | null {
  if (typeof window === "undefined") return null;
  const local = localStorage.getItem(GEMINI_STORAGE_KEY);
  if (local && local.trim()) return local.trim();
  const envKey = (import.meta as unknown as { env?: Record<string, string> }).env?.["VITE_GEMINI_API_KEY"];
  if (envKey && envKey.trim()) return envKey.trim();
  return null;
}

export function setStoredGeminiKey(key: string | null) {
  if (typeof window === "undefined") return;
  if (!key || !key.trim()) {
    localStorage.removeItem(GEMINI_STORAGE_KEY);
  } else {
    localStorage.setItem(GEMINI_STORAGE_KEY, key.trim());
  }
}

const AI_COACH_PROMPT = `You are a Principal Cloud Architect and master certification exam author for Azure.
Your task is to transform a learner's raw study notes into deep, thought-provoking scenario-based practice questions.

GOAL: Make the learner THINK, evaluate architectural trade-offs, and internalize what could the answer be.
NEVER write trivial fill-in-the-blank questions or simple vocabulary matching.

QUESTION GUIDELINES:
1. Scenario-Driven: Frame stems around practical problem solving (e.g., "A company wants to...", "An architect is reviewing a system where...", "To ensure high resilience while keeping costs predictable, which approach...").
2. Deep & Plausible Distractors: All 4 options must look credible. Wrong options must reflect real misunderstandings or tools that exist in the notes but do not solve this specific requirement.
3. In-Depth Teaching Explanation:
   - Paragraph 1: Why the correct answer is the right choice and how it solves the requirement.
   - Paragraph 2: Exactly why the most tempting wrong option fails or is unsuitable.
   - Memory tip: A concise rule of thumb, architectural pattern, or memory hook.
4. Output Language: Match requested language ("en" or "sw" for Kiswahili).
5. Output Format: Return strictly JSON with no markdown wrapping.

SCHEMA:
{
  "questions": [
    {
      "stem": "string",
      "options": [
        { "id": "a", "text": "string" },
        { "id": "b", "text": "string" },
        { "id": "c", "text": "string" },
        { "id": "d", "text": "string" }
      ],
      "correct_ids": ["a"],
      "explanation": "string",
      "memory_hook": "string",
      "hint": "string",
      "difficulty": 1 | 2 | 3
    }
  ]
}`;

function cleanJsonText(raw: string): string {
  return raw
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/, "")
    .trim();
}

/**
 * Calls Google Gemini API directly using the user's free API key.
 */
async function callGeminiDirect(
  apiKey: string,
  notes: string,
  count: number,
  language: string
): Promise<GeneratedQuestion[]> {
  const models = ["gemini-2.5-flash", "gemini-1.5-flash"];

  const payload = {
    contents: [
      {
        parts: [
          {
            text: `${AI_COACH_PROMPT}\n\nSTUDY NOTES:\n${notes}\n\nREQUEST:\nGenerate ${count} scenario questions in language: ${language}.`,
          },
        ],
      },
    ],
    generationConfig: {
      temperature: 0.3,
      responseMimeType: "application/json",
    },
  };

  let lastError: Error | null = null;

  for (const model of models) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Gemini API (${model}) failed [${response.status}]: ${errText}`);
      }

      const resData = await response.json();
      const rawText = resData.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!rawText) throw new Error("Gemini returned empty text");

      const parsed = JSON.parse(cleanJsonText(rawText));
      if (!parsed.questions || !Array.isArray(parsed.questions)) {
        throw new Error("Invalid response format from Gemini");
      }

      return parsed.questions.map((q: any) => ({
        stem: q.stem,
        options: q.options,
        correct_ids: q.correct_ids,
        explanation: q.explanation,
        memory_hook: q.memory_hook || null,
        hint: q.hint || null,
        difficulty: (q.difficulty >= 1 && q.difficulty <= 3 ? q.difficulty : 2) as 1 | 2 | 3,
        source: "ai_generated" as const,
      }));
    } catch (e: any) {
      lastError = e;
      console.warn(`Failed with ${model}, trying fallback model...`, e);
    }
  }

  throw lastError || new Error("Failed to generate questions with Gemini");
}

/**
 * Main generator entry point with intelligent fallback.
 */
export async function generateQuestionsFromNotes(params: {
  noteId: string;
  notesBody: string;
  noteTitle: string;
  count?: 3 | 5 | 8;
  language?: string;
}): Promise<{ questions: GeneratedQuestion[]; usedProvider: "gemini" | "edge_function" | "local_generator" }> {
  const { noteId, notesBody, noteTitle, count = 5, language = "en" } = params;

  // 1. Check for Gemini API key
  const geminiKey = getStoredGeminiKey();
  if (geminiKey) {
    try {
      const questions = await callGeminiDirect(geminiKey, notesBody, count, language);
      if (questions.length > 0) {
        return { questions, usedProvider: "gemini" };
      }
    } catch (err) {
      console.warn("Gemini direct call failed, attempting backend function...", err);
    }
  }

  // 2. Try Supabase Edge Function
  try {
    const { data: aiData, error: aiError } = await supabase.functions.invoke(
      "generate-questions",
      {
        body: {
          note_id: noteId,
          notes: notesBody,
          count,
        },
      }
    );

    if (!aiError && aiData?.questions && aiData.questions.length > 0) {
      return {
        questions: aiData.questions.map((q: any) => ({
          ...q,
          source: "ai_generated",
        })),
        usedProvider: "edge_function",
      };
    }
  } catch (err) {
    console.warn("Edge function unavailable, falling back to smart local generator:", err);
  }

  // 3. Fallback to upgraded smart offline generator
  const localQuestions = generateFallbackQuestions(notesBody, count, noteTitle);
  return {
    questions: localQuestions.map((q) => ({
      ...q,
      source: "local_generated",
    })),
    usedProvider: "local_generator",
  };
}
