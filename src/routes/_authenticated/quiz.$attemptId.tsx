import { useState, useEffect, useRef, useCallback } from "react";
import { createFileRoute, useNavigate, useParams } from "@tanstack/react-router";
import {
  Volume2,
  VolumeX,
  Lightbulb,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  HelpCircle,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useSettings } from "@/lib/settings-context";
import { speakSequence, stopSpeaking, isSpeechSupported } from "@/lib/speech";
import type { Tables } from "@/integrations/supabase/types";

export const Route = createFileRoute("/_authenticated/quiz/$attemptId")({
  component: QuizPage,
});

type Question = Tables<"questions">;

export function QuizPage() {
  const { attemptId } = useParams({ from: "/_authenticated/quiz/$attemptId" });
  const { user } = useAuth();
  const { settings } = useSettings();
  const navigate = useNavigate();

  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);
  const [isAnswered, setIsAnswered] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [score, setScore] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  // Timing
  const questionStartTimeRef = useRef<number>(Date.now());

  // Load questions
  useEffect(() => {
    async function loadQuizQuestions() {
      if (!user || !attemptId) return;

      try {
        setLoading(true);

        // 1. Try to read from sessionStorage first
        const cached = sessionStorage.getItem(`quiz_${attemptId}_questions`);
        if (cached) {
          try {
            const parsed = JSON.parse(cached) as Question[];
            if (Array.isArray(parsed) && parsed.length > 0) {
              setQuestions(parsed);
              setLoading(false);
              return;
            }
          } catch {
            // Ignore parse errors, fallback to DB
          }
        }

        // 2. Fetch attempt from DB
        const { data: attempt, error: attemptError } = await supabase
          .from("attempts")
          .select("*")
          .eq("id", attemptId)
          .single();

        if (attemptError || !attempt) {
          throw new Error("Quiz attempt not found");
        }

        // Check if already finished
        if (attempt.finished_at) {
          void navigate({ to: `/results/${attemptId}` });
          return;
        }

        // Check already answered questions in this attempt
        const { data: existingAnswers } = await supabase
          .from("answers")
          .select("question_id, is_correct")
          .eq("attempt_id", attemptId);

        const answeredIds = new Set(existingAnswers?.map((a) => a.question_id) ?? []);
        const currentScore = existingAnswers?.filter((a) => a.is_correct).length ?? 0;
        setScore(currentScore);

        // Fetch candidate questions
        const { data: fetchedQuestions, error: qError } = await supabase
          .from("questions")
          .select("*")
          .limit(attempt.question_count * 2);

        if (qError || !fetchedQuestions) {
          throw qError || new Error("Failed to load questions");
        }

        setQuestions(fetchedQuestions.slice(0, attempt.question_count));
        setCurrentIndex(answeredIds.size);
      } catch (err) {
        console.error("Failed to load quiz:", err);
      } finally {
        setLoading(false);
      }
    }

    void loadQuizQuestions();
  }, [attemptId, user, navigate]);

  const currentQuestion = questions[currentIndex] as Question | undefined;

  // Auto-read question if read_aloud setting is enabled
  useEffect(() => {
    if (!currentQuestion) return;

    // Reset state for new question
    setSelectedOptionId(null);
    setIsAnswered(false);
    setShowHint(false);
    questionStartTimeRef.current = Date.now();

    if (settings.read_aloud && isSpeechSupported()) {
      handleReadQuestion();
    }

    return () => {
      stopSpeaking();
      setIsSpeaking(false);
    };
  }, [currentIndex, currentQuestion?.id, settings.read_aloud]);

  // Read question text aloud
  const handleReadQuestion = useCallback(() => {
    if (!currentQuestion) return;

    if (isSpeaking) {
      stopSpeaking();
      setIsSpeaking(false);
      return;
    }

    const options = (currentQuestion.options as Array<{ id: string; text: string }>) || [];
    const items = [
      currentQuestion.stem,
      ...options.map((opt) => `Option ${opt.id.toUpperCase()}: ${opt.text}`),
    ];

    setIsSpeaking(true);
    speakSequence(items, {
      rate: settings.speech_rate || 1,
      onEnd: () => setIsSpeaking(false),
      onError: () => setIsSpeaking(false),
    });
  }, [currentQuestion, isSpeaking, settings.speech_rate]);

  // Read explanation aloud
  const handleReadExplanation = useCallback(() => {
    if (!currentQuestion) return;

    if (isSpeaking) {
      stopSpeaking();
      setIsSpeaking(false);
      return;
    }

    const items = [
      currentQuestion.explanation,
      currentQuestion.memory_hook ? `Memory tip: ${currentQuestion.memory_hook}` : "",
    ].filter(Boolean);

    setIsSpeaking(true);
    speakSequence(items, {
      rate: settings.speech_rate || 1,
      onEnd: () => setIsSpeaking(false),
      onError: () => setIsSpeaking(false),
    });
  }, [currentQuestion, isSpeaking, settings.speech_rate]);

  // Handle answering
  const handleSelectOption = async (optionId: string) => {
    if (isAnswered || !currentQuestion || !user) return;

    stopSpeaking();
    setIsSpeaking(false);

    setSelectedOptionId(optionId);
    setIsAnswered(true);

    const isCorrect = currentQuestion.correct_ids.includes(optionId);
    if (isCorrect) {
      setScore((prev) => prev + 1);
    }

    const secondsTaken = Math.max(
      1,
      Math.round((Date.now() - questionStartTimeRef.current) / 1000)
    );

    // Save answer to database
    try {
      await supabase.from("answers").insert({
        attempt_id: attemptId,
        user_id: user.id,
        question_id: currentQuestion.id,
        difficulty: currentQuestion.difficulty,
        chosen_ids: [optionId],
        is_correct: isCorrect,
        seconds_taken: secondsTaken,
      });
    } catch (err) {
      console.error("Failed to record answer:", err);
    }
  };

  // Next question or finish
  const handleNext = async () => {
    stopSpeaking();
    setIsSpeaking(false);

    if (currentIndex + 1 < questions.length) {
      setCurrentIndex((prev) => prev + 1);
    } else {
      // Finished all questions
      setSubmitting(true);
      try {
        const finalScore = score;
        await supabase
          .from("attempts")
          .update({
            score: finalScore,
            finished_at: new Date().toISOString(),
          })
          .eq("id", attemptId);

        // Remove cached questions
        sessionStorage.removeItem(`quiz_${attemptId}_questions`);

        await navigate({ to: `/results/${attemptId}` });
      } catch (err) {
        console.error("Failed to finish quiz:", err);
        await navigate({ to: `/results/${attemptId}` });
      } finally {
        setSubmitting(false);
      }
    }
  };

  // Keyboard navigation: 1-4 to select, Enter for next
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is typing in an input
      if (
        document.activeElement?.tagName === "INPUT" ||
        document.activeElement?.tagName === "TEXTAREA"
      ) {
        return;
      }

      if (!isAnswered && currentQuestion) {
        const options = (currentQuestion.options as Array<{ id: string; text: string }>) || [];
        const keyNum = parseInt(e.key, 10);
        if (keyNum >= 1 && keyNum <= options.length) {
          const opt = options[keyNum - 1];
          if (opt) {
            void handleSelectOption(opt.id);
          }
        }
      } else if (isAnswered && e.key === "Enter") {
        e.preventDefault();
        void handleNext();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isAnswered, currentQuestion, currentIndex, questions.length]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <Loader2 className="size-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Loading your questions…</p>
      </div>
    );
  }

  if (!currentQuestion) {
    return (
      <div className="py-12 text-center space-y-4">
        <HelpCircle className="size-12 mx-auto text-muted-foreground" />
        <h2 className="text-xl font-bold">No questions found</h2>
        <p className="text-sm text-muted-foreground">
          This quiz session could not find any questions.
        </p>
        <Button onClick={() => navigate({ to: "/practise" })}>
          Return to Practise
        </Button>
      </div>
    );
  }

  const options = (currentQuestion.options as Array<{ id: string; text: string }>) || [];
  const progressPercent = ((currentIndex + 1) / questions.length) * 100;
  const isCorrect = selectedOptionId
    ? currentQuestion.correct_ids.includes(selectedOptionId)
    : false;

  const difficultyLabel =
    currentQuestion.difficulty === 1
      ? "Fundamentals"
      : currentQuestion.difficulty === 3
      ? "Expert"
      : "Associate";

  return (
    <div className="py-6 max-w-2xl mx-auto space-y-6">
      {/* Quiz Top Navigation Bar */}
      <div className="flex items-center justify-between gap-4">
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground hover:text-foreground">
              <ArrowLeft className="size-4" /> Exit
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Leave this quiz?</AlertDialogTitle>
              <AlertDialogDescription>
                Your answered questions will be saved. You can always start a new practice session later.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Stay</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  stopSpeaking();
                  navigate({ to: "/practise" });
                }}
              >
                Exit quiz
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-muted-foreground">
            Question {currentIndex + 1} of {questions.length}
          </span>
          <Badge variant="outline" className="text-xs capitalize font-medium">
            {difficultyLabel}
          </Badge>
        </div>
      </div>

      {/* Progress Bar */}
      <Progress value={progressPercent} className="h-2 rounded-full" />

      {/* Question Card */}
      <Card className="rounded-2xl border-border/70 shadow-sm overflow-hidden">
        <CardContent className="p-6 space-y-6">
          {/* Metadata & Audio */}
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-primary">
              {currentQuestion.topic_label || "Azure Fundamentals"}
            </span>

            <div className="flex items-center gap-1">
              {currentQuestion.hint && !isAnswered && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowHint((prev) => !prev)}
                  className="h-8 gap-1.5 text-xs text-muted-foreground hover:text-foreground"
                >
                  <Lightbulb className="size-3.5 text-amber-500" />
                  {showHint ? "Hide hint" : "Hint"}
                </Button>
              )}

              {isSpeechSupported() && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleReadQuestion}
                  aria-label={isSpeaking ? "Stop listening" : "Listen to question"}
                  className="size-8 rounded-full text-muted-foreground hover:text-foreground"
                >
                  {isSpeaking ? (
                    <VolumeX className="size-4 text-primary animate-pulse" />
                  ) : (
                    <Volume2 className="size-4" />
                  )}
                </Button>
              )}
            </div>
          </div>

          {/* Hint view */}
          {showHint && currentQuestion.hint && (
            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-foreground flex items-start gap-2">
              <Lightbulb className="size-4 text-amber-500 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold text-amber-600 dark:text-amber-400">Hint: </span>
                {currentQuestion.hint}
              </div>
            </div>
          )}

          {/* Question Stem */}
          <h2 className="text-lg md:text-xl font-bold tracking-tight text-foreground leading-snug">
            {currentQuestion.stem}
          </h2>

          {/* Options List */}
          <div className="space-y-3 pt-2">
            {options.map((option, idx) => {
              const isSelected = selectedOptionId === option.id;
              const isOptionCorrect = currentQuestion.correct_ids.includes(option.id);

              let optionClasses =
                "relative flex items-start gap-3 w-full p-4 rounded-xl border text-left transition-all text-sm font-medium";

              if (!isAnswered) {
                // Interactive state
                optionClasses +=
                  " border-border hover:border-primary/50 hover:bg-muted/40 cursor-pointer active:scale-[0.99]";
              } else {
                // Answered state: Green for correct, Amber for incorrect (NEVER RED!)
                if (isOptionCorrect) {
                  optionClasses +=
                    " border-emerald-500 bg-emerald-500/10 text-emerald-950 dark:text-emerald-200 font-semibold ring-1 ring-emerald-500/40";
                } else if (isSelected && !isOptionCorrect) {
                  optionClasses +=
                    " border-amber-500 bg-amber-500/10 text-amber-950 dark:text-amber-200 font-semibold ring-1 ring-amber-500/40";
                } else {
                  optionClasses += " border-border/40 opacity-40 text-muted-foreground";
                }
              }

              return (
                <button
                  key={option.id}
                  type="button"
                  disabled={isAnswered}
                  onClick={() => handleSelectOption(option.id)}
                  className={optionClasses}
                >
                  <span
                    className={`flex size-6 shrink-0 items-center justify-center rounded-lg border text-xs font-bold ${
                      isAnswered && isOptionCorrect
                        ? "border-emerald-500 bg-emerald-500 text-white"
                        : isAnswered && isSelected && !isOptionCorrect
                        ? "border-amber-500 bg-amber-500 text-white"
                        : "border-border bg-muted/60 text-muted-foreground"
                    }`}
                  >
                    {idx + 1}
                  </span>
                  <span className="flex-1 pt-0.5 leading-relaxed">{option.text}</span>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Feedback Panel (Shown right after answering) */}
      {isAnswered && (
        <Card
          aria-live="polite"
          className={`rounded-2xl border shadow-md transition-all animate-in fade-in-50 duration-200 ${
            isCorrect
              ? "border-emerald-500/40 bg-emerald-50/50 dark:bg-emerald-950/20"
              : "border-amber-500/40 bg-amber-50/50 dark:bg-amber-950/20"
          }`}
        >
          <CardContent className="p-6 space-y-4">
            {/* Result Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {isCorrect ? (
                  <>
                    <CheckCircle2 className="size-5 text-emerald-600 dark:text-emerald-400" />
                    <h3 className="font-bold text-base text-emerald-900 dark:text-emerald-300">
                      Correct! Well done.
                    </h3>
                  </>
                ) : (
                  <>
                    <AlertTriangle className="size-5 text-amber-600 dark:text-amber-400" />
                    <h3 className="font-bold text-base text-amber-900 dark:text-amber-300">
                      Not quite, but good try!
                    </h3>
                  </>
                )}
              </div>

              {isSpeechSupported() && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleReadExplanation}
                  className="h-8 gap-1.5 text-xs text-muted-foreground hover:text-foreground"
                >
                  <Volume2 className="size-3.5" /> Listen
                </Button>
              )}
            </div>

            {/* Explanation Body */}
            <p className="text-sm leading-relaxed text-foreground">
              {currentQuestion.explanation}
            </p>

            {/* Memory Hook Tip */}
            {currentQuestion.memory_hook && (
              <div className="p-3 rounded-xl bg-background/80 border border-border/70 text-xs text-muted-foreground flex items-start gap-2">
                <span className="text-base">💡</span>
                <div>
                  <span className="font-semibold text-foreground">Memory hook: </span>
                  {currentQuestion.memory_hook}
                </div>
              </div>
            )}

            {/* Next Action */}
            <div className="pt-2 flex justify-end">
              <Button
                size="default"
                onClick={handleNext}
                disabled={submitting}
                className="rounded-xl px-5 gap-2 font-semibold shadow-sm"
              >
                {submitting ? (
                  <>
                    <Loader2 className="size-4 animate-spin" /> Saving…
                  </>
                ) : currentIndex + 1 < questions.length ? (
                  <>
                    Next question <ArrowRight className="size-4" />
                  </>
                ) : (
                  <>
                    View results <ArrowRight className="size-4" />
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
