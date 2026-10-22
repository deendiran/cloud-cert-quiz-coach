import { useState, useEffect } from "react";
import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import {
  Trophy,
  RotateCcw,
  BookOpen,
  LineChart,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  HelpCircle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import type { Tables } from "@/integrations/supabase/types";

export const Route = createFileRoute("/_authenticated/results/$attemptId")({
  component: ResultsPage,
});

type Answer = Tables<"answers">;
type Question = Tables<"questions">;
type Attempt = Tables<"attempts">;

interface AnswerWithQuestion extends Answer {
  question?: Question | undefined;
}

interface TopicBreakdown {
  topic: string;
  correct: number;
  total: number;
  percent: number;
}

export function ResultsPage() {
  const { attemptId } = useParams({ from: "/_authenticated/results/$attemptId" });
  const { user } = useAuth();

  const [attempt, setAttempt] = useState<Attempt | null>(null);
  const [answers, setAnswers] = useState<AnswerWithQuestion[]>([]);
  const [topicStats, setTopicStats] = useState<TopicBreakdown[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadResults() {
      if (!user || !attemptId) return;

      try {
        setLoading(true);

        // Fetch attempt
        const { data: attemptData, error: attemptError } = await supabase
          .from("attempts")
          .select("*")
          .eq("id", attemptId)
          .single();

        if (attemptError || !attemptData) {
          throw new Error("Attempt not found");
        }
        setAttempt(attemptData);

        // Fetch answers for this attempt
        const { data: answersData, error: answersError } = await supabase
          .from("answers")
          .select("*")
          .eq("attempt_id", attemptId);

        if (answersError) throw answersError;

        if (answersData && answersData.length > 0) {
          // Fetch associated questions
          const questionIds = answersData.map((a) => a.question_id);
          const { data: questionsData } = await supabase
            .from("questions")
            .select("*")
            .in("id", questionIds);

          const qMap = new Map((questionsData || []).map((q) => [q.id, q]));

          const enriched: AnswerWithQuestion[] = answersData.map((ans) => ({
            ...ans,
            question: qMap.get(ans.question_id),
          }));

          setAnswers(enriched);

          // Compute topic breakdown
          const breakdownMap = new Map<string, { correct: number; total: number }>();
          enriched.forEach((item) => {
            const topic = item.question?.topic_label || "General Azure";
            const current = breakdownMap.get(topic) || { correct: 0, total: 0 };
            current.total += 1;
            if (item.is_correct) current.correct += 1;
            breakdownMap.set(topic, current);
          });

          const stats: TopicBreakdown[] = Array.from(breakdownMap.entries()).map(
            ([topic, data]) => ({
              topic,
              correct: data.correct,
              total: data.total,
              percent: Math.round((data.correct / data.total) * 100),
            })
          );

          setTopicStats(stats);
        }
      } catch (err) {
        console.error("Failed to load results:", err);
      } finally {
        setLoading(false);
      }
    }

    void loadResults();
  }, [attemptId, user]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <Loader2 className="size-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Calculating your results…</p>
      </div>
    );
  }

  if (!attempt) {
    return (
      <div className="py-12 text-center space-y-4">
        <HelpCircle className="size-12 mx-auto text-muted-foreground" />
        <h2 className="text-xl font-bold">Results not found</h2>
        <Button asChild>
          <Link to="/practise">Return to Practise</Link>
        </Button>
      </div>
    );
  }

  const totalQuestions = answers.length || attempt.question_count;
  const correctCount = answers.filter((a) => a.is_correct).length;
  const scorePercent = totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0;
  const missedAnswers = answers.filter((a) => !a.is_correct);

  return (
    <div className="py-8 max-w-2xl mx-auto space-y-6">
      {/* Disclaimer */}
      <p className="text-xs text-muted-foreground text-center">
        Unofficial study aid. Not affiliated with or endorsed by Microsoft.
      </p>

      {/* Main Score Card */}
      <Card className="rounded-2xl border-border/70 shadow-sm text-center overflow-hidden">
        <div className="bg-primary/5 py-8 px-6 space-y-3">
          <div className="size-14 mx-auto rounded-full bg-primary/10 flex items-center justify-center text-primary">
            <Trophy className="size-7" />
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight text-foreground">
            Quiz Complete!
          </h1>
          <div className="text-4xl font-black text-primary">
            {correctCount} / {totalQuestions}{" "}
            <span className="text-xl font-medium text-muted-foreground">
              ({scorePercent}%)
            </span>
          </div>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            {scorePercent >= 80
              ? "Outstanding performance! You have strong command of these concepts."
              : scorePercent >= 60
              ? "Good effort! A quick review of the missed questions will get you exam-ready."
              : "Keep practicing! Every attempt sharpens your knowledge for the real exam."}
          </p>
        </div>

        {/* Action Buttons */}
        <CardContent className="p-4 grid grid-cols-1 sm:grid-cols-3 gap-2 bg-card">
          <Button asChild variant="default" className="rounded-xl gap-2 font-semibold shadow-sm">
            <Link to="/practise">
              <RotateCcw className="size-4" /> Practise again
            </Link>
          </Button>
          <Button asChild variant="outline" className="rounded-xl gap-2 font-medium">
            <Link to="/notes">
              <BookOpen className="size-4" /> Review notes
            </Link>
          </Button>
          <Button asChild variant="outline" className="rounded-xl gap-2 font-medium">
            <Link to="/readiness">
              <LineChart className="size-4" /> View readiness
            </Link>
          </Button>
        </CardContent>
      </Card>

      {/* Topic Breakdown Card */}
      {topicStats.length > 0 && (
        <Card className="rounded-2xl border-border/70 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-bold">Topic Breakdown</CardTitle>
            <CardDescription className="text-xs">
              Performance by topic in this practice session
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {topicStats.map((item) => (
              <div key={item.topic} className="space-y-1.5">
                <div className="flex justify-between text-xs font-semibold">
                  <span className="text-foreground">{item.topic}</span>
                  <span className="text-muted-foreground">
                    {item.correct} / {item.total} ({item.percent}%)
                  </span>
                </div>
                <Progress value={item.percent} className="h-2 rounded-full" />
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Missed Questions Review */}
      <Card className="rounded-2xl border-border/70 shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-bold flex items-center gap-2">
              Review Missed Questions
              <Badge
                variant={missedAnswers.length === 0 ? "secondary" : "outline"}
                className={`text-xs ${
                  missedAnswers.length > 0 ? "border-amber-500 text-amber-600 dark:text-amber-400" : ""
                }`}
              >
                {missedAnswers.length}
              </Badge>
            </CardTitle>
          </div>
          <CardDescription className="text-xs">
            Review detailed explanations to turn weaknesses into strengths
          </CardDescription>
        </CardHeader>
        <CardContent>
          {missedAnswers.length === 0 ? (
            <div className="py-6 text-center space-y-2">
              <CheckCircle2 className="size-8 mx-auto text-emerald-500" />
              <p className="text-sm font-semibold text-foreground">Flawless run!</p>
              <p className="text-xs text-muted-foreground">
                You got every single question right in this session.
              </p>
            </div>
          ) : (
            <Accordion type="single" collapsible className="w-full space-y-2">
              {missedAnswers.map((item, idx) => {
                const q = item.question;
                if (!q) return null;

                const options = (q.options as Array<{ id: string; text: string }>) || [];
                const chosenOption = options.find((o) => item.chosen_ids.includes(o.id));
                const correctOption = options.find((o) => q.correct_ids.includes(o.id));

                return (
                  <AccordionItem
                    key={item.id}
                    value={item.id}
                    className="border border-border/60 rounded-xl px-4 py-1"
                  >
                    <AccordionTrigger className="text-left text-sm font-semibold hover:no-underline gap-3">
                      <div className="flex items-start gap-2">
                        <AlertTriangle className="size-4 text-amber-500 shrink-0 mt-0.5" />
                        <span className="line-clamp-2">{q.stem}</span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="pt-2 pb-4 space-y-3 text-xs leading-relaxed">
                      {/* Options comparison */}
                      <div className="space-y-2">
                        {chosenOption && (
                          <div className="p-2.5 rounded-lg border border-amber-500/30 bg-amber-500/10 text-amber-950 dark:text-amber-200">
                            <span className="font-bold">Your answer: </span>
                            {chosenOption.text}
                          </div>
                        )}
                        {correctOption && (
                          <div className="p-2.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-emerald-950 dark:text-emerald-200">
                            <span className="font-bold">Correct answer: </span>
                            {correctOption.text}
                          </div>
                        )}
                      </div>

                      {/* Explanation */}
                      <div className="text-muted-foreground pt-1">
                        <span className="font-bold text-foreground">Explanation: </span>
                        {q.explanation}
                      </div>

                      {/* Memory Hook */}
                      {q.memory_hook && (
                        <div className="p-2.5 rounded-lg bg-background border border-border/60 flex items-start gap-2">
                          <span>💡</span>
                          <div>
                            <span className="font-semibold text-foreground">Memory hook: </span>
                            {q.memory_hook}
                          </div>
                        </div>
                      )}
                    </AccordionContent>
                  </AccordionItem>
                );
              })}
            </Accordion>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
