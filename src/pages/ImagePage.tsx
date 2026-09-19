import { useMutation, useQuery } from "convex/react";
import { Sparkles } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import type { JobWithUrl } from "@/components/JobCard";
import { StudioLayout } from "@/components/StudioLayout";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { api } from "../../convex/_generated/api";

type Aspect = "1:1" | "3:2" | "2:3";
type Quality = "fast" | "best";

export function ImagePage() {
  const jobs = useQuery(api.jobs.list, { kind: "image", limit: 40 }) as
    | JobWithUrl[]
    | undefined;
  const createImage = useMutation(api.jobs.createImage);
  const [prompt, setPrompt] = useState("");
  const [aspect, setAspect] = useState<Aspect>("3:2");
  const [quality, setQuality] = useState<Quality>("fast");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (prompt.trim().length < 5) {
      toast.error("Describe the image first.");
      return;
    }
    setBusy(true);
    try {
      await createImage({ prompt, aspect, quality });
      toast.success("Image queued.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not start");
    } finally {
      setBusy(false);
    }
  };

  const form = (
    <>
      <div className="space-y-2">
        <Label htmlFor="image-prompt">Describe the image</Label>
        <Textarea
          id="image-prompt"
          value={prompt}
          onChange={e => setPrompt(e.target.value)}
          rows={6}
          placeholder="A wide photo of a freshly stuccoed craftsman home at dusk, warm porch light, no text…"
        />
        <p className="text-[11px] text-muted-foreground">
          Ask for no text in the image; we add typography ourselves so it stays
          crisp.
        </p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label>Aspect</Label>
          <Select value={aspect} onValueChange={v => setAspect(v as Aspect)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="3:2">3:2 landscape</SelectItem>
              <SelectItem value="1:1">1:1 square</SelectItem>
              <SelectItem value="2:3">2:3 portrait</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Quality</Label>
          <Select value={quality} onValueChange={v => setQuality(v as Quality)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="fast">Fast draft</SelectItem>
              <SelectItem value="best">Best</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <Button className="w-full" onClick={submit} disabled={busy}>
        <Sparkles className="size-4" /> Generate image
      </Button>
    </>
  );

  return (
    <StudioLayout
      title="Image"
      subtitle="Stills, posters, thumbnails and first frames for the video studio."
      form={form}
      jobs={jobs}
      emptyText="No images yet."
      onReuse={job => {
        setPrompt(job.prompt);
        const p = job.params as { aspect?: Aspect; quality?: Quality };
        if (p.aspect) setAspect(p.aspect);
        if (p.quality) setQuality(p.quality);
        window.scrollTo({ top: 0, behavior: "smooth" });
      }}
    />
  );
}
