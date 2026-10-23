import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/readiness")({
  component: ReadinessStub,
});

function ReadinessStub() {
  return (
    <div className="py-10 text-sm text-muted-foreground">
      Readiness is being set up. Check back shortly.
    </div>
  );
}
