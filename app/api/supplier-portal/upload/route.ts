import { NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { isObjectStorageConfigured, uploadObjectBytes } from "@/lib/object-storage";

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const maxSize = 10 * 1024 * 1024; // 10 MB
    if (file.size > maxSize) {
      return NextResponse.json({ error: "File too large (max 10MB)" }, { status: 413 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const ext = path.extname(file.name) || "";
    const safeName = `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`;

    // Object storage first (works on any host, including serverless — the
    // local-disk fallback below only persists on a single, long-lived
    // instance). Falls back to local disk when SUPABASE_URL/
    // SUPABASE_SERVICE_ROLE_KEY aren't set yet, so this route keeps working
    // exactly as before until credentials are provisioned — see
    // lib/object-storage.ts and DEPLOYMENT.md's Architecture Notes.
    if (isObjectStorageConfigured()) {
      const url = await uploadObjectBytes(
        `supplier-portal/${safeName}`,
        buffer,
        file.type || "application/octet-stream"
      );
      return NextResponse.json({ url, name: file.name, size: file.size });
    }

    const uploadDir = path.join(process.cwd(), "public", "uploads", "portal");
    await mkdir(uploadDir, { recursive: true });
    await writeFile(path.join(uploadDir, safeName), buffer);

    return NextResponse.json({
      url: `/uploads/portal/${safeName}`,
      name: file.name,
      size: file.size,
    });
  } catch (err) {
    console.error("[POST /api/supplier-portal/upload]", err);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
