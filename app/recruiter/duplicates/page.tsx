"use client";

import Link from "next/link";
import { Copy } from "lucide-react";
import { getDuplicates, resolveDuplicate, type DuplicatePair } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/app/badges";
import { Empty, ErrorState, Loading, PageHeader, useAction, useAsync } from "@/components/app/states";
import type { ApplicationStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

export default function Duplicates() {
  const { data, error, loading, reload } = useAsync(getDuplicates);
  const action = useAction();
  const pending = data?.filter((p) => p.status === "pending") ?? [];
  const resolved = data?.filter((p) => p.status !== "pending") ?? [];

  return (
    <>
      <PageHeader
        title="Duplicate applications"
        description="The same person under different accounts: matching resume email or phone, or near-identical resumes. Nothing changes until you confirm."
        actions={<Button variant="outline" onClick={reload} disabled={loading}>Re-scan</Button>}
      />
      {loading && <Loading label="Scanning applicants…" />}
      {error && <ErrorState message={error} onRetry={reload} />}
      {action.error && <ErrorState message={action.error} />}
      {data && pending.length === 0 && <Empty title="No possible duplicates">Every applicant looks unique.</Empty>}
      <div className="space-y-3">
        {pending.map((p) => (
          <Pair key={p.flag_id} p={p}>
            <Button size="sm" disabled={!!action.busy} onClick={() => action.run(p.flag_id, async () => { await resolveDuplicate(p.flag_id, "merge"); await reload(); })}>
              Confirm duplicate
            </Button>
            <Button size="sm" variant="outline" disabled={!!action.busy} onClick={() => action.run(p.flag_id, async () => { await resolveDuplicate(p.flag_id, "dismiss"); await reload(); })}>
              Not a duplicate
            </Button>
          </Pair>
        ))}
      </div>
      {resolved.length > 0 && (
        <>
          <h2 className="mb-3 mt-8 text-lg font-semibold">Resolved</h2>
          <div className="space-y-3 opacity-75">
            {resolved.map((p) => <Pair key={p.flag_id} p={p}><span className="text-sm text-muted-foreground">{p.status === "merged" ? "Confirmed — later application closed" : "Dismissed"}</span></Pair>)}
          </div>
        </>
      )}
    </>
  );
}

function Pair({ p, children }: { p: DuplicatePair; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <span className="flex items-center gap-2 text-sm font-medium text-missing"><Copy className="h-4 w-4" /> {p.reason}</span>
        <div className="flex gap-2">{children}</div>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {[p.a, p.b].map((x, i) => (
          <Link key={x.application_id} href={`/recruiter/applications/${x.application_id}`} className={cn("rounded-xl border border-border bg-background/50 p-3 text-sm hover:border-primary/60")}>
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{i === 0 ? "Earlier (kept)" : "Later"}</p>
            <p className="font-medium">{x.name ?? "Candidate"} <span className="text-muted-foreground">· {x.email}</span></p>
            <p className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">{x.job_title} · {new Date(x.created_at).toLocaleDateString()} {x.status && <StatusBadge status={x.status as ApplicationStatus} />}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
