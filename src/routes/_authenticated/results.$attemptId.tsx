import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/results/$attemptId")({
  component: ResultsStub,
});

function ResultsStub() {
  return (
    <div className="py-10 text-sm text-muted-foreground">
      Results are being set up. Check back shortly.
    </div>
  );
}
