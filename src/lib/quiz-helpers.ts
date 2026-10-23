import type { QuizQuestion } from "@/lib/fallback-questions";

export const OPTION_LETTERS = ["a", "b", "c", "d"] as const;

export function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function isCorrectChoice(
  question: Pick<QuizQuestion, "correct_ids">,
  optionId: string
): boolean {
  return question.correct_ids.includes(optionId);
}

export function correctOptionText(
  question: Pick<QuizQuestion, "options" | "correct_ids">
): string {
  const correct = question.options.find((option) =>
    question.correct_ids.includes(option.id)
  );
  return correct?.text ?? "";
}

export function letterFor(index: number): string {
  return OPTION_LETTERS[index]?.toUpperCase() ?? String(index + 1);
}

/** Encouraging one-liner by score band. */
export function scoreEncouragement(correct: number, total: number): string {
  const pct = total === 0 ? 0 : (correct / total) * 100;
  if (pct >= 90)
    return "Outstanding — you really know this material. Keep the streak going!";
  if (pct >= 75)
    return "Strong work! A little polish on the missed ones and you're there.";
  if (pct >= 50)
    return "Good progress — you're building a solid base. Review the misses and try again.";
  if (pct >= 25)
    return "Every attempt counts. Skim the explanations below, then take another pass.";
  return "Tough round — that's how learning starts. Read the explanations and go again.";
}

export function readinessBand(percent: number): {
  label: "Ready" | "Almost" | "Needs work";
  color: string;
} {
  if (percent >= 80) return { label: "Ready", color: "var(--color-correct)" };
  if (percent >= 60) return { label: "Almost", color: "var(--color-info)" };
  return { label: "Needs work", color: "var(--color-incorrect)" };
}

export function friendlyDbError(message?: string): string {
  const m = (message ?? "").toLowerCase();
  if (m.includes("failed to fetch") || m.includes("network"))
    return "We couldn't reach the server. Check your connection and try again.";
  if (m.includes("row-level") || m.includes("permission"))
    return "That item isn't available with your account. Refresh and try again.";
  return "Something went wrong. Please try again in a moment.";
}
