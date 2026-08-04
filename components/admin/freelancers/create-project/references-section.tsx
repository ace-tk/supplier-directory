"use client";

import { useRef, useState } from "react";
import { useFormContext, useFieldArray } from "react-hook-form";
import { toast } from "sonner";
import { Plus, Trash2, Loader2, X, Link2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { fileToDataUrl } from "@/lib/file-to-data-url";
import { validateImage } from "@/lib/file-validation";
import type { CreateProjectFormValues, ReferenceLinkValues } from "@/lib/validations/project";

const PLATFORM_OPTIONS: { value: ReferenceLinkValues["platform"]; label: string }[] = [
  { value: "WEBSITE", label: "Website" },
  { value: "INSTAGRAM", label: "Instagram" },
  { value: "LINKEDIN", label: "LinkedIn" },
  { value: "BEHANCE", label: "Behance" },
  { value: "DRIBBBLE", label: "Dribbble" },
  { value: "GOOGLE_DRIVE", label: "Google Drive" },
  { value: "FIGMA", label: "Figma" },
];

export function ReferencesSection() {
  const {
    register,
    control,
    watch,
    setValue,
    formState: { errors },
  } = useFormContext<CreateProjectFormValues>();
  const links = useFieldArray({ control, name: "referenceLinks" });
  const images = useFieldArray({ control, name: "referenceImages" });
  const [uploading, setUploading] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);

  function addLink() {
    links.append({ id: crypto.randomUUID(), platform: "WEBSITE", url: "" });
  }

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (files.length === 0) return;
    setUploading(true);
    try {
      for (const file of files) {
        const validation = validateImage(file.type, file.size);
        if (!validation.valid) {
          toast.error(validation.error);
          continue;
        }
        const dataUrl = await fileToDataUrl(file);
        images.append({ id: crypto.randomUUID(), dataUrl, caption: "", mimeType: file.type, sizeBytes: file.size });
      }
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <Label className="text-xs font-medium">Reference Links</Label>
        {links.fields.length === 0 && (
          <p className="text-xs text-muted-foreground">No reference links added yet.</p>
        )}
        <div className="space-y-2">
          {links.fields.map((field, index) => {
            const platform = watch(`referenceLinks.${index}.platform`);
            const err = errors.referenceLinks?.[index]?.url;
            return (
              <div key={field.id} className="flex items-start gap-2">
                <Select value={platform} onValueChange={(v) => v && setValue(`referenceLinks.${index}.platform`, v as ReferenceLinkValues["platform"])}>
                  <SelectTrigger className="w-36 shrink-0">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PLATFORM_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="flex-1">
                  <Input placeholder="https://..." aria-invalid={!!err} {...register(`referenceLinks.${index}.url`)} />
                  {err && <p className="text-xs text-destructive mt-1">{err.message}</p>}
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="text-muted-foreground hover:text-destructive shrink-0"
                  onClick={() => links.remove(index)}
                  aria-label="Remove link"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            );
          })}
        </div>
        <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={addLink}>
          <Plus className="h-3.5 w-3.5" /> Add Reference Link
        </Button>
      </div>

      <div className="space-y-3">
        <Label className="text-xs font-medium">Reference Images</Label>
        <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-3">
          <button
            type="button"
            onClick={() => imageInputRef.current?.click()}
            disabled={uploading}
            className="aspect-square rounded-xl border-2 border-dashed border-border flex flex-col items-center justify-center gap-1 text-muted-foreground hover:border-primary/50 hover:text-primary transition-colors"
          >
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            <span className="text-[10px]">Add</span>
          </button>
          <input ref={imageInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleImageUpload} />

          {images.fields.map((field, index) => (
            <div key={field.id} className="relative group aspect-square rounded-xl overflow-hidden bg-muted">
              <img src={field.dataUrl} alt="Reference" className="w-full h-full object-cover" />
              <button
                type="button"
                onClick={() => images.remove(index)}
                className="absolute top-1 right-1 flex items-center justify-center w-5 h-5 rounded-full bg-black/60 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                aria-label="Remove image"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      </div>

      {links.fields.length === 0 && images.fields.length === 0 && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Link2 className="h-3.5 w-3.5" /> References are optional but help freelancers understand project expectations.
        </div>
      )}
    </div>
  );
}
