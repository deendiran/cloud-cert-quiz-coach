import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, NotebookPen, Play, Trash2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useSettings, langTag } from "@/lib/settings-context";
import { friendlyDbError, shuffle } from "@/lib/quiz-helpers";
import { generateLocalQuestions } from "@/lib/fallback-questions";
import { generateQuestionsForNote } from "@/lib/server/generate-questions.functions";
import { speakSequence, speechSupported, stopSpeaking } from "@/lib/speech";

export const Route = createFileRoute("/_authenticated/notes")({
  head: () => ({
    meta: [
      { title: "Notes — Azure Quiz Coach" },
      {
        name: "description",
        content: "Paste your study notes and turn them into practice questions.",
      },
    ],
  }),
  component: NotesPage,
});

const NOTE_MIN = 80;
const NOTE_MAX = 6000;
const NOTE_COUNTS = [3, 5, 8] as const;

interface NoteRow {
  id: string;
  title: string;
  body: string;
  created_at: string;
}

function NotesPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { settings } = useSettings();

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [count, setCount] = useState<number>(5);
  const [working, setWorking] = useState<null | "ai" | "local">(null);
  const [notice, setNotice] = useState<{ tone: "info" | "warn"; text: string } | null>(null);
  const [speaking, setSpeaking] = useState(false);
  const [notePendingDelete, setNotePendingDelete] = useState<NoteRow | null>(null);

  const notesQuery = useQuery({
    queryKey: ["notes", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notes")
        .select("id, title, body, created_at")
        .order("created_at", { ascending: false });
      if (error) throw new Error(error.message);
      return (data ?? []) as NoteRow[];
    },
  });

  const noteQuestionCountsQuery = useQuery({
    queryKey: ["note-question-counts", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("questions")
        .select("note_id")
        .eq("owner_id", user!.id)
        .not("note_id", "is", null);
      if (error) throw new Error(error.message);
      const counts = new Map<string, number>();
      for (const row of data ?? []) {
        if (row.note_id) counts.set(row.note_id, (counts.get(row.note_id) ?? 0) + 1);
      }
      return counts;
    },
  });

  const notes = notesQuery.data ?? [];
  const questionCounts = noteQuestionCountsQuery.data ?? new Map<string, number>();

  const charCount = body.length;
  const valid = charCount >= NOTE_MIN && charCount <= NOTE_MAX;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!valid || !user) return;
    setNotice(null);
    setWorking("ai");
    try {
      const { data: note, error: insertError } = await supabase
        .from("notes")
        .insert({
          user_id: user.id,
          title: title.trim() || "Untitled notes",
          body,
        })
        .select("id, title, body")
        .single();
      if (insertError || !note) throw new Error(insertError?.message);

      const result = await generateQuestionsForNote({ data: { note_id: note.id, count } });
      if (result.ok) {
        setNotice({
          tone: "info",
          text: `Done — ${result.questions.length} question${result.questions.length === 1 ? "" : "s"} made from your notes. Find them under "My notes" when practising.`,
        });
      } else if (result.status === 404) {
        setNotice({ tone: "warn", text: "That note disappeared. Please try again." });
      } else if (result.reason === "daily_limit") {
        setNotice({
          tone: "warn",
          text: "You've reached today's limit of 20 AI question sets. You can try again tomorrow.",
        });
      } else {
        // 429 / 502 and other generation failures: client-side fallback.
        setWorking("local");
        const made = await generateLocalQuestions(note, count);
        if (made > 0) {
          setNotice({
            tone: "warn",
            text: `The AI helper was busy, so we used a simpler method: fill-in-the-blank questions built straight from your sentences (${made} made). Try the AI version again later.`,
          });
        } else {
          setNotice({
            tone: "warn",
            text: "We saved your note but couldn't make questions from it. Add a few more full sentences and try again.",
          });
        }
      }
      setTitle("");
      setBody("");
      await queryClient.invalidateQueries({ queryKey: ["notes"] });
      await queryClient.invalidateQueries({ queryKey: ["note-question-counts"] });
      await queryClient.invalidateQueries({ queryKey: ["notes-questions-exist"] });
    } catch (error) {
      setNotice({ tone: "warn", text: friendlyDbError(error instanceof Error ? error.message : undefined) });
    } finally {
      setWorking(null);
    }
  };

  const practiseNote = async (note: NoteRow) => {
    const { data: candidates } = await supabase
      .from("questions")
      .select("id")
      .eq("owner_id", user!.id)
      .eq("note_id", note.id);
    const pool = shuffle(candidates ?? []).slice(0, 8);
    if (pool.length === 0) {
      setNotice({ tone: "warn", text: "This note has no questions yet. Make some first." });
      return;
    }
    const { data: attempt, error } = await supabase
      .from("attempts")
      .insert({
        user_id: user!.id,
        question_count: pool.length,
        question_ids: pool.map((q) => q.id),
      })
      .select("id")
      .single();
    if (error || !attempt) return;
    navigate({ to: "/quiz/$attemptId", params: { attemptId: attempt.id } });
  };

  const deleteNote = async () => {
    if (!notePendingDelete) return;
    const noteId = notePendingDelete.id;
    setNotePendingDelete(null);
    await supabase.from("questions").delete().eq("note_id", noteId);
    await supabase.from("notes").delete().eq("id", noteId);
    await queryClient.invalidateQueries({ queryKey: ["notes"] });
    await queryClient.invalidateQueries({ queryKey: ["note-question-counts"] });
    await queryClient.invalidateQueries({ queryKey: ["notes-questions-exist"] });
  };

  const listenToNotes = () => {
    if (!speechSupported()) return;
    setSpeaking(true);
    speakSequence([body], {
      rate: settings.speech_rate,
      lang: langTag(settings.language),
      onEnd: () => setSpeaking(false),
    });
  };

  const notesWithCounts = useMemo(
    () =>
      notes.map((note) => ({
        ...note,
        questionCount: questionCounts.get(note.id) ?? 0,
      })),
    [notes, questionCounts]
  );

  return (
    <div className="space-y-6 py-8">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight text-foreground">Notes</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Paste your study notes and turn them into practice questions.
        </p>
      </div>

      <Card className="rounded-2xl">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">New questions from notes</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="note-title">Title (optional)</Label>
              <Input
                id="note-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Storage summary"
                maxLength={120}
              />
            </div>
            <div className="space-y-1.5">
              <div className="flex items-baseline justify-between">
                <Label htmlFor="note-body">Paste your notes</Label>
                <span
                  className={`text-xs ${valid ? "text-muted-foreground" : "text-incorrect-foreground"}`}
                  aria-live="polite"
                >
                  {charCount} / {NOTE_MAX} characters (min {NOTE_MIN})
                </span>
              </div>
              <Textarea
                id="note-body"
                value={body}
                onChange={(e) => setBody(e.target.value.slice(0, NOTE_MAX))}
                rows={8}
                placeholder="Paste at least a few sentences of study notes here…"
              />
            </div>

            <div>
              <p className="mb-2 text-sm font-semibold text-foreground">How many questions?</p>
              <div
                role="radiogroup"
                aria-label="Number of questions"
                className="inline-flex overflow-hidden rounded-xl border border-input"
              >
                {NOTE_COUNTS.map((value) => (
                  <button
                    key={value}
                    type="button"
                    role="radio"
                    aria-checked={count === value}
                    onClick={() => setCount(value)}
                    className={`min-h-11 px-6 text-sm font-medium transition-colors ${
                      count === value
                        ? "bg-primary text-primary-foreground"
                        : "bg-background text-foreground hover:bg-secondary"
                    }`}
                  >
                    {value}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button type="submit" disabled={!valid || working !== null}>
                {working === "ai" ? (
                  <Loader2 className="animate-spin" aria-hidden="true" />
                ) : (
                  <NotebookPen aria-hidden="true" />
                )}
                Make questions
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={listenToNotes}
                disabled={!speechSupported() || charCount === 0}
              >
                Listen to notes
              </Button>
              {speaking && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    stopSpeaking();
                    setSpeaking(false);
                  }}
                >
                  Stop
                </Button>
              )}
            </div>
            {!speechSupported() && (
              <p className="text-xs text-muted-foreground">
                Your browser doesn't support read-aloud, so listening is unavailable.
              </p>
            )}
            {working && (
              <p aria-live="polite" className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                {working === "ai"
                  ? "Writing questions from your notes…"
                  : "Building simple questions from your notes…"}
              </p>
            )}
            {notice && (
              <p
                aria-live="polite"
                className={`rounded-lg px-3 py-2 text-sm ${
                  notice.tone === "warn" ? "bg-incorrect-soft text-incorrect-foreground" : "bg-correct-soft text-correct-foreground"
                }`}
              >
                {notice.text}
              </p>
            )}
          </form>
        </CardContent>
      </Card>

      <div>
        <h2 className="text-lg font-semibold text-foreground">Your saved notes</h2>
        {notesQuery.isLoading ? (
          <div className="mt-3 space-y-2" aria-hidden="true">
            <Skeleton className="h-24 w-full rounded-2xl" />
            <Skeleton className="h-24 w-full rounded-2xl" />
          </div>
        ) : notesWithCounts.length === 0 ? (
          <Card className="mt-3 rounded-2xl">
            <CardContent className="p-6 text-sm text-muted-foreground">
              No notes yet. Paste your first set of notes above to get started.
            </CardContent>
          </Card>
        ) : (
          <div className="mt-3 space-y-3">
            {notesWithCounts.map((note) => (
              <Card key={note.id} className="rounded-2xl">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="truncate font-semibold text-foreground">{note.title}</h3>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {note.questionCount} question{note.questionCount === 1 ? "" : "s"} ·{" "}
                        {new Date(note.created_at).toLocaleDateString()}
                      </p>
                      <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                        {note.body}
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => void practiseNote(note)}
                        aria-label={`Practise ${note.title}`}
                      >
                        <Play aria-hidden="true" />
                        Practise
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setNotePendingDelete(note)}
                        aria-label={`Delete ${note.title}`}
                      >
                        <Trash2 className="text-muted-foreground" aria-hidden="true" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <AlertDialog
        open={notePendingDelete !== null}
        onOpenChange={(open) => !open && setNotePendingDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this note?</AlertDialogTitle>
            <AlertDialogDescription>
              "{notePendingDelete?.title}" and its{" "}
              {notePendingDelete ? (questionCounts.get(notePendingDelete.id) ?? 0) : 0}{" "}
              question{notePendingDelete && (questionCounts.get(notePendingDelete.id) ?? 0) === 1 ? "" : "s"} will be removed.
              This can't be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep it</AlertDialogCancel>
            <AlertDialogAction onClick={() => void deleteNote()}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
