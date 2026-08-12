"use client";

import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { AttachedFilesPanel } from "./AttachedFilesPanel";
import { CompactTemplateBrowser } from "./CompactTemplateBrowser";
import type { DraftAttachment, ContentItemRecord } from "@/types/content";

export function ContentWorkspaceSidebar({
  basePath,
  attachments,
  onAttachmentsChange,
  onUseTemplate,
  selectedAttachment,
  onSelectAttachment,
}: {
  basePath: string;
  attachments: DraftAttachment[];
  onAttachmentsChange: (next: DraftAttachment[]) => void;
  onUseTemplate: (item: ContentItemRecord) => void;
  selectedAttachment: DraftAttachment | null;
  onSelectAttachment: (file: DraftAttachment | null) => void;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <Tabs defaultValue="files">
        <TabsList className="w-full">
          <TabsTrigger value="files" className="flex-1">
            Files
          </TabsTrigger>
          <TabsTrigger value="templates" className="flex-1">
            Templates
          </TabsTrigger>
        </TabsList>
        <TabsContent value="files" className="pt-3">
          <AttachedFilesPanel
            attachments={attachments}
            onAttachmentsChange={onAttachmentsChange}
            selected={selectedAttachment}
            onSelect={onSelectAttachment}
          />
        </TabsContent>
        <TabsContent value="templates" className="pt-3">
          <CompactTemplateBrowser basePath={basePath} onUseTemplate={onUseTemplate} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
