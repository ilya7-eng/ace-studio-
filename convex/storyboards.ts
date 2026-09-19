import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { internalMutation, internalQuery } from "./_generated/server";
import { authenticatedMutation, authenticatedQuery } from "./functions";
import { REALISM_PREFIX, VIDEO_FORMATS } from "./jobs";

const characterV = v.object({ name: v.string(), description: v.string() });
const sceneV = v.object({
  title: v.string(),
  frame: v.string(),
  motion: v.string(),
  characters: v.array(v.string()),
  imageJobId: v.optional(v.id("jobs")),
  videoJobId: v.optional(v.id("jobs")),
});

export const list = authenticatedQuery({
  args: {},
  handler: async ctx =>
    ctx.db
      .query("storyboards")
      .withIndex("by_user_created", q => q.eq("userId", ctx.userId))
      .order("desc")
      .take(30),
});

/** One storyboard with its scene jobs resolved (urls included). */
export const get = authenticatedQuery({
  args: { id: v.id("storyboards") },
  handler: async (ctx, { id }) => {
    const sb = await ctx.db.get(id);
    if (!sb || sb.userId !== ctx.userId) return null;
    const jobIds = sb.scenes.flatMap(s =>
      [s.imageJobId, s.videoJobId].filter((x): x is Id<"jobs"> => !!x),
    );
    const jobs: Record<string, Doc<"jobs"> & { fileUrl: string | null }> = {};
    for (const jid of jobIds) {
      const j = await ctx.db.get(jid);
      if (j)
        jobs[jid] = {
          ...j,
          fileUrl: j.fileId
            ? await ctx.storage.getUrl(j.fileId)
            : (j.externalUrl ?? null),
        };
    }
    return { ...sb, jobs };
  },
});

export const create = authenticatedMutation({
  args: {
    idea: v.string(),
    format: v.string(),
    seconds: v.number(),
    realism: v.boolean(),
    quality: v.union(v.literal("fast"), v.literal("best")),
    sceneCount: v.number(),
    hd: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    if (!VIDEO_FORMATS[args.format]) throw new Error("Unknown format");
    const id = await ctx.db.insert("storyboards", {
      userId: ctx.userId,
      idea: args.idea.trim(),
      title: args.idea.trim().slice(0, 60),
      status: "planning",
      characters: [],
      scenes: [],
      settings: {
        format: args.format,
        seconds: Math.max(2, Math.min(12, Math.round(args.seconds))),
        realism: args.realism,
        quality: args.quality,
        hd: args.hd ?? args.format !== "draft",
      },
      createdAt: Date.now(),
    });
    await ctx.scheduler.runAfter(0, internal.engines.planStoryboard, {
      storyboardId: id,
      sceneCount: Math.max(1, Math.min(8, Math.round(args.sceneCount))),
    });
    return id;
  },
});

/** User edits to the plan before rendering. */
export const updatePlan = authenticatedMutation({
  args: {
    id: v.id("storyboards"),
    title: v.optional(v.string()),
    characters: v.array(characterV),
    scenes: v.array(sceneV),
  },
  handler: async (ctx, { id, ...rest }) => {
    const sb = await ctx.db.get(id);
    if (!sb || sb.userId !== ctx.userId) throw new Error("Not found");
    if (sb.status === "rendering") throw new Error("Already rendering");
    await ctx.db.patch(id, {
      ...rest,
      title: rest.title ?? sb.title,
      status: "ready",
    });
  },
});

export const remove = authenticatedMutation({
  args: { id: v.id("storyboards") },
  handler: async (ctx, { id }) => {
    const sb = await ctx.db.get(id);
    if (!sb || sb.userId !== ctx.userId) throw new Error("Not found");
    await ctx.db.delete(id);
  },
});

/** Kick off image -> video for every scene (or one scene). */
export const render = authenticatedMutation({
  args: { id: v.id("storyboards"), sceneIndex: v.optional(v.number()) },
  handler: async (ctx, { id, sceneIndex }) => {
    const sb = await ctx.db.get(id);
    if (!sb || sb.userId !== ctx.userId) throw new Error("Not found");
    if (sb.scenes.length === 0) throw new Error("Plan first");
    await ctx.db.patch(id, { status: "rendering", error: undefined });
    const indices =
      sceneIndex === undefined
        ? sb.scenes.map((_, i) => i)
        : [sceneIndex];
    for (const i of indices) {
      await ctx.scheduler.runAfter(i * 1500, internal.engines.renderScene, {
        storyboardId: id,
        sceneIndex: i,
      });
    }
  },
});

