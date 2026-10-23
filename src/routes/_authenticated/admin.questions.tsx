import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Pencil, Plus, Search, Trash2 } from "lucide-react";
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
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { friendlyDbError } from "@/lib/quiz-helpers";

export const Route = createFileRoute("/_authenticated/admin/questions")({
  head: () => ({
    meta: [
      { title: "Manage questions — Azure Quiz Coach" },
      {
        name: "description",
        content: "Admin view to create, edit, publish and delete built-in questions.",
      },
    ],
  }),
  component: AdminQuestionsPage,
});

interface AdminQuestion {
  id: string;
  topic_id: number | null;
  stem: string;
  options: { id: string; text: string }[];
  correct_ids: string[];
  explanation: string;
  memory_hook: string | null;
  hint: string | null;
  difficulty: number;
  is_published: boolean;
}

interface QuestionDraft {
  topic_id: string;
  stem: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  correct: string;
  explanation: string;
  memory_hook: string;
  hint: string;
  difficulty: number;
  is_published: boolean;
}

const emptyDraft: QuestionDraft = {
  topic_id: "1",
  stem: "",
  optionA: "",
  optionB: "",
  optionC: "",
  optionD: "",
  correct: "a",
  explanation: "",
  memory_hook: "",
  hint: "",
  difficulty: 2,
  is_published: false,
};

function draftFromQuestion(question: AdminQuestion): QuestionDraft {
  const text = (id: string) => question.options.find((o) => o.id === id)?.text ?? "";
  return {
    topic_id: String(question.topic_id ?? 1),
    stem: question.stem,
    optionA: text("a"),
    optionB: text("b"),
    optionC: text("c"),
    optionD: text("d"),
    correct: question.correct_ids[0] ?? "a",
    explanation: question.explanation,
    memory_hook: question.memory_hook ?? "",
    hint: question.hint ?? "",
    difficulty: question.difficulty,
    is_published: question.is_published,
  };
}

