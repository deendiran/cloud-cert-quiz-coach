/**
 * Client-side fallback question generator.
 *
 * Used when the generate-questions edge function returns 429 or 502.
 * Produces fill-in-the-blank questions by:
 *   1. Splitting the notes into sentences.
 *   2. Picking the longest word in a sentence as the answer.
 *   3. Using 3 other long words from the notes as distractors.
 *
 * Questions are tagged with source = 'local_generated'.
 */

export interface FallbackQuestion {
  stem: string;
  options: { id: string; text: string }[];
  correct_ids: string[];
  explanation: string;
  memory_hook: string | null;
  hint: string | null;
  difficulty: 1 | 2 | 3;
  source: "local_generated";
}

const OPT_IDS = ["a", "b", "c", "d"] as const;

function tokenize(text: string): string[] {
  return text
    .replace(/[^a-zA-Z\s]/g, " ")
    .split(/\s+/)
    .map((w) => w.toLowerCase())
    .filter((w) => w.length > 4);
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const current = a[i];
    const target = a[j];
    if (current !== undefined && target !== undefined) {
      a[i] = target;
      a[j] = current;
    }
  }
  return a;
}

export function generateFallbackQuestions(
  notesBody: string,
  count: 3 | 5 | 8,
  topicLabel: string
): FallbackQuestion[] {
  const sentences = notesBody
    .split(/[.!?]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 40);

  if (sentences.length === 0) return [];

  const allWords = tokenize(notesBody);
  const uniqueWords = [...new Set(allWords)].sort((a, b) => b.length - a.length);

  const questions: FallbackQuestion[] = [];

  for (let i = 0; i < Math.min(count, sentences.length); i++) {
    const sentence = sentences[i % sentences.length];
    if (!sentence) continue;
    const sentenceWords = tokenize(sentence).sort((a, b) => b.length - a.length);
    if (sentenceWords.length === 0) continue;

    const answer = sentenceWords[0];
    if (!answer) continue;
    const distractors = uniqueWords
      .filter((w) => w !== answer)
      .slice(0, 10)
      .filter((w) => w !== answer)
      .slice(0, 3);

    if (distractors.length < 3) continue;

    const stem = sentence.replace(new RegExp(`\\b${answer}\\b`, "i"), "_____");
    const shuffledOptions = shuffle([answer, ...distractors]);
    const correctIdx = shuffledOptions.indexOf(answer);

    questions.push({
      stem: `Fill in the blank: "${stem}"`,
      options: shuffledOptions.map((text, idx) => ({
        id: OPT_IDS[idx] ?? "a",
        text: (text ?? "").charAt(0).toUpperCase() + (text ?? "").slice(1),
      })),
      correct_ids: [OPT_IDS[correctIdx] ?? "a"],
      explanation: `The missing word is "${answer}", taken directly from your notes.`,
      memory_hook: null,
      hint: `The answer appears in this sentence from your notes.`,
      difficulty: 1,
      source: "local_generated",
    });
  }

  return questions;
}
