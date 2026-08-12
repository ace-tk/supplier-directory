import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Next.js caps Server Action request bodies at 1MB by default. Content
      // Management attachments (and a few other modules) are persisted as
      // base64 data URLs inside `saveContentAction`'s payload — base64
      // inflates raw bytes by ~4/3, so even a single ~750KB document already
      // exceeded the framework default, well under the documented 10MB
      // per-file limit (see lib/file-validation.ts MAX_DOCUMENT_BYTES).
      // 20MB comfortably covers one attachment at the max document size
      // plus encoding/JSON overhead and a few smaller extras, without being
      // unbounded.
      bodySizeLimit: "20mb",
    },
  },
};

export default nextConfig;
