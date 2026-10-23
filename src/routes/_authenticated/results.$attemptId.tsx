import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { RotateCcw, Target, Zap } from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import {
  correctOptionText,
  friendlyDbError,
  scoreEncouragement,
} from "@/lib/quiz-helpers";

export const Route = createFileRoute("/_authenticated/results/$attemptId")({
  component: ResultsPage,
});

interface ResultAnswer {
  question_id: string;
  is_correct: boolean;
  question: {
    stem: string;
    options: { id: string; text: string }[];
    correct_ids: string[];
    explanation: string;
    memory_hook: string | null;
    topic_label: string | null;
    topic_id: number | null;
  } | null;
}

function ResultsPage() {
  const { attemptId } = Route.useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

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

  const answersQuery = useQuery({
    queryKey: ["results-answers", attemptId],
    enabled: !!attemptQuery.data,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("answers")
        .select(
          "question_id, is_correct, question:questions(stem, options, correct_ids, explanation, memory_hook, topic_label, topic_id)"
        )
        .eq("attempt_id", attemptId);
      if (error) throw new Error(error.message);
      return (data ?? []) as unknown as ResultAnswer[];
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

  const attempt = attemptQuery.data;
  const answers = answersQuery.data ?? [];
  const topicNames = useMemo(
    () => new Map((topicsQuery.data ?? []).map((t) => [t.id, t.name])),
    [topicsQuery.data]
  );

  const correctCount =
    attempt?.score ?? answers.filter((a) => a.is_correct).length;
  const total = attempt?.question_count ?? answers.length;

  const perTopic = useMemo(() => {
    const map = new Map<string, { correct: number; total: number }>();
    for (const answer of answers) {
      if (!answer.question) continue;
      const name =
        (answer.question.topic_id != null
          ? topicNames.get(answer.question.topic_id)
          : null) ??
        answer.question.topic_label ??
        "Other";
      const entry = map.get(name) ?? { correct: 0, total: 0 };
      entry.total += 1;
      if (answer.is_correct) entry.correct += 1;
      map.set(name, entry);
    }
    return [...map.entries()]
      .map(([name, counts]) => ({
        name,
        correct: counts.correct,
        total: counts.total,
        pct: counts.total === 0 ? 0 : Math.round((counts.correct / counts.total) * 100),
      }))
      .sort((a, b) => a.pct - b.pct);
  }, [answers, topicNames]);

  const missed = answers.filter((a) => !a.is_correct && a.question);

  const weakTopicIds = useMemo(() => {
    const ids = new Set<number>();
    for (const answer of answers) {
      if (!answer.question?.topic_id) continue;
      if (!answer.is_correct) ids.add(answer.question.topic_id);
    }
    return [...ids];
  }, [answers]);

  const tryAgain = async () => {
    if (!user || !attempt) return;
    const { data: newAttempt, error } = await supabase
      .from("attempts")
      .insert({
        user_id: user.id,
        question_count: (attempt.question_ids as string[]).length,
        question_ids: attempt.question_ids,
      })
      .select("id")
      .single();
    if (error || !newAttempt) return;
    navigate({ to: "/quiz/$attemptId", params: { attemptId: newAttempt.id } });
  };

  if (attemptQuery.isLoading || answersQuery.isLoading) {
    return (
      <div className="space-y-4 py-8" aria-hidden="true">
        <Skeleton className="mx-auto h-16 w-40" />
        <Skeleton className="mx-auto h-5 w-72" />
        <Skeleton className="h-40 w-full rounded-2xl" />
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

  if (!attempt) {
    return (
      <div className="py-10">
        <Card className="rounded-2xl">
          <CardContent className="p-6 text-sm text-muted-foreground">
            We couldn't find that attempt. It may belong to another account.
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 py-8">
      <div className="text-center">
        <p className="text-5xl font-extrabold tracking-tight text-foreground">
          {correctCount} / {total}
        </p>
        <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-muted-foreground">
          {scoreEncouragement(correctCount, total)}
        </p>
      </div>

      {perTopic.length > 0 && (
        <Card className="rounded-2xl">
          <CardContent className="space-y-3 p-5">
            <h2 className="text-sm font-semibold text-foreground">By topic</h2>
            {perTopic.map((topic) => (
              <div key={topic.name}>
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span className="truncate font-medium text-foreground">
                    {topic.name}
                  </span>
                  <span>
                    {topic.correct} / {topic.total}
                  </span>
                </div>
                <div
                  className="mt-1 h-2.5 w-full overflow-hidden rounded-full bg-muted"
                  role="img"
                  aria-label={`${topic.name}: ${topic.correct} of ${topic.total} correct`}
                >
                  <div
                    className="h-full rounded-full bg-primary transition-all"
                    style={{ width: `${Math.max(topic.pct, 3)}%` }}
                  />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Accordion type="single" collapsible className="rounded-2xl border bg-card">
        <AccordionItem value="missed" className="border-0">
          <AccordionTrigger className="px-5 py-4 text-sm font-semibold hover:no-underline">
            Review missed questions ({missed.length})
          </AccordionTrigger>
          <AccordionContent className="px-5 pb-5">
            {missed.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nothing missed — flawless round!
              </p>
            ) : (
              <div className="space-y-4">
                {missed.map((answer) => (
                  <div
                    key={answer.question_id}
                    className="rounded-xl border bg-background p-4"
                  >
                    <p className="text-sm font-semibold text-foreground">
                      {answer.question!.stem}
                    </p>
                    <p className="mt-2 text-sm text-foreground">
                      <span className="font-semibold">Correct answer:</span>{" "}
                      {correctOptionText({
                        ...answer.question!,
                        correct_ids: answer.question!.correct_ids,
                        options: answer.question!.options,
                      } as never)}
                    </p>
                    <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                      {answer.question!.explanation}
                    </p>
                    {answer.question!.memory_hook && (
                      <p className="mt-1 text-sm font-medium text-foreground">
                        Memory hook: {answer.question!.memory_hook}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      <div className="grid gap-2 sm:grid-cols-3">
        <Button variant="outline" onClick={tryAgain}>
          <RotateCcw aria-hidden="true" />
          Try again
        </Button>
        <Button variant="outline" onClick={() => navigate({ to: "/readiness" })}>
          <Target aria-hidden="true" />
          See my readiness
        </Button>
        <Button
          onClick={() =>
            weakTopicIds.length > 0
              ? navigate({
                  to: "/practise",
                  search: { topics: weakTopicIds.join(",") },
                })
              : navigate({ to: "/practise" })
          }
        >
          <Zap aria-hidden="true" />
          Practise my weak topics
        </Button>
      </div>
    </div>
  );
}
