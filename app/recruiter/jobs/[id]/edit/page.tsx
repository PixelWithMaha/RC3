"use client";

import { useParams } from "next/navigation";
import { getJob } from "@/lib/api";
import { JobForm } from "@/components/app/job-form";
import { ErrorState, Loading, useAsync } from "@/components/app/states";
import { Hero } from "@/components/app/kit";

export default function EditJob() {
  const { id } = useParams<{ id: string }>();
  const { data: job, error, loading, reload } = useAsync(() => getJob(id), [id]);
  if (loading) return <Loading />;
  if (error || !job) return <ErrorState message={error ?? "Job not found"} onRetry={reload} />;
  return (
    <>
      <Hero eyebrow="Edit job" title={job.title} description="Changing skills or the description re-computes the job embedding." art="jobs" />
      <JobForm job={job} />
    </>
  );
}
