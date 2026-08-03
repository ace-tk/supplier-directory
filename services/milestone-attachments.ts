"use server";

import { db } from "@/lib/db";
import { getUser } from "@/lib/session";
import { logMilestoneActivity } from "@/lib/milestone-activity";
import { getAccessForMilestone } from "@/lib/supply-chain-queries";
import { canEditMilestone } from "@/lib/supply-chain-permissions";
import { validateDocument } from "@/lib/file-validation";
import type { ActionResult } from "@/services/supply-chain";

export async function uploadMilestoneAttachmentAction(
  milestoneId: string,
  file: { fileName: string; mimeType: string; sizeBytes: number; dataUrl: string }
): Promise<ActionResult<{ id: string }>> {
  const user = await getUser();
  if (!user) return { success: false, error: "You must be signed in." };

  const access = await getAccessForMilestone(milestoneId, user.id, user.role);
  if (!access) return { success: false, error: "Milestone not found." };
  if (!canEditMilestone(access.access, access.isAssignee)) {
    return { success: false, error: "You don't have permission to attach files here." };
  }

  const validation = validateDocument(file.mimeType, file.sizeBytes);
  if (!validation.valid) return { success: false, error: validation.error! };

  const attachment = await db.milestoneAttachment.create({
    data: {
      milestoneId,
      fileName: file.fileName,
      mimeType: file.mimeType,
      sizeBytes: file.sizeBytes,
      dataUrl: file.dataUrl,
      uploadedById: user.id,
    },
  });

  await logMilestoneActivity(milestoneId, "Attachment Added", `${user.name} attached ${file.fileName}.`, user.id);

  return { success: true, data: { id: attachment.id } };
}

export async function removeMilestoneAttachmentAction(attachmentId: string): Promise<ActionResult> {
  const user = await getUser();
  if (!user) return { success: false, error: "You must be signed in." };

  const attachment = await db.milestoneAttachment.findUnique({ where: { id: attachmentId } });
  if (!attachment) return { success: false, error: "File not found." };

  const access = await getAccessForMilestone(attachment.milestoneId, user.id, user.role);
  if (!access) return { success: false, error: "Milestone not found." };
  const canManage = access.access.canEditChain || attachment.uploadedById === user.id;
  if (!canManage) return { success: false, error: "You don't have permission to remove this file." };

  await db.milestoneAttachment.delete({ where: { id: attachmentId } });
  await logMilestoneActivity(attachment.milestoneId, "Attachment Removed", `${user.name} removed ${attachment.fileName}.`, user.id);

  return { success: true, data: undefined };
}
