"use node";
/**
 * Engine actions: talk to our private Hugging Face Spaces (Gradio HTTP API)
 * and the Viktor tool gateway, then store results in Convex file storage.
 */
import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { internalAction } from "./_generated/server";
import { REALISM_PREFIX } from "./jobs";

declare const process: { env: Record<string, string | undefined> };

const LTX_SPACE = "https://legacy-music-studios-ltx-studio.hf.space";
const ACE_SPACE = "https://legacy-music-studios-ace-studio.hf.space";

/** Production cannot take env vars from the sandbox: fall back to the secrets table. */
async function ensureHfToken(ctx: {
  runQuery: (
    ref: typeof internal.studio.getSecret,
    args: { name: string },
  ) => Promise<string | null>;
}) {
  if (process.env.HF_TOKEN) return;
  const stored = await ctx.runQuery(internal.studio.getSecret, {
    name: "HF_TOKEN",
  });
  if (stored) process.env.HF_TOKEN = stored;
}

function hfHeaders(): Record<string, string> {
  const token = process.env.HF_TOKEN;
  if (!token) throw new Error("HF_TOKEN is not configured on this deployment");
  return { Authorization: `Bearer ${token}` };
}

/** Upload a file to a Gradio Space; returns the server-side path. */
async function gradioUpload(
  space: string,
  bytes: ArrayBuffer,
  filename: string,
  mime: string,
): Promise<string> {
  const form = new FormData();
  form.append("files", new Blob([bytes], { type: mime }), filename);
  const res = await fetch(`${space}/gradio_api/upload`, {
    method: "POST",
    headers: hfHeaders(),
    body: form,
  });
  if (!res.ok) throw new Error(`Upload failed: HTTP ${res.status}`);
  const paths = (await res.json()) as string[];
  if (!paths?.[0]) throw new Error("Upload returned no path");
  return paths[0];
}

/** Call a named Gradio endpoint and wait for the completed result data. */
async function gradioCall<T>(
  space: string,
  endpoint: string,
  data: unknown[],
): Promise<T> {
  const start = await fetch(`${space}/gradio_api/call/${endpoint}`, {
    method: "POST",
    headers: { ...hfHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify({ data }),
  });
  if (!start.ok) {
    throw new Error(
      `Space call failed: HTTP ${start.status} ${await start.text()}`,
    );
  }
  const { event_id } = (await start.json()) as { event_id: string };
  const res = await fetch(`${space}/gradio_api/call/${endpoint}/${event_id}`, {
    headers: hfHeaders(),
  });
  if (!res.ok) throw new Error(`Space stream failed: HTTP ${res.status}`);
  const text = await res.text();
  // SSE: pairs of "event: X" / "data: Y"
  const lines = text.split("\n");
  let event = "";
  for (const line of lines) {
    if (line.startsWith("event:")) event = line.slice(6).trim();
    else if (line.startsWith("data:")) {
      const payload = line.slice(5).trim();
      if (event === "complete") return JSON.parse(payload) as T;
      if (event === "error") {
        throw new Error(
          payload && payload !== "null"
            ? `Engine error: ${payload}`
            : "Engine error (the Space may be asleep or out of GPU quota; try again in a few minutes)",
        );
      }
    }
  }
  throw new Error("Engine returned no result");
}

async function fetchBytes(url: string, headers: Record<string, string> = {}) {
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`Download failed: HTTP ${res.status}`);
  return res.arrayBuffer();
}

type GradioFile = { path: string; url: string };

