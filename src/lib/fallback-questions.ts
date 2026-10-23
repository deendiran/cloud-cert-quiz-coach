import { supabase } from "@/integrations/supabase/client";

export interface OptionRow {
  id: string;
  text: string;
}

export interface QuizQuestion {
  id: string;
  stem: string;
  options: OptionRow[];
  correct_ids: string[];
  explanation: string;
  memory_hook: string | null;
  hint: string | null;
  topic_label: string | null;
  topic_id: number | null;
  source: string;
  difficulty: number;
}

function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/**
 * Client-side fallback: builds fill-in-the-blank questions from the note text.
 * Picks the longest word in a sentence as the answer and uses other frequent
 * terms from the notes as distractors.
 */
export async function generateLocalQuestions(
  note: { id: string; title: string; body: string },
  count: number
): Promise<number> {
  const sentences = note.body
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 25 && /[a-zA-Z]{5,}/.test(s));
  if (sentences.length === 0) return 0;

  const termCounts = new Map<string, number>();
  for (const match of note.body.matchAll(/\b[a-zA-Z]{5,}\b/g)) {
    const term = match[0];
    termCounts.set(term, (termCounts.get(term) ?? 0) + 1);
  }
  const termPool = [...termCounts.keys()]
    .sort((a, b) => (termCounts.get(b) ?? 0) - (termCounts.get(a) ?? 0));

  const chosen = shuffle(sentences).slice(0, count);
  const rows: Record<string, unknown>[] = [];

  for (const sentence of chosen) {
    const words = sentence.match(/\b[a-zA-Z]{5,}\b/g) ?? [];
    if (words.length === 0) continue;
    const answer = words.reduce((a, b) => (b.length > a.length ? b : a));
    const distractors = shuffle(
      termPool.filter((t) => t.toLowerCase() !== answer.toLowerCase())
    ).slice(0, 3);
    if (distractors.length < 3) continue;

    const blanked = sentence.replace(
      new RegExp(`\\b${answer.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`),
      "_____"
    );
    const shuffledOptions = shuffle([
      answer,
      ...distractors,
    ]).map((text, index) => ({
      id: ["a", "b", "c", "d"][index],
      text,
    }));
    const correctId = shuffledOptions.find((o) => o.text === answer)!.id;

    rows.push({
      owner_id: null, // filled below with the signed-in user
      note_id: note.id,
      topic_label: `My notes: ${note.title}`,
      difficulty: 2,
      type: "mcq",
      stem: `Fill in the blank: ${blanked}`,
      options: shuffledOptions,
      correct_ids: [correctId],
      explanation: `Your notes say: "${sentence}" — the missing term is "${answer}".`,
      memory_hook: null,
      hint: "Re-read the sentence in your notes that this question came from.",
      source: "local_generated",
      is_published: false,
    });
  }

  if (rows.length === 0) return 0;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return 0;
  const withOwner = rows.map((row) => ({ ...row, owner_id: user.id }));
  const { error } = await supabase
    .from("questions")
    .insert(withOwner as unknown as Record<string, string>);
  if (error) return 0;
  return withOwner.length;
}
