import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import type { AuthSession, SessionUser } from "@/types/auth";

const SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET ?? "supplybase-dev-secret-change-in-production"
);

const COOKIE_NAME = "sb_session";
const DEFAULT_MAX_AGE = 60 * 60 * 24 * 7; // 7 days
const REMEMBER_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

export async function createSession(
  user: SessionUser,
  rememberMe = false
): Promise<string> {
  const maxAge = rememberMe ? REMEMBER_MAX_AGE : DEFAULT_MAX_AGE;
  const expiresAt = Date.now() + maxAge * 1000;

  const token = await new SignJWT({ user, expiresAt })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(Math.floor(expiresAt / 1000))
    .sign(SECRET);

  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge,
    path: "/",
  });

  return token;
}

export async function getSession(): Promise<AuthSession | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(COOKIE_NAME)?.value;
    if (!token) return null;

    const { payload } = await jwtVerify(token, SECRET);
    const session = payload as unknown as AuthSession;

    if (session.expiresAt < Date.now()) {
      await destroySession();
      return null;
    }

    return session;
  } catch {
    return null;
  }
}

export async function destroySession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

export async function getUser(): Promise<SessionUser | null> {
  const session = await getSession();
  return session?.user ?? null;
}
