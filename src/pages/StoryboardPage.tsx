import { useMutation, useQuery } from "convex/react";
import { Clapperboard, Film, Loader2, Trash2, Wand2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import type { Doc, Id } from "../../convex/_generated/dataModel";

type Character = { name: string; description: string };
type Scene = {
  title: string;
  frame: string;
  motion: string;
  characters: string[];
  imageJobId?: Id<"jobs">;
  videoJobId?: Id<"jobs">;
};
type JobWithUrl = Doc<"jobs"> & { fileUrl: string | null };

const FORMATS: Record<string, string> = {
  "16:9": "16:9 Landscape",
  "9:16": "9:16 Vertical",
  "1:1": "1:1 Square",
  draft: "Quick draft (cheaper)",
};

const EXAMPLE =
  "A retired boxer in a small Pennsylvania town repairs the cracked stucco on his late father's house. Sunrise, he mixes the mud, works the wall, steps back at sunset and smiles.";

export function StoryboardPage() {
  const boards = useQuery(api.storyboards.list) as
    | Doc<"storyboards">[]
    | undefined;
  const create = useMutation(api.storyboards.create);
  const [selected, setSelected] = useState<Id<"storyboards"> | null>(null);

  const [idea, setIdea] = useState("");
  const [format, setFormat] = useState("16:9");
  const [seconds, setSeconds] = useState(6);
  const [sceneCount, setSceneCount] = useState(3);
  const [realism, setRealism] = useState(true);
  const [best, setBest] = useState(false);
  const [hd, setHd] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!selected && boards && boards.length > 0) setSelected(boards[0]._id);
  }, [boards, selected]);

  const plan = async () => {
    if (idea.trim().length < 15) {
      toast.error("Give me at least a sentence of story.");
      return;
    }
    setBusy(true);
    try {
      const id = await create({
        idea,
        format,
        seconds,
        realism,
        quality: best ? "best" : "fast",
        sceneCount,
        hd,
      });
      setSelected(id);
      toast.success("Planning scenes and locking characters…");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not plan");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Storyboard</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Type the story. I lock a character sheet, split it into one-beat
          scenes, render a reference still per scene, then animate each still
          so the same faces carry through.
        </p>
      </div>
      <div className="grid lg:grid-cols-[380px_1fr] gap-6 items-start">
        <div className="rounded-xl border bg-card p-4 space-y-4 lg:sticky lg:top-6">
          <div className="space-y-2">
            <Label htmlFor="sb-idea">The story</Label>
            <Textarea
              id="sb-idea"
              rows={6}
              value={idea}
              onChange={e => setIdea(e.target.value)}
              placeholder="Who, where, what happens. Names of movies or people are fine here, the planner translates them into looks."
            />
            <button
              type="button"
              className="text-[11px] px-2 py-1 rounded-md border hover:bg-muted"
              onClick={() => setIdea(EXAMPLE)}
            >
              Example
            </button>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between">
              <Label>Scenes</Label>
              <span className="text-sm text-muted-foreground">{sceneCount}</span>
            </div>
            <Slider
              min={1}
              max={8}
              step={1}
              value={[sceneCount]}
              onValueChange={v => setSceneCount(v[0])}
            />
          </div>
          <div className="space-y-2">
            <div className="flex justify-between">
              <Label>Seconds per scene</Label>
              <span className="text-sm text-muted-foreground">{seconds}s</span>
            </div>
            <Slider
              min={2}
              max={12}
              step={1}
              value={[seconds]}
              onValueChange={v => setSeconds(v[0])}
            />
          </div>
          <div className="space-y-2">
            <Label>Format</Label>
            <Select value={format} onValueChange={setFormat}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(FORMATS).map(([k, label]) => (
                  <SelectItem key={k} value={k}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-2">
              <Label htmlFor="sb-hd">HD decode</Label>
              <div className="flex items-center gap-2 h-9">
                <Switch id="sb-hd" checked={hd} onCheckedChange={setHd} />
                <span className="text-xs text-muted-foreground">
                  {hd ? "On" : "Off"}
                </span>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="sb-realism">Live-action look</Label>
              <div className="flex items-center gap-2 h-9">
                <Switch
                  id="sb-realism"
                  checked={realism}
                  onCheckedChange={setRealism}
                />
                <span className="text-xs text-muted-foreground">
                  {realism ? "On" : "Off"}
                </span>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="sb-best">Best stills</Label>
              <div className="flex items-center gap-2 h-9">
                <Switch id="sb-best" checked={best} onCheckedChange={setBest} />
                <span className="text-xs text-muted-foreground">
                  {best ? "GPT Image" : "Fast"}
                </span>
              </div>
            </div>
          </div>
          <Button className="w-full" onClick={plan} disabled={busy}>
            <Wand2 className="size-4" /> Plan scenes
          </Button>
          <p className="text-[11px] text-muted-foreground">
            Planning is free. You review and edit the plan before anything
            renders. Rendering costs roughly {seconds * 5}s of GPU per scene.
          </p>

          {boards && boards.length > 0 && (
            <div className="pt-2 border-t space-y-1">
              <Label className="text-xs">Your storyboards</Label>
              <div className="max-h-48 overflow-auto space-y-1">
                {boards.map(b => (
                  <button
                    key={b._id}
                    type="button"
                    onClick={() => setSelected(b._id)}
                    className={`w-full text-left text-xs px-2 py-1.5 rounded-md hover:bg-muted flex items-center gap-2 ${
                      selected === b._id ? "bg-muted" : ""
                    }`}
                  >
                    <StatusDot status={b.status} />
                    <span className="truncate flex-1">{b.title}</span>
                    <span className="text-muted-foreground">
                      {b.scenes.length || "…"}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div>
          {selected ? (
            <BoardView id={selected} onDeleted={() => setSelected(null)} />
          ) : (
            <div className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
              No storyboards yet. Describe a story on the left.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatusDot({ status }: { status: string }) {
  const color =
    status === "done"
      ? "bg-emerald-500"
      : status === "error"
        ? "bg-red-500"
        : status === "ready"
          ? "bg-sky-500"
          : "bg-amber-500 animate-pulse";
  return <span className={`inline-block size-2 rounded-full ${color}`} />;
}

function BoardView({
  id,
  onDeleted,
}: {
  id: Id<"storyboards">;
  onDeleted: () => void;
}) {
  const board = useQuery(api.storyboards.get, { id }) as
    | (Doc<"storyboards"> & { jobs: Record<string, JobWithUrl> })
    | null
    | undefined;
  const updatePlan = useMutation(api.storyboards.updatePlan);
  const render = useMutation(api.storyboards.render);
  const remove = useMutation(api.storyboards.remove);

  const [characters, setCharacters] = useState<Character[]>([]);
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (board && !dirty) {
      setCharacters(board.characters);
      setScenes(board.scenes);
    }
  }, [board, dirty]);

  if (board === undefined)
    return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (board === null)
    return <p className="text-sm text-muted-foreground">Not found.</p>;

  const editable = board.status === "ready" || board.status === "error";
  const planning = board.status === "planning";

  const save = async () => {
    await updatePlan({
      id,
      characters,
      scenes: scenes.map(s => ({
        title: s.title,
        frame: s.frame,
        motion: s.motion,
        characters: s.characters,
        imageJobId: s.imageJobId,
        videoJobId: s.videoJobId,
      })),
    });
    setDirty(false);
    toast.success("Plan saved");
  };

  const renderAll = async () => {
    try {
      if (dirty) await save();
      await render({ id });
      toast.success(
        `Rendering ${scenes.length} scene${scenes.length === 1 ? "" : "s"}: still first, then the clip.`,
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not start");
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold leading-tight">{board.title}</h2>
          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
            {board.idea}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Badge variant="outline" className="capitalize">
            <StatusDot status={board.status} />
            <span className="ml-1.5">{board.status}</span>
          </Badge>
          <Button
            size="icon"
            variant="ghost"
            onClick={async () => {
              await remove({ id });
              onDeleted();
            }}
            title="Delete storyboard"
          >
            <Trash2 className="size-4" />
          </Button>
        </div>
      </div>

      {planning && (
        <div className="rounded-xl border p-6 text-sm text-muted-foreground flex items-center gap-3">
          <Loader2 className="size-4 animate-spin" /> Writing the character
          sheet and breaking the story into scenes…
        </div>
      )}
      {board.error && (
        <div className="rounded-xl border border-red-500/40 bg-red-500/5 p-4 text-sm text-red-600">
          {board.error}
        </div>
      )}

      {characters.length > 0 && (
        <section className="rounded-xl border bg-card p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">
              Character sheet{" "}
              <span className="text-muted-foreground font-normal">
                (locked wording, pasted into every scene)
              </span>
            </h3>
          </div>
          <div className="grid md:grid-cols-2 gap-3">
            {characters.map((c, i) => (
              <div key={`${c.name}-${i}`} className="space-y-1">
                <Label className="text-xs">{c.name}</Label>
                <Textarea
                  rows={4}
                  value={c.description}
                  disabled={!editable}
                  onChange={e => {
                    const next = [...characters];
                    next[i] = { ...c, description: e.target.value };
                    setCharacters(next);
                    setDirty(true);
                  }}
                  className="text-xs"
                />
              </div>
            ))}
          </div>
        </section>
      )}

      {scenes.map((s, i) => {
        const img = s.imageJobId ? board.jobs[s.imageJobId] : undefined;
        const vid = s.videoJobId ? board.jobs[s.videoJobId] : undefined;
        return (
          <section
            key={`scene-${i}`}
            className="rounded-xl border bg-card p-4 space-y-3"
            data-testid="scene-card"
          >
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold">
                Scene {i + 1}: {s.title}
              </h3>
              <div className="flex items-center gap-1.5">
                {s.characters.map(n => (
                  <Badge key={n} variant="secondary" className="text-[10px]">
                    {n}
                  </Badge>
                ))}
                {vid && (
                  <Badge variant="outline" className="text-[10px] capitalize">
                    {vid.status}
                  </Badge>
                )}
              </div>
            </div>
            <div className="grid md:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Reference still (what we see)</Label>
                <Textarea
                  rows={5}
                  value={s.frame}
                  disabled={!editable}
                  className="text-xs"
                  onChange={e => {
                    const next = [...scenes];
                    next[i] = { ...s, frame: e.target.value };
                    setScenes(next);
                    setDirty(true);
                  }}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Motion (what happens)</Label>
                <Textarea
                  rows={5}
                  value={s.motion}
                  disabled={!editable}
                  className="text-xs"
                  onChange={e => {
                    const next = [...scenes];
                    next[i] = { ...s, motion: e.target.value };
                    setScenes(next);
                    setDirty(true);
                  }}
                />
              </div>
            </div>
            {(img || vid) && (
              <div className="grid md:grid-cols-2 gap-3">
                <MediaSlot
                  label="Still"
                  job={img}
                  render={j => (
                    <img
                      src={j.fileUrl ?? ""}
                      alt={s.title}
                      className="w-full rounded-lg object-cover bg-muted"
                    />
                  )}
                />
                <MediaSlot
                  label="Clip"
                  job={vid}
                  render={j => (
                    // biome-ignore lint/a11y/useMediaCaption: generated clip
                    <video
                      src={j.fileUrl ?? ""}
                      controls
                      playsInline
                      preload="metadata"
                      className="w-full rounded-lg bg-black"
                    />
                  )}
                />
              </div>
            )}
            {editable && s.videoJobId && (
              <Button
                size="sm"
                variant="outline"
                onClick={async () => {
                  if (dirty) await save();
                  await render({ id, sceneIndex: i });
                  toast.success(`Re-rendering scene ${i + 1}`);
                }}
              >
                <Film className="size-3.5" /> Re-render this scene
              </Button>
            )}
          </section>
        );
      })}

      {scenes.length > 0 && (
        <div className="flex flex-wrap gap-2 justify-end">
          <Button
            onClick={renderAll}
            disabled={!editable}
          >
            <Clapperboard className="size-4" />
            {board.scenes.some(s => s.videoJobId)
              ? "Re-render all scenes"
              : `Render ${scenes.length} scene${scenes.length === 1 ? "" : "s"}`}
          </Button>
          {dirty && editable && (
            <Button variant="outline" onClick={save}>
              Save plan
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

function MediaSlot({
  label,
  job,
  render,
}: {
  label: string;
  job?: JobWithUrl;
  render: (j: JobWithUrl) => React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      {!job ? (
        <div className="rounded-lg border border-dashed aspect-video grid place-items-center text-xs text-muted-foreground">
          waiting
        </div>
      ) : job.status === "error" ? (
        <div className="rounded-lg border border-red-500/40 bg-red-500/5 p-3 text-xs text-red-600">
          {job.error}
        </div>
      ) : job.status === "done" && job.fileUrl ? (
        render(job)
      ) : (
        <div className="rounded-lg border aspect-video grid place-items-center text-xs text-muted-foreground gap-2">
          <span className="flex items-center gap-2">
            <Loader2 className="size-3.5 animate-spin" /> {job.status}
          </span>
        </div>
      )}
    </div>
  );
}
