// Who may call the export API: signed-in users, and only while the
// Pattern Print Studio feature is switched on.

import { getSession } from "@/lib/session";
import { isPatternStudioEnabled } from "../../flag";

/** A refusal to send back, or null if the caller may go ahead. */
export async function refuseExportCall(): Promise<Response | null> {
  if (!isPatternStudioEnabled()) return Response.json({ error: "Not found." }, { status: 404 });
  if (!(await getSession())) return Response.json({ error: "Please sign in again." }, { status: 401 });
  return null;
}

/** The signed-in user's id, or a refusal. */
export async function exportCaller(): Promise<{ userId: string } | { refused: Response }> {
  if (!isPatternStudioEnabled()) return { refused: Response.json({ error: "Not found." }, { status: 404 }) };
  const session = await getSession();
  if (!session?.user?.id) return { refused: Response.json({ error: "Please sign in again." }, { status: 401 }) };
  return { userId: session.user.id };
}
