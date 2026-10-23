import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  PolarAngleAxis,
  PolarGrid,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Line,
  LineChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { friendlyDbError, readinessBand } from "@/lib/quiz-helpers";

export const Route = createFileRoute("/_authenticated/readiness")({
  component: ReadinessPage,
});

interface ReadinessInput {
  topic: string;
  is_correct: boolean;
  w: number;
  answered_at: string;
}

function ReadinessPage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const inputsQuery = useQuery({
    queryKey: ["readiness-inputs", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("readiness_inputs")
        .select("topic, is_correct, w, answered_at")
        .order("answered_at", { ascending: false });
      if (error) throw new Error(error.message);
      return (data ?? []) as ReadinessInput[];
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

  const inputs = inputsQuery.data ?? [];

  const perTopic = useMemo(() => {
    const map = new Map<string, { wSum: number; wCorrect: number; count: number }>();
    for (const row of inputs) {
      if (!row.topic) continue;
      const entry = map.get(row.topic) ?? { wSum: 0, wCorrect: 0, count: 0 };
      entry.wSum += Number(row.w ?? 0);
      if (row.is_correct) entry.wCorrect += Number(row.w ?? 0);
      entry.count += 1;
      map.set(row.topic, entry);
    }
    return [...map.entries()]
      .map(([topic, entry]) => {
        const score = entry.wSum === 0 ? 0 : (entry.wCorrect / entry.wSum) * 100;
        const coverage = Math.min(1, entry.count / 8);
        const adjusted = score * (0.6 + 0.4 * coverage);
        return {
          topic,
          score: Math.round(score),
          coverage,
          adjusted: Math.round(adjusted),
          count: entry.count,
        };
      })
      .sort((a, b) => a.adjusted - b.adjusted);
  }, [inputs]);

  const overall = useMemo(() => {
    if (perTopic.length === 0) return 0;
    const mean = perTopic.reduce((sum, topic) => sum + topic.adjusted, 0) / perTopic.length;
    return Math.round(mean);
  }, [perTopic]);

  const dailyAccuracy = useMemo(() => {
    const byDay = new Map<string, { correct: number; total: number }>();
    for (const row of inputs) {
      const day = new Date(row.answered_at).toISOString().slice(0, 10);
      const entry = byDay.get(day) ?? { correct: 0, total: 0 };
      entry.total += 1;
      if (row.is_correct) entry.correct += 1;
      byDay.set(day, entry);
    }
    return [...byDay.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-14)
      .map(([day, entry]) => ({
        day: day.slice(5),
        accuracy: entry.total === 0 ? 0 : Math.round((entry.correct / entry.total) * 100),
      }));
  }, [inputs]);

  const nextUpTopic = perTopic[0];
  const nextUpTopicId = nextUpTopic
    ? (topicsQuery.data ?? []).find((t) => t.name === nextUpTopic.topic)?.id
    : undefined;

  const band = readinessBand(overall);
  const gaugeRadius = 70;
  const gaugeCircumference = 2 * Math.PI * gaugeRadius;

  if (inputsQuery.isLoading) {
    return (
      <div className="space-y-4 py-8" aria-hidden="true">
        <Skeleton className="mx-auto size-56 rounded-full" />
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    );
  }

  if (inputsQuery.isError) {
    return (
      <div className="py-10">
        <Card className="rounded-2xl">
          <CardContent className="p-6 text-sm text-incorrect-foreground">
            {friendlyDbError(inputsQuery.error.message)}
          </CardContent>
        </Card>
      </div>
    );
  }

  if (inputs.length === 0) {
    return (
      <div className="py-12">
        <Card className="rounded-2xl">
          <CardContent className="p-10 text-center">
            <h1 className="text-xl font-semibold text-foreground">No data yet</h1>
            <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
              Take your first quiz to see your readiness.
            </p>
            <Button className="mt-6" onClick={() => navigate({ to: "/practise" })}>
              Start practising
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 py-8">
      <h1 className="text-3xl font-extrabold tracking-tight text-foreground">Readiness</h1>

      <Card className="rounded-2xl">
        <CardContent className="flex flex-col items-center p-6">
          <svg width="180" height="180" viewBox="0 0 180 180" role="img" aria-label={`Overall readiness ${overall} percent — ${band.label}`}>
            <circle cx="90" cy="90" r={gaugeRadius} fill="none" stroke="var(--color-muted)" strokeWidth="14" />
            <circle
              cx="90"
              cy="90"
              r={gaugeRadius}
              fill="none"
              stroke={band.color}
              strokeWidth="14"
              strokeLinecap="round"
              strokeDasharray={`${(overall / 100) * gaugeCircumference} ${gaugeCircumference}`}
              transform="rotate(-90 90 90)"
            />
            <text x="90" y="86" textAnchor="middle" className="fill-foreground" fontSize="40" fontWeight="800">
              {overall}
            </text>
            <text x="90" y="112" textAnchor="middle" className="fill-muted-foreground" fontSize="14">
              {band.label}
            </text>
          </svg>
          <p className="mt-2 text-sm text-muted-foreground">
            Weighted across {perTopic.length} topic{perTopic.length === 1 ? "" : "s"}.
          </p>
        </CardContent>
      </Card>

      <Card className="rounded-2xl">
        <CardContent className="p-5">
          <h2 className="text-sm font-semibold text-foreground">By topic</h2>
          <div className="mt-3 h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={perTopic.map((t) => ({ topic: t.topic, value: t.adjusted }))} outerRadius="75%">
                <PolarGrid stroke="var(--color-border)" />
                <PolarAngleAxis dataKey="topic" tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} />
                <Radar dataKey="value" stroke="var(--color-primary)" fill="var(--color-primary)" fillOpacity={0.25} />
                <Tooltip
                  contentStyle={{
                    background: "var(--color-card)",
                    border: "1px solid var(--color-border)",
                    borderRadius: "12px",
                    fontSize: "12px",
                  }}
                />
              </RadarChart>
            </ResponsiveContainer>
          </div>
          <ul className="mt-2 space-y-1">
            {perTopic.map((topic) => (
              <li key={topic.topic} className="flex justify-between text-xs text-muted-foreground">
                <span className="font-medium text-foreground">{topic.topic}</span>
                <span>
                  {topic.score}% accuracy · {topic.count} answer{topic.count === 1 ? "" : "s"}
                </span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card className="rounded-2xl">
        <CardContent className="p-5">
          <h2 className="text-sm font-semibold text-foreground">Daily accuracy (last 14 days)</h2>
          {dailyAccuracy.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">No daily data yet.</p>
          ) : (
            <div className="mt-3 h-48 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={dailyAccuracy}>
                  <XAxis dataKey="day" tick={{ fontSize: 10, fill: "var(--color-muted-foreground)" }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: "var(--color-muted-foreground)" }} unit="%" width={40} />
                  <Tooltip
                    formatter={(value) => [`${value}%`, "Accuracy"]}
                    contentStyle={{
                      background: "var(--color-card)",
                      border: "1px solid var(--color-border)",
                      borderRadius: "12px",
                      fontSize: "12px",
                    }}
                  />
                  <Line type="monotone" dataKey="accuracy" stroke="var(--color-primary)" strokeWidth={2} dot />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      {nextUpTopic && (
        <Card className="rounded-2xl border-primary/30 bg-secondary/40">
          <CardContent className="flex flex-col items-start gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-foreground">
                Next up: {nextUpTopic.topic}
              </p>
              <p className="text-xs text-muted-foreground">
                Your lowest topic right now — a short quiz there lifts your readiness fastest.
              </p>
            </div>
            <Button
              onClick={() =>
                nextUpTopicId
                  ? navigate({ to: "/practise", search: { topics: String(nextUpTopicId) } })
                  : navigate({ to: "/practise" })
              }
            >
              <Zap aria-hidden="true" />
              Practise this topic
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
