"use client";

import { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { exportMyDataAction } from "@/services/settings";

export function DataPrivacySection() {
  const [exporting, setExporting] = useState(false);

  async function handleExport() {
    setExporting(true);
    const result = await exportMyDataAction();
    setExporting(false);
    if (!result.success) return toast.error(result.error);

    const blob = new Blob([result.data.json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `supplybase-data-export-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    toast.success("Your data export has downloaded");
  }

  return (
    <div className="space-y-6 max-w-xl">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">Data & Privacy</h2>
        <p className="text-sm text-muted-foreground">Manage the data associated with your account.</p>
      </div>

      <div className="rounded-xl border bg-card p-4">
        <p className="text-sm font-medium">Export my data</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Download a JSON file containing your profile, workspace membership and support request history.
        </p>
        <Button variant="outline" className="mt-3 gap-2" onClick={handleExport} disabled={exporting}>
          {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          Export my data
        </Button>
      </div>

      <div className="rounded-xl border bg-card p-4">
        <p className="text-sm font-medium">Retention</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Your account, workspace and activity data is retained for as long as your account is active. Support requests you submit are retained to keep a record of resolutions.
        </p>
      </div>
    </div>
  );
}
