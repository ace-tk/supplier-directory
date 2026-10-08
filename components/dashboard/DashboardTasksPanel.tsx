"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Plus, CheckCircle2, Circle, Loader2, ListChecks } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/empty-state";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { createTaskAction, toggleTaskAction, type TaskRecord } from "@/services/tasks";
import { cn } from "@/lib/utils";
import type { AdminTasksState } from "@/lib/dashboard-queries";

export function DashboardTasksPanel({ initialTasksState }: { initialTasksState: AdminTasksState }) {
  const [tasks, setTasks] = useState<TaskRecord[]>(
    initialTasksState.tasks.map((t) => ({ ...t, dueDate: null }))
  );
  const [completedCount, setCompletedCount] = useState(initialTasksState.completedCount);
  const [totalCount, setTotalCount] = useState(initialTasksState.totalCount);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleToggle(task: TaskRecord) {
    const nextCompleted = !task.completed;
    setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, completed: nextCompleted } : t)));
    setCompletedCount((c) => c + (nextCompleted ? 1 : -1));

    const result = await toggleTaskAction(task.id);
    if (!result.success) {
      // Roll back on failure.
      setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, completed: task.completed } : t)));
      setCompletedCount((c) => c + (nextCompleted ? -1 : 1));
      toast.error(result.error);
    }
  }

  async function handleAddTask() {
    const trimmed = title.trim();
    if (!trimmed) return toast.error("Task title is required.");
    setSaving(true);
    try {
      const result = await createTaskAction({ title: trimmed, dueDate: dueDate || undefined });
      if (!result.success) return toast.error(result.error);
      setTasks((prev) => [result.data, ...prev].slice(0, 5));
      setCompletedCount((c) => c);
      setTotalCount((c) => c + 1);
      setTitle("");
      setDueDate("");
      setDialogOpen(false);
      toast.success("Task added");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Tasks</CardTitle>
          <CardDescription>{completedCount} of {totalCount} complete</CardDescription>
        </CardHeader>
        <CardContent className="space-y-1">
        {tasks.length === 0 ? (
          <EmptyState
            icon={ListChecks}
            title="No tasks yet"
            description="Add a task to keep track of what needs doing."
            className="py-6"
          />
        ) : (
          tasks.map((task) => (
            <button
              key={task.id}
              type="button"
              onClick={() => handleToggle(task)}
              className="w-full flex items-center gap-2.5 py-2 px-1 rounded-xl hover:bg-soft transition-colors group text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {task.completed ? (
                <CheckCircle2 className="h-4 w-4 text-success shrink-0" />
              ) : (
                <Circle className="h-4 w-4 text-muted-foreground/50 shrink-0 group-hover:text-primary transition-colors" />
              )}
              <span className={cn("text-sm flex-1 leading-snug", task.completed ? "line-through text-muted-foreground" : "text-foreground")}>
                {task.title}
              </span>
            </button>
          ))
        )}
        <Button
          variant="soft"
          size="sm"
          className="w-full mt-2 gap-1.5"
          onClick={() => setDialogOpen(true)}
        >
          <Plus className="h-3.5 w-3.5" />
          Add task
        </Button>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add task</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Task title *</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Review new supplier applications" autoFocus />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Due date</Label>
              <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddTask} disabled={saving || !title.trim()}>
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Add Task"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
