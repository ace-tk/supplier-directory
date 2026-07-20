"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Bookmark, ShieldCheck } from "lucide-react";
import { Product } from "@/types/product";

export function ProductCard({ 
  product, 
  onClick 
}: { 
  product: Product; 
  onClick: (product: Product) => void;
}) {
  const [isHovered, setIsHovered] = useState(false);
  const [isSaved, setIsSaved] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="group relative cursor-pointer break-inside-avoid mb-6 rounded-2xl overflow-hidden bg-white shadow-sm hover:shadow-xl transition-all duration-300 border border-slate-100"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={() => onClick(product)}
    >
      {/* Image Container */}
      <div className="relative overflow-hidden bg-slate-50">
        <motion.img
          src={product.images[0]}
          alt={product.name}
          className="w-full h-auto object-cover"
          animate={{ scale: isHovered ? 1.05 : 1 }}
          transition={{ duration: 0.4 }}
          loading="lazy"
        />
        
        {/* Overlay Actions */}
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: isHovered ? 1 : 0 }}
          className="absolute inset-0 bg-black/20 flex flex-col justify-between p-4"
        >
          <div className="flex justify-end">
            <button 
              onClick={(e) => {
                e.stopPropagation();
                setIsSaved(!isSaved);
              }}
              className={`p-2 rounded-full backdrop-blur-md transition-colors ${
                isSaved ? "bg-red-500 text-white" : "bg-white/80 text-slate-800 hover:bg-white"
              }`}
            >
              <Bookmark className="w-5 h-5" fill={isSaved ? "currentColor" : "none"} />
            </button>
          </div>
        </motion.div>
      </div>

      {/* Content */}
      <div className="p-4">
        <h3 className="font-semibold text-slate-900 text-lg leading-tight mb-1">{product.name}</h3>
        
        <div className="flex items-center gap-1.5 text-sm text-slate-500 mb-2">
          <span className="truncate">{product.supplier?.companyName}</span>
          {product.supplier?.verified && (
            <ShieldCheck className="w-4 h-4 text-blue-500 shrink-0" />
          )}
        </div>

        <div className="flex flex-wrap gap-2 mb-3">
          <span className="px-2 py-1 bg-slate-100 text-slate-600 text-xs rounded-md font-medium">
            {product.category}
          </span>
          <span className="px-2 py-1 bg-slate-100 text-slate-600 text-xs rounded-md font-medium">
            {product.country}
          </span>
        </div>

        <div className="flex items-end justify-between mt-4">
          <div>
            <p className="text-xs text-slate-400 mb-0.5">Price Range</p>
            <p className="font-semibold text-slate-900">{product.priceRange}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-slate-400 mb-0.5">MOQ</p>
            <p className="font-medium text-slate-700">{product.moq}</p>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
