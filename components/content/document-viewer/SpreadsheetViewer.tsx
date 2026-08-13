"use client";

import { useEffect, useRef, useState } from "react";
import { Download, Maximize2, Minimize2 } from "lucide-react";
import { readSpreadsheet, type SpreadsheetWorkbook } from "@/lib/spreadsheet-client";
import { formatFileSize } from "@/lib/content-ui";
import { cn } from "@/lib/utils";
import { downloadDataUrl, IconButton, ViewerChrome, useFullscreen, LoadingState, type ViewerVariant } from "./shared";
import { UnsupportedViewer } from "./UnsupportedViewer";
import type { DraftAttachment } from "@/types/content";

/** Read-only spreadsheet preview via SheetJS — real workbook sheets, rows,
 * and columns, not a fabricated table. Column A is rendered as a sticky
 * row-number rail; row 1 is a sticky header. */
export function SpreadsheetViewer({ file, variant = "compact" }: { file: DraftAttachment; variant?: ViewerVariant }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { isFullscreen, toggle: toggleFullscreen } = useFullscreen(containerRef);
  const [workbook, setWorkbook] = useState<SpreadsheetWorkbook | null>(null);
  const [sheetIndex, setSheetIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    readSpreadsheet(file.dataUrl)
      .then((wb) => {
        if (cancelled) return;
        setWorkbook(wb);
        setSheetIndex(0);
      })
      .catch(() => {
        if (!cancelled) setError("Couldn't preview this spreadsheet.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [retryKey]);

  if (error) {
    return (
      <UnsupportedViewer
        file={file}
        message={error}
        onRetry={() => {
          setError(null);
          setLoading(true);
          setRetryKey((k) => k + 1);
        }}
      />
    );
  }

  const sheet = workbook?.sheets[sheetIndex] ?? null;
  const colCount = sheet ? Math.max(0, ...sheet.rows.map((r) => r.length)) : 0;

  return (
    <ViewerChrome
      containerRef={containerRef}
      variant={variant}
      contentClassName={variant === "large" ? "flex-1 min-h-0 flex flex-col bg-muted/20" : "max-h-[420px] flex flex-col bg-muted/20"}
      toolbar={
        <>
          <div className="flex items-center gap-1 overflow-x-auto">
            {loading ? (
              <span className="text-xs text-muted-foreground">Loading...</span>
            ) : (
              workbook?.sheets.map((s, i) => (
                <button
                  key={s.name}
                  type="button"
                  onClick={() => setSheetIndex(i)}
                  className={cn(
                    "shrink-0 rounded-md px-2 py-1 text-xs font-medium transition-colors",
                    i === sheetIndex ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted"
                  )}
                >
                  {s.name}
                </button>
              ))
            )}
          </div>
          <div className="flex items-center gap-2 ml-auto shrink-0">
            <span className="text-xs text-muted-foreground">{formatFileSize(file.sizeBytes)}</span>
            <IconButton label="Download" onClick={() => downloadDataUrl(file.dataUrl, file.fileName)}>
              <Download className="h-3.5 w-3.5" />
            </IconButton>
            <IconButton label={isFullscreen ? "Exit fullscreen" : "Fullscreen"} onClick={toggleFullscreen} active={isFullscreen}>
              {isFullscreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
            </IconButton>
          </div>
        </>
      }
    >
      {loading ? (
        <LoadingState />
      ) : !sheet || sheet.rows.length === 0 ? (
        <div className="flex items-center justify-center h-40 w-full text-sm text-muted-foreground">This sheet is empty.</div>
      ) : (
        <div className="flex-1 min-h-0 overflow-auto">
          <table className="border-collapse text-xs">
            <tbody>
              {sheet.rows.map((row, r) => (
                <tr key={r}>
                  <td
                    className={cn(
                      "sticky left-0 z-10 bg-muted border border-border px-2 py-1 text-center text-muted-foreground font-medium tabular-nums",
                      r === 0 && "sticky top-0 z-20"
                    )}
                  >
                    {r + 1}
                  </td>
                  {Array.from({ length: colCount }).map((_, c) => (
                    <td
                      key={c}
                      className={cn(
                        "border border-border px-2 py-1 min-w-[90px] max-w-[240px] truncate text-foreground bg-card",
                        r === 0 && "sticky top-0 z-10 bg-muted font-semibold"
                      )}
                      title={row[c] ?? ""}
                    >
                      {row[c] ?? ""}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {(sheet?.truncatedRows || sheet?.truncatedCols) && (
        <p className="shrink-0 px-3 py-1.5 text-[11px] text-muted-foreground border-t border-border bg-muted/40">
          Showing {sheet.rows.length} of {sheet.totalRows} rows
          {sheet.truncatedCols ? ` and the first ${sheet.rows[0]?.length ?? 0} of ${sheet.totalCols} columns` : ""} — download the file for
          the full sheet.
        </p>
      )}
    </ViewerChrome>
  );
}
