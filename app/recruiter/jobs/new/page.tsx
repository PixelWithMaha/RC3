import { JobForm } from "@/components/app/job-form";
import { Hero } from "@/components/app/kit";

export default function NewJob() {
  return (
    <>
      <Hero eyebrow="Create" title="New job" description="Paste a description and let AI extract the requirements. You review before publishing." art="jobs" />
      <JobForm />
    </>
  );
}
