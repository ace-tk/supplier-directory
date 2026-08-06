"use server";

import { db } from "@/lib/db";
import { getUser } from "@/lib/session";
import { validateImage, validateDocument } from "@/lib/file-validation";
import { saveContentSchema } from "@/lib/validations/content";
import { getContentItemForOwner, getContentListForOwner, getTemplatesForOwner } from "@/lib/content-queries";
import type { ContentItemRecord, ContentItemSummary } from "@/types/content";
import type { ContentStatus, ContentType, ContentLanguage, ContentTone, ContentAudience } from "@/lib/generated/prisma/enums";

export type ActionResult<T = void> = { success: true; data: T } | { success: false; error: string };

async function requireUser() {
  const user = await getUser();
  return user ?? null;
}

export async function getContentListAction(): Promise<ActionResult<ContentItemSummary[]>> {
  const user = await requireUser();
  if (!user) return { success: false, error: "You must be signed in." };
  return { success: true, data: await getContentListForOwner(user.id) };
}

export async function getTemplatesAction(): Promise<ActionResult<ContentItemSummary[]>> {
  const user = await requireUser();
  if (!user) return { success: false, error: "You must be signed in." };
  return { success: true, data: await getTemplatesForOwner(user.id) };
}

export async function getContentItemAction(id: string): Promise<ActionResult<ContentItemRecord>> {
  const user = await requireUser();
  if (!user) return { success: false, error: "You must be signed in." };

  const item = await getContentItemForOwner(id, user.id);
  if (!item) return { success: false, error: "Content not found." };
  return { success: true, data: item };
}

export interface SaveContentPayload {
  id?: string;
  title: string;
  category?: string;
  tags: string[];
  featuredImageUrl?: string;
  bodyHtml: string;
  attachments: { fileName: string; mimeType: string; sizeBytes: number; dataUrl: string }[];
  status: ContentStatus;
  prompt?: string;
  contentType?: ContentType;
  language?: ContentLanguage;
  tone?: ContentTone;
  audience?: ContentAudience;
  isTemplate?: boolean;
}

export async function saveContentAction(input: SaveContentPayload): Promise<ActionResult<{ id: string }>> {
  const user = await requireUser();
  if (!user) return { success: false, error: "You must be signed in." };

  const parsed = saveContentSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };
  const data = parsed.data;

  if (data.featuredImageUrl) {
    const match = /^data:(.+);base64,/.exec(data.featuredImageUrl);
    const sizeBytes = Math.round((data.featuredImageUrl.length * 3) / 4);
    const v = validateImage(match?.[1] ?? "", sizeBytes);
    if (!v.valid) return { success: false, error: v.error! };
  }
  for (const att of data.attachments) {
    const okAsDocument = validateDocument(att.mimeType, att.sizeBytes).valid;
    const okAsImage = validateImage(att.mimeType, att.sizeBytes).valid;
    if (!okAsDocument && !okAsImage) {
      return { success: false, error: `${att.fileName}: unsupported file type or file too large.` };
    }
  }

  if (data.id) {
    const existing = await db.contentItem.findUnique({ where: { id: data.id }, select: { ownerId: true } });
    if (!existing || existing.ownerId !== user.id) return { success: false, error: "Content not found." };

    await db.contentItem.update({
      where: { id: data.id },
      data: {
        title: data.title.trim(),
        category: data.category?.trim() || null,
        tags: data.tags,
        featuredImageUrl: data.featuredImageUrl || null,
        bodyHtml: data.bodyHtml,
        status: input.status,
        publishedAt: input.status === "PUBLISHED" ? new Date() : undefined,
        prompt: data.prompt,
        contentType: data.contentType,
        language: data.language,
        tone: data.tone,
        audience: data.audience,
        isTemplate: data.isTemplate,
        attachments: {
          deleteMany: {},
          create: data.attachments.map((a) => ({
            fileName: a.fileName,
            mimeType: a.mimeType,
            sizeBytes: a.sizeBytes,
            dataUrl: a.dataUrl,
          })),
        },
      },
    });

    return { success: true, data: { id: data.id } };
  }

  const created = await db.contentItem.create({
    data: {
      title: data.title.trim(),
      category: data.category?.trim() || null,
      tags: data.tags,
      featuredImageUrl: data.featuredImageUrl || null,
      bodyHtml: data.bodyHtml,
      status: input.status,
      publishedAt: input.status === "PUBLISHED" ? new Date() : null,
      prompt: data.prompt,
      contentType: data.contentType,
      language: data.language,
      tone: data.tone,
      audience: data.audience,
      isTemplate: data.isTemplate ?? false,
      ownerId: user.id,
      attachments: {
        create: data.attachments.map((a) => ({
          fileName: a.fileName,
          mimeType: a.mimeType,
          sizeBytes: a.sizeBytes,
          dataUrl: a.dataUrl,
        })),
      },
    },
    select: { id: true },
  });

  return { success: true, data: { id: created.id } };
}

export async function renameContentAction(id: string, title: string): Promise<ActionResult<void>> {
  const user = await requireUser();
  if (!user) return { success: false, error: "You must be signed in." };
  if (!title.trim() || title.trim().length < 2) return { success: false, error: "Title is required." };

  const existing = await db.contentItem.findUnique({ where: { id }, select: { ownerId: true } });
  if (!existing || existing.ownerId !== user.id) return { success: false, error: "Content not found." };

  await db.contentItem.update({ where: { id }, data: { title: title.trim() } });
  return { success: true, data: undefined };
}

export async function setContentStatusAction(id: string, status: ContentStatus): Promise<ActionResult<void>> {
  const user = await requireUser();
  if (!user) return { success: false, error: "You must be signed in." };

  const existing = await db.contentItem.findUnique({ where: { id }, select: { ownerId: true } });
  if (!existing || existing.ownerId !== user.id) return { success: false, error: "Content not found." };

  await db.contentItem.update({
    where: { id },
    data: { status, publishedAt: status === "PUBLISHED" ? new Date() : undefined },
  });

  return { success: true, data: undefined };
}

export async function deleteContentAction(id: string): Promise<ActionResult<void>> {
  const user = await requireUser();
  if (!user) return { success: false, error: "You must be signed in." };

  const existing = await db.contentItem.findUnique({ where: { id }, select: { ownerId: true } });
  if (!existing || existing.ownerId !== user.id) return { success: false, error: "Content not found." };

  await db.contentItem.delete({ where: { id } });
  return { success: true, data: undefined };
}
