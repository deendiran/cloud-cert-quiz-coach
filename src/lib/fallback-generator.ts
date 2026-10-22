/**
 * Smart Offline Question Generator.
 *
 * Used as an offline backup when an AI provider is unreachable.
 * Generates conceptual and scenario-oriented questions with substantive options
 * and explanatory feedback, avoiding raw single-word fill-in-the-blanks.
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

/**
 * Extracts key technical sentences that contain conceptual statements, definitions, or rules.
 */
function extractMeaningfulSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim().replace(/^[-*•\d.)\s]+/, ""))
    .filter(
      (s) =>
        s.length >= 35 &&
        s.length <= 220 &&
        !s.toLowerCase().startsWith("http") &&
        !s.includes("Copyright")
    );
}

/**
 * Generates plausible conceptual distractors by altering phrases or leveraging other sentences.
 */
function createConceptDistractors(
  targetSentence: string,
  otherSentences: string[]
): string[] {
  const distractors: string[] = [];

  // 1. Invert/modify the target sentence subtly to create a classic misconception
  if (targetSentence.includes(" must ")) {
    distractors.push(targetSentence.replace(" must ", " should never "));
  } else if (targetSentence.includes(" is responsible for ")) {
    distractors.push(targetSentence.replace(" is responsible for ", " is not responsible for "));
  } else if (targetSentence.includes(" always ")) {
    distractors.push(targetSentence.replace(" always ", " only occasionally "));
  } else if (targetSentence.includes(" before ")) {
    distractors.push(targetSentence.replace(" before ", " after "));
  } else if (targetSentence.includes(" requires ")) {
    distractors.push(targetSentence.replace(" requires ", " eliminates the need for "));
  } else if (targetSentence.includes(" increases ")) {
    distractors.push(targetSentence.replace(" increases ", " reduces "));
  } else if (targetSentence.includes(" enables ")) {
    distractors.push(targetSentence.replace(" enables ", " prevents "));
  }

  // 2. Pick candidate statements from other sentences in the notes
  const availableOthers = shuffle(otherSentences.filter((s) => s !== targetSentence));
  for (const s of availableOthers) {
    if (distractors.length >= 3) break;
    // Shorten or clean the sentence to make it a neat option
    const clean = s.length > 90 ? s.slice(0, 85).replace(/,\s*[^,]*$/, "") + "..." : s;
    if (!distractors.includes(clean)) {
      distractors.push(clean);
    }
  }

  // 3. Fallback generic technical distractor if notes are brief
  const genericTechnical = [
    "It requires manual physical reconfiguration by the cloud datacentre team.",
    "It is automatically disabled when high availability zones are configured.",
    "It only applies to legacy unmanaged on-premises hardware without internet access.",
    "It replaces the shared responsibility model with fully automated provider guarantees.",
  ];

  for (const fallback of genericTechnical) {
    if (distractors.length >= 3) break;
    if (!distractors.includes(fallback)) {
      distractors.push(fallback);
    }
  }

  return distractors.slice(0, 3);
}

export function generateFallbackQuestions(
  notesBody: string,
  count: 3 | 5 | 8,
  topicLabel: string
): FallbackQuestion[] {
  const sentences = extractMeaningfulSentences(notesBody);

  if (sentences.length === 0) return [];

  const questions: FallbackQuestion[] = [];
  const templates = [
    (sent: string) =>
      `Scenario: You are reviewing cloud architectural specifications for "${topicLabel}". Which of the following statements is accurate according to your study material?`,
    (sent: string) =>
      `An engineer needs to verify key requirements from your notes. Which of the following principles is correct?`,
    (sent: string) =>
      `When implementing solutions based on your notes, which statement correctly describes the intended behaviour?`,
    (sent: string) =>
      `Which of the following best represents a core fact outlined in your notes regarding this topic?`,
  ];

  const shuffledSentences = shuffle(sentences);

  for (let i = 0; i < Math.min(count, shuffledSentences.length); i++) {
    const correctSentence = shuffledSentences[i];
    if (!correctSentence) continue;

    const distractors = createConceptDistractors(correctSentence, sentences);
    if (distractors.length < 3) continue;

    const templateFn = templates[i % templates.length] ?? templates[0]!;
    const stem = templateFn(correctSentence);

    const rawOptions = [correctSentence, ...distractors];
    const shuffledOptions = shuffle(rawOptions);
    const correctIdx = shuffledOptions.indexOf(correctSentence);

    const options = shuffledOptions.map((text, idx) => ({
      id: OPT_IDS[idx] ?? "a",
      text: text.charAt(0).toUpperCase() + text.slice(1),
    }));

    const correctId = OPT_IDS[correctIdx] ?? "a";

    // Build comprehensive multi-part explanation
    const explanation = `Correct: "${correctSentence}" is directly stated in your notes. The alternative options either alter the core condition or pertain to different requirements within the notes. Always verify the exact role and responsibility in your study notes.`;

    questions.push({
      stem,
      options,
      correct_ids: [correctId],
      explanation,
      memory_hook: `Key principle from notes: "${correctSentence.slice(0, 70)}${correctSentence.length > 70 ? "…" : ""}"`,
      hint: `Look for the statement that aligns directly with the facts in your notes without altering the scope or responsibility.`,
      difficulty: 2,
      source: "local_generated",
    });
  }

  return questions;
}
