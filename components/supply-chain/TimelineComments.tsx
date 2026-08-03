"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Send, Pencil, Trash2, Reply, Check, X } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { formatDateTime, initialsFor, avatarColorFor } from "@/lib/supply-chain-ui";
import { addCommentAction, editCommentAction, deleteCommentAction } from "@/services/milestone-comments";
import { cn } from "@/lib/utils";
import type { MilestoneCommentEntry } from "@/types/supply-chain";
import type { SessionUser } from "@/types/auth";

interface TimelineCommentsProps {
  milestoneId: string;
  comments: MilestoneCommentEntry[];
  canComment: boolean;
  currentUser: SessionUser | null;
  onCommentsChange: (comments: MilestoneCommentEntry[]) => void;
}

function CommentRow({
  comment,
  currentUser,
  onReply,
  onEdit,
  onDelete,
}: {
  comment: MilestoneCommentEntry;
  currentUser: SessionUser | null;
  onReply: () => void;
  onEdit: (content: string) => Promise<void>;
  onDelete: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(comment.content);
  const isOwn = currentUser?.id === comment.author.id;

  return (
    <div className="flex gap-2.5">
      <Avatar size="sm" className="mt-0.5 shrink-0">
        <AvatarFallback className={cn("text-white text-[9px] font-semibold", avatarColorFor(comment.author.id))}>
          {initialsFor(comment.author.name)}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <p className="text-xs font-medium text-foreground">{comment.author.name}</p>
          <p className="text-[10px] text-muted-foreground">
            {formatDateTime(comment.createdAt)}
            {comment.edited && " · edited"}
          </p>
        </div>

        {editing ? (
          <div className="mt-1 space-y-1.5">
            <Textarea rows={2} value={draft} onChange={(e) => setDraft(e.target.value)} className="text-xs" />
            <div className="flex items-center gap-1.5">
              <Button
                size="sm"
                onClick={async () => {
                  await onEdit(draft);
                  setEditing(false);
                }}
              >
                <Check className="h-3 w-3" /> Save
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
                <X className="h-3 w-3" /> Cancel
              </Button>
            </div>
          </div>
        ) : (
          <p className="text-xs text-foreground/90 mt-0.5 whitespace-pre-wrap">{comment.content}</p>
        )}

        {!editing && (
          <div className="flex items-center gap-3 mt-1">
            <button type="button" onClick={onReply} className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground">
              <Reply className="h-3 w-3" /> Reply
            </button>
            {isOwn && (
              <>
                <button
                  type="button"
                  onClick={() => setEditing(true)}
                  className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground"
                >
                  <Pencil className="h-3 w-3" /> Edit
                </button>
                <button
                  type="button"
                  onClick={onDelete}
                  className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="h-3 w-3" /> Delete
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export function TimelineComments({ milestoneId, comments, canComment, currentUser, onCommentsChange }: TimelineCommentsProps) {
  const [draft, setDraft] = useState("");
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const topLevel = [...comments].filter((c) => !c.parentCommentId).reverse();
  const repliesFor = (id: string) => [...comments].filter((c) => c.parentCommentId === id).reverse();

  async function handleSubmit() {
    if (!draft.trim() || !currentUser) return;
    setSubmitting(true);
    const result = await addCommentAction(milestoneId, draft.trim(), replyTo ?? undefined);
    setSubmitting(false);
    if (!result.success) {
      toast.error(result.error);
      return;
    }
    onCommentsChange([
      {
        id: result.data.id,
        content: draft.trim(),
        author: {
          id: currentUser.id,
          name: currentUser.name,
          email: currentUser.email,
          role: currentUser.role,
          avatar: currentUser.avatar ?? null,
          companyName: null,
        },
        parentCommentId: replyTo,
        edited: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      ...comments,
    ]);
    setDraft("");
    setReplyTo(null);
  }

  async function handleEdit(commentId: string, content: string) {
    const result = await editCommentAction(commentId, content);
    if (!result.success) {
      toast.error(result.error);
      return;
    }
    onCommentsChange(comments.map((c) => (c.id === commentId ? { ...c, content, edited: true } : c)));
  }

  async function handleDelete(commentId: string) {
    const result = await deleteCommentAction(commentId);
    if (!result.success) {
      toast.error(result.error);
      return;
    }
    onCommentsChange(comments.filter((c) => c.id !== commentId));
  }

  return (
    <div className="space-y-4">
      {canComment && (
        <div className="space-y-1.5">
          {replyTo && (
            <div className="flex items-center justify-between text-[10px] text-muted-foreground bg-muted/50 rounded-md px-2 py-1">
              <span>Replying to a comment</span>
              <button type="button" onClick={() => setReplyTo(null)} className="hover:text-foreground">
                <X className="h-3 w-3" />
              </button>
            </div>
          )}
          <div className="flex items-end gap-2">
            <Textarea
              rows={2}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Add a comment..."
              className="text-xs"
            />
            <Button size="icon" onClick={handleSubmit} disabled={submitting || !draft.trim()} aria-label="Post comment">
              <Send className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}

      <div className="space-y-4">
        {topLevel.map((comment) => (
          <div key={comment.id} className="space-y-3">
            <CommentRow
              comment={comment}
              currentUser={currentUser}
              onReply={() => setReplyTo(comment.id)}
              onEdit={(content) => handleEdit(comment.id, content)}
              onDelete={() => handleDelete(comment.id)}
            />
            {repliesFor(comment.id).length > 0 && (
              <div className="pl-8 space-y-3 border-l border-border/60 ml-3.5">
                {repliesFor(comment.id).map((reply) => (
                  <CommentRow
                    key={reply.id}
                    comment={reply}
                    currentUser={currentUser}
                    onReply={() => setReplyTo(comment.id)}
                    onEdit={(content) => handleEdit(reply.id, content)}
                    onDelete={() => handleDelete(reply.id)}
                  />
                ))}
              </div>
            )}
          </div>
        ))}
        {topLevel.length === 0 && <p className="text-center text-[11px] text-muted-foreground/60 py-4">No comments yet.</p>}
      </div>
    </div>
  );
}
