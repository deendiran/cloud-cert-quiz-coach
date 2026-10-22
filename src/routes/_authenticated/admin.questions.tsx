import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/admin/questions")({
  component: AdminQuestionsStub,
});

function AdminQuestionsStub() {
  return (
    <div className="py-10 text-sm text-muted-foreground">
      Question management is being set up. Check back shortly.
    </div>
  );
}
