import { SupplierListing, Message as PrismaMessage, CrmNote as PrismaCrmNote, Task as PrismaTask, Activity as PrismaActivity, Conversation as PrismaConversation } from "@/lib/generated/prisma/client";

export type CrmNote = PrismaCrmNote;
export type Task = PrismaTask;
export type Activity = PrismaActivity;

export interface SharedSupplyChainSummary {
  id: string;
  name: string;
  orderNumber: string;
  status: string;
}

export type Message = PrismaMessage & {
  supplyChain?: SharedSupplyChainSummary | null;
};

export type Conversation = PrismaConversation & {
  supplier: SupplierListing;
  messages: Message[];
  notes?: CrmNote[];
  tasks?: Task[];
  activities?: Activity[];
};
