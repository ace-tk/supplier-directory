"use client";

import { Suspense, useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { ConversationList } from "@/components/crm/ConversationList";
import { ChatWindow } from "@/components/crm/ChatWindow";
import { RightSidebar } from "@/components/crm/RightSidebar";
import { Conversation } from "@/types/crm";

function CrmInner() {
  const searchParams = useSearchParams();
  const initialSupplierId = searchParams?.get("supplierId");

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversation, setActiveConversation] = useState<Conversation | null>(null);
  const [loading, setLoading] = useState(true);
  const [showLeftSidebar, setShowLeftSidebar] = useState(true);
  const [showRightSidebar, setShowRightSidebar] = useState(false);

  const fetchFull = async (supplierId: string): Promise<Conversation | null> => {
    try {
      const res = await fetch(`/api/crm/conversations?supplierId=${supplierId}`);
      return res.json();
    } catch {
      return null;
    }
  };

  useEffect(() => {
    async function init() {
      try {
        const res = await fetch("/api/crm/conversations");
        const data: Conversation[] = await res.json();
        setConversations(data);

        if (initialSupplierId) {
          const full = await fetchFull(initialSupplierId);
          if (full) setActiveConversation(full);
          setShowLeftSidebar(false);
        } else if (data.length > 0) {
          const full = await fetchFull(data[0].supplierId);
          if (full) setActiveConversation(full);
        }
      } finally {
        setLoading(false);
      }
    }
    init();
  }, [initialSupplierId]);

  const handleSelectConversation = async (conv: Conversation) => {
    const full = await fetchFull(conv.supplierId);
    if (full) setActiveConversation(full);
    if (window.innerWidth < 1024) setShowLeftSidebar(false);
  };

  const handleSendMessage = async (
    content: string,
    type: "TEXT" | "PRODUCT" | "SUPPLY_CHAIN" = "TEXT",
    productId?: string,
    supplyChainId?: string
  ) => {
    if (!activeConversation) return;

    // Optimistic update
    const tempMsg = {
      id: `tmp-${Date.now()}`,
      conversationId: activeConversation.id,
      sender: "user",
      type,
      content,
      attachmentUrl: null,
      productId: productId ?? null,
      supplyChainId: supplyChainId ?? null,
      status: "sent",
      createdAt: new Date(),
    };
    setActiveConversation((prev) => prev ? { ...prev, messages: [...(prev.messages ?? []), tempMsg] } : prev);

    // Persist
    await fetch("/api/crm/conversations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ conversationId: activeConversation.id, content, type, productId, supplyChainId }),
    });
  };

  return (
    <div className="flex h-[calc(100vh-4rem)] bg-white overflow-hidden rounded-t-2xl border border-slate-200 mt-2 mx-2 sm:mx-6 shadow-sm relative">
      {/* Left Sidebar */}
      <div className={`absolute inset-y-0 left-0 z-20 w-80 bg-white border-r border-slate-200 transition-transform duration-300 lg:relative lg:translate-x-0 ${showLeftSidebar ? "translate-x-0" : "-translate-x-full"}`}>
        <ConversationList
          conversations={conversations}
          activeId={activeConversation?.id}
          onSelect={handleSelectConversation}
          loading={loading}
        />
      </div>

      {/* Center Chat */}
      <div className="flex-1 flex flex-col min-w-0 relative z-10">
        <ChatWindow
          conversation={activeConversation}
          onSendMessage={handleSendMessage}
          onToggleLeftSidebar={() => setShowLeftSidebar(!showLeftSidebar)}
          onToggleRightSidebar={() => setShowRightSidebar(!showRightSidebar)}
          showLeftSidebar={showLeftSidebar}
        />
      </div>

      {/* Right Sidebar */}
      <div className={`absolute inset-y-0 right-0 z-20 w-80 bg-white border-l border-slate-200 transition-transform duration-300 xl:relative xl:translate-x-0 flex flex-col ${showRightSidebar ? "translate-x-0" : "translate-x-full"}`}>
        <RightSidebar
          conversation={activeConversation}
          onClose={() => setShowRightSidebar(false)}
        />
      </div>

      {/* Mobile backdrops */}
      {showLeftSidebar && <div className="fixed inset-0 z-10 bg-black/20 lg:hidden" onClick={() => setShowLeftSidebar(false)} />}
      {showRightSidebar && <div className="fixed inset-0 z-10 bg-black/20 xl:hidden" onClick={() => setShowRightSidebar(false)} />}
    </div>
  );
}

export default function CrmPage() {
  return (
    <Suspense fallback={<div className="h-[calc(100vh-4rem)] flex items-center justify-center text-slate-500">Loading CRM...</div>}>
      <CrmInner />
    </Suspense>
  );
}
