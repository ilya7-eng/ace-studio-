import { useQuery } from "convex/react";
import { useState } from "react";
import type { JobWithUrl } from "@/components/JobCard";
import { JobCard } from "@/components/JobCard";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api } from "../../convex/_generated/api";

type Filter = "all" | "video" | "image" | "music";

export function LibraryPage() {
  const [filter, setFilter] = useState<Filter>("all");
  const jobs = useQuery(
    api.jobs.list,
    filter === "all" ? { limit: 120 } : { kind: filter, limit: 120 },
  ) as JobWithUrl[] | undefined;
  const done = jobs?.filter(j => j.status === "done") ?? [];

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Library</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Everything you have generated, with its prompt and seed, ready to
            download or reuse.
          </p>
        </div>
        <Tabs value={filter} onValueChange={v => setFilter(v as Filter)}>
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="video">Video</TabsTrigger>
            <TabsTrigger value="image">Image</TabsTrigger>
            <TabsTrigger value="music">Music</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>
      {jobs === undefined ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : done.length === 0 ? (
        <div className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
          Nothing finished yet. Renders in progress show in their studio.
        </div>
      ) : (
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
          {done.map(job => (
            <JobCard key={job._id} job={job} />
          ))}
        </div>
      )}
    </div>
  );
}
