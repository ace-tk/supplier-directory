import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  try {
    const count = await db.supplierListing.count();
    return NextResponse.json({ ok: true, count });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack : "";
    return NextResponse.json({ error: msg, stack }, { status: 500 });
  }
}
