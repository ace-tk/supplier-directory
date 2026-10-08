"use client";

import { useState } from "react";
import { Search, Filter, Pin, BadgeCheck, Check, CheckCheck } from "lucide-react";
import { Conversation } from "@/types/crm";
import { formatDistanceToNow } from "date-fns";

export function ConversationList({
  conversations,
  activeId,
  onSelect,
  loading
}: {
  conversations: Conversation[];
  activeId?: string;
  onSelect: (c: Conversation) => void;
  loading: boolean;
}) {
  const [search, setSearch] = useState("");
  
  const filtered = conversations.filter(c => 
    c.supplier?.companyName.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex flex-col h-full bg-card">
      {/* Header */}
      <div className="p-4 border-b border-border shrink-0">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-foreground">Inbox</h2>
          <button className="p-2 text-muted-foreground hover:bg-soft rounded-full transition-colors">
            <Filter className="w-5 h-5" />
          </button>
        </div>
        
        <div className="relative group">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-lav-ink transition-colors" />
          <input 
            type="text" 
            placeholder="Search suppliers or messages..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-soft border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-lav-ink/20 focus:border-lav-ink/30 transition-all"
          />
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto hide-scrollbar">
        {loading ? (
          <div className="p-4 space-y-4">
            {[1,2,3,4].map(i => (
              <div key={i} className="flex items-center gap-3 animate-pulse">
                <div className="w-12 h-12 bg-soft rounded-full"></div>
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-soft rounded w-1/2"></div>
                  <div className="h-3 bg-soft rounded w-3/4"></div>
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground text-sm">
            No conversations found.
          </div>
        ) : (
          filtered.map((conv) => {
            const lastMsg = conv.messages?.[0];
            const isActive = activeId === conv.id;
            
            return (
              <button
                key={conv.id}
                onClick={() => onSelect(conv)}
                className={`w-full text-left p-3 flex items-start gap-3 border-b border-border transition-colors ${
                  isActive ? "bg-lav" : "hover:bg-soft"
                }`}
              >
                <div className="relative shrink-0 mt-1">
                  <div 
                    className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold shadow-sm text-sm"
                    style={{ backgroundColor: conv.supplier.logoColor || '#6366F1' }}
                  >
                    {conv.supplier.initials || conv.supplier.companyName.substring(0,2).toUpperCase()}
                  </div>
                  {conv.unreadCount > 0 && (
                    <div className="absolute -top-1 -right-1 w-5 h-5 bg-indigo-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-white">
                      {conv.unreadCount}
                    </div>
                  )}
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-1 mb-1">
                    <div className="flex items-center gap-1 min-w-0">
                      <span className="font-semibold text-foreground truncate text-sm">
                        {conv.supplier.companyName}
                      </span>
                      {conv.supplier.verified && (
                        <BadgeCheck className="w-3.5 h-3.5 text-sky-ink shrink-0" />
                      )}
                    </div>
                    {conv.pinned ? (
                      <Pin className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                    ) : (
                      <span className="text-[10px] text-muted-foreground whitespace-nowrap shrink-0">
                        {conv.lastMessageAt ? formatDistanceToNow(new Date(conv.lastMessageAt), { addSuffix: true }) : ''}
                      </span>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-1">
                    {lastMsg?.sender === 'user' && (
                      lastMsg.status === 'seen' ? 
                        <CheckCheck className="w-3 h-3 text-sky-ink shrink-0" /> : 
                        <Check className="w-3 h-3 text-muted-foreground shrink-0" />
                    )}
                    <p className={`text-xs truncate ${conv.unreadCount > 0 ? "font-semibold text-foreground" : "text-muted-foreground"}`}>
                      {lastMsg?.type === "PRODUCT" ? "Sent a product" : 
                       lastMsg?.type === "IMAGE" ? "📷 Image attached" : 
                       lastMsg?.content || "No messages yet"}
                    </p>
                  </div>
                  
                  <div className="flex gap-2 mt-1.5">
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-soft text-muted-foreground font-medium">
                      {conv.supplier.country}
                    </span>
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-soft text-muted-foreground font-medium truncate max-w-[80px]">
                      {conv.supplier.industry}
                    </span>
                  </div>
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
