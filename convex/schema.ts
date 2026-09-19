import { authTables } from "@convex-dev/auth/server";
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export const jobKind = v.union(
  v.literal("video"),
  v.literal("image"),
  v.literal("music"),
);

export const jobStatus = v.union(
  v.literal("queued"),
  v.literal("running"),
  v.literal("done"),
  v.literal("error"),
);

const schema = defineSchema({
  ...authTables,
  // Runtime secrets for deployments where env vars cannot be set from the
  // sandbox (production). Written only through the admin HTTP route.
  secrets: defineTable({ name: v.string(), value: v.string() }).index(
    "by_name",
    ["name"],
  ),
  jobs: defineTable({
    userId: v.id("users"),
    kind: jobKind,
    status: jobStatus,
    title: v.string(),
    prompt: v.string(),
    // Full prompt actually sent to the engine (with prefixes etc.)
    fullPrompt: v.optional(v.string()),
    params: v.any(),
    seed: v.optional(v.number()),
    inputFileId: v.optional(v.id("_storage")),
    fileId: v.optional(v.id("_storage")),
    externalUrl: v.optional(v.string()),
    mime: v.optional(v.string()),
    info: v.optional(v.string()),
    error: v.optional(v.string()),
    gpuSeconds: v.optional(v.number()),
    // 1 = thumbs up, -1 = thumbs down; feeds the prompt coach's examples
    rating: v.optional(v.number()),
    createdAt: v.number(),
    startedAt: v.optional(v.number()),
    finishedAt: v.optional(v.number()),
  })
    .index("by_user_created", ["userId", "createdAt"])
    .index("by_user_kind_created", ["userId", "kind", "createdAt"])
    .index("by_created", ["createdAt"]),
  storyboards: defineTable({
    userId: v.id("users"),
    idea: v.string(),
    title: v.string(),
    status: v.union(
      v.literal("planning"),
      v.literal("ready"),
      v.literal("rendering"),
      v.literal("done"),
      v.literal("error"),
    ),
    characters: v.array(
      v.object({ name: v.string(), description: v.string() }),
    ),
    scenes: v.array(
      v.object({
        title: v.string(),
        // Still-frame description (what the reference image shows).
        frame: v.string(),
        // Motion + camera for the clip, starting from that frame.
        motion: v.string(),
        characters: v.array(v.string()),
        imageJobId: v.optional(v.id("jobs")),
        videoJobId: v.optional(v.id("jobs")),
      }),
    ),
    settings: v.object({
      format: v.string(),
      seconds: v.number(),
      realism: v.boolean(),
      quality: v.string(),
      hd: v.optional(v.boolean()),
    }),
    error: v.optional(v.string()),
    createdAt: v.number(),
  }).index("by_user_created", ["userId", "createdAt"]),
});

export default schema;
