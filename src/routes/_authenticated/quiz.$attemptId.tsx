import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/quiz/$attemptId")({
  component: QuizStub,
});

function QuizStub() {
  return (
    <div className="py-10 text-sm text-muted-foreground">
      Quiz is being set up. Check back shortly.
    </div>
  );
}
