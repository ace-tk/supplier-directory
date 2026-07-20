import { SupplierListing, Message as PrismaMessage, CrmNote as PrismaCrmNote, Task as PrismaTask, Activity as PrismaActivity, Conversation as PrismaConversation } from "@/lib/generated/prisma/client";

export type Message = PrismaMessage;
export type CrmNote = PrismaCrmNote;
export type Task = PrismaTask;
export type Activity = PrismaActivity;

export type Conversation = PrismaConversation & {
  supplier: SupplierListing;
  messages: Message[];
  notes?: CrmNote[];
  tasks?: Task[];
  activities?: Activity[];
};