export const renderVideo = internalAction({
  args: { jobId: v.id("jobs") },
  handler: async (ctx, { jobId }) => {
    const job = await ctx.runQuery(internal.jobs.getInternal, { id: jobId });
    if (!job) return;
    await ctx.runMutation(internal.jobs.markRunning, { id: jobId });
    const t0 = Date.now();
    try {
      await ensureHfToken(ctx);
      let imageArg: unknown = null;
      if (job.inputUrl) {
        const bytes = await fetchBytes(job.inputUrl);
        const path = await gradioUpload(
          LTX_SPACE,
          bytes,
          "first_frame.png",
          "image/png",
        );
        imageArg = { path, meta: { _type: "gradio.FileData" } };
      }
      const p = job.params as {
        width: number;
        height: number;
        seconds: number;
        realism?: boolean;
        coach?: boolean;
        hd?: boolean;
      };
      let enginePrompt =
        job.fullPrompt ??
        (p.realism ? `${REALISM_PREFIX} ${job.prompt}` : job.prompt);
      if (p.coach !== false) {
        const examples = await ctx.runQuery(internal.jobs.ratedExamples, {
          userId: job.userId,
        });
        const coached = await coachVideoPrompt(
          job.prompt,
          p.seconds,
          !!job.inputUrl,
          examples,
        );
        if (coached) {
          enginePrompt = p.realism ? `${REALISM_PREFIX} ${coached}` : coached;
          await ctx.runMutation(internal.jobs.setFullPrompt, {
            id: jobId,
            fullPrompt: enginePrompt,
          });
        }
      }
      const [video, , seedUsed, info] = await gradioCall<
        [GradioFile, string, number, string]
      >(LTX_SPACE, "run", [
        enginePrompt,
        imageArg,
        p.height,
        p.width,
        p.seconds,
        job.seed ?? 42,
        // LTX-2.5's own diffusion decoder: crisper skin/fabric/edges, ~30% more GPU time.
        p.hd ? "diffusion" : "conv",
        false,
        false,
        false,
      ]);
      const bytes = await fetchBytes(video.url, hfHeaders());
      const fileId = await ctx.storage.store(
        new Blob([bytes], { type: "video/mp4" }),
      );
      await ctx.runMutation(internal.jobs.markDone, {
        id: jobId,
        fileId,
        mime: "video/mp4",
        info,
        seed: typeof seedUsed === "number" ? seedUsed : job.seed,
        gpuSeconds: Math.round((Date.now() - t0) / 1000),
      });
    } catch (e) {
      await ctx.runMutation(internal.jobs.markError, {
        id: jobId,
        error: e instanceof Error ? e.message : String(e),
        gpuSeconds: Math.round((Date.now() - t0) / 1000),
      });
    }
    const sbId = (job.params as { storyboardId?: Id<"storyboards"> })
      .storyboardId;
    if (sbId) {
      await ctx.runMutation(internal.storyboards.refreshStatus, { id: sbId });
    }
  },
});

export const renderMusic = internalAction({
  args: { jobId: v.id("jobs") },
  handler: async (ctx, { jobId }) => {
    const job = await ctx.runQuery(internal.jobs.getInternal, { id: jobId });
    if (!job) return;
    await ctx.runMutation(internal.jobs.markRunning, { id: jobId });
    const t0 = Date.now();
    try {
      await ensureHfToken(ctx);
      const p = job.params as { seconds: number; lyrics: string };
      const [audio] = await gradioCall<[string]>(ACE_SPACE, "generate", [
        job.fullPrompt ?? job.prompt,
        p.lyrics,
        p.seconds,
        32,
        7.5,
        job.seed ?? -1,
        "",
        0.8,
      ]);
      // Returns a data URI (audio/wav;base64,...)
      const m = /^data:(audio\/[a-z0-9.+-]+);base64,(.*)$/s.exec(audio);
      if (!m) throw new Error("Music engine returned an unexpected payload");
      const mime = m[1];
      const bin = atob(m[2]);
      const buf = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
      const fileId = await ctx.storage.store(new Blob([buf], { type: mime }));
      await ctx.runMutation(internal.jobs.markDone, {
        id: jobId,
        fileId,
        mime,
        info: `${p.seconds}s ${p.lyrics === "[inst]" ? "instrumental" : "song"}`,
        gpuSeconds: Math.round((Date.now() - t0) / 1000),
      });
    } catch (e) {
      await ctx.runMutation(internal.jobs.markError, {
        id: jobId,
        error: e instanceof Error ? e.message : String(e),
        gpuSeconds: Math.round((Date.now() - t0) / 1000),
      });
    }
  },
});

const VIKTOR_API_URL = process.env.VIKTOR_SPACES_API_URL;
const PROJECT_NAME = process.env.VIKTOR_SPACES_PROJECT_NAME;
const PROJECT_SECRET = process.env.VIKTOR_SPACES_PROJECT_SECRET;

async function callTool<T>(role: string, args: Record<string, unknown>) {
  const response = await fetch(
    `${VIKTOR_API_URL}/api/viktor-spaces/tools/call`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        project_name: PROJECT_NAME,
        project_secret: PROJECT_SECRET,
        role,
        arguments: args,
      }),
    },
  );
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${await response.text()}`);
  }
  const json = await response.json();
  if (!json.success) throw new Error(json.error ?? "Tool call failed");
  return json.result as T;
}

/**
 * Prompt coach: LTX has no knowledge of names (films, celebrities, brands) and
 * can hold one beat per clip. Rewrite the user's idea into a literal shot
 * description. Returns null on failure so the raw prompt still renders.
 */
async function coachVideoPrompt(
  userPrompt: string,
  seconds: number,
  hasStartFrame: boolean,
  examples: { liked: string[]; disliked: string[] } = {
    liked: [],
    disliked: [],
  },
): Promise<string | null> {
  const taste = [
    examples.liked.length
      ? `Prompts this user rated GOOD (match their level of detail and style):\n${examples.liked.map(t => `- ${t}`).join("\n")}`
      : "",
    examples.disliked.length
      ? `Prompts this user rated BAD (avoid what these did):\n${examples.disliked.map(t => `- ${t}`).join("\n")}`
      : "",
  ]
    .filter(Boolean)
    .join("\n\n");
  const prompt = `You rewrite ideas into prompts for the LTX-2 text-to-video model. Rules:
