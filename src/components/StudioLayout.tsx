import type { ReactNode } from "react";
import type { JobWithUrl } from "./JobCard";
import { JobCard } from "./JobCard";

export function StudioLayout({
  title,
  subtitle,
  form,
  jobs,
  onReuse,
  emptyText,
}: {
  title: string;
  subtitle: string;
  form: ReactNode;
  jobs: JobWithUrl[] | undefined;
  onReuse?: (job: JobWithUrl) => void;
  emptyText: string;
}) {
  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>
      </div>
      <div className="grid lg:grid-cols-[380px_1fr] gap-6 items-start">
        <div className="rounded-xl border bg-card p-4 space-y-4 lg:sticky lg:top-6">
          {form}
        </div>
        <div className="space-y-4">
          {jobs === undefined ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : jobs.length === 0 ? (
            <div className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
              {emptyText}
            </div>
          ) : (
            <div className="grid md:grid-cols-2 gap-4">
              {jobs.map(job => (
                <JobCard key={job._id} job={job} onReuse={onReuse} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
