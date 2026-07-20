import type { Metadata } from "next";

export const metadata: Metadata = {
  title: {
    template: "%s | SupplyBase",
    default: "Sign in | SupplyBase",
  },
};

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-sm">{children}</div>
    </div>
  );
}
