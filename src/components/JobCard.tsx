import { useMutation } from "convex/react";
import {
  Download,
  Loader2,
  RefreshCw,
  ThumbsDown,
  ThumbsUp,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { api } from "../../convex/_generated/api";
import type { Doc } from "../../convex/_generated/dataModel";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";

export type JobWithUrl = Doc<"jobs"> & {
  fileUrl: string | null;
  inputUrl: string | null;
};

function fmtTime(ts: number) {
  return new Date(ts).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function Media({ job }: { job: JobWithUrl }) {
  if (job.status === "queued" || job.status === "running") {
    const label =
      job.kind === "video"
        ? "Rendering shot (40–90 s)"
        : job.kind === "music"
          ? "Composing (1–3 min)"
          : "Generating image";
    return (
      <div className="aspect-video w-full rounded-lg bg-muted flex flex-col items-center justify-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-5 animate-spin" />
        <span>{job.status === "queued" ? "Queued" : label}</span>
      </div>
    );
  }
  if (job.status === "error") {
    return (
      <div className="aspect-video w-full rounded-lg bg-destructive/10 text-destructive p-4 text-sm flex items-center justify-center text-center">
        {job.error ?? "Failed"}
      </div>
    );
  }
  if (!job.fileUrl) return null;
  if (job.kind === "video") {
    return (
      // biome-ignore lint/a11y/useMediaCaption: generated clip, captions are burned in the edit
      <video
        src={job.fileUrl}
        controls
        playsInline
        preload="metadata"
        className="w-full rounded-lg bg-black max-h-[420px]"
      />
    );
  }
  if (job.kind === "music") {
    return (
      <div className="rounded-lg bg-muted p-4">
        {/* biome-ignore lint/a11y/useMediaCaption: generated music, no dialogue */}
        <audio
          src={job.fileUrl}
          controls
          preload="metadata"
          className="w-full"
        />
      </div>
    );
  }
  return (
    <img
      src={job.fileUrl}
      alt={job.prompt}
      className="w-full rounded-lg object-contain max-h-[420px] bg-muted"
    />
  );
}

export function JobCard({
  job,
  onReuse,
}: {
  job: JobWithUrl;
  onReuse?: (job: JobWithUrl) => void;
}) {
  const remove = useMutation(api.jobs.remove);
  const rate = useMutation(api.jobs.rate);
  const p = job.params as Record<string, unknown>;
  const ext =
    job.kind === "video" ? "mp4" : job.kind === "music" ? "wav" : "png";
  const safeName = `${job.kind}_${job.title.replace(/[^a-z0-9]+/gi, "_").slice(0, 40)}_s${job.seed ?? 0}.${ext}`;

  return (
    <div
      className="rounded-xl border bg-card p-3 space-y-3"
      data-testid="job-card"
    >
      <Media job={job} />
      <p className="text-sm leading-snug line-clamp-3" title={job.prompt}>
        {job.prompt}
      </p>
      <div className="flex flex-wrap gap-1.5 text-[11px]">
        <Badge variant="secondary">{job.kind}</Badge>
        {typeof p.format === "string" && (
          <Badge variant="outline">{p.format}</Badge>
        )}
        {typeof p.seconds === "number" && (
          <Badge variant="outline">{p.seconds}s</Badge>
        )}
        {typeof p.aspect === "string" && (
          <Badge variant="outline">{p.aspect}</Badge>
        )}
        {p.mode === "image-to-video" && (
          <Badge variant="outline">from photo</Badge>
        )}
        {p.hd === true && <Badge variant="outline">HD</Badge>}
        {job.seed !== undefined && (
          <Badge variant="outline">seed {job.seed}</Badge>
        )}
        {job.info && <Badge variant="outline">{job.info}</Badge>}
        {job.kind === "video" && p.coach !== false && job.fullPrompt && (
          <details className="basis-full text-muted-foreground">
            <summary className="cursor-pointer select-none">
              coached prompt (what the engine got)
            </summary>
            <p className="mt-1 whitespace-pre-wrap leading-snug">
              {job.fullPrompt}
            </p>
          </details>
        )}
        <span className="text-muted-foreground self-center ml-auto">
          {fmtTime(job.createdAt)}
        </span>
      </div>
      {job.status === "done" && (
        <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
          <Button
            size="icon"
            variant={job.rating === 1 ? "default" : "ghost"}
            className="h-7 w-7"
            aria-label="Good"
            onClick={() => rate({ id: job._id, rating: 1 })}
          >
            <ThumbsUp className="size-3.5" />
          </Button>
          <Button
            size="icon"
            variant={job.rating === -1 ? "default" : "ghost"}
            className="h-7 w-7"
            aria-label="Bad"
            onClick={() => rate({ id: job._id, rating: -1 })}
          >
            <ThumbsDown className="size-3.5" />
          </Button>
          <span>rate it, the coach learns your taste</span>
        </div>
      )}
      <div className="flex gap-2">
        {job.fileUrl && job.status === "done" && (
          <Button size="sm" variant="default" asChild>
            <a
              href={job.fileUrl}
              download={safeName}
              target="_blank"
              rel="noreferrer"
            >
              <Download className="size-4" /> Download
            </a>
          </Button>
        )}
        {onReuse && (
          <Button size="sm" variant="outline" onClick={() => onReuse(job)}>
            <RefreshCw className="size-4" /> Reuse prompt
          </Button>
        )}
        <Button
          size="sm"
          variant="ghost"
          className="ml-auto text-muted-foreground"
          onClick={async () => {
            await remove({ id: job._id });
            toast.success("Deleted");
          }}
          aria-label="Delete"
        >
          <Trash2 className="size-4" />
        </Button>
      </div>
    </div>
  );
}
