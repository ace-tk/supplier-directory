"use client";

import { useState } from "react";
import { Loader2, Trash2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";

interface DeleteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyName: string;
  onConfirm: () => Promise<void>;
}

export function DeleteDialog({
  open,
  onOpenChange,
  companyName,
  onConfirm,
}: DeleteDialogProps) {
  const [deleting, setDeleting] = useState(false);

  async function handleConfirm() {
    setDeleting(true);
    await onConfirm();
    setDeleting(false);
    onOpenChange(false);
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <div className="flex items-center justify-center w-12 h-12 rounded-full bg-destructive/10 mx-auto mb-2">
            <Trash2 className="h-5 w-5 text-destructive" />
          </div>
          <AlertDialogTitle className="text-center">Remove supplier?</AlertDialogTitle>
          <AlertDialogDescription className="text-center">
            <strong className="font-medium text-foreground">{companyName}</strong> will be
            permanently removed from the directory. This cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="sm:justify-center">
          <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={deleting}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/80 gap-1.5"
          >
            {deleting ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Deleting…
              </>
            ) : (
              <>
                <Trash2 className="h-3.5 w-3.5" />
                Delete supplier
              </>
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
