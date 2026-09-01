"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getUser } from "@/lib/session";
import { getCurrentWorkspaceAccess } from "@/lib/team-auth";
import { extractDataUrlMeta, validateDocumentOrImage } from "@/lib/file-validation";
import { submitSupportRequestSchema, type SubmitSupportRequestInput } from "@/lib/validations/support";
import type { SupportRequestStatus } from "@/lib/generated/prisma/enums";

type Result<T = void> = { success: true; data: T } | { success: false; error: string };

export async function submitSupportRequestAction(input: SubmitSupportRequestInput): Promise<Result<{ id: string }>> {
  const user = await getUser();
  if (!user) return { success: false, error: "Sign in required." };

  const parsed = submitSupportRequestSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid request." };
  const data = parsed.data;

  let attachmentUrl: string | null = null;
  let attachmentName: string | null = null;
  let attachmentSize: number | null = null;
  if (data.attachment) {
    const { mimeType, sizeBytes } = extractDataUrlMeta(data.attachment.dataUrl);
    const validation = validateDocumentOrImage(mimeType, sizeBytes, data.attachment.name);
    if (!validation.valid) return { success: false, error: validation.error! };
    attachmentUrl = data.attachment.dataUrl;
    attachmentName = data.attachment.name;
    attachmentSize = sizeBytes;
  }

  const created = await db.supportRequest.create({
    data: {
      userId: user.id,
      type: data.type,
      subject: data.subject,
      category: data.category,
      priority: data.priority,
      description: data.description,
      module: data.module || null,
      route: data.route || null,
      attachmentUrl,
      attachmentName,
      attachmentSize,
    },
    select: { id: true },
  });

  revalidatePath("/help");
  return { success: true, data: { id: created.id } };
}

export async function updateSupportRequestStatusAction(id: string, status: SupportRequestStatus): Promise<Result> {
  const access = await getCurrentWorkspaceAccess();
  if (!access || !access.isOwner) return { success: false, error: "Owner access required." };

  const existing = await db.supportRequest.findUnique({ where: { id }, select: { id: true } });
  if (!existing) return { success: false, error: "Support request not found." };

  await db.supportRequest.update({ where: { id }, data: { status } });
  revalidatePath("/help");
  return { success: true, data: undefined };
}
