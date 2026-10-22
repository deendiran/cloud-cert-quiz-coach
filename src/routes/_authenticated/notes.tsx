import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/notes")({
  component: NotesStub,
});

function NotesStub() {
  return (
    <div className="py-10 text-sm text-muted-foreground">
      Notes are being set up. Check back shortly.
    </div>
  );
}