function AdminQuestionsPage() {
  const { isAdmin, user } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<{ mode: "create" | "edit"; id?: string; draft: QuestionDraft } | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<AdminQuestion | null>(null);

  const questionsQuery = useQuery({
    queryKey: ["admin-questions"],
    enabled: isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("questions")
        .select(
          "id, topic_id, stem, options, correct_ids, explanation, memory_hook, hint, difficulty, is_published"
        )
        .is("owner_id", null)
        .order("created_at", { ascending: false });
      if (error) throw new Error(error.message);
      return (data ?? []) as AdminQuestion[];
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

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return questionsQuery.data ?? [];
    return (questionsQuery.data ?? []).filter(
      (q) =>
        q.stem.toLowerCase().includes(term) ||
        q.explanation.toLowerCase().includes(term) ||
        (topicNames.get(q.topic_id ?? -1) ?? "").toLowerCase().includes(term)
    );
  }, [questionsQuery.data, search, topicNames]);

  if (!isAdmin) {
    return (
      <div className="py-12">
        <Card className="rounded-2xl">
          <CardContent className="p-10 text-center">
            <h1 className="text-xl font-semibold text-foreground">Admins only</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              You don't have access to question management. If you believe this
              is a mistake, ask an administrator to grant the admin role.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const validateDraft = (draft: QuestionDraft): string | null => {
    if (draft.stem.trim().length < 8) return "The question stem is too short.";
    const options = [draft.optionA, draft.optionB, draft.optionC, draft.optionD].filter(
      (o) => o.trim().length > 0
    );
    if (options.length < 3) return "Fill in at least three answer options.";
    const texts = options.map((o) => o.trim().toLowerCase());
    if (new Set(texts).size !== texts.length) return "Answer options must be different from each other.";
    if (draft.correct === "d" && !draft.optionD.trim()) return "The correct option D has no text.";
    if (draft.explanation.trim().length < 10) return "Write an explanation (at least a sentence).";
    return null;
  };

  const save = async () => {
    if (!editing) return;
    const problem = validateDraft(editing.draft);
    if (problem) {
      setFormError(problem);
      return;
    }
    setSaving(true);
    setFormError(null);
    const draft = editing.draft;
    const options = [
      { id: "a", text: draft.optionA.trim() },
      { id: "b", text: draft.optionB.trim() },
      { id: "c", text: draft.optionC.trim() },
      ...(draft.optionD.trim() ? [{ id: "d", text: draft.optionD.trim() }] : []),
    ];
    const row = {
      owner_id: null,
      topic_id: Number(draft.topic_id),
      stem: draft.stem.trim(),
      options,
      correct_ids: [draft.correct],
      explanation: draft.explanation.trim(),
      memory_hook: draft.memory_hook.trim() || null,
      hint: draft.hint.trim() || null,
      difficulty: draft.difficulty,
      is_published: draft.is_published,
    };
    try {
      if (editing.mode === "create") {
        const { error } = await supabase.from("questions").insert(row);
        if (error) throw new Error(error.message);
      } else {
        const { error } = await supabase
          .from("questions")
          .update(row)
          .eq("id", editing.id!);
        if (error) throw new Error(error.message);
      }
      setEditing(null);
      await queryClient.invalidateQueries({ queryKey: ["admin-questions"] });
    } catch (error) {
      setFormError(friendlyDbError(error instanceof Error ? error.message : undefined));
    } finally {
      setSaving(false);
    }
  };

  const togglePublished = async (question: AdminQuestion, value: boolean) => {
    const { error } = await supabase
      .from("questions")
      .update({ is_published: value })
      .eq("id", question.id);
    if (!error) {
      await queryClient.invalidateQueries({ queryKey: ["admin-questions"] });
    }
  };

  const deleteQuestion = async () => {
    if (!pendingDelete) return;
    const id = pendingDelete.id;
    setPendingDelete(null);
    await supabase.from("questions").delete().eq("id", id);
    await queryClient.invalidateQueries({ queryKey: ["admin-questions"] });
  };

  return (
    <div className="space-y-6 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-foreground">
            Manage questions
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Built-in questions learners practise. Unpublished ones stay hidden.
          </p>
        </div>
        <Button onClick={() => setEditing({ mode: "create", draft: emptyDraft })}>
          <Plus aria-hidden="true" />
          New question
        </Button>
      </div>

      <div className="relative">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
        <Input
          className="pl-9"
          placeholder="Search stems, explanations or topics…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Search questions"
        />
      </div>

      {questionsQuery.isLoading ? (
        <div className="space-y-2" aria-hidden="true">
          {Array.from({ length: 5 }).map((_, index) => (
            <Skeleton key={index} className="h-14 w-full rounded-xl" />
          ))}
        </div>
      ) : questionsQuery.isError ? (
        <p className="text-sm text-incorrect-foreground">
          {friendlyDbError(questionsQuery.error.message)}
        </p>
      ) : filtered.length === 0 ? (
        <Card className="rounded-2xl">
          <CardContent className="p-6 text-sm text-muted-foreground">
            {search ? "No questions match that search." : "No built-in questions yet — create the first one."}
          </CardContent>
        </Card>
      ) : (
        <Card className="rounded-2xl">
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[45%]">Question</TableHead>
                  <TableHead>Topic</TableHead>
                  <TableHead>Published</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((question) => (
                  <TableRow key={question.id}>
                    <TableCell className="max-w-md">
                      <p className="truncate text-sm font-medium text-foreground">
                        {question.stem}
                      </p>
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">
                        {question.explanation}
                      </p>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {topicNames.get(question.topic_id ?? -1) ?? "—"}
                    </TableCell>
                    <TableCell>
                      <Switch
                        checked={question.is_published}
                        onCheckedChange={(value) => void togglePublished(question, value)}
                        aria-label={`Publish ${question.stem}`}
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          aria-label={`Edit ${question.stem}`}
                          onClick={() =>
                            setEditing({
                              mode: "edit",
                              id: question.id,
                              draft: draftFromQuestion(question),
                            })
                          }
                        >
                          <Pencil className="text-muted-foreground" aria-hidden="true" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          aria-label={`Delete ${question.stem}`}
                          onClick={() => setPendingDelete(question)}
                        >
                          <Trash2 className="text-muted-foreground" aria-hidden="true" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Dialog
        open={editing !== null}
        onOpenChange={(open) => !open && setEditing(null)}
      >
        <DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editing?.mode === "create" ? "New question" : "Edit question"}
            </DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Topic</Label>
                  <Select
                    value={editing.draft.topic_id}
                    onValueChange={(value) =>
                      setEditing({ ...editing, draft: { ...editing.draft, topic_id: value } })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(topicsQuery.data ?? []).map((topic) => (
                        <SelectItem key={topic.id} value={String(topic.id)}>
                          {topic.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Difficulty (1-3)</Label>
                  <Input
                    type="number"
                    min={1}
                    max={3}
                    value={editing.draft.difficulty}
                    onChange={(e) =>
                      setEditing({
                        ...editing,
                        draft: { ...editing.draft, difficulty: Number(e.target.value) || 2 },
                      })
                    }
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="q-stem">Question</Label>
                <Textarea
                  id="q-stem"
                  rows={2}
                  value={editing.draft.stem}
                  onChange={(e) =>
                    setEditing({ ...editing, draft: { ...editing.draft, stem: e.target.value } })
                  }
                />
              </div>
              {(["a", "b", "c", "d"] as const).map((letter) => {
                const key = `option${letter.toUpperCase()}` as keyof QuestionDraft;
                return (
                  <div key={letter} className="space-y-1.5">
                    <Label htmlFor={`q-option-${letter}`}>
                      Option {letter.toUpperCase()}
                      {letter === "d" ? " (optional)" : ""}
                    </Label>
                    <div className="flex items-center gap-2">
                      <Input
                        id={`q-option-${letter}`}
                        value={editing.draft[key] as string}
                        onChange={(e) =>
                          setEditing({
                            ...editing,
                            draft: { ...editing.draft, [key]: e.target.value },
                          })
                        }
                      />
                      <label className="flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
                        <input
                          type="radio"
                          name="correct-option"
                          checked={editing.draft.correct === letter}
                          onChange={() =>
                            setEditing({ ...editing, draft: { ...editing.draft, correct: letter } })
                          }
                          aria-label={`Mark option ${letter.toUpperCase()} correct`}
                        />
                        correct
                      </label>
                    </div>
                  </div>
                );
              })}
              <div className="space-y-1.5">
                <Label htmlFor="q-explanation">Explanation</Label>
                <Textarea
                  id="q-explanation"
                  rows={3}
                  value={editing.draft.explanation}
                  onChange={(e) =>
                    setEditing({ ...editing, draft: { ...editing.draft, explanation: e.target.value } })
                  }
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="q-hook">Memory hook (optional)</Label>
                  <Input
                    id="q-hook"
                    value={editing.draft.memory_hook}
                    onChange={(e) =>
                      setEditing({ ...editing, draft: { ...editing.draft, memory_hook: e.target.value } })
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="q-hint">Hint (optional)</Label>
                  <Input
                    id="q-hint"
                    value={editing.draft.hint}
                    onChange={(e) =>
                      setEditing({ ...editing, draft: { ...editing.draft, hint: e.target.value } })
                    }
                  />
                </div>
              </div>
              <div className="flex items-center justify-between rounded-xl border p-3">
                <div>
                  <p className="text-sm font-medium text-foreground">Published</p>
                  <p className="text-xs text-muted-foreground">
                    Learners only see published questions.
                  </p>
                </div>
                <Switch
                  checked={editing.draft.is_published}
                  onCheckedChange={(value) =>
                    setEditing({ ...editing, draft: { ...editing.draft, is_published: value } })
                  }
                  aria-label="Published"
                />
              </div>
              {formError && (
                <p role="alert" className="rounded-lg bg-incorrect-soft px-3 py-2 text-sm text-incorrect-foreground">
                  {formError}
                </p>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button onClick={() => void save()} disabled={saving}>
              {saving && <Loader2 className="animate-spin" aria-hidden="true" />}
              Save question
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => !open && setPendingDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this question?</AlertDialogTitle>
            <AlertDialogDescription>
              "{pendingDelete?.stem}" will be permanently removed. This can't be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep it</AlertDialogCancel>
            <AlertDialogAction onClick={() => void deleteQuestion()}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
