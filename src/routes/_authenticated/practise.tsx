import { useState, useEffect } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { BookOpen, Sparkles, Check, AlertCircle, Loader2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import type { Tables } from "@/integrations/supabase/types";

export const Route = createFileRoute("/_authenticated/practise")({
  component: PractisePage,
});

type Topic = Tables<"topics">;

export function PractisePage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [topics, setTopics] = useState<Topic[]>([]);
  const [hasNoteQuestions, setHasNoteQuestions] = useState(false);
  const [loading, setLoading] = useState(true);
  const [selectedTopicId, setSelectedTopicId] = useState<number | "all" | "notes">("all");
  const [questionCount, setQuestionCount] = useState<5 | 8 | 12>(8);
  const [starting, setStarting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        // Load topics
        const { data: topicsData, error: topicsError } = await supabase
          .from("topics")
          .select("*")
          .order("id");

        if (!topicsError && topicsData) {
          setTopics(topicsData);
        }

        // Check if user has personal questions generated from notes
        if (user) {
          const { count } = await supabase
            .from("questions")
            .select("id", { count: "exact", head: true })
            .eq("owner_id", user.id);
          if (count && count > 0) {
            setHasNoteQuestions(true);
          }
        }
      } catch (err) {
        console.error("Failed to load topics:", err);
      } finally {
        setLoading(false);
      }
    }

    void loadData();
  }, [user]);

  const handleStartQuiz = async () => {
    if (!user) return;
    setErrorMsg(null);
    setStarting(true);

    try {
      let query = supabase.from("questions").select("*");

      if (selectedTopicId === "notes") {
        query = query.eq("owner_id", user.id);
      } else if (selectedTopicId === "all") {
        // Built-in published questions OR user's own questions
        query = query.or(`is_published.eq.true,owner_id.eq.${user.id}`);
      } else {
        // Specific topic
        query = query.eq("topic_id", selectedTopicId).eq("is_published", true);
      }

      const { data: questions, error } = await query;

      if (error) {
        throw error;
      }

      if (!questions || questions.length === 0) {
        setErrorMsg(
          selectedTopicId === "notes"
            ? "You haven't generated any questions from notes yet. Visit Notes to create some!"
            : "No practice questions found for this topic yet. Please select 'All topics' or another topic."
        );
        setStarting(false);
        return;
      }

      // Shuffle using Fisher-Yates
      const shuffled = [...questions];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        const current = shuffled[i];
        const target = shuffled[j];
        if (current !== undefined && target !== undefined) {
          shuffled[i] = target;
          shuffled[j] = current;
        }
      }

      const chosenQuestions = shuffled.slice(0, questionCount);

      // Create an attempt record
      const { data: attempt, error: attemptError } = await supabase
        .from("attempts")
        .insert({
          user_id: user.id,
          question_count: chosenQuestions.length,
          score: 0,
        })
        .select()
        .single();

      if (attemptError || !attempt) {
        throw attemptError || new Error("Failed to create quiz attempt");
      }

      // Cache selected questions for this attempt in sessionStorage for instant retrieval
      try {
        sessionStorage.setItem(
          `quiz_${attempt.id}_questions`,
          JSON.stringify(chosenQuestions)
        );
      } catch {
        // Ignore storage quotas
      }

      // Navigate to the quiz runner
      await navigate({
        to: `/quiz/${attempt.id}`,
      });
    } catch (err) {
      console.error("Failed to start quiz:", err);
      setErrorMsg("Failed to start quiz. Please check your connection and try again.");
      setStarting(false);
    }
  };

  return (
    <div className="py-8 space-y-6">
      {/* Page Title & Compliance Disclaimer */}
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight text-foreground">
          Let's practise
        </h1>
        <p className="mt-1 text-xs text-muted-foreground">
          Unofficial study aid. Not affiliated with or endorsed by Microsoft.
        </p>
      </div>

      {errorMsg && (
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertDescription>{errorMsg}</AlertDescription>
        </Alert>
      )}

      {/* Topic selection card */}
      <Card className="rounded-2xl border-border/60 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-bold flex items-center gap-2">
            <BookOpen className="size-5 text-primary" />
            1. Select Topic
          </CardTitle>
          <CardDescription>
            Choose a domain to focus on, or test yourself across all topics.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> Loading topics…
            </div>
          ) : (
            <div className="flex flex-wrap gap-2 pt-1">
              {/* All topics chip */}
              <button
                type="button"
                onClick={() => setSelectedTopicId("all")}
                className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-medium transition-all ${
                  selectedTopicId === "all"
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "bg-secondary text-secondary-foreground hover:bg-secondary/80 border border-transparent"
                }`}
              >
                {selectedTopicId === "all" && <Check className="size-3.5" />}
                All topics
              </button>

              {/* Individual topics */}
              {topics.map((t) => {
                const active = selectedTopicId === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setSelectedTopicId(t.id)}
                    className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-medium transition-all ${
                      active
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "bg-secondary text-secondary-foreground hover:bg-secondary/80 border border-transparent"
                    }`}
                  >
                    {active && <Check className="size-3.5" />}
                    {t.name}
                  </button>
                );
              })}

              {/* User note questions chip */}
              {hasNoteQuestions && (
                <button
                  type="button"
                  onClick={() => setSelectedTopicId("notes")}
                  className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-medium transition-all ${
                    selectedTopicId === "notes"
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "bg-secondary text-secondary-foreground hover:bg-secondary/80 border border-transparent"
                  }`}
                >
                  <Sparkles className="size-3.5 text-amber-500" />
                  {selectedTopicId === "notes" && <Check className="size-3.5" />}
                  From my notes
                </button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Question count selector card */}
      <Card className="rounded-2xl border-border/60 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-bold">2. Question Count</CardTitle>
          <CardDescription>
            Choose how many questions you want to practise in this session.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-3">
            {([5, 8, 12] as const).map((count) => {
              const active = questionCount === count;
              return (
                <button
                  key={count}
                  type="button"
                  onClick={() => setQuestionCount(count)}
                  className={`flex flex-col items-center justify-center py-3.5 px-4 rounded-xl border text-center transition-all ${
                    active
                      ? "border-primary bg-primary/10 text-primary font-bold shadow-sm"
                      : "border-border hover:bg-muted/50 text-foreground font-medium"
                  }`}
                >
                  <span className="text-xl">{count}</span>
                  <span className="text-xs text-muted-foreground mt-0.5">questions</span>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Start quiz action */}
      <div className="pt-2">
        <Button
          size="lg"
          onClick={handleStartQuiz}
          disabled={starting || loading}
          className="w-full h-12 rounded-xl text-base font-semibold shadow-md transition-all"
        >
          {starting ? (
            <>
              <Loader2 className="mr-2 size-5 animate-spin" /> Preparing quiz…
            </>
          ) : (
            "Start quiz"
          )}
        </Button>
      </div>
    </div>
  );
}
