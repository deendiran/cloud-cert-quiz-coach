import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent } from "@/components/ui/card";

export const Route = createFileRoute("/_authenticated/practise")({
  component: PractiseStub,
});

function PractiseStub() {
  return (
    <div className="py-10">
      <h1 className="text-3xl font-extrabold tracking-tight text-foreground">
        Let's practise
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Unofficial study aid. Not affiliated with or endorsed by Microsoft.
      </p>
      <Card className="mt-6 rounded-2xl">
        <CardContent className="p-6 text-sm text-muted-foreground">
          Topics are being set up. Check back shortly.
        </CardContent>
      </Card>
    </div>
  );
}
