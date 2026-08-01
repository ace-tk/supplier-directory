import { getUser } from "@/lib/session";
import { PageHeader } from "@/components/layout/page-header";
import { RecordsTable, type RecordColumn } from "@/components/portal/records-table";
import { getDownloads, formatMockDate, type DownloadRecord } from "@/lib/mock-data";
import { FileText } from "lucide-react";

const columns: RecordColumn<DownloadRecord>[] = [
  {
    key: "file",
    label: "File",
    render: (r) => (
      <span className="flex items-center gap-2 font-medium text-foreground">
        <FileText className="h-3.5 w-3.5 text-muted-foreground" />
        {r.fileName}
      </span>
    ),
  },
  { key: "type", label: "Type", render: (r) => r.type },
  { key: "date", label: "Downloaded", render: (r) => formatMockDate(r.date), className: "text-muted-foreground" },
];

export default async function BuyerDownloadsPage() {
  const user = await getUser();
  const downloads = getDownloads(user?.id ?? "guest");

  return (
    <div className="space-y-6">
      <PageHeader
        title="Downloads"
        description="Product and supplier detail sheets you've downloaded from the Shop and Directory."
      />
      <RecordsTable columns={columns} rows={downloads} />
    </div>
  );
}
