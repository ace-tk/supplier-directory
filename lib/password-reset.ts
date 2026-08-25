import crypto from "crypto";
import { db } from "@/lib/db";

const TOKEN_TTL_MS = 1000 * 60 * 60 * 24; // 24 hours

export function hashToken(rawToken: string): string {
  return crypto.createHash("sha256").update(rawToken).digest("hex");
}

/** Builds the raw token and its database-safe representation without
 * performing a write. This lets multi-record account creation include the
 * token in the same atomic nested Prisma write. */
export function preparePasswordResetToken(): {
  rawToken: string;
  tokenHash: string;
  expiresAt: Date;
} {
  const rawToken = crypto.randomBytes(32).toString("hex");
  return {
    rawToken,
    tokenHash: hashToken(rawToken),
    expiresAt: new Date(Date.now() + TOKEN_TTL_MS),
  };
}

/** Creates a real, single-use reset/activation token. Returns the RAW token
 * exactly once — only its hash is ever persisted, so it cannot be recovered
 * from the database afterward. Caller is responsible for delivering it
 * (there is no email provider in this codebase — see requestPasswordResetAction
 * and createFreelancerAction for how each caller handles that honestly). */
export async function createPasswordResetToken(userId: string): Promise<{ rawToken: string; expiresAt: Date }> {
  const { rawToken, tokenHash, expiresAt } = preparePasswordResetToken();

  await db.passwordResetToken.create({
    data: { userId, tokenHash, expiresAt },
  });

  return { rawToken, expiresAt };
}

export async function consumePasswordResetToken(
  rawToken: string
): Promise<{ userId: string } | { error: string }> {
  const record = await db.passwordResetToken.findUnique({
    where: { tokenHash: hashToken(rawToken) },
  });
  if (!record) return { error: "This reset link is invalid." };
  if (record.usedAt) return { error: "This reset link has already been used." };
  if (record.expiresAt < new Date()) return { error: "This reset link has expired." };

  return { userId: record.userId };
}

export async function markPasswordResetTokenUsed(rawToken: string): Promise<void> {
  await db.passwordResetToken.updateMany({
    where: { tokenHash: hashToken(rawToken) },
    data: { usedAt: new Date() },
  });
}