/* ---------- internal ---------- */

export const getInternal = internalQuery({
  args: { id: v.id("storyboards") },
  handler: async (ctx, { id }) => ctx.db.get(id),
});

export const setPlan = internalMutation({
  args: {
    id: v.id("storyboards"),
    title: v.string(),
    characters: v.array(characterV),
    scenes: v.array(sceneV),
  },
  handler: async (ctx, { id, ...rest }) => {
    await ctx.db.patch(id, { ...rest, status: "ready" });
  },
});

export const setError = internalMutation({
  args: { id: v.id("storyboards"), error: v.string() },
  handler: async (ctx, { id, error }) => {
    await ctx.db.patch(id, { status: "error", error });
  },
});

/** Create the two job records for a scene; returns their ids. */
export const openSceneJobs = internalMutation({
  args: {
    id: v.id("storyboards"),
    sceneIndex: v.number(),
    imagePrompt: v.string(),
    videoPrompt: v.string(),
  },
  handler: async (ctx, { id, sceneIndex, imagePrompt, videoPrompt }) => {
    const sb = await ctx.db.get(id);
    if (!sb) throw new Error("Storyboard gone");
    const scene = sb.scenes[sceneIndex];
    const fmt = VIDEO_FORMATS[sb.settings.format];
    const aspect =
      sb.settings.format === "9:16"
        ? "2:3"
        : sb.settings.format === "1:1"
          ? "1:1"
          : "3:2";
    const tag = `${sb.title.slice(0, 40)} · Scene ${sceneIndex + 1}: ${scene.title}`;
    const imageJobId = await ctx.db.insert("jobs", {
      userId: sb.userId,
      kind: "image",
      status: "queued",
      title: tag.slice(0, 80),
      prompt: imagePrompt,
      fullPrompt: imagePrompt,
      params: {
        aspect,
        quality: sb.settings.quality,
        storyboardId: id,
        sceneIndex,
      },
      createdAt: Date.now(),
    });
    const fullPrompt = sb.settings.realism
      ? `${REALISM_PREFIX} ${videoPrompt}`
      : videoPrompt;
    const videoJobId = await ctx.db.insert("jobs", {
      userId: sb.userId,
      kind: "video",
      status: "queued",
      title: tag.slice(0, 80),
      prompt: scene.motion,
      fullPrompt,
      params: {
        format: sb.settings.format,
        width: fmt.width,
        height: fmt.height,
        seconds: sb.settings.seconds,
        realism: sb.settings.realism,
        coach: false,
        hd: sb.settings.hd ?? sb.settings.format !== "draft",
        mode: "image-to-video",
        storyboardId: id,
        sceneIndex,
      },
      seed: Math.floor(Math.random() * 1_000_000),
      createdAt: Date.now(),
    });
    const scenes = sb.scenes.map((s, i) =>
      i === sceneIndex ? { ...s, imageJobId, videoJobId } : s,
    );
    await ctx.db.patch(id, { scenes });
    return { imageJobId, videoJobId };
  },
});

export const attachInput = internalMutation({
  args: { videoJobId: v.id("jobs"), inputFileId: v.id("_storage") },
  handler: async (ctx, { videoJobId, inputFileId }) => {
    await ctx.db.patch(videoJobId, { inputFileId });
  },
});

/** Called after each scene video finishes; flips storyboard to done. */
export const refreshStatus = internalMutation({
  args: { id: v.id("storyboards") },
  handler: async (ctx, { id }) => {
    const sb = await ctx.db.get(id);
    if (!sb || sb.status !== "rendering") return;
    let allDone = true;
    for (const s of sb.scenes) {
      if (!s.videoJobId) {
        allDone = false;
        break;
      }
      const j = await ctx.db.get(s.videoJobId);
      if (!j || j.status === "queued" || j.status === "running") {
        allDone = false;
        break;
      }
    }
    if (allDone) await ctx.db.patch(id, { status: "done" });
  },
});