- The model knows NO names: no film titles, characters, celebrities, brands, teams or logos. Replace every name with a literal visual description of what the camera sees (appearance, wardrobe, props, setting).
- A ${seconds}-second clip holds ONE beat. If the idea is a story ("fights and wins"), keep only the single most visual moment and describe its motion.
- Order: camera (shot size + movement), subject + action, setting, light + mood. Present tense, concrete nouns, no adjectives piles, no text/captions on screen.
- 40 to 80 words. No quotes, no preamble.
${hasStartFrame ? "- A start frame image is provided: describe only the MOTION and camera move that should happen from that frame, do not re-describe the frame." : ""}
${taste ? `\n${taste}\n` : ""}
IDEA: ${userPrompt}`;
  try {
    const r = await callTool<{
      result?: { prompt?: string };
      output?: { prompt?: string };
      prompt?: string;
    }>("ai_structured_output", {
      prompt,
      output_schema: {
        type: "object",
        properties: {
          prompt: { type: "string", description: "the rewritten shot prompt" },
        },
        required: ["prompt"],
      },
      intelligence_level: "balanced",
    });
    const out = (r.result ?? r.output ?? r) as { prompt?: string };
    const text = out.prompt?.trim();
    return text && text.length > 20 ? text : null;
  } catch (e) {
    console.error("prompt coach failed", e);
    return null;
  }
}

export const renderImage = internalAction({
  args: { jobId: v.id("jobs") },
  handler: async (ctx, { jobId }) => {
    const job = await ctx.runQuery(internal.jobs.getInternal, { id: jobId });
    if (!job) return;
    await ctx.runMutation(internal.jobs.markRunning, { id: jobId });
    try {
      const p = job.params as { aspect: string; quality: string };
      const result = await callTool<{
        response_text: string;
        image_url?: string | null;
        error?: string | null;
      }>("text2im", {
        prompt: job.prompt,
        aspect_ratio: p.aspect,
        model: p.quality === "best" ? "gpt-image-2" : "gemini-flash-image",
        output_format: "png",
      });
      if (result.error) throw new Error(result.error);
      const imageUrl =
        result.image_url ??
        /https?:\/\/\S+/
          .exec(result.response_text ?? "")?.[0]
          ?.replace(/[.,;)]+$/, "");
      if (!imageUrl) throw new Error("No image returned");
      let fileId: undefined | Awaited<ReturnType<typeof ctx.storage.store>>;
      try {
        const bytes = await fetchBytes(imageUrl);
        fileId = await ctx.storage.store(
          new Blob([bytes], { type: "image/png" }),
        );
      } catch {
        fileId = undefined;
      }
      await ctx.runMutation(internal.jobs.markDone, {
        id: jobId,
        fileId,
        externalUrl: fileId ? undefined : imageUrl,
        mime: "image/png",
        info: p.quality === "best" ? "GPT Image 2" : "Gemini Flash Image",
        gpuSeconds: 0,
      });
    } catch (e) {
      await ctx.runMutation(internal.jobs.markError, {
        id: jobId,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  },
});

/* ======================= Storyboard ======================= */

type PlanOut = {
  title: string;
  characters: { name: string; description: string }[];
  scenes: {
    title: string;
    frame: string;
    motion: string;
    characters: string[];
  }[];
};

export const planStoryboard = internalAction({
  args: { storyboardId: v.id("storyboards"), sceneCount: v.number() },
  handler: async (ctx, { storyboardId, sceneCount }) => {
    const sb = await ctx.runQuery(internal.storyboards.getInternal, {
      id: storyboardId,
    });
    if (!sb) return;
    const prompt = `You are a film director planning a short AI-generated video with the LTX-2 model (image-to-video, ${sb.settings.seconds}-second clips).
Hard facts about the model:
- It knows NO names: no film titles, characters, celebrities, brands, teams, logos. Every person or thing must be a literal visual description.
- One clip = ONE beat of motion. No story arcs inside a clip.
- Character consistency comes from repeating the EXACT same wording of a character's look in every scene that shows them, and from starting each clip on a reference still.

TASK: turn the idea below into ${sceneCount} scene(s).
1. CHARACTERS: 1-4 recurring characters. Each gets a short name (for your own reference) and a 25-45 word locked description: age range, build, face, hair, skin, wardrobe, one signature prop. If the idea names a famous person or character, describe their look instead of the name.
2. SCENES (exactly ${sceneCount}, in order): each with
   - title: 2-5 words
   - frame: the reference still, 40-70 words. Camera shot size, composition, setting, light. Paste the FULL locked description of every character present, word for word.
   - motion: what moves during the ${sb.settings.seconds} seconds, 25-50 words. One beat. Camera move + subject action. Do NOT re-describe looks.
   - characters: array of the character names present.
