import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { internalMutation, internalQuery } from "./_generated/server";
import { authenticatedMutation, authenticatedQuery } from "./functions";
import { jobKind } from "./schema";

export const REALISM_PREFIX =
  "Live-action footage, real human actors, shot on ARRI Alexa 35, natural skin texture, subtle film grain, realistic lighting, commercial cinematography. Not animated, not CGI, not cartoon.";

export const VIDEO_FORMATS: Record<
  string,
  { width: number; height: number; label: string }
> = {
  "16:9": { width: 1280, height: 704, label: "16:9 Landscape (YouTube, web)" },
  "9:16": { width: 704, height: 1280, label: "9:16 Vertical (Reels, TikTok)" },
  "1:1": { width: 768, height: 768, label: "1:1 Square (feed)" },
  draft: { width: 1024, height: 576, label: "Quick draft (16:9, cheaper)" },
};

// Daily GPU allowance on the Hugging Face PRO account (seconds).
export const DAILY_GPU_SECONDS = 40 * 60;

async function withUrls(
  ctx: { storage: { getUrl: (id: Id<"_storage">) => Promise<string | null> } },
  jobs: Doc<"jobs">[],
) {
  return Promise.all(
    jobs.map(async job => ({
      ...job,
      fileUrl: job.fileId
        ? await ctx.storage.getUrl(job.fileId)
        : (job.externalUrl ?? null),
      inputUrl: job.inputFileId
        ? await ctx.storage.getUrl(job.inputFileId)
        : null,
    })),
  );
}

export const list = authenticatedQuery({
  args: { kind: v.optional(jobKind), limit: v.optional(v.number()) },
  handler: async (ctx, { kind, limit }) => {
    const n = Math.min(limit ?? 60, 200);
    const jobs = kind
      ? await ctx.db
          .query("jobs")
          .withIndex("by_user_kind_created", q =>
            q.eq("userId", ctx.userId).eq("kind", kind),
          )
          .order("desc")
          .take(n)
      : await ctx.db
          .query("jobs")
          .withIndex("by_user_created", q => q.eq("userId", ctx.userId))
          .order("desc")
          .take(n);
    return withUrls(ctx, jobs);
  },
});

export const get = authenticatedQuery({
  args: { id: v.id("jobs") },
  handler: async (ctx, { id }) => {
    const job = await ctx.db.get(id);
    if (!job || job.userId !== ctx.userId) return null;
    const [withUrl] = await withUrls(ctx, [job]);
    return withUrl;
  },
});

/** GPU seconds used in the last 24h (shared HF allowance, all users). */

/** Server-side gate for the daily GPU allowance (the sidebar bar is only a mirror of this). */
async function assertBudget(
  ctx: MutationCtx,
  kind: "video" | "image" | "music",
) {
  const since = Date.now() - 24 * 3600 * 1000;
  const recent = await ctx.db
    .query("jobs")
    .withIndex("by_created", q => q.gt("createdAt", since))
    .collect();
  const used = recent.reduce((s, j) => s + (j.gpuSeconds ?? 0), 0);
  const inFlight = recent.filter(
    j => j.status === "running" || j.status === "queued",
  ).length;
  if (kind !== "image" && used >= DAILY_GPU_SECONDS) {
    throw new Error(
      "Daily GPU allowance is used up. It resets over the next 24 hours.",
    );
  }
  if (inFlight >= MAX_IN_FLIGHT) {
    throw new Error(
      `Too many renders in flight (${inFlight}). Wait for one to finish.`,
    );
  }
}
export const MAX_IN_FLIGHT = 6;

export const budget = authenticatedQuery({
  args: {},
  handler: async ctx => {
    const since = Date.now() - 24 * 3600 * 1000;
    const recent = await ctx.db
      .query("jobs")
      .withIndex("by_created", q => q.gt("createdAt", since))
      .collect();
    const used = recent.reduce((s, j) => s + (j.gpuSeconds ?? 0), 0);
    const running = recent.filter(
      j => j.status === "running" || j.status === "queued",
    ).length;
    return { usedSeconds: used, totalSeconds: DAILY_GPU_SECONDS, running };
  },
});

export const generateUploadUrl = authenticatedMutation({
  args: {},
  handler: async ctx => ctx.storage.generateUploadUrl(),
});

export const remove = authenticatedMutation({
  args: { id: v.id("jobs") },
  handler: async (ctx, { id }) => {
    const job = await ctx.db.get(id);
    if (!job || job.userId !== ctx.userId) throw new Error("Not found");
    if (job.fileId) await ctx.storage.delete(job.fileId);
    if (job.inputFileId) await ctx.storage.delete(job.inputFileId);
    await ctx.db.delete(id);
  },
});

export const rate = authenticatedMutation({
  args: { id: v.id("jobs"), rating: v.number() },
  handler: async (ctx, { id, rating }) => {
    const job = await ctx.db.get(id);
    if (!job || job.userId !== ctx.userId) throw new Error("Not found");
    await ctx.db.patch(id, {
      rating: job.rating === rating ? undefined : rating,
    });
  },
});

/* ---------- create jobs (each schedules its engine action) ---------- */

