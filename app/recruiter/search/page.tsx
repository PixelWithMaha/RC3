"use client";

import { useState } from "react";
import { Search } from "lucide-react";
import { getRecruiterJobs, searchTalent } from "@/lib/api";
import type { SearchResult } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Empty, ErrorState, Loading, PageHeader, useAction, useAsync } from "@/components/app/states";

export default function TalentSearch() {
  const jobs = useAsync(getRecruiterJobs);
  const [query, setQuery] = useState("Python developers with REST API experience");
  const [jobId, setJobId] = useState("");
  const [results, setResults] = useState<SearchResult[] | null>(null);
  const action = useAction();

  return (
    <>
      <PageHeader title="Talent search" description="Plain-language semantic search across your applicants' resumes, with the passages that matched." />
      <form className="mb-6 flex flex-wrap gap-2" onSubmit={(e) => { e.preventDefault(); action.run("s", async () => setResults(await searchTalent(query, jobId || undefined))); }}>
        <Input className="min-w-0 flex-1" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="e.g. backend engineers who have deployed with Docker" />
        <Select className="w-48" value={jobId} onChange={(e) => setJobId(e.target.value)}>
          <option value="">All my applicants</option>
          {jobs.data?.map((j) => <option key={j.id} value={j.id}>{j.title}</option>)}
        </Select>
        <Button disabled={!!action.busy || query.trim().length < 3}><Search className="h-4 w-4" /> Search</Button>
      </form>
      {action.busy && <Loading label="Embedding query and searching…" />}
      {action.error && <ErrorState message={action.error} />}
      {results?.length === 0 && <Empty title="No matches">Try different wording — search is semantic, not keyword.</Empty>}
      <div className="space-y-3">
        {results?.map((r) => (
          <div key={r.resume_id} className="rounded-xl border border-border bg-surface p-4">
            <div className="mb-2 flex items-center justify-between">
              <p className="font-medium">{r.candidate.full_name ?? r.candidate.email ?? "Candidate"}</p>
              <span className="font-mono text-xs text-matched">{Math.round(r.similarity * 100)}% match</span>
            </div>
            <div className="space-y-1.5">
              {r.evidence.map((e, i) => (
                <p key={i} className="rounded-md bg-background/60 p-2 font-mono text-xs leading-relaxed text-foreground/80">{e}</p>
              ))}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
