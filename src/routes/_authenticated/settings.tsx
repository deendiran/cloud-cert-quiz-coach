import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/settings")({
  component: SettingsStub,
});

function SettingsStub() {
  return (
    <div className="py-10 text-sm text-muted-foreground">
      Settings are being set up. Check back shortly.
    </div>
  );
}
