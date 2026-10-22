import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useMemo } from "react";
import {
  Sparkles,
  ArrowRight,
  TrendingUp,
  Target,
  Award,
  Layers,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  Clock,
} from "lucide-react";
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/_authenticated/readiness")({
  component: ReadinessPage,
});

interface ReadinessRow {
  user_id: string;
  topic: string | null;
  is_correct: boolean;
  w: number | null;
  answered_at: string;
}

interface TopicStat {
  topic: string;
  score: number;
  coverage: number;
  adjusted: number;
  answers: number;
  correctCount: number;
}

interface DailyAccuracy {
  date: string;
  label: string;
  accuracy: number;
  total: number;
}

function CircularGauge({ score, label }: { score: number; label: "Ready" | "Almost" | "Needs work" }) {
  const radius = 64;
  const stroke = 12;
  const normalizedRadius = radius - stroke * 2;
  const circumference = normalizedRadius * 2 * Math.PI;
  const strokeDashoffset = circumference - (score / 100) * circumference;

  const colorClass =
    label === "Ready"
      ? "text-emerald-500 stroke-emerald-500"
      : label === "Almost"
      ? "text-sky-500 stroke-sky-500"
      : "text-amber-500 stroke-amber-500";

  const badgeVariant =
    label === "Ready"
      ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
      : label === "Almost"
      ? "bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20"
      : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20";

  return (
    <div className="flex flex-col items-center justify-center p-4">
      <div className="relative flex items-center justify-center">
        <svg height={radius * 2} width={radius * 2} className="-rotate-90 transform">
          {/* Background circle */}
          <circle
            stroke="currentColor"
            fill="transparent"
            strokeWidth={stroke}
            className="text-muted/30"
            r={normalizedRadius}
            cx={radius}
            cy={radius}
          />
          {/* Progress circle */}
          <circle
            stroke="currentColor"
            fill="transparent"
            strokeWidth={stroke}
            strokeDasharray={`${circumference} ${circumference}`}
            style={{ strokeDashoffset, transition: "stroke-dashoffset 0.8s ease-in-out" }}
            strokeLinecap="round"
            className={colorClass}
            r={normalizedRadius}
            cx={radius}
            cy={radius}
          />
        </svg>

        {/* Value in the center */}
        <div className="absolute flex flex-col items-center justify-center text-center">
          <span className="text-3xl font-extrabold tracking-tight text-foreground">{score}%</span>
          <span className="text-[11px] font-medium text-muted-foreground">Readiness</span>
        </div>
      </div>

      <div className={`mt-3 inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${badgeVariant}`}>
        {label === "Ready" ? (
          <CheckCircle2 className="size-3.5" />
        ) : label === "Almost" ? (
          <Clock className="size-3.5" />
        ) : (
          <AlertTriangle className="size-3.5" />
        )}
        <span>{label} {label === "Ready" ? "(80+)" : label === "Almost" ? "(60-79)" : "(below 60)"}</span>
      </div>
    </div>
  );
}

function ReadinessPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState<ReadinessRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadReadiness() {
      if (!user) return;
      try {
        setLoading(true);
        const { data: rows, error } = await supabase
          .from("readiness_inputs")
          .select("*")
          .eq("user_id", user.id)
          .order("answered_at", { ascending: true });

        if (!error && rows) {
          setData(rows as ReadinessRow[]);
        }
      } catch (err) {
        console.error("Error loading readiness inputs:", err);
      } finally {
        setLoading(false);
      }
    }

    void loadReadiness();
  }, [user]);

  // Topic metrics calculation based on specified formula
  const { topicStats, overallScore, readinessLabel, lowestTopic, dailyData } = useMemo(() => {
    if (data.length === 0) {
      return {
        topicStats: [],
        overallScore: 0,
        readinessLabel: "Needs work" as const,
        lowestTopic: null,
        dailyData: [],
      };
    }

    // 1. Group by topic
    const grouped = new Map<string, ReadinessRow[]>();
    data.forEach((row) => {
      const topicName = (row.topic && row.topic.trim()) || "General Azure";
      const list = grouped.get(topicName) || [];
      list.push(row);
      grouped.set(topicName, list);
    });

    const stats: TopicStat[] = [];
    grouped.forEach((rows, topic) => {
      let sumWCorrect = 0;
      let sumWTotal = 0;
      let correctCount = 0;

      rows.forEach((r) => {
        const w = typeof r.w === "number" && !isNaN(r.w) ? r.w : 1;
        sumWTotal += w;
        if (r.is_correct) {
          sumWCorrect += w;
          correctCount += 1;
        }
      });

      // score = sum(w for correct) / sum(w) * 100
      const score = sumWTotal > 0 ? (sumWCorrect / sumWTotal) * 100 : 0;
      // coverage = min(1, answers / 8)
      const coverage = Math.min(1, rows.length / 8);
      // adjusted = score * (0.6 + 0.4 * coverage)
      const adjusted = score * (0.6 + 0.4 * coverage);

      stats.push({
        topic,
        score: Math.round(score),
        coverage,
        adjusted: Math.round(adjusted),
        answers: rows.length,
        correctCount,
      });
    });

    // Overall = mean of adjusted scores
    const overall =
      stats.length > 0
        ? Math.round(stats.reduce((acc, curr) => acc + curr.adjusted, 0) / stats.length)
        : 0;

    const label: "Ready" | "Almost" | "Needs work" =
      overall >= 80 ? "Ready" : overall >= 60 ? "Almost" : "Needs work";

    // Lowest topic for "Next up" recommendation
    const sorted = [...stats].sort((a, b) => a.adjusted - b.adjusted || a.coverage - b.coverage);
    const lowest = sorted[0] || null;

    // 2. 14-day daily accuracy line chart
    const dayMap = new Map<string, { correct: number; total: number }>();
    const now = new Date();
    // Pre-populate last 14 days
    for (let i = 13; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      dayMap.set(key, { correct: 0, total: 0 });
    }

    data.forEach((r) => {
      const dateKey = r.answered_at ? r.answered_at.slice(0, 10) : "";
      if (dayMap.has(dateKey)) {
        const item = dayMap.get(dateKey)!;
        item.total += 1;
        if (r.is_correct) item.correct += 1;
      }
    });

    const daily: DailyAccuracy[] = Array.from(dayMap.entries()).map(([dateStr, agg]) => {
      const dateObj = new Date(dateStr + "T00:00:00");
      const labelStr = dateObj.toLocaleDateString("en-US", { month: "short", day: "numeric" });
      const acc = agg.total > 0 ? Math.round((agg.correct / agg.total) * 100) : 0;
      return {
        date: dateStr,
        label: labelStr,
        accuracy: acc,
        total: agg.total,
      };
    });

    return {
      topicStats: stats,
      overallScore: overall,
      readinessLabel: label,
      lowestTopic: lowest,
      dailyData: daily,
    };
  }, [data]);

  // Radar chart data formatted for Recharts
  const radarData = useMemo(() => {
    return topicStats.map((t) => ({
      topic: t.topic.length > 14 ? t.topic.slice(0, 12) + "…" : t.topic,
      fullTopic: t.topic,
      score: t.adjusted,
      fullMark: 100,
    }));
  }, [topicStats]);

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl space-y-6 py-6">
        <Skeleton className="h-10 w-64 rounded-xl" />
        <Skeleton className="h-5 w-96 rounded-lg" />
        <div className="grid gap-6 md:grid-cols-3">
          <Skeleton className="h-64 rounded-2xl md:col-span-1" />
          <Skeleton className="h-64 rounded-2xl md:col-span-2" />
        </div>
      </div>
    );
  }

  // Empty state if user hasn't answered questions yet
  if (data.length === 0) {
    return (
      <div className="mx-auto max-w-xl py-16 text-center">
        <div className="mx-auto flex size-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <Target className="size-8" />
        </div>
        <h2 className="mt-6 text-2xl font-bold tracking-tight text-foreground">
          No Readiness Data Yet
        </h2>
        <p className="mt-2 text-base text-muted-foreground">
          Take your first quiz to see your readiness.
        </p>
        <div className="mt-8 flex justify-center">
          <Button asChild size="lg" className="rounded-xl px-8 shadow-sm">
            <Link to="/practise">Start Practice Quiz</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-8 py-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-foreground sm:text-3xl">
          Exam Readiness
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Weighted decay scoring factoring recent accuracy and question coverage across Azure domains.
        </p>
      </div>

      {/* Top row: Gauge + Next Up Card */}
      <div className="grid gap-6 md:grid-cols-3">
        {/* Overall Circular Gauge */}
        <Card className="flex flex-col justify-between rounded-2xl border bg-card p-4 shadow-sm md:col-span-1">
          <CardHeader className="p-2 pb-0 text-center">
            <CardTitle className="text-base font-semibold">Overall Readiness</CardTitle>
            <CardDescription className="text-xs">Based on weighted topic scores</CardDescription>
          </CardHeader>
          <CardContent className="p-2">
            <CircularGauge score={overallScore} label={readinessLabel} />
          </CardContent>
          <div className="border-t border-border/50 pt-2 text-center text-[11px] text-muted-foreground">
            Target: 80%+ to be exam ready
          </div>
        </Card>

        {/* "Next Up: <lowest topic>" Card */}
        {lowestTopic && (
          <Card className="flex flex-col justify-between rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/5 via-card to-card p-6 shadow-sm md:col-span-2">
            <div>
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-primary">
                <Sparkles className="size-4" />
                <span>Recommended Focus</span>
              </div>
              <h3 className="mt-2 text-xl font-bold text-foreground">
                Next up: {lowestTopic.topic}
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Your current adjusted readiness in this topic is{" "}
                <strong className="text-foreground">{lowestTopic.adjusted}%</strong> with{" "}
                {lowestTopic.answers} question{lowestTopic.answers === 1 ? "" : "s"} answered. Boosting
                coverage here will raise your overall readiness fastest.
              </p>

              <div className="mt-4 space-y-1.5">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Topic Coverage ({lowestTopic.answers}/8 questions)</span>
                  <span>{Math.round(lowestTopic.coverage * 100)}%</span>
                </div>
                <Progress value={lowestTopic.coverage * 100} className="h-2" />
              </div>
            </div>

            <div className="mt-6 flex items-center justify-between pt-2">
              <span className="text-xs text-muted-foreground">
                Score: {lowestTopic.score}% accuracy
              </span>
              <Button
                onClick={() => void navigate({ to: "/practise" })}
                className="gap-2 rounded-xl shadow-sm"
              >
                <span>Practise this topic</span>
                <ArrowRight className="size-4" />
              </Button>
            </div>
          </Card>
        )}
      </div>

      {/* Visual Charts: Radar & 14-Day Accuracy */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Topic Radar Chart */}
        <Card className="rounded-2xl border bg-card shadow-sm">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Target className="size-4 text-primary" />
              <CardTitle className="text-base font-semibold">Readiness by Domain</CardTitle>
            </div>
            <CardDescription className="text-xs">Adjusted score per Azure topic (0–100)</CardDescription>
          </CardHeader>
          <CardContent className="h-72 w-full p-2">
            {radarData.length > 2 ? (
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={radarData} outerRadius="75%">
                  <PolarGrid stroke="var(--border)" />
                  <PolarAngleAxis
                    dataKey="topic"
                    tick={{ fill: "var(--foreground)", fontSize: 11 }}
                  />
                  <PolarRadiusAxis
                    angle={30}
                    domain={[0, 100]}
                    tick={{ fill: "var(--muted-foreground)", fontSize: 10 }}
                  />
                  <Radar
                    name="Readiness"
                    dataKey="score"
                    stroke="var(--primary)"
                    fill="var(--primary)"
                    fillOpacity={0.3}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "var(--card)",
                      borderColor: "var(--border)",
                      borderRadius: "0.75rem",
                      fontSize: "12px",
                      color: "var(--foreground)",
                    }}
                    formatter={(val: number) => [`${val}%`, "Adjusted score"]}
                  />
                </RadarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full flex-col items-center justify-center p-6 text-center text-xs text-muted-foreground">
                <Layers className="mb-2 size-8 text-muted-foreground/40" />
                <span>Answer questions across at least 3 topics to display the domain radar.</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* 14-Day Line Chart */}
        <Card className="rounded-2xl border bg-card shadow-sm">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Calendar className="size-4 text-primary" />
              <CardTitle className="text-base font-semibold">14-Day Daily Accuracy</CardTitle>
            </div>
            <CardDescription className="text-xs">
              Daily percentage of correct answers over the past two weeks
            </CardDescription>
          </CardHeader>
          <CardContent className="h-72 w-full p-2">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={dailyData} margin={{ top: 10, right: 15, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fill: "var(--muted-foreground)", fontSize: 10 }}
                  interval="preserveStartEnd"
                />
                <YAxis
                  domain={[0, 100]}
                  tick={{ fill: "var(--muted-foreground)", fontSize: 10 }}
                  tickFormatter={(val) => `${val}%`}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "var(--card)",
                    borderColor: "var(--border)",
                    borderRadius: "0.75rem",
                    fontSize: "12px",
                    color: "var(--foreground)",
                  }}
                  formatter={(val: number, name: string, item: { payload?: DailyAccuracy }) => [
                    `${val}% (${item.payload?.total ?? 0} answers)`,
                    "Daily accuracy",
                  ]}
                />
                <Line
                  type="monotone"
                  dataKey="accuracy"
                  stroke="var(--primary)"
                  strokeWidth={2.5}
                  dot={{ r: 3, fill: "var(--primary)" }}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Topic Breakdown Detailed Table/List */}
      <Card className="rounded-2xl border bg-card shadow-sm">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Award className="size-4 text-primary" />
            <CardTitle className="text-base font-semibold">Topic Mastery Breakdown</CardTitle>
          </div>
          <CardDescription className="text-xs">
            Detailed view of your weighted score and question coverage per domain
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            {topicStats.map((item) => (
              <div
                key={item.topic}
                className="flex flex-col justify-between rounded-xl border border-border/70 p-4 transition-colors hover:border-border"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-foreground">{item.topic}</span>
                    <Badge
                      variant="outline"
                      className={
                        item.adjusted >= 80
                          ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                          : item.adjusted >= 60
                          ? "border-sky-500/20 bg-sky-500/10 text-sky-600 dark:text-sky-400"
                          : "border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400"
                      }
                    >
                      {item.adjusted}% Ready
                    </Badge>
                  </div>
                  <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                    <span>Accuracy: {item.score}%</span>
                    <span>
                      {item.correctCount}/{item.answers} correct
                    </span>
                  </div>
                </div>

                <div className="mt-3 space-y-1">
                  <div className="flex justify-between text-[11px] text-muted-foreground">
                    <span>Coverage</span>
                    <span>
                      {item.answers}/8 questions ({Math.round(item.coverage * 100)}%)
                    </span>
                  </div>
                  <Progress value={item.coverage * 100} className="h-1.5" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
