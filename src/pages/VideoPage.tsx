import { useMutation, useQuery } from "convex/react";
import { ImagePlus, Sparkles, X } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import type { JobWithUrl } from "@/components/JobCard";
import { StudioLayout } from "@/components/StudioLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";

const FORMATS = [
  { value: "16:9", label: "16:9 landscape · YouTube, web" },
  { value: "9:16", label: "9:16 vertical · Reels, TikTok" },
  { value: "1:1", label: "1:1 square · feed" },
  { value: "draft", label: "Quick draft · 1024×576, cheapest" },
];

const EXAMPLES = [
  "A stucco crew in gray work shirts applies a smooth finish coat to a two-story home at golden hour. Slow dolly in, handheld feel. Sound of trowels and distant birds.",
  "Close-up of a homeowner's hands running across a freshly repaired stucco wall, then a slow pull back to reveal the whole house. Warm evening light.",
  "A country singer with a weathered guitar sits on a porch at dusk, strumming softly while fireflies drift past. Slow push in.",
];

export function VideoPage() {
  const jobs = useQuery(api.jobs.list, { kind: "video", limit: 40 }) as
    | JobWithUrl[]
    | undefined;
  const createVideo = useMutation(api.jobs.createVideo);
  const generateUploadUrl = useMutation(api.jobs.generateUploadUrl);

  const [prompt, setPrompt] = useState("");
  const [format, setFormat] = useState("16:9");
  const [seconds, setSeconds] = useState(6);
  const [seed, setSeed] = useState("");
  const [realism, setRealism] = useState(true);
  const [coach, setCoach] = useState(true);
  const [hd, setHd] = useState(true);
  const [image, setImage] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const submit = async () => {
    if (prompt.trim().length < 8) {
      toast.error("Describe the shot in at least a sentence.");
      return;
    }
    setBusy(true);
    try {
      let inputFileId: Id<"_storage"> | undefined;
      if (image) {
        const url = await generateUploadUrl();
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": image.type || "image/png" },
          body: image,
        });
        if (!res.ok) throw new Error("Photo upload failed");
        inputFileId = ((await res.json()) as { storageId: Id<"_storage"> })
          .storageId;
      }
      await createVideo({
        prompt,
        format,
        seconds,
        seed: seed.trim() === "" ? undefined : Number(seed),
        realism,
        coach,
        hd,
        inputFileId,
      });
      toast.success("Shot queued. It shows up on the right when done.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not start render");
    } finally {
      setBusy(false);
    }
  };

  const form = (
    <>
      <div className="space-y-2">
        <Label htmlFor="video-prompt">Describe one shot</Label>
        <Textarea
          id="video-prompt"
          value={prompt}
          onChange={e => setPrompt(e.target.value)}
          rows={6}
          placeholder="Subject, setting, light, camera move, what happens, what we hear…"
        />
        <div className="flex flex-wrap gap-1.5">
          {EXAMPLES.map((ex, i) => (
            <button
              key={ex}
              type="button"
              className="text-[11px] px-2 py-1 rounded-md border hover:bg-muted"
              onClick={() => setPrompt(ex)}
            >
              Example {i + 1}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <Label>First frame (optional)</Label>
        {image ? (
          <div className="flex items-center gap-3">
            <img
              src={URL.createObjectURL(image)}
              alt="first frame"
              className="h-14 w-20 object-cover rounded-md border"
            />
            <span className="text-xs text-muted-foreground truncate flex-1">
              {image.name}
            </span>
            <Button
              size="icon"
              variant="ghost"
              onClick={() => setImage(null)}
              aria-label="Remove photo"
            >
              <X className="size-4" />
            </Button>
          </div>
        ) : (
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={() => fileRef.current?.click()}
          >
            <ImagePlus className="size-4" /> Use a real photo as the first frame
          </Button>
        )}
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={e => setImage(e.target.files?.[0] ?? null)}
        />
        <p className="text-[11px] text-muted-foreground">
          Job-site photos, products, storefronts. The shot starts from your
          image and animates it.
        </p>
      </div>

      <div className="space-y-2">
        <Label>Format</Label>
        <Select value={format} onValueChange={setFormat}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {FORMATS.map(f => (
              <SelectItem key={f.value} value={f.value}>
                {f.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <div className="flex justify-between">
          <Label>Length</Label>
          <span className="text-sm text-muted-foreground">{seconds}s</span>
        </div>
        <Slider
          min={3}
          max={12}
          step={1}
          value={[seconds]}
          onValueChange={v => setSeconds(v[0])}
        />
        <p className="text-[11px] text-muted-foreground">
          3–8 s cuts best; 12 s is the engine's ceiling. Longer burns more of the daily GPU allowance.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="seed">Seed</Label>
          <Input
            id="seed"
            inputMode="numeric"
            placeholder="random"
            value={seed}
            onChange={e => setSeed(e.target.value.replace(/[^0-9]/g, ""))}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="realism">Realism prefix</Label>
          <div className="flex items-center gap-2 h-9">
            <Switch
              id="realism"
              checked={realism}
              onCheckedChange={setRealism}
            />
            <span className="text-xs text-muted-foreground">
              {realism ? "Live-action look" : "Off"}
            </span>
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="coach">Prompt coach</Label>
          <div className="flex items-center gap-2 h-9">
            <Switch id="coach" checked={coach} onCheckedChange={setCoach} />
            <span className="text-xs text-muted-foreground">
              {coach ? "Rewrites names + stories into shots" : "Send as typed"}
            </span>
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="hd">HD decode</Label>
          <div className="flex items-center gap-2 h-9">
            <Switch id="hd" checked={hd} onCheckedChange={setHd} />
            <span className="text-xs text-muted-foreground">
              {hd ? "Crisper detail, ~30% more GPU" : "Standard"}
            </span>
          </div>
        </div>
      </div>

      <Button className="w-full" onClick={submit} disabled={busy}>
        <Sparkles className="size-4" /> Generate shot
      </Button>
    </>
  );

  return (
    <StudioLayout
      title="Video"
      subtitle="One prompt = one shot with synced sound. Same prompt + different seed = a different take."
      form={form}
      jobs={jobs}
      emptyText="No shots yet. Describe one on the left and hit Generate."
      onReuse={(job: JobWithUrl) => {
        setPrompt(job.prompt);
        const p = job.params as { format?: string; seconds?: number };
        if (p.format) setFormat(p.format);
        if (p.seconds) setSeconds(p.seconds);
        window.scrollTo({ top: 0, behavior: "smooth" });
      }}
    />
  );
}
