"use client";

import { useState } from "react";
import { Search, Sparkles } from "lucide-react";
import { getRecruiterJobs, searchTalent } from "@/lib/api";
import type { SearchResult } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Avatar, Hero, ScoreRing, Skeleton, stagger } from "@/components/app/kit";
import { Empty, ErrorState, useAction, useAsync } from "@/components/app/states";

const EXAMPLES = ["Python developers with REST API experience", "Engineers who deployed with Docker", "React developers who write tests", "SQL and dashboard experience"];
const STOP = new Set(["with", "and", "the", "who", "for", "experience", "developers", "developer", "engineers", "have"]);

export default function TalentSearch() {
  const jobs = useAsync(getRecruiterJobs);
  const [query, setQuery] = useState(EXAMPLES[0]);
  const [jobId, setJobId] = useState("");
  const [results, setResults] = useState<SearchResult[] | null>(null);
  const action = useAction();
  const run = (q = query) => action.run("s", async () => setResults(await searchTalent(q, jobId || undefined)));
  const terms = query.toLowerCase().split(/\W+/).filter((t) => t.length > 2 && !STOP.has(t));

  return (
    <>
      <Hero eyebrow="Semantic search" title="Talent search" art="search"
        description="Ask in plain language. Resume passages are embedded, so “REST API” also finds “Flask endpoints” — with the matching evidence." />
      <form className="flex flex-wrap gap-2" onSubmit={(e) => { e.preventDefault(); run(); }}>
        <div className="relative min-w-[260px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-primary" />
          <Input className="h-11 pl-9 text-base" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search query" />
        </div>
        <Select className="h-11 w-52" value={jobId} onChange={(e) => setJobId(e.target.value)} aria-label="Limit to job">
          <option value="">All my applicants</option>
          {jobs.data?.map((j) => <option key={j.id} value={j.id}>{j.title}</option>)}
        </Select>
        <Button className="h-11" disabled={!!action.busy || query.trim().length < 3}><Sparkles className="h-4 w-4" /> Search</Button>
      </form>
      <div className="mb-6 mt-3 flex flex-wrap gap-1.5">
        {EXAMPLES.map((e) => (
          <button key={e} type="button" onClick={() => { setQuery(e); run(e); }} className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground transition-colors hover:border-primary hover:text-primary">{e}</button>
        ))}
      </div>
      {action.busy && <div className="space-y-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-28" />)}</div>}
      {action.error && <ErrorState message={action.error} />}
      {!action.busy && results?.length === 0 && <Empty art="search" title="No matches">Try different wording — search is by meaning, not keywords.</Empty>}
      <div className="space-y-3">
        {!action.busy && results?.map((r, i) => (
          <div key={r.resume_id} style={stagger(i)} className="dash-card flex gap-4 rounded-2xl border border-border bg-surface p-4">
            <ScoreRing value={r.similarity * 100} size={58} stroke={6} label="match" />
            <div className="min-w-0 flex-1">
              <div className="mb-2 flex items-center gap-2">
                <Avatar name={r.candidate.full_name ?? r.candidate.email} size={28} />
                <p className="font-medium">{r.candidate.full_name ?? r.candidate.email ?? "Candidate"}</p>
              </div>
              <div className="space-y-1.5">
                {r.evidence.map((e, j) => <p key={j} className="rounded-lg bg-background/60 p-2 font-mono text-xs leading-relaxed text-foreground/80"><Marked text={e} terms={terms} /></p>)}
              </div>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

function Marked({ text, terms }: { text: string; terms: string[] }) {
  if (!terms.length) return <>{text}</>;
  const re = new RegExp(`(${terms.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`, "gi");
  return <>{text.split(re).map((part, i) => (i % 2 ? <mark key={i} className="rounded bg-matched/25 px-0.5 text-matched">{part}</mark> : part))}</>;
}
