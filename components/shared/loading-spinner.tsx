import { cn } from "@/lib/utils";

interface LoadingSpinnerProps {
  size?: "sm" | "md" | "lg";
  className?: string;
}

const sizeMap = {
  sm: "h-4 w-4 border-2",
  md: "h-6 w-6 border-2",
  lg: "h-10 w-10 border-[3px]",
};

export function LoadingSpinner({ size = "md", className }: LoadingSpinnerProps) {
  return (
    <div
      role="status"
      aria-label="Loading"
      className={cn(
        "rounded-full border-border border-t-primary animate-spin",
        sizeMap[size],
        className
      )}
    />
  );
}

export function LoadingPage() {
  return (
    <div className="flex flex-1 items-center justify-center min-h-[400px]">
      <LoadingSpinner size="lg" />
    </div>
  );
}
