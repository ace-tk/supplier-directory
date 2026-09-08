// Shared JWT signing/verification key for lib/session.ts and proxy.ts.
// In production, JWT_SECRET must be set explicitly — silently falling back
// to the dev placeholder would let anyone forge session cookies using a
// value that's public in this repo's history.
const DEV_FALLBACK_SECRET = "supplybase-dev-secret-change-in-production";

function resolveSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (secret) return secret;

  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "JWT_SECRET environment variable is required in production. Set it before starting the app."
    );
  }

  return DEV_FALLBACK_SECRET;
}

export const AUTH_SECRET = new TextEncoder().encode(resolveSecret());
