import { useState, useEffect } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  Sparkles,
  BookOpen,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Loader2,
  FileText,
  Play,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { generateFallbackQuestions } from "@/lib/fallback-generator";
import type { Tables } from "@/integrations/supabase/types";

export const Route = createFileRoute("/_authenticated/notes")({
  component: NotesPage,
});

type Note = Tables<"notes">;

interface NoteWithQuestionCount extends Note {
  question_count?: number;
}

export function NotesPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [notes, setNotes] = useState<NoteWithQuestionCount[]>([]);
  const [loading, setLoading] = useState(true);

  // Form state
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [generating, setGenerating] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{
    type: "success" | "error" | "warning";
    text: string;
    noteId?: string;
  } | null>(null);

  const charCount = body.length;
  const isValidLength = charCount >= 80 && charCount <= 6000;

  // Load user's saved notes
  const loadNotes = async () => {
    if (!user) return;
    try {
      setLoading(true);
      const { data: notesData, error: notesError } = await supabase
        .from("notes")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (notesError) throw notesError;

      if (notesData) {
        // Query question counts for each note
        const noteIds = notesData.map((n) => n.id);
        const { data: questionsData } = await supabase
          .from("questions")
          .select("note_id")
          .in("note_id", noteIds);

        const countMap = new Map<string, number>();
        (questionsData || []).forEach((q) => {
          if (q.note_id) {
            countMap.set(q.note_id, (countMap.get(q.note_id) || 0) + 1);
          }
        });

        const enriched = notesData.map((note) => ({
          ...note,
          question_count: countMap.get(note.id) || 0,
        }));

        setNotes(enriched);
      }
    } catch (err) {
      console.error("Failed to load notes:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadNotes();
  }, [user]);

  // Generate questions handler
  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !isValidLength || generating) return;

    setStatusMessage(null);
    setGenerating(true);

    try {
      const noteTitle = title.trim() || `Notes: ${body.slice(0, 30)}…`;

      // 1. Save note to database
      const { data: note, error: noteError } = await supabase
        .from("notes")
        .insert({
          user_id: user.id,
          title: noteTitle,
          body: body.trim(),
        })
        .select()
        .single();

      if (noteError || !note) {
        throw noteError || new Error("Failed to save note");
      }

      // 2. Try calling the Supabase Edge Function
      let generatedQuestionsCount = 0;
      let usedFallback = false;

      try {
        const { data: aiData, error: aiError } = await supabase.functions.invoke(
          "generate-questions",
          {
            body: {
              note_id: note.id,
              notes: body.trim(),
              count: 5,
            },
          }
        );

        if (aiError || !aiData?.questions) {
          throw aiError || new Error("AI function returned no questions");
        }

        generatedQuestionsCount = aiData.questions.length;
      } catch (fnErr) {
        console.warn("AI generation unavailable, using local generator:", fnErr);
        usedFallback = true;

        // Use local offline fallback generator
        const fallbackQs = generateFallbackQuestions(body.trim(), 5, noteTitle);

        if (fallbackQs.length > 0) {
          const insertPayload = fallbackQs.map((q) => ({
            owner_id: user.id,
            note_id: note.id,
            topic_label: `Notes: ${noteTitle}`,
            difficulty: q.difficulty,
            type: "mcq" as const,
            stem: q.stem,
            options: q.options,
            correct_ids: q.correct_ids,
            explanation: q.explanation,
            memory_hook: q.memory_hook,
            hint: q.hint,
            source: "local_generated" as const,
            is_published: false,
          }));

          const { error: insertError } = await supabase
            .from("questions")
            .insert(insertPayload);

          if (insertError) throw insertError;
          generatedQuestionsCount = fallbackQs.length;
        } else {
          throw new Error("Could not extract enough sentences to generate questions");
        }
      }

      // Success feedback
      setTitle("");
      setBody("");
      void loadNotes();

      setStatusMessage({
        type: usedFallback ? "warning" : "success",
        text: usedFallback
          ? `Generated ${generatedQuestionsCount} practice questions using the local offline generator (AI service was busy).`
          : `Successfully generated ${generatedQuestionsCount} AI practice questions!`,
        noteId: note.id,
      });
    } catch (err: any) {
      console.error("Generation error:", err);
      setStatusMessage({
        type: "error",
        text: err?.message || "Failed to generate questions. Please try again.",
      });
    } finally {
      setGenerating(false);
    }
  };

  // Delete note
  const handleDeleteNote = async (noteId: string) => {
    try {
      const { error } = await supabase.from("notes").delete().eq("id", noteId);
      if (error) throw error;
      setNotes((prev) => prev.filter((n) => n.id !== noteId));
    } catch (err) {
      console.error("Failed to delete note:", err);
    }
  };

  // Start quiz directly with this note's questions
  const handlePractiseNote = async (noteId: string) => {
    if (!user) return;
    try {
      const { data: questions, error } = await supabase
        .from("questions")
        .select("*")
        .eq("note_id", noteId);

      if (error || !questions || questions.length === 0) {
        return;
      }

      const { data: attempt, error: attemptError } = await supabase
        .from("attempts")
        .insert({
          user_id: user.id,
          question_count: questions.length,
          score: 0,
        })
        .select()
        .single();

      if (attemptError || !attempt) return;

      sessionStorage.setItem(`quiz_${attempt.id}_questions`, JSON.stringify(questions));
      await navigate({ to: `/quiz/${attempt.id}` });
    } catch (err) {
      console.error("Failed to launch quiz from note:", err);
    }
  };

  return (
    <div className="py-8 max-w-2xl mx-auto space-y-8">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight text-foreground flex items-center gap-2">
          Study Notes & AI Coach
        </h1>
        <p className="mt-1 text-xs text-muted-foreground">
          Unofficial study aid. Not affiliated with or endorsed by Microsoft.
        </p>
      </div>

      {statusMessage && (
        <Alert
          variant={statusMessage.type === "error" ? "destructive" : "default"}
          className={`rounded-xl border ${
            statusMessage.type === "success"
              ? "border-emerald-500/40 bg-emerald-50/50 dark:bg-emerald-950/20 text-emerald-950 dark:text-emerald-200"
              : statusMessage.type === "warning"
              ? "border-amber-500/40 bg-amber-50/50 dark:bg-amber-950/20 text-amber-950 dark:text-amber-200"
              : ""
          }`}
        >
          {statusMessage.type === "success" ? (
            <CheckCircle2 className="size-4 text-emerald-600 dark:text-emerald-400" />
          ) : (
            <AlertCircle className="size-4" />
          )}
          <AlertDescription className="flex items-center justify-between gap-4">
            <span>{statusMessage.text}</span>
            {statusMessage.noteId && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => handlePractiseNote(statusMessage.noteId!)}
                className="shrink-0 h-8 gap-1.5 font-semibold"
              >
                <Play className="size-3" /> Practise now
              </Button>
            )}
          </AlertDescription>
        </Alert>
      )}

      {/* Note Creation Card */}
      <Card className="rounded-2xl border-border/70 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-bold flex items-center gap-2">
            <Sparkles className="size-5 text-primary" /> Paste Notes to Generate Questions
          </CardTitle>
          <CardDescription>
            Paste your Azure study notes, architectural summaries, or documentation excerpts.
            Our AI generates 5 targeted exam-style practice questions with explanations.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleGenerate} className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="note-title" className="text-xs font-semibold text-foreground">
                Title (optional)
              </label>
              <Input
                id="note-title"
                placeholder="e.g. Virtual Networks, Blob Storage Tiers, Entra ID Roles"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                disabled={generating}
                className="rounded-xl"
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between items-center text-xs">
                <label htmlFor="note-body" className="font-semibold text-foreground">
                  Notes content
                </label>
                <span
                  className={`font-mono text-xs ${
                    charCount < 80
                      ? "text-muted-foreground"
                      : charCount > 6000
                      ? "text-destructive font-bold"
                      : "text-emerald-600 dark:text-emerald-400 font-semibold"
                  }`}
                >
                  {charCount.toLocaleString()} / 6,000 chars {charCount < 80 ? "(min 80)" : ""}
                </span>
              </div>
              <Textarea
                id="note-body"
                placeholder="Paste key concepts, bullet points, or definitions here. (Minimum 80 characters)…"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                disabled={generating}
                rows={6}
                className="rounded-xl resize-y text-sm leading-relaxed"
              />
            </div>

            <Button
              type="submit"
              size="lg"
              disabled={!isValidLength || generating}
              className="w-full rounded-xl h-11 font-semibold gap-2 shadow-sm transition-all"
            >
              {generating ? (
                <>
                  <Loader2 className="size-4 animate-spin" /> Generating questions…
                </>
              ) : (
                <>
                  <Sparkles className="size-4" /> Generate 5 Questions
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Saved Notes Section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
            <BookOpen className="size-5 text-primary" /> Your Saved Notes
          </h2>
          <Badge variant="secondary" className="text-xs">
            {notes.length} saved
          </Badge>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-8 gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Loading your notes…
          </div>
        ) : notes.length === 0 ? (
          <Card className="rounded-2xl border-dashed border-border/80 p-8 text-center">
            <FileText className="size-8 mx-auto text-muted-foreground mb-2" />
            <p className="text-sm font-semibold text-foreground">No study notes yet</p>
            <p className="text-xs text-muted-foreground mt-1">
              Paste your first set of notes above to generate tailored practice questions.
            </p>
          </Card>
        ) : (
          <div className="space-y-3">
            {notes.map((note) => (
              <Card key={note.id} className="rounded-xl border-border/70 shadow-sm">
                <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-1 flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-sm text-foreground truncate">
                        {note.title}
                      </h3>
                      {note.question_count !== undefined && note.question_count > 0 && (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">
                          {note.question_count} Qs
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2">
                      {note.body}
                    </p>
                    <span className="text-[10px] text-muted-foreground block">
                      Saved {new Date(note.created_at).toLocaleDateString()}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                    {note.question_count && note.question_count > 0 ? (
                      <Button
                        size="sm"
                        variant="default"
                        onClick={() => handlePractiseNote(note.id)}
                        className="h-8 rounded-lg gap-1.5 text-xs font-semibold"
                      >
                        <Play className="size-3" /> Practise
                      </Button>
                    ) : null}

                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => handleDeleteNote(note.id)}
                      aria-label="Delete note"
                      className="size-8 rounded-lg text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
