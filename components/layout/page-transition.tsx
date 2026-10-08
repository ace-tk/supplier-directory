"use client";

import { usePathname } from "next/navigation";
import { motion } from "framer-motion";

/** Page enter: fade + 8px rise, 220ms. Transform/opacity only; reduced-motion safe via MotionProvider. */
export function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <motion.div
      key={pathname}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, ease: "easeOut" }}
      className="mx-auto w-full max-w-[1400px]"
    >
      {children}
    </motion.div>
  );
}
