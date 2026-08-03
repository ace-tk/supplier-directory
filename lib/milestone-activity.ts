import { db } from "@/lib/db";

export async function logMilestoneActivity(
  milestoneId: string,
  type: string,
  description: string,
  actorId?: string
): Promise<void> {
  await db.milestoneActivity.create({ data: { milestoneId, type, description, actorId } });
}
