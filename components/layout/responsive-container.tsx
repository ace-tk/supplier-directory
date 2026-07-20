import { cn } from "@/lib/utils";

interface ResponsiveContainerProps {
  children: React.ReactNode;
  className?: string;
  size?: "sm" | "md" | "lg" | "xl" | "full";
}

const sizeMap = {
  sm: "max-w-2xl",
  md: "max-w-4xl",
  lg: "max-w-6xl",
  xl: "max-w-7xl",
  full: "max-w-full",
};

export function ResponsiveContainer({
  children,
  className,
  size = "xl",
}: ResponsiveContainerProps) {
  return (
    <div className={cn("w-full mx-auto", sizeMap[size], className)}>
      {children}
    </div>
  );
}
