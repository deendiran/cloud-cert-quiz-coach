import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Accessibility,
  BookOpenCheck,
  NotebookPen,
  Target,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const APP_TITLE = "Azure Quiz Coach — Unofficial exam practice";
const APP_DESCRIPTION =
  "Practise cloud exam questions, turn your own notes into quizzes, and track how ready you are — all in one calm, accessible study app.";

export const Route = createFileRoute("/")({
  component: LandingPage,
  head: () => ({
    meta: [
      { title: APP_TITLE },
      { name: "description", content: APP_DESCRIPTION },
      { property: "og:title", content: APP_TITLE },
      { property: "og:description", content: APP_DESCRIPTION },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

const features = [
  {
    icon: BookOpenCheck,
    title: "Practise by topic",
    text: "Short quizzes across cloud basics, compute, storage, networking, security and cost.",
  },
  {
    icon: NotebookPen,
    title: "Questions from your notes",
    text: "Paste your own study notes and get practice questions built from them.",
  },
  {
    icon: Target,
    title: "Readiness score",
    text: "A weighted view of how you're doing per topic, so you know what to revise next.",
  },
  {
    icon: Accessibility,
    title: "Built for every learner",
    text: "Read-aloud, large text, dyslexia-friendly font and high-contrast options.",
  },
];

function LandingPage() {
  return (
    <div className="flex flex-1 flex-col items-center px-4 py-10 sm:py-16">
      <div className="w-full max-w-3xl">
        <div className="rounded-3xl bg-primary px-6 py-12 text-center text-primary-foreground shadow-lg sm:px-12">
          <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl">
            Azure Quiz Coach
          </h1>
          <p className="mt-3 text-sm font-medium text-primary-foreground/80">
            Unofficial study aid. Not affiliated with or endorsed by Microsoft.
          </p>
          <p className="mx-auto mt-4 max-w-md text-base leading-relaxed text-primary-foreground/90">
            Practise exam-style questions, turn your own notes into quizzes, and
            see how ready you really are.
          </p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Button
              size="lg"
              variant="secondary"
              className="bg-background text-primary hover:bg-background/90"
              asChild
            >
              <Link to="/practise">Start practising</Link>
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="border-primary-foreground/40 bg-transparent text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground"
              asChild
            >
              <Link to="/auth">Sign in</Link>
            </Button>
          </div>
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {features.map((feature) => (
            <Card key={feature.title} className="rounded-2xl">
              <CardContent className="flex gap-4 p-5">
                <div className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-xl bg-secondary">
                  <feature.icon
                    className="size-5 text-secondary-foreground"
                    aria-hidden="true"
                  />
                </div>
                <div>
                  <h2 className="font-semibold text-foreground">{feature.title}</h2>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                    {feature.text}
                  </p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