export const createVideo = authenticatedMutation({
  args: {
    prompt: v.string(),
    format: v.string(),
    seconds: v.number(),
    seed: v.optional(v.number()),
    realism: v.boolean(),
    coach: v.optional(v.boolean()),
    hd: v.optional(v.boolean()),
    inputFileId: v.optional(v.id("_storage")),
  },
  handler: async (ctx, args) => {
    await assertBudget(ctx, "video");
    const fmt = VIDEO_FORMATS[args.format];
    if (!fmt) throw new Error("Unknown format");
    const seconds = Math.max(2, Math.min(12, Math.round(args.seconds)));
    const seed =
      args.seed !== undefined && args.seed >= 0
        ? Math.floor(args.seed)
        : Math.floor(Math.random() * 1_000_000);
    // With the coach on, fullPrompt is filled in by the engine once rewritten.
    const fullPrompt =
      (args.coach ?? true)
        ? undefined
        : args.realism
          ? `${REALISM_PREFIX} ${args.prompt.trim()}`
          : args.prompt.trim();
    const id = await ctx.db.insert("jobs", {
      userId: ctx.userId,
      kind: "video",
      status: "queued",
      title: args.prompt.trim().slice(0, 80),
      prompt: args.prompt.trim(),
      fullPrompt,
      params: {
        format: args.format,
        width: fmt.width,
        height: fmt.height,
        seconds,
        realism: args.realism,
        coach: args.coach ?? true,
        hd: args.hd ?? args.format !== "draft",
        mode: args.inputFileId ? "image-to-video" : "text-to-video",
      },
      seed,
      inputFileId: args.inputFileId,
      createdAt: Date.now(),
    });
    await ctx.scheduler.runAfter(0, internal.engines.renderVideo, {
      jobId: id,
    });
    return id;
  },
});

export const createImage = authenticatedMutation({
  args: {
    prompt: v.string(),
    aspect: v.union(v.literal("1:1"), v.literal("3:2"), v.literal("2:3")),
    quality: v.union(v.literal("fast"), v.literal("best")),
  },
  handler: async (ctx, args) => {
    await assertBudget(ctx, "image");
    const id = await ctx.db.insert("jobs", {
      userId: ctx.userId,
      kind: "image",
      status: "queued",
      title: args.prompt.trim().slice(0, 80),
      prompt: args.prompt.trim(),
      fullPrompt: args.prompt.trim(),
      params: { aspect: args.aspect, quality: args.quality },
      createdAt: Date.now(),
    });
    await ctx.scheduler.runAfter(0, internal.engines.renderImage, {
      jobId: id,
    });
    return id;
  },
});

export const createMusic = authenticatedMutation({
  args: {
    prompt: v.string(),
    lyrics: v.string(),
    seconds: v.number(),
    seed: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await assertBudget(ctx, "music");
    const seconds = Math.max(10, Math.min(240, Math.round(args.seconds)));
    const seed =
      args.seed !== undefined && args.seed >= 0
        ? Math.floor(args.seed)
        : Math.floor(Math.random() * 1_000_000);
    const lyrics = args.lyrics.trim() || "[inst]";
    const id = await ctx.db.insert("jobs", {
      userId: ctx.userId,
      kind: "music",
      status: "queued",
      title: args.prompt.trim().slice(0, 80),
      prompt: args.prompt.trim(),
      fullPrompt: args.prompt.trim(),
      params: { seconds, lyrics, instrumental: lyrics === "[inst]" },
      seed,
      createdAt: Date.now(),
    });
    await ctx.scheduler.runAfter(0, internal.engines.renderMusic, {
      jobId: id,
    });
    return id;
  },
});

/* ---------- internal helpers used by engine actions ---------- */

export const getInternal = internalQuery({
  args: { id: v.id("jobs") },
  handler: async (ctx, { id }) => {
    const job = await ctx.db.get(id);
    if (!job) return null;
    return {
      ...job,
      inputUrl: job.inputFileId
        ? await ctx.storage.getUrl(job.inputFileId)
        : null,
    };
  },
});

/** Recent thumbs-up / thumbs-down video prompts for this user; the coach
 * uses them as taste examples. */
export const ratedExamples = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const recent = await ctx.db
      .query("jobs")
      .withIndex("by_user_created", q => q.eq("userId", userId))
      .order("desc")
      .take(60);
    const liked: string[] = [];
    const disliked: string[] = [];
    for (const j of recent) {
      if (j.kind !== "video" || !j.rating || !j.fullPrompt) continue;
      const text = j.fullPrompt.replace(REALISM_PREFIX, "").trim();
      if (j.rating > 0 && liked.length < 4) liked.push(text);
      if (j.rating < 0 && disliked.length < 3) disliked.push(text);
    }
    return { liked, disliked };
  },
});

export const setFullPrompt = internalMutation({
  args: { id: v.id("jobs"), fullPrompt: v.string() },
  handler: async (ctx, { id, fullPrompt }) => {
    await ctx.db.patch(id, { fullPrompt });
  },
});

export const markRunning = internalMutation({
  args: { id: v.id("jobs") },
  handler: async (ctx, { id }) => {
    await ctx.db.patch(id, { status: "running", startedAt: Date.now() });
  },
});

export const markDone = internalMutation({
  args: {
    id: v.id("jobs"),
    fileId: v.optional(v.id("_storage")),
    externalUrl: v.optional(v.string()),
    mime: v.string(),
    info: v.optional(v.string()),
    seed: v.optional(v.number()),
    gpuSeconds: v.optional(v.number()),
  },
  handler: async (ctx, { id, ...rest }) => {
    await ctx.db.patch(id, { status: "done", finishedAt: Date.now(), ...rest });
  },
});

export const markError = internalMutation({
  args: {
    id: v.id("jobs"),
    error: v.string(),
    gpuSeconds: v.optional(v.number()),
  },
  handler: async (ctx, { id, error, gpuSeconds }) => {
    await ctx.db.patch(id, {
      status: "error",
      error: error.slice(0, 2000),
      finishedAt: Date.now(),
      gpuSeconds,
    });
  },
});
