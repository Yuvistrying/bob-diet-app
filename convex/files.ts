import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// Generate an upload URL for the client to upload a file
export const generateUploadUrl = mutation({
  args: {
    // Optional metadata about the file
    metadata: v.optional(
      v.object({
        type: v.string(),
        purpose: v.string(),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    // Generate the upload URL
    const uploadUrl = await ctx.storage.generateUploadUrl();

    // Optionally store metadata about the upcoming upload
    if (args.metadata) {
      await ctx.db.insert("files", {
        userId: identity.subject,
        uploadUrl,
        metadata: args.metadata,
        uploadedAt: Date.now(),
        storageId: undefined, // Will be updated after upload
      });
    }

    return uploadUrl;
  },
});

// Get a file URL from storage ID
export const getImageUrl = query({
  args: {
    storageId: v.id("_storage"),
  },
  handler: async (ctx, { storageId }) => {
    const url = await ctx.storage.getUrl(storageId);
    return url;
  },
});

// Get multiple image URLs at once
export const getMultipleImageUrls = query({
  args: {
    storageIds: v.array(v.id("_storage")),
  },
  handler: async (ctx, { storageIds }) => {
    const urls: Record<string, string | null> = {};

    for (const storageId of storageIds) {
      try {
        const url = await ctx.storage.getUrl(storageId);
        urls[storageId] = url;
      } catch (error) {
        console.error(`Failed to get URL for storageId ${storageId}:`, error);
        urls[storageId] = null;
      }
    }

    return urls;
  },
});

// Store the storage ID after successful upload
export const storeFileId = mutation({
  args: {
    storageId: v.id("_storage"),
    uploadUrl: v.optional(v.string()),
  },
  handler: async (ctx, { storageId, uploadUrl }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    // If we tracked this upload, update the record
    if (uploadUrl) {
      const file = await ctx.db
        .query("files")
        .withIndex("by_upload_url", (q) => q.eq("uploadUrl", uploadUrl))
        .first();

      if (file) {
        await ctx.db.patch(file._id, {
          storageId,
          uploadedAt: Date.now(),
        });
      }
    } else {
      // Otherwise create a new record
      await ctx.db.insert("files", {
        userId: identity.subject,
        storageId,
        uploadedAt: Date.now(),
        metadata: { type: "image", purpose: "food-analysis" },
      });
    }

    return storageId;
  },
});
