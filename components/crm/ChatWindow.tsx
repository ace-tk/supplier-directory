"use client";

import { useState, useRef, useEffect } from "react";
import { format } from "date-fns";
import {
  Phone, Video, Info, Paperclip, Smile, Mic, Send,
  Menu, Sparkles, Package, Check, CheckCheck,
  ShieldCheck, MessageCircle, Workflow, ArrowRight
} from "lucide-react";
import Link from "next/link";
import { Conversation, Message } from "@/types/crm";
import { motion, AnimatePresence } from "framer-motion";
import { ShareSupplyChainDialog } from "./ShareSupplyChainDialog";
import { supplyChainPath } from "@/lib/supply-chain-ui";
import type { SupplyChainSummary } from "@/services/supply-chain";

export function ChatWindow({
  conversation,
  onSendMessage,
  onToggleLeftSidebar,
  onToggleRightSidebar,
  showLeftSidebar
}: {
  conversation: Conversation | null;
  onSendMessage: (c: string, t?: "TEXT" | "PRODUCT" | "SUPPLY_CHAIN", pid?: string, supplyChainId?: string) => void;
  onToggleLeftSidebar: () => void;
  onToggleRightSidebar: () => void;
  showLeftSidebar: boolean;
}) {
  const [inputText, setInputText] = useState("");
  const [showAiMenu, setShowAiMenu] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [conversation?.messages]);

  if (!conversation) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-slate-50/50 h-full">
        <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
          <MessageCircle className="w-8 h-8 text-slate-300" />
        </div>
        <h3 className="text-xl font-bold text-slate-800">No conversation selected</h3>
        <p className="text-sm text-slate-500 mt-2">Choose a supplier from the list to start chatting.</p>
        
        {!showLeftSidebar && (
          <button 
            onClick={onToggleLeftSidebar}
            className="mt-6 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium lg:hidden"
          >
            Open Inbox
          </button>
        )}
      </div>
    );
  }

  const handleSend = () => {
    if (!inputText.trim()) return;
    onSendMessage(inputText);
    setInputText("");
  };

  const handleShareSupplyChain = (chain: SupplyChainSummary) => {
    onSendMessage(`Shared "${chain.name}" (${chain.orderNumber})`, "SUPPLY_CHAIN", undefined, chain.id);
    setShareOpen(false);
  };

  const handleAiAction = (promptType: string) => {
    const aiTexts: Record<string, string> = {
      "Professional Reply": "Thank you for reaching out. We have reviewed your inquiry and would be happy to discuss this further. Could you please provide more details about your requirements?",
      "Follow-up Message": "I wanted to follow up on my previous message regarding the product inquiry. Could you please share a pro-forma invoice when you have a moment?",
      "Request Quotation": "Could you please send us a quotation for the products discussed? We would need pricing for MOQ, as well as bulk order tiers if available.",
      "Negotiate Price": "We appreciate your offer. However, given our order volume, we were hoping to discuss a more competitive price point. Would you be open to negotiating on the unit price for orders above the standard MOQ?",
      "Confirm Details": "Just to confirm the details we discussed: MOQ, pricing, lead time, and payment terms. Could you send a formal pro-forma invoice for our records?"
    };
    setInputText(aiTexts[promptType] || `[AI: ${promptType}]`);
    setShowAiMenu(false);
  };

  // Group messages by date
  const grouped: { date: string; messages: Message[] }[] = [];
  (conversation.messages || []).forEach((msg) => {
    const dateStr = format(new Date(msg.createdAt), "MMMM d, yyyy");
    const last = grouped[grouped.length - 1];
    if (!last || last.date !== dateStr) {
      grouped.push({ date: dateStr, messages: [msg] });
    } else {
      last.messages.push(msg);
    }
  });

  return (
    <div className="flex flex-col h-full bg-[#EFEAE2] relative overflow-hidden">
      {/* Header */}
      <div className="h-16 px-4 bg-white border-b border-slate-200 flex items-center justify-between shrink-0 relative z-10 shadow-sm">
        <div className="flex items-center gap-3">
          <button 
            onClick={onToggleLeftSidebar}
            className="lg:hidden p-2 -ml-2 text-slate-500 hover:bg-slate-100 rounded-full transition-colors"
          >
            <Menu className="w-5 h-5" />
          </button>

          <div 
            className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm shadow-sm cursor-pointer"
            style={{ backgroundColor: conversation.supplier.logoColor || '#6366F1' }}
            onClick={onToggleRightSidebar}
          >
            {conversation.supplier.initials || conversation.supplier.companyName.substring(0,2).toUpperCase()}
          </div>
          <button className="text-left" onClick={onToggleRightSidebar}>
            <h3 className="font-bold text-slate-900 leading-tight text-sm">
              {conversation.supplier.companyName}
            </h3>
            <p className="text-[11px] text-emerald-500 font-medium">
              Online · Click for info
            </p>
          </button>
        </div>

        <div className="flex items-center gap-1 sm:gap-2">
          <button className="p-2 text-slate-500 hover:bg-slate-100 rounded-full transition-colors hidden sm:flex">
            <Video className="w-5 h-5" />
          </button>
          <button className="p-2 text-slate-500 hover:bg-slate-100 rounded-full transition-colors">
            <Phone className="w-5 h-5" />
          </button>
          <div className="w-px h-6 bg-slate-200 mx-1"></div>
          <button 
            onClick={onToggleRightSidebar}
            className="p-2 text-slate-500 hover:bg-slate-100 rounded-full transition-colors"
          >
            <Info className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 sm:px-8 py-6 space-y-1 relative z-10" style={{ scrollbarWidth: 'thin' }}>
        {/* Encryption notice */}
        <div className="bg-[#FFF4CC] border border-[#FFD966]/40 p-2.5 rounded-xl shadow-sm text-center text-xs text-amber-800 max-w-md mx-auto mb-6 flex items-center justify-center gap-2">
          <ShieldCheck className="w-4 h-4 shrink-0 text-amber-600" />
          <span>Messages are end-to-end encrypted. Internal use only.</span>
        </div>

        {grouped.map(({ date, messages: dayMsgs }) => (
          <div key={date}>
            {/* Date separator */}
            <div className="flex justify-center my-4">
              <span className="px-3 py-1 bg-white/90 backdrop-blur shadow-sm rounded-full text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
                {date}
              </span>
            </div>

            {dayMsgs.map((msg) => {
              const isUser = msg.sender === 'user';
              
              return (
                <motion.div 
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2 }}
                  key={msg.id} 
                  className={`flex mb-1 ${isUser ? 'justify-end' : 'justify-start'}`}
                >
                  <div 
                    className={`max-w-[85%] sm:max-w-[65%] rounded-2xl px-3.5 py-2 shadow-sm relative ${
                      isUser 
                        ? 'bg-[#D9FDD3] rounded-tr-sm' 
                        : 'bg-white rounded-tl-sm border border-slate-100/60'
                    }`}
                  >
                    {/* Product Card */}
                    {msg.type === 'PRODUCT' && (
                      <div className="mb-2 p-2.5 bg-white/80 rounded-xl flex items-center gap-3 border border-slate-200/50">
                        <div className="w-12 h-12 bg-slate-100 rounded-lg shrink-0 flex items-center justify-center">
                          <Package className="w-5 h-5 text-slate-400" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-slate-800">Product Shared</p>
                          <button className="text-xs text-indigo-600 font-medium hover:underline mt-0.5">
                            View Details →
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Supply Chain Card */}
                    {msg.type === 'SUPPLY_CHAIN' && msg.supplyChain && (
                      <div className="mb-2 p-2.5 bg-white/80 rounded-xl flex items-center gap-3 border border-slate-200/50">
                        <div className="w-12 h-12 bg-indigo-50 rounded-lg shrink-0 flex items-center justify-center">
                          <Workflow className="w-5 h-5 text-indigo-500" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-slate-800 truncate">{msg.supplyChain.name}</p>
                          <p className="text-[11px] text-slate-500">{msg.supplyChain.orderNumber}</p>
                          <Link
                            href={supplyChainPath("ADMIN", msg.supplyChain.id)}
                            className="inline-flex items-center gap-1 text-xs text-indigo-600 font-medium hover:underline mt-0.5"
                          >
                            Open Supply Chain <ArrowRight className="w-3 h-3" />
                          </Link>
                        </div>
                      </div>
                    )}

                    {msg.type !== 'SUPPLY_CHAIN' && (
                      <p className="text-[14.5px] leading-relaxed break-words whitespace-pre-wrap text-slate-800">
                        {msg.content}
                      </p>
                    )}

                    <div className={`flex items-center justify-end gap-1 mt-0.5 ${isUser ? 'text-[#8696A0]' : 'text-slate-400'}`}>
                      <span className="text-[10px] font-medium">
                        {format(new Date(msg.createdAt), 'h:mm a')}
                      </span>
                      {isUser && (
                        msg.status === 'seen' ? 
                          <CheckCheck className="w-3.5 h-3.5 text-[#53BDEB]" /> : 
                          <Check className="w-3.5 h-3.5" />
                      )}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Composer */}
      <div className="bg-[#F0F2F5] px-3 py-2.5 flex items-end gap-2 shrink-0 relative z-10 border-t border-slate-200/50">
        <button className="p-2.5 text-slate-500 hover:text-slate-600 hover:bg-slate-200/60 rounded-full transition-colors shrink-0">
          <Smile className="w-6 h-6" />
        </button>
        <button className="p-2.5 text-slate-500 hover:text-slate-600 hover:bg-slate-200/60 rounded-full transition-colors shrink-0">
          <Paperclip className="w-6 h-6" />
        </button>
        <button
          onClick={() => setShareOpen(true)}
          title="Share Supply Chain"
          className="p-2.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-full transition-colors shrink-0"
        >
          <Workflow className="w-5 h-5" />
        </button>

        {/* Input area */}
        <div className="flex-1 bg-white rounded-2xl shadow-sm border border-slate-200/60 flex items-center min-h-[44px] px-4">
          <textarea
            value={inputText}
            onChange={(e) => {
              setInputText(e.target.value);
              // Auto-resize
              e.target.style.height = 'auto';
              e.target.style.height = Math.min(e.target.scrollHeight, 128) + 'px';
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="Type a message..."
            className="flex-1 bg-transparent py-2.5 focus:outline-none resize-none text-[15px] text-slate-800 placeholder:text-slate-400"
            rows={1}
            style={{ minHeight: "24px", maxHeight: "128px" }}
          />

          {/* AI Button */}
          <div className="relative ml-2 shrink-0">
            <button 
              onClick={() => setShowAiMenu(!showAiMenu)}
              className={`p-1.5 rounded-lg transition-all flex items-center justify-center ${
                showAiMenu ? "bg-indigo-100 text-indigo-600 scale-95" : "text-slate-400 hover:text-indigo-500 hover:bg-indigo-50"
              }`}
              title="AI Assist"
            >
              <Sparkles className="w-4.5 h-4.5" />
            </button>

            <AnimatePresence>
              {showAiMenu && (
                <motion.div
                  initial={{ opacity: 0, y: 8, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 8, scale: 0.95 }}
                  transition={{ duration: 0.15 }}
                  className="absolute bottom-full right-0 mb-2 w-60 bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden z-50 origin-bottom-right"
                >
                  <div className="px-3 py-2.5 border-b border-slate-100 bg-gradient-to-r from-indigo-50 to-purple-50 flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-indigo-500" />
                    <span className="text-xs font-bold text-indigo-700 uppercase tracking-wide">AI Assist</span>
                    <span className="ml-auto text-[10px] bg-indigo-100 text-indigo-600 px-1.5 py-0.5 rounded-full font-bold">BETA</span>
                  </div>
                  <div className="p-1.5 flex flex-col gap-0.5">
                    {[
                      "Professional Reply", 
                      "Follow-up Message", 
                      "Request Quotation", 
                      "Negotiate Price", 
                      "Confirm Details"
                    ].map(action => (
                      <button 
                        key={action}
                        onClick={() => handleAiAction(action)}
                        className="text-left px-3 py-2 text-sm text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 rounded-xl transition-colors font-medium"
                      >
                        {action}
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {inputText.trim() ? (
          <motion.button 
            initial={{ scale: 0.8 }}
            animate={{ scale: 1 }}
            onClick={handleSend}
            className="p-3 bg-[#00A884] text-white hover:bg-[#008f6f] rounded-full transition-colors shrink-0 shadow-sm"
          >
            <Send className="w-5 h-5 ml-0.5" />
          </motion.button>
        ) : (
          <button className="p-3 text-slate-500 hover:text-slate-600 hover:bg-slate-200/60 rounded-full transition-colors shrink-0">
            <Mic className="w-6 h-6" />
          </button>
        )}
      </div>

      <ShareSupplyChainDialog open={shareOpen} onClose={() => setShareOpen(false)} onSelect={handleShareSupplyChain} />
    </div>
  );
}
