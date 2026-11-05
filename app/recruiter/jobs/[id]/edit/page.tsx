"use client";

import { useParams } from "next/navigation";
import { getJob } from "@/lib/api";
import { JobForm } from "@/components/app/job-form";
import { ErrorState, Loading, PageHeader, useAsync } from "@/components/app/states";

export default function EditJob() {
  const { id } = useParams<{ id: string }>();
  const { data: job, error, loading, reload } = useAsync(() => getJob(id), [id]);
  if (loading) return <Loading />;
  if (error || !job) return <ErrorState message={error ?? "Job not found"} onRetry={reload} />;
  return (
    <>
      <PageHeader title={`Edit · ${job.title}`} />
      <JobForm job={job} />
    </>
  );
}
