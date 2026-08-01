"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { assignTask } from "@/services/freelancer-service";
import type { FreelancerRecord } from "@/types/freelancer";

interface AssignTaskDialogProps {
  freelancer: FreelancerRecord | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAssigned: (freelancerId: string) => void;
}

export function AssignTaskDialog({ freelancer, open, onOpenChange, onAssigned }: AssignTaskDialogProps) {
  const [target, setTarget] = useState("");
  const [taskTitle, setTaskTitle] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const options = freelancer ? [...freelancer.assignedClients, ...freelancer.assignedSuppliers] : [];

  async function handleSubmit() {
    if (!freelancer || !target || !taskTitle.trim()) {
      toast.error("Select a client/supplier and enter a task title");
      return;
    }
    setSubmitting(true);
    await assignTask(freelancer.id, { clientOrSupplier: target, taskTitle });
    setSubmitting(false);
    toast.success(`Task assigned to ${freelancer.name}`);
    onAssigned(freelancer.id);
    onOpenChange(false);
    setTarget("");
    setTaskTitle("");
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Assign Task {freelancer && `— ${freelancer.name}`}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="assign-target">Client / Supplier</Label>
            <Select value={target} onValueChange={(value) => setTarget(value ?? "")}>
              <SelectTrigger id="assign-target" className="w-full">
                <SelectValue placeholder="Select client or supplier" />
              </SelectTrigger>
              <SelectContent>
                {options.map((name) => (
                  <SelectItem key={name} value={name}>
                    {name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="assign-title">Task Title</Label>
            <Input
              id="assign-title"
              value={taskTitle}
              onChange={(e) => setTaskTitle(e.target.value)}
              placeholder="e.g. Product photoshoot for new listing"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? "Assigning..." : "Assign Task"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
