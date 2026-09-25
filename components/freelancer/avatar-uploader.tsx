"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { Camera, Loader2 } from "lucide-react";
import { fileToDataUrl } from "@/lib/file-to-data-url";
import { updateAvatarAction } from "@/services/freelancer";
import { initialsFor } from "@/lib/freelancer-ui";

export function AvatarUploader({ name, avatar }: { name: string; avatar: string | null }) {
  const [currentAvatar, setCurrentAvatar] = useState(avatar);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploading(true);
    try {
      const dataUrl = await fileToDataUrl(file);
      const result = await updateAvatarAction(dataUrl);
      if (!result.success) return toast.error(result.error);
      setCurrentAvatar(dataUrl);
      toast.success("Profile picture updated");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="relative shrink-0">
      <div className="flex items-center justify-center w-20 h-20 rounded-2xl bg-primary/10 text-primary text-xl font-semibold overflow-hidden">
        {currentAvatar ? (
          <img src={currentAvatar} alt={name} className="w-full h-full object-cover" />
        ) : (
          initialsFor(name)
        )}
      </div>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        className="absolute -bottom-1.5 -right-1.5 flex items-center justify-center w-7 h-7 rounded-full bg-primary text-primary-foreground border-2 border-background hover:bg-primary/90 transition-colors"
        aria-label="Change profile picture"
      >
        {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Camera className="h-3.5 w-3.5" />}
      </button>
      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleChange} />
    </div>
  );
}
