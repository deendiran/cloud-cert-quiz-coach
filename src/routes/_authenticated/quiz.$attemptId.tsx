import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  CheckCircle2,
  CircleAlert,
  Ear,
  Lightbulb,
  Loader2,
  Square,
  Volume2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/lib/auth-context";
import { useSettings, langTag } from "@/lib/settings-context";
import {
  correctOptionText,
  friendlyDbError,
  isCorrectChoice,
  letterFor,
  shuffle,
} from "@/lib/quiz-helpers";
import type { OptionRow, QuizQuestion } from "@/lib/fallback-questions";
import {
  speakSequence,
  speechSupported,
  stopSpeaking,
} from "@/lib/speech";

export const Route = createFileRoute("/_authenticated/quiz/$attemptId")({
  head: () => ({
    meta: [
      { title: "Quiz — Azure Quiz Coach" },
      {
        name: "description",
        content: "Answer one question at a time with hints and read-aloud.",
      },
    ],
  }),
  component: QuizPage,
});

function QuizPage() {
  const { attemptId } = Route.useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { settings } = useSettings();

  const attemptQuery = useQuery({
    queryKey: ["attempt", attemptId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("attempts")
        .select("id, question_count, question_ids, score, finished_at")
        .eq("id", attemptId)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return data;
    },
  });

  const attempt = attemptQuery.data;
  const questionIds = useMemo(
    () => (attempt?.question_ids as string[] | undefined) ?? [],
    [attempt]
  );

  const questionsQuery = useQuery({
    queryKey: ["quiz-questions", questionIds.join(",")],
    enabled: questionIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("questions")
        .select(
          "id, stem, options, correct_ids, explanation, memory_hook, hint, topic_label, topic_id, source, difficulty"
        )
        .in("id", questionIds);
      if (error) throw new Error(error.message);
      // Preserve the attempt's original question order.
      const byId = new Map((data ?? []).map((q) => [q.id, q]));
      return questionIds
        .map((id) => byId.get(id))
        .filter((q): q is QuizQuestion => !!q);
    },
  });

  const topicsQuery = useQuery({
    queryKey: ["topics"],
    queryFn: async () => {
      const { data, error } = await supabase.from("topics").select("id, name");
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });

  const topicNames = useMemo(
    () => new Map((topicsQuery.data ?? []).map((t) => [t.id, t.name])),
    [topicsQuery.data]
  );

  const questions = questionsQuery.data ?? [];

  // One fixed shuffle per question so navigation back and forth is stable.
  const shuffledOptions = useMemo(() => {
    const map = new Map<string, OptionRow[]>();
    for (const question of questions) {
      map.set(question.id, shuffle(question.options));
    }
    return map;
  }, [questions]);

  const [index, setIndex] = useState(0);
  const [chosenId, setChosenId] = useState<string | null>(null);
  const [locked, setLocked] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [saving, setSaving] = useState(false);
  const [finishError, setFinishError] = useState<string | null>(null);
  const questionStartedAt = useRef<number>(Date.now());
  const answeredCountRef = useRef(0);
  const correctCountRef = useRef(0);

  const current: QuizQuestion | undefined = questions[index];
  const total = questions.length;
  const isLast = index === total - 1;

  const speechLang = langTag(settings.language);
  const speechRate = settings.speech_rate;

  const readQuestionAloud = useCallback(
    (question: QuizQuestion, options: OptionRow[]) => {
      if (!speechSupported()) return;
      setSpeaking(true);
      const parts = [
        `Question ${index + 1}. ${question.stem}`,
        ...options.map(
          (option, optionIndex) =>
            `Option ${letterFor(optionIndex)}: ${option.text}`
        ),
      ];
      speakSequence(parts, { rate: speechRate, lang: speechLang, onEnd: () => setSpeaking(false) });
    },
    [index, speechLang, speechRate]
  );

  const readFeedbackAloud = useCallback(
    (question: QuizQuestion, chosen: string) => {
      if (!speechSupported()) return;
      setSpeaking(true);
      const correct = isCorrectChoice(question, chosen);
      const parts = [
        correct
          ? "Correct."
          : `Not quite. The correct answer is: ${correctOptionText(question)}.`,
        question.explanation,
      ];
      if (question.memory_hook) parts.push(`Memory hook: ${question.memory_hook}`);
      speakSequence(parts, { rate: speechRate, lang: speechLang, onEnd: () => setSpeaking(false) });
    },
    [speechLang, speechRate]
  );

  // Read-aloud automatically: question when it appears, answer after responding.
  useEffect(() => {
    if (!current || locked) return;
    if (settings.read_aloud) readQuestionAloud(current, shuffledOptions.get(current.id) ?? []);
    questionStartedAt.current = Date.now();
    return () => stopSpeaking();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.id, locked]);

  useEffect(() => () => stopSpeaking(), []);

  const submitAnswer = useCallback(
    async (question: QuizQuestion, optionId: string) => {
      if (locked || saving) return;
      setChosenId(optionId);
      setLocked(true);
      if (settings.read_aloud) {
        readFeedbackAloud(question, optionId);
      }
      const isCorrect = isCorrectChoice(question, optionId);
      answeredCountRef.current += 1;
      if (isCorrect) correctCountRef.current += 1;
      try {
        await supabase.from("answers").insert({
          attempt_id: attemptId,
          user_id: user!.id,
          question_id: question.id,
          difficulty: question.difficulty,
          chosen_ids: [optionId],
          is_correct: isCorrect,
          seconds_taken: Math.min(
            3600,
            Math.max(1, Math.round((Date.now() - questionStartedAt.current) / 1000))
          ),
        });
      } catch {
        // The answer will be missing from analytics but the quiz continues.
      }
    },
    [attemptId, locked, readFeedbackAloud, saving, settings.read_aloud, user]
  );

  const goNext = useCallback(() => {
    stopSpeaking();
    setSpeaking(false);
    setFinishError(null);
    if (isLast) {
      void finish();
      return;
    }
    setIndex((current) => current + 1);
    setChosenId(null);
    setLocked(false);
    setShowHint(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLast, total]);

  const finish = useCallback(async () => {
    setSaving(true);
    const { error } = await supabase
      .from("attempts")
      .update({
        score: correctCountRef.current,
        finished_at: new Date().toISOString(),
      })
      .eq("id", attemptId);
    setSaving(false);
    if (error) {
      setFinishError(
        "We couldn't save your final score, but your answers are stored. Try again from the results page."
      );
      return;
    }
    navigate({ to: "/results/$attemptId", params: { attemptId } });
  }, [attemptId, navigate]);

  // Keyboard: 1-4 choose, Enter for next.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!current) return;
      if (!locked && /^[1-4]$/.test(event.key)) {
        const options = shuffledOptions.get(current.id) ?? [];
        const option = options[Number(event.key) - 1];
        if (option) void submitAnswer(current, option.id);
      } else if (locked && event.key === "Enter") {
        event.preventDefault();
        goNext();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [current, goNext, locked, shuffledOptions, submitAnswer]);

  if (attemptQuery.isLoading || (attempt && questionsQuery.isLoading)) {
    return (
      <div className="space-y-4 py-8" aria-hidden="true">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-2 w-full" />
        <Skeleton className="h-40 w-full rounded-2xl" />
        <Skeleton className="h-14 w-full rounded-xl" />
        <Skeleton className="h-14 w-full rounded-xl" />
        <Skeleton className="h-14 w-full rounded-xl" />
      </div>
    );
  }

  if (attemptQuery.isError) {
    return (
      <div className="py-10">
        <Card className="rounded-2xl">
          <CardContent className="p-6 text-sm text-incorrect-foreground">
            {friendlyDbError(attemptQuery.error.message)}
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!attempt || attempt.finished_at) {
    return (
      <div className="py-10">
        <Card className="rounded-2xl">
          <CardContent className="p-6 text-sm text-muted-foreground">
            This quiz isn't available — it may have been completed or belongs to
            another account. Start a fresh one from the practise page.
          </CardContent>
        </Card>
      </div>
    );
  }

  if (questionsQuery.isError) {
    return (
      <div className="py-10">
        <Card className="rounded-2xl">
          <CardContent className="p-6 text-sm text-incorrect-foreground">
            {friendlyDbError(questionsQuery.error.message)}
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!current) {
    return (
      <div className="py-10">
        <Card className="rounded-2xl">
          <CardContent className="p-6 text-sm text-muted-foreground">
            This quiz has no questions attached. Head back to practise and start
            a new one.
          </CardContent>
        </Card>
      </div>
    );
  }

  const options = shuffledOptions.get(current.id) ?? [];
  const topicName =
    (current.topic_id != null ? topicNames.get(current.topic_id) : null) ??
    current.topic_label ??
    "";
  const chosenIsCorrect = chosenId ? isCorrectChoice(current, chosenId) : false;

  const readStemAndOptions = () => {
    readQuestionAloud(current, options);
  };

  return (
    <div className="py-6">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-sm font-semibold text-foreground">
          Question {index + 1} of {total}
        </p>
        <p className="truncate text-xs text-muted-foreground">{topicName}</p>
      </div>
      <Progress
        value={((index + 1) / total) * 100}
        className="mt-2 h-2"
        aria-label={`Question ${index + 1} of ${total}`}
      />

      <Card className="mt-4 rounded-2xl">
        <CardContent className="p-5">
          <h1 className="text-lg font-semibold leading-snug text-foreground">
            {current.stem}
          </h1>

          <div className="mt-4 space-y-2.5">
            {options.map((option, optionIndex) => {
              const isChosen = chosenId === option.id;
              const isCorrectOption = current.correct_ids.includes(option.id);
              const marked = locked;
              const state = marked
                ? isCorrectOption
                  ? "correct"
                  : isChosen
                    ? "incorrect"
                    : "idle"
                : "idle";
              return (
                <button
                  key={option.id}
                  type="button"
                  disabled={locked}
                  onClick={() => void submitAnswer(current, option.id)}
                  aria-label={`Option ${letterFor(optionIndex)}${locked && isCorrectOption ? " — correct answer" : ""}`}
                  className={`flex min-h-14 w-full items-center gap-3 rounded-xl border px-4 py-3 text-left text-sm transition-colors ${
                    state === "correct"
                      ? "border-correct bg-correct-soft text-correct-foreground"
                      : state === "incorrect"
                        ? "border-incorrect bg-incorrect-soft text-incorrect-foreground"
                        : "border-input bg-background text-foreground hover:bg-secondary disabled:hover:bg-background"
                  } ${isChosen && !marked ? "ring-2 ring-ring" : ""}`}
                >
                  <span
                    className={`flex size-7 shrink-0 items-center justify-center rounded-lg text-xs font-bold ${
                      state === "correct"
                        ? "bg-correct text-white"
                        : state === "incorrect"
                          ? "bg-incorrect text-white"
                          : "bg-secondary text-secondary-foreground"
                    }`}
                  >
                    {letterFor(optionIndex)}
                  </span>
                  <span className="flex-1">{option.text}</span>
                  {state === "correct" && (
                    <CheckCircle2 className="size-5 shrink-0" aria-hidden="true" />
                  )}
                  {state === "incorrect" && (
                    <CircleAlert className="size-5 shrink-0" aria-hidden="true" />
                  )}
                </button>
              );
            })}
          </div>

          {!locked && (
            <div className="mt-4 flex flex-wrap items-center gap-2">
              {current.hint && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowHint((value) => !value)}
                  aria-expanded={showHint}
                >
                  <Lightbulb aria-hidden="true" />
                  {showHint ? "Hide hint" : "Show hint"}
                </Button>
              )}
              {speechSupported() && (
                <>
                  <Button variant="outline" size="sm" onClick={readStemAndOptions}>
                    <Ear aria-hidden="true" />
                    Listen
                  </Button>
                  {speaking && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        stopSpeaking();
                        setSpeaking(false);
                      }}
                    >
                      <Square aria-hidden="true" />
                      Stop
                    </Button>
                  )}
                </>
              )}
            </div>
          )}
          {showHint && current.hint && !locked && (
            <p className="mt-3 rounded-lg bg-info-soft px-3 py-2 text-sm text-foreground">
              {current.hint}
            </p>
          )}
          {!speechSupported() && (
            <p className="mt-3 text-xs text-muted-foreground">
              Your browser doesn't support read-aloud, so the Listen buttons are
              hidden. The quiz works fine without them.
            </p>
          )}
        </CardContent>
      </Card>

      {locked && (
        <div
          role="status"
          aria-live="polite"
          className="fixed inset-x-0 bottom-0 z-30 mx-auto max-w-3xl px-4 pb-4"
        >
          <Card
            className={`rounded-2xl border-2 shadow-xl ${
              chosenIsCorrect
                ? "border-correct bg-correct-soft"
                : "border-incorrect bg-incorrect-soft"
            }`}
          >
            <CardContent className="p-5">
              <div className="flex items-center gap-2">
                {chosenIsCorrect ? (
                  <CheckCircle2
                    className="size-6 text-correct-foreground"
                    aria-hidden="true"
                  />
                ) : (
                  <CircleAlert
                    className="size-6 text-incorrect-foreground"
                    aria-hidden="true"
                  />
                )}
                <h2 className="text-lg font-bold text-foreground">
                  {chosenIsCorrect ? "Nice work!" : "Not quite, here's why"}
                </h2>
              </div>
              {!chosenIsCorrect && (
                <p className="mt-2 text-sm text-foreground">
                  <span className="font-semibold">Correct answer:</span>{" "}
                  {correctOptionText(current)}
                </p>
              )}
              <p className="mt-2 text-sm leading-relaxed text-foreground">
                {current.explanation}
              </p>
              {current.memory_hook && (
                <p className="mt-2 text-sm font-medium text-foreground">
                  Memory hook: {current.memory_hook}
                </p>
              )}
              {speechSupported() && (
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3"
                  onClick={() => readFeedbackAloud(current, chosenId!)}
                >
                  <Volume2 aria-hidden="true" />
                  Listen to answer
                </Button>
              )}
              <Button size="lg" className="mt-4 w-full" onClick={goNext} disabled={saving}>
                {saving && <Loader2 className="animate-spin" aria-hidden="true" />}
                {isLast ? "See results" : "Next question"}
              </Button>
              {finishError && (
                <p className="mt-3 rounded-lg bg-incorrect-soft px-3 py-2 text-sm text-incorrect-foreground">
                  {finishError}
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
