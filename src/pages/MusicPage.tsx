import { useMutation, useQuery } from "convex/react";
import { Sparkles } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import type { JobWithUrl } from "@/components/JobCard";
import { StudioLayout } from "@/components/StudioLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { api } from "../../convex/_generated/api";

const EXAMPLES = [
  "warm cinematic, acoustic guitar and soft piano, hopeful build, 90 bpm, commercial underscore",
  "modern country, male vocal, telecaster, steel guitar, mid-tempo, heartfelt",
  "lo-fi hip hop, mellow keys, vinyl crackle, late night study, 80 bpm",
];

export function MusicPage() {
  const jobs = useQuery(api.jobs.list, { kind: "music", limit: 40 }) as
    | JobWithUrl[]
    | undefined;
  const createMusic = useMutation(api.jobs.createMusic);
  const [prompt, setPrompt] = useState("");
  const [lyrics, setLyrics] = useState("");
  const [seconds, setSeconds] = useState(30);
  const [seed, setSeed] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (prompt.trim().length < 5) {
      toast.error("Describe the music first.");
      return;
    }
    setBusy(true);
    try {
      await createMusic({
        prompt,
        lyrics,
        seconds,
        seed: seed.trim() === "" ? undefined : Number(seed),
      });
      toast.success("Track queued. Songs take 1–3 minutes.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not start");
    } finally {
      setBusy(false);
    }
  };

  const form = (
    <>
      <div className="space-y-2">
        <Label htmlFor="music-prompt">Style</Label>
        <Textarea
          id="music-prompt"
          value={prompt}
          onChange={e => setPrompt(e.target.value)}
          rows={3}
          placeholder="genre, instruments, mood, tempo, vocal type…"
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
        <Label htmlFor="lyrics">Lyrics (leave empty for instrumental)</Label>
        <Textarea
          id="lyrics"
          value={lyrics}
          onChange={e => setLyrics(e.target.value)}
          rows={6}
          placeholder={"[verse]\nFirst line here…\n\n[chorus]\n…"}
        />
        <p className="text-[11px] text-muted-foreground">
          Use [verse], [chorus], [bridge] tags. Empty = instrumental bed.
        </p>
      </div>
      <div className="space-y-2">
        <div className="flex justify-between">
          <Label>Length</Label>
          <span className="text-sm text-muted-foreground">{seconds}s</span>
        </div>
        <Slider
          min={10}
          max={240}
          step={5}
          value={[seconds]}
          onValueChange={v => setSeconds(v[0])}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="music-seed">Seed</Label>
        <Input
          id="music-seed"
          inputMode="numeric"
          placeholder="random"
          value={seed}
          onChange={e => setSeed(e.target.value.replace(/[^0-9]/g, ""))}
        />
      </div>
      <Button className="w-full" onClick={submit} disabled={busy}>
        <Sparkles className="size-4" /> Generate track
      </Button>
    </>
  );

  return (
    <StudioLayout
      title="Music"
      subtitle="Our in-house ACE-Step engine. Instrumental beds for ads, or full songs with your lyrics. No licensing."
      form={form}
      jobs={jobs}
      emptyText="No tracks yet."
      onReuse={job => {
        setPrompt(job.prompt);
        const p = job.params as { lyrics?: string; seconds?: number };
        setLyrics(p.lyrics && p.lyrics !== "[inst]" ? p.lyrics : "");
        if (p.seconds) setSeconds(p.seconds);
        window.scrollTo({ top: 0, behavior: "smooth" });
      }}
    />
  );
}
