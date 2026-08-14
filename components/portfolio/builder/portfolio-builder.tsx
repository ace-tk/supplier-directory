"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { ExternalLink, Loader2 } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { StatusBadge } from "@/components/portal/status-badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { PortfolioRenderer } from "@/components/portfolio/templates/registry";
import { TemplatePicker } from "@/components/portfolio/builder/template-picker";
import { ContentForm } from "@/components/portfolio/builder/content-form";
import { ProjectsManager } from "@/components/portfolio/builder/projects-manager";
import { BoardsManager } from "@/components/portfolio/builder/boards-manager";
import { publishPortfolioAction, unpublishPortfolioAction } from "@/services/portfolio";
import type { PortfolioViewModel } from "@/types/portfolio";

export function PortfolioBuilder({ initialData, userId }: { initialData: PortfolioViewModel; userId: string }) {
  const [data, setData] = useState(initialData);
  const [publishing, setPublishing] = useState(false);

  const isPublished = data.status === "PUBLISHED";
  const publicUrl = `/portfolio/${userId}`;

  async function handlePublishToggle() {
    setPublishing(true);
    const result = isPublished ? await unpublishPortfolioAction() : await publishPortfolioAction();
    setPublishing(false);
    if (!result.success) return toast.error(result.error);
    setData(result.data);
    toast.success(isPublished ? "Portfolio unpublished" : "Portfolio published");
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <PageHeader title="My Portfolio" description="Build and publish your one-page portfolio website." />
        <div className="flex items-center gap-2 shrink-0">
          <StatusBadge status={isPublished ? "Published" : "Draft"} />
          {isPublished && (
            <Link href={publicUrl} target="_blank">
              <Button variant="outline" size="sm" className="gap-1.5">
                <ExternalLink className="h-3.5 w-3.5" /> View Live
              </Button>
            </Link>
          )}
          <Button size="sm" variant={isPublished ? "outline" : "default"} onClick={handlePublishToggle} disabled={publishing} className="gap-1.5">
            {publishing && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {isPublished ? "Unpublish" : "Publish"}
          </Button>
        </div>
      </div>

      <Tabs defaultValue="template">
        <TabsList>
          <TabsTrigger value="template">Template</TabsTrigger>
          <TabsTrigger value="content">Content</TabsTrigger>
          <TabsTrigger value="projects">Projects</TabsTrigger>
          <TabsTrigger value="boards">Boards</TabsTrigger>
          <TabsTrigger value="preview">Preview</TabsTrigger>
        </TabsList>

        <TabsContent value="template" className="pt-6">
          <TemplatePicker data={data} onChange={setData} />
        </TabsContent>

        <TabsContent value="content" className="pt-6">
          <ContentForm data={data} onChange={setData} />
        </TabsContent>

        <TabsContent value="projects" className="pt-6">
          <ProjectsManager data={data} onChange={setData} />
        </TabsContent>

        <TabsContent value="boards" className="pt-6">
          <BoardsManager data={data} onChange={setData} />
        </TabsContent>

        <TabsContent value="preview" className="pt-6">
          <div className="rounded-xl border border-border overflow-hidden">
            <PortfolioRenderer data={data} />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
