"use client";

import { useState } from "react";
import { format } from "date-fns";
import { toast } from "sonner";
import {
  X, ShieldCheck, MapPin, Calendar, Clock,
  Package, TrendingUp, CheckSquare, Activity, FileText, Plus
} from "lucide-react";
import { Conversation, Task } from "@/types/crm";
import { motion, AnimatePresence } from "framer-motion";
import { createTaskAction, toggleTaskAction } from "@/services/tasks";

type Tab = "overview" | "notes" | "activity" | "tasks";

export function RightSidebar({
  conversation,
  onClose
}: {
  conversation: Conversation | null;
  onClose: () => void;
}) {
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [newNote, setNewNote] = useState("");
  const [localTasks, setLocalTasks] = useState<Task[]>(conversation?.tasks ?? []);
  const [addingTask, setAddingTask] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [savingTask, setSavingTask] = useState(false);

  // Adjusted during render (not in an effect) so switching to a different
  // conversation resets the visible task list to that conversation's own
  // tasks instead of carrying over the previous one's local edits.
  const [prevConversationId, setPrevConversationId] = useState(conversation?.id);
  if (conversation?.id !== prevConversationId) {
    setPrevConversationId(conversation?.id);
    setLocalTasks(conversation?.tasks ?? []);
  }

  if (!conversation) return null;

  const supplier = conversation.supplier;

  async function handleAddTask() {
    const title = newTaskTitle.trim();
    if (!title || !conversation) return;
    setSavingTask(true);
    try {
      const result = await createTaskAction({ title, conversationId: conversation.id });
      if (!result.success) return toast.error(result.error);
      setLocalTasks((prev) => [
        {
          id: result.data.id,
          title: result.data.title,
          completed: result.data.completed,
          dueDate: result.data.dueDate ? new Date(result.data.dueDate) : null,
          priority: "Medium",
          assignedTo: "Me",
          conversationId: conversation.id,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        ...prev,
      ]);
      setNewTaskTitle("");
      setAddingTask(false);
    } finally {
      setSavingTask(false);
    }
  }

  async function handleToggleTask(task: Task) {
    setLocalTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, completed: !t.completed } : t)));
    const result = await toggleTaskAction(task.id);
    if (!result.success) {
      setLocalTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, completed: task.completed } : t)));
      toast.error(result.error);
    }
  }

  return (
    <div className="flex-1 flex flex-col h-full bg-white relative z-20">
      {/* Header */}
      <div className="h-16 px-4 border-b border-slate-200 flex items-center gap-3 shrink-0 bg-slate-50">
        <button 
          onClick={onClose}
          className="p-2 -ml-2 text-slate-500 hover:bg-slate-200 rounded-full transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
        <h2 className="font-bold text-slate-800">CRM Information</h2>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 px-2 shrink-0">
        {[
          { id: "overview", label: "Overview" },
          { id: "notes", label: "Notes" },
          { id: "activity", label: "Activity" },
          { id: "tasks", label: "Tasks" }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as Tab)}
            className={`flex-1 py-3 text-sm font-medium transition-colors border-b-2 ${
              activeTab === tab.id 
                ? "border-indigo-600 text-indigo-700" 
                : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        <AnimatePresence mode="wait">
          {activeTab === "overview" && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="p-5 space-y-6"
            >
              {/* Profile Card */}
              <div className="flex flex-col items-center text-center">
                <div 
                  className="w-24 h-24 rounded-2xl flex items-center justify-center text-white font-bold text-3xl shadow-sm mb-4"
                  style={{ backgroundColor: supplier.logoColor || '#6366F1' }}
                >
                  {supplier.initials || supplier.companyName.substring(0,2).toUpperCase()}
                </div>
                <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2 justify-center">
                  {supplier.companyName}
                  {supplier.verified && <ShieldCheck className="w-5 h-5 text-blue-500" />}
                </h3>
                <p className="text-sm text-slate-500 mt-1">{supplier.industry}</p>
                <div className="flex items-center gap-1 mt-2 text-sm text-slate-600 font-medium">
                  <MapPin className="w-4 h-4 text-slate-400" />
                  {supplier.city}, {supplier.country}
                </div>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                  <Clock className="w-5 h-5 text-indigo-500 mb-2" />
                  <p className="text-xs text-slate-500 font-medium">Response Time</p>
                  <p className="text-sm font-bold text-slate-800">{supplier.responseTime || "< 2 hours"}</p>
                </div>
                <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                  <Calendar className="w-5 h-5 text-emerald-500 mb-2" />
                  <p className="text-xs text-slate-500 font-medium">Established</p>
                  <p className="text-sm font-bold text-slate-800">{supplier.yearEstablished || "2010"}</p>
                </div>
                <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                  <Package className="w-5 h-5 text-amber-500 mb-2" />
                  <p className="text-xs text-slate-500 font-medium">Total Products</p>
                  <p className="text-sm font-bold text-slate-800">{supplier.products?.length || 0}</p>
                </div>
                <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                  <TrendingUp className="w-5 h-5 text-rose-500 mb-2" />
                  <p className="text-xs text-slate-500 font-medium">Total Orders</p>
                  <p className="text-sm font-bold text-slate-800">12</p>
                </div>
              </div>

              <button className="w-full py-2.5 bg-slate-900 text-white font-medium rounded-xl hover:bg-slate-800 transition-colors">
                View Full Profile
              </button>
            </motion.div>
          )}

          {activeTab === "notes" && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="p-5 flex flex-col h-full"
            >
              <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 mb-4 flex gap-2 text-sm text-amber-800">
                <ShieldCheck className="w-5 h-5 shrink-0 text-amber-600" />
                <p>Notes are for internal use only and are not visible to the supplier.</p>
              </div>

              <div className="flex-1 space-y-4">
                {conversation.notes && conversation.notes.length > 0 ? (
                  conversation.notes.map(note => (
                    <div key={note.id} className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
                      <p className="text-sm text-slate-700 whitespace-pre-wrap">{note.content}</p>
                      <div className="flex justify-between items-center mt-3 text-[11px] text-slate-400 font-medium uppercase tracking-wider">
                        <span>{note.author}</span>
                        <span>{format(new Date(note.createdAt), 'MMM d, h:mm a')}</span>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-10 text-slate-500 text-sm">
                    No notes added yet.
                  </div>
                )}
              </div>

              <div className="mt-4 shrink-0 relative">
                <textarea
                  value={newNote}
                  onChange={e => setNewNote(e.target.value)}
                  placeholder="Type a note..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 resize-none"
                  rows={2}
                />
                <button className="absolute right-3 bottom-4 p-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors">
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </motion.div>
          )}

          {activeTab === "tasks" && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="p-5"
            >
              {addingTask ? (
                <div className="mb-6 p-3 border border-slate-200 rounded-xl bg-slate-50 space-y-2">
                  <input
                    autoFocus
                    value={newTaskTitle}
                    onChange={(e) => setNewTaskTitle(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleAddTask()}
                    placeholder="Task title..."
                    className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  />
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => { setAddingTask(false); setNewTaskTitle(""); }}
                      className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleAddTask}
                      disabled={savingTask || !newTaskTitle.trim()}
                      className="px-3 py-1.5 text-xs font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50"
                    >
                      {savingTask ? "Adding..." : "Add"}
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setAddingTask(true)}
                  className="w-full py-2.5 mb-6 border-2 border-dashed border-slate-300 text-slate-600 font-medium rounded-xl hover:border-indigo-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors flex items-center justify-center gap-2"
                >
                  <Plus className="w-4 h-4" /> Add Task
                </button>
              )}

              <div className="space-y-3">
                {localTasks.length > 0 ? (
                  localTasks.map(task => (
                    <div key={task.id} className={`flex items-start gap-3 p-3 rounded-xl border ${task.completed ? 'bg-slate-50 border-slate-100 opacity-60' : 'bg-white border-slate-200 shadow-sm'}`}>
                      <button onClick={() => handleToggleTask(task)} className={`mt-0.5 shrink-0 ${task.completed ? 'text-indigo-500' : 'text-slate-300 hover:text-indigo-400'}`}>
                        <CheckSquare className="w-5 h-5" />
                      </button>
                      <div>
                        <p className={`text-sm font-medium ${task.completed ? 'text-slate-500 line-through' : 'text-slate-800'}`}>{task.title}</p>
                        <div className="flex gap-2 mt-1">
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                            task.priority === 'High' ? 'bg-rose-100 text-rose-700' :
                            task.priority === 'Low' ? 'bg-slate-100 text-slate-600' : 'bg-amber-100 text-amber-700'
                          }`}>{task.priority}</span>
                          {task.dueDate && (
                            <span className="text-[10px] text-slate-500 font-medium pt-0.5">
                              Due: {format(new Date(task.dueDate), 'MMM d')}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-10 text-slate-500 text-sm">
                    No active tasks.
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {activeTab === "activity" && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="p-5"
            >
              <div className="space-y-6 relative before:absolute before:inset-0 before:ml-[11px] before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-slate-200 before:to-transparent">
                {conversation.activities && conversation.activities.length > 0 ? (
                  conversation.activities.map(activity => (
                    <div key={activity.id} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                      <div className="flex items-center justify-center w-6 h-6 rounded-full border border-white bg-slate-200 text-slate-500 shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10">
                        {activity.type === 'System' ? <Activity className="w-3 h-3" /> : <FileText className="w-3 h-3" />}
                      </div>
                      <div className="w-[calc(100%-2.5rem)] md:w-[calc(50%-1.5rem)] p-3 rounded bg-slate-50 border border-slate-100 shadow-sm">
                        <div className="flex items-center justify-between mb-1">
                          <h4 className="font-semibold text-slate-800 text-sm">{activity.title}</h4>
                        </div>
                        {activity.description && <p className="text-xs text-slate-500">{activity.description}</p>}
                        <time className="text-[10px] text-slate-400 mt-2 block uppercase tracking-wider font-medium">
                          {format(new Date(activity.createdAt), 'MMM d, h:mm a')}
                        </time>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-10 text-slate-500 text-sm">
                    No activity recorded.
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
