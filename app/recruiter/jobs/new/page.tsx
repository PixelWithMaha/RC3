import { JobForm } from "@/components/app/job-form";
import { PageHeader } from "@/components/app/states";

export default function NewJob() {
  return (
    <>
      <PageHeader title="New job" description="Paste a description and let AI extract the requirements. You review before publishing." />
      <JobForm />
    </>
  );
}
