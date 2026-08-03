"use server";

import { db } from "@/lib/db";
import { getUser } from "@/lib/session";
import { logMilestoneActivity } from "@/lib/milestone-activity";
import { getAccessForMilestone } from "@/lib/supply-chain-queries";
import { canEditMilestone } from "@/lib/supply-chain-permissions";
import { validateImage, validateVideo } from "@/lib/file-validation";
import type { ActionResult } from "@/services/supply-chain";
import type { MediaKind } from "@/types/supply-chain";

export async function uploadMilestoneMediaAction(
  milestoneId: string,
  file: { kind: MediaKind; fileName: string; mimeType: string; sizeBytes: number; dataUrl: string }
): Promise<ActionResult<{ id: string }>> {
  const user = await getUser();
  if (!user) return { success: false, error: "You must be signed in." };

  const access = await getAccessForMilestone(milestoneId, user.id, user.role);
  if (!access) return { success: false, error: "Milestone not found." };
  if (!canEditMilestone(access.access, access.isAssignee)) {
    return { success: false, error: "You don't have permission to upload media here." };
  }

  const validation = file.kind === "IMAGE" ? validateImage(file.mimeType, file.sizeBytes) : validateVideo(file.mimeType, file.sizeBytes);
  if (!validation.valid) return { success: false, error: validation.error! };

  const media = await db.milestoneMedia.create({
    data: {
      milestoneId,
      kind: file.kind,
      fileName: file.fileName,
      mimeType: file.mimeType,
      sizeBytes: file.sizeBytes,
      dataUrl: file.dataUrl,
      uploadedById: user.id,
    },
  });

  await logMilestoneActivity(
    milestoneId,
    file.kind === "IMAGE" ? "Images Uploaded" : "Videos Uploaded",
    `${user.name} uploaded ${file.kind === "IMAGE" ? "an image" : "a video"}: ${file.fileName}.`,
    user.id
  );

  return { success: true, data: { id: media.id } };
}

export async function removeMilestoneMediaAction(mediaId: string): Promise<ActionResult> {
  const user = await getUser();
  if (!user) return { success: false, error: "You must be signed in." };

  const media = await db.milestoneMedia.findUnique({ where: { id: mediaId } });
  if (!media) return { success: false, error: "File not found." };

  const access = await getAccessForMilestone(media.milestoneId, user.id, user.role);
  if (!access) return { success: false, error: "Milestone not found." };
  const canManage = access.access.canEditChain || media.uploadedById === user.id;
  if (!canManage) return { success: false, error: "You don't have permission to remove this file." };

  await db.milestoneMedia.delete({ where: { id: mediaId } });
  await logMilestoneActivity(media.milestoneId, "Media Removed", `${user.name} removed ${media.fileName}.`, user.id);

  return { success: true, data: undefined };
}
