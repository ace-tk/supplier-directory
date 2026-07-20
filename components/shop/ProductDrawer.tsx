"use client";

import { motion, AnimatePresence } from "framer-motion";
import { X, Bookmark, Share2, MessageCircle, Mail, ExternalLink, ShieldCheck, Factory } from "lucide-react";
import { Product } from "@/types/product";
import { Supplier } from "@/types/supplier";
import { useState } from "react";
import Link from "next/link";

export function ProductDrawer({
  product,
  isOpen,
  onClose,
  onViewSupplier,
}: {
  product: Product | null;
  isOpen: boolean;
  onClose: () => void;
  onViewSupplier: (supplier: Supplier) => void;
}) {
  const [activeImage, setActiveImage] = useState(0);

  if (!product) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50"
          />

          {/* Drawer */}
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="fixed inset-y-0 right-0 w-full md:w-[600px] lg:w-[800px] bg-white z-50 shadow-2xl flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <button
                  onClick={onClose}
                  className="p-2 -ml-2 rounded-full hover:bg-slate-100 transition-colors"
                >
                  <X className="w-5 h-5 text-slate-500" />
                </button>
                <h2 className="font-semibold text-slate-900">Product Details</h2>
              </div>
              <div className="flex items-center gap-2">
                <button className="p-2 rounded-full hover:bg-slate-100 text-slate-500 transition-colors">
                  <Share2 className="w-5 h-5" />
                </button>
                <button className="p-2 rounded-full hover:bg-slate-100 text-slate-500 transition-colors">
                  <Bookmark className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Content Scroll Area */}
            <div className="flex-1 overflow-y-auto">
              {/* Image Gallery */}
              <div className="bg-slate-50 p-6 flex flex-col items-center border-b border-slate-100">
                <div className="relative w-full max-w-lg aspect-square rounded-2xl overflow-hidden bg-white shadow-sm mb-4">
                  <img
                    src={product.images[activeImage] || product.images[0]}
                    alt={product.name}
                    className="w-full h-full object-contain"
                  />
                </div>
                {product.images.length > 1 && (
                  <div className="flex gap-3 overflow-x-auto pb-2">
                    {product.images.map((img, idx) => (
                      <button
                        key={idx}
                        onClick={() => setActiveImage(idx)}
                        className={`relative w-20 h-20 rounded-xl overflow-hidden border-2 transition-all shrink-0 ${
                          activeImage === idx ? "border-indigo-500" : "border-transparent hover:border-slate-300"
                        }`}
                      >
                        <img src={img} alt="" className="w-full h-full object-cover" />
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Product Info */}
              <div className="p-8 max-w-3xl mx-auto">
                <div className="mb-8">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="px-2.5 py-1 bg-indigo-50 text-indigo-700 text-xs font-semibold rounded-md uppercase tracking-wider">
                      {product.category}
                    </span>
                  </div>
                  <h1 className="text-3xl font-bold text-slate-900 mb-4 leading-tight">{product.name}</h1>
                  <p className="text-slate-600 text-lg leading-relaxed">
                    {product.description}
                  </p>
                </div>

                {/* Key Metrics */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                    <p className="text-xs text-slate-500 mb-1 font-medium">Price Range</p>
                    <p className="text-lg font-bold text-slate-900">{product.priceRange}</p>
                  </div>
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                    <p className="text-xs text-slate-500 mb-1 font-medium">Min. Order (MOQ)</p>
                    <p className="text-lg font-bold text-slate-900">{product.moq}</p>
                  </div>
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                    <p className="text-xs text-slate-500 mb-1 font-medium">Lead Time</p>
                    <p className="text-lg font-bold text-slate-900">{product.leadTime}</p>
                  </div>
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                    <p className="text-xs text-slate-500 mb-1 font-medium">Material</p>
                    <p className="text-lg font-bold text-slate-900">{product.material || "N/A"}</p>
                  </div>
                </div>

                {/* Supplier Card */}
                {product.supplier && (
                  <div className="mb-10">
                    <h3 className="text-lg font-semibold text-slate-900 mb-4">Supplier Information</h3>
                    <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm hover:shadow-md transition-shadow">
                      <div className="flex items-start justify-between mb-6">
                        <div className="flex items-center gap-4">
                          <div 
                            className="w-16 h-16 rounded-2xl flex items-center justify-center text-white text-xl font-bold shadow-sm"
                            style={{ backgroundColor: product.supplier.logoColor || '#6366F1' }}
                          >
                            {product.supplier.initials || product.supplier.companyName.substring(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <h4 className="font-bold text-slate-900 text-xl">{product.supplier.companyName}</h4>
                              {product.supplier.verified && (
                                <ShieldCheck className="w-5 h-5 text-blue-500" />
                              )}
                            </div>
                            <div className="flex items-center gap-2 text-sm text-slate-500">
                              <Factory className="w-4 h-4" />
                              <span>{product.supplier.supplierType}</span>
                              <span>•</span>
                              <span>{product.supplier.city}, {product.supplier.country}</span>
                            </div>
                          </div>
                        </div>
                        <button 
                          onClick={() => onViewSupplier(product.supplier as unknown as Supplier)}
                          className="flex items-center gap-2 text-sm font-medium text-indigo-600 hover:text-indigo-700 bg-indigo-50 px-4 py-2 rounded-full transition-colors"
                        >
                          View Profile <ExternalLink className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <Link href={"/dashboard/crm?supplierId=" + product.supplier.id} className="flex items-center justify-center gap-2 w-full py-3 bg-[#25D366] hover:bg-[#1EBE5D] text-white rounded-xl font-semibold transition-colors">
                          <MessageCircle className="w-5 h-5" /> WhatsApp
                        </Link>
                        <button className="flex items-center justify-center gap-2 w-full py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-semibold transition-colors">
                          <Mail className="w-5 h-5" /> Contact Supplier
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Specs */}
                <div>
                  <h3 className="text-lg font-semibold text-slate-900 mb-4">Specifications</h3>
                  <div className="bg-slate-50 rounded-2xl p-6 text-slate-600 border border-slate-100">
                    {product.specifications || "No specifications provided."}
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
