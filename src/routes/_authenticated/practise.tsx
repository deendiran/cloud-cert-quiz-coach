import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, NotebookPen } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/lib/auth-context";
import { friendlyDbError, shuffle } from "@/lib/quiz-helpers";

export const Route = createFileRoute("/_authenticated/practise")({
  head: () => ({
    meta: [
      { title: "Practise — Azure Quiz Coach" },
      {
        name: "description",
        content:
          "Choose your topics and quiz length, then start a practice quiz.",
      },
    ],
  }),
  validateSearch: (search: Record<string, unknown>) => ({
    topics:
      typeof search.topics === "string" && search.topics.length > 0
        ? search.topics
            .split(",")
            .map((value) => Number.parseInt(value, 10))
            .filter((value) => Number.isFinite(value))
        : undefined,
  }),
  component: PractisePage,
});

const QUIZ_LENGTHS = [5, 8, 12] as const;

function PractisePage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { search } = Route.useSearch();

  const topicsQuery = useQuery({
    queryKey: ["topics"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("topics")
        .select("id, name")
        .order("name");
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });

  const notesQuestionsQuery = useQuery({
    queryKey: ["notes-questions-exist", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { count, error } = await supabase
        .from("questions")
        .select("id", { count: "exact", head: true })
        .eq("owner_id", user!.id)
        .not("note_id", "is", null);
      if (error) throw new Error(error.message);
      return (count ?? 0) > 0;
    },
  });

  const hasNotesQuestions = notesQuestionsQuery.data === true;

  const [selectedTopicIds, setSelectedTopicIds] = useState<number[]>(
    search.topics ?? []
  );
  const [notesOnly, setNotesOnly] = useState(false);
  const [length, setLength] = useState<number>(8);
  const [starting, setStarting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const topics = topicsQuery.data ?? [];
  const noTopicSelected = selectedTopicIds.length === 0;

  const toggleTopic = (topicId: number) => {
    setNotice(null);
    setNotesOnly(false);
    setSelectedTopicIds((current) =>
      current.includes(topicId)
        ? current.filter((id) => id !== topicId)
        : [...current, topicId]
    );
  };

  const toggleNotes = () => {
    setNotice(null);
    setNotesOnly((current) => !current);
    if (!notesOnly) setSelectedTopicIds([]);
  };

  const startQuiz = async () => {
    setNotice(null);
    setStarting(true);
    try {
      let query = supabase.from("questions").select("id");
      if (notesOnly) {
        query = query
          .eq("owner_id", user!.id)
          .not("note_id", "is", null);
      } else {
        query = query.is("owner_id", null).eq("is_published", true);
        if (!noTopicSelected) query = query.in("topic_id", selectedTopicIds);
      }
      const { data: candidates, error } = await query;
      if (error) throw new Error(error.message);

      const pool = shuffle(candidates ?? []).slice(0, length);
      if (pool.length === 0) {
        setNotice(
          notesOnly
            ? "There are no questions from your notes yet. Make some from the Notes page first."
            : "No questions match that topic mix yet. Try another topic or start with all topics."
        );
        return;
      }
      if (pool.length < length) {
        setNotice(
          `Only ${pool.length} question${pool.length === 1 ? "" : "s"} available for this mix — we'll use ${pool.length === 1 ? "it" : "all of them"}.`
        );
      }

      const { data: attempt, error: attemptError } = await supabase
        .from("attempts")
        .insert({
          user_id: user!.id,
          question_count: pool.length,
          question_ids: pool.map((q) => q.id),
        })
        .select("id")
        .single();
      if (attemptError || !attempt) throw new Error(attemptError?.message);
      navigate({ to: "/quiz/$attemptId", params: { attemptId: attempt.id } });
    } catch (error) {
      setNotice(friendlyDbError(error instanceof Error ? error.message : undefined));
    } finally {
      setStarting(false);
    }
  };

  const topicChips = useMemo(
    () =>
      topics.map((topic) => ({
        ...topic,
        active: selectedTopicIds.includes(topic.id),
      })),
    [topics, selectedTopicIds]
  );

  return (
    <div className="py-8">
      <h1 className="text-3xl font-extrabold tracking-tight text-foreground">
        Let's practise
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Unofficial study aid. Not affiliated with or endorsed by Microsoft.
      </p>

      <Card className="mt-6 rounded-2xl">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Pick your topics</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {topicsQuery.isLoading ? (
            <div className="flex flex-wrap gap-2" aria-hidden="true">
              {Array.from({ length: 6 }).map((_, index) => (
                <div
                  key={index}
                  className="h-11 w-28 animate-pulse rounded-full bg-muted"
                />
              ))}
            </div>
          ) : topicsQuery.isError ? (
            <p className="text-sm text-incorrect-foreground">
              {friendlyDbError(topicsQuery.error.message)}
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {topicChips.map((chip) => (
                <button
                  key={chip.id}
                  type="button"
                  onClick={() => toggleTopic(chip.id)}
                  aria-pressed={chip.active}
                  className={`min-h-11 rounded-full border px-4 text-sm font-medium transition-colors ${
                    chip.active
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-input bg-background text-foreground hover:bg-secondary"
                  }`}
                >
                  {chip.name}
                </button>
              ))}
              {hasNotesQuestions && (
                <button
                  type="button"
                  onClick={toggleNotes}
                  aria-pressed={notesOnly}
                  className={`min-h-11 inline-flex items-center gap-1.5 rounded-full border px-4 text-sm font-medium transition-colors ${
                    notesOnly
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-input bg-background text-foreground hover:bg-secondary"
                  }`}
                >
                  <NotebookPen className="size-4" aria-hidden="true" />
                  My notes
                </button>
              )}
            </div>
          )}
          {noTopicSelected && !notesOnly && (
            <p className="text-xs text-muted-foreground">
              No topic selected — questions will come from all topics.
            </p>
          )}

          <div>
            <p className="mb-2 text-sm font-semibold text-foreground">
              How many questions?
            </p>
            <div
              role="radiogroup"
              aria-label="Number of questions"
              className="inline-flex overflow-hidden rounded-xl border border-input"
            >
              {QUIZ_LENGTHS.map((value) => (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={length === value}
                  onClick={() => setLength(value)}
                  className={`min-h-11 px-6 text-sm font-medium transition-colors ${
                    length === value
                      ? "bg-primary text-primary-foreground"
                      : "bg-background text-foreground hover:bg-secondary"
                  }`}
                >
                  {value}
                </button>
              ))}
            </div>
          </div>

          {notice && (
            <p
              aria-live="polite"
              className="rounded-lg bg-info-soft px-3 py-2 text-sm text-foreground"
            >
              {notice}
            </p>
          )}

          <Button size="lg" className="w-full" onClick={startQuiz} disabled={starting}>
            {starting && <Loader2 className="animate-spin" aria-hidden="true" />}
            Start quiz
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
