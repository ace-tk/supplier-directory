"use client";

import { MotionConfig } from "framer-motion";

/** Every framer-motion animation in the app honours prefers-reduced-motion. */
export function MotionProvider({ children }: { children: React.ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