Scenes should cut together as a sequence (establishing -> action -> reaction/payoff). No on-screen text.

IDEA: ${sb.idea}`;
    try {
      const r = await callTool<
        { result?: PlanOut; output?: PlanOut } & Partial<PlanOut>
      >("ai_structured_output", {
        prompt,
        output_schema: {
          type: "object",
          properties: {
            title: { type: "string" },
            characters: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  name: { type: "string" },
                  description: { type: "string" },
                },
                required: ["name", "description"],
              },
            },
            scenes: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  title: { type: "string" },
                  frame: { type: "string" },
                  motion: { type: "string" },
                  characters: { type: "array", items: { type: "string" } },
                },
                required: ["title", "frame", "motion", "characters"],
              },
            },
          },
          required: ["title", "characters", "scenes"],
        },
        intelligence_level: "smart",
      });
      const out = (r.result ?? r.output ?? r) as PlanOut;
      if (!out.scenes?.length) throw new Error("Planner returned no scenes");
      await ctx.runMutation(internal.storyboards.setPlan, {
        id: storyboardId,
        title: (out.title || sb.title).slice(0, 80),
        characters: (out.characters ?? []).map(c => ({
          name: c.name,
          description: c.description,
        })),
        scenes: out.scenes.slice(0, sceneCount).map(sc => ({
          title: sc.title,
          frame: sc.frame,
          motion: sc.motion,
          characters: sc.characters ?? [],
        })),
      });
    } catch (e) {
      await ctx.runMutation(internal.storyboards.setError, {
        id: storyboardId,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  },
});

/** Scene pipeline: reference still (text2im) -> image-to-video (LTX). */
export const renderScene = internalAction({
  args: { storyboardId: v.id("storyboards"), sceneIndex: v.number() },
  handler: async (ctx, { storyboardId, sceneIndex }) => {
    const sb = await ctx.runQuery(internal.storyboards.getInternal, {
      id: storyboardId,
    });
    if (!sb) return;
    const scene = sb.scenes[sceneIndex];
    if (!scene) return;
    await ensureHfToken(ctx);
    const stillStyle = sb.settings.realism
      ? "Photorealistic cinematic film still, shot on ARRI Alexa 35, natural skin texture, realistic lighting, no text, no watermark."
      : "Cinematic film still, no text, no watermark.";
    const imagePrompt = `${stillStyle} ${scene.frame}`;
    const { imageJobId, videoJobId } = await ctx.runMutation(
      internal.storyboards.openSceneJobs,
      { id: storyboardId, sceneIndex, imagePrompt, videoPrompt: scene.motion },
    );
    // --- still frame
    await ctx.runMutation(internal.jobs.markRunning, { id: imageJobId });
    let fileId: Id<"_storage"> | undefined;
    try {
      const aspect = (
        await ctx.runQuery(internal.jobs.getInternal, { id: imageJobId })
      )?.params?.aspect as string;
      const result = await callTool<{
        response_text: string;
        image_url?: string | null;
        error?: string | null;
      }>("text2im", {
        prompt: imagePrompt,
        aspect_ratio: aspect ?? "3:2",
        model:
          sb.settings.quality === "best" ? "gpt-image-2" : "gemini-flash-image",
        output_format: "png",
      });
      if (result.error) throw new Error(result.error);
      const imageUrl =
        result.image_url ??
        /https?:\/\/\S+/
          .exec(result.response_text ?? "")?.[0]
          ?.replace(/[.,;)]+$/, "");
      if (!imageUrl) throw new Error("No image returned");
      const bytes = await fetchBytes(imageUrl);
      fileId = await ctx.storage.store(
        new Blob([bytes], { type: "image/png" }),
      );
      await ctx.runMutation(internal.jobs.markDone, {
        id: imageJobId,
        fileId,
        mime: "image/png",
        info:
          sb.settings.quality === "best" ? "GPT Image 2" : "Gemini Flash Image",
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      await ctx.runMutation(internal.jobs.markError, {
        id: imageJobId,
        error: msg,
      });
      await ctx.runMutation(internal.jobs.markError, {
        id: videoJobId,
        error: `Reference still failed: ${msg}`,
      });
      await ctx.runMutation(internal.storyboards.refreshStatus, {
        id: storyboardId,
      });
      return;
    }
    // --- clip from that frame
    await ctx.runMutation(internal.storyboards.attachInput, {
      videoJobId,
      inputFileId: fileId,
    });
    await ctx.scheduler.runAfter(0, internal.engines.renderVideo, {
      jobId: videoJobId,
    });
  },
});
