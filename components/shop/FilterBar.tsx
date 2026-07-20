"use client";

import { motion } from "framer-motion";
import { Search, SlidersHorizontal, ChevronDown } from "lucide-react";

export function FilterBar({
  searchQuery,
  setSearchQuery,
  activeCategory,
  setActiveCategory,
  activeSort,
  setActiveSort
}: {
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  activeCategory: string;
  setActiveCategory: (c: string) => void;
  activeSort: string;
  setActiveSort: (s: string) => void;
}) {
  const categories = ["All Categories", "Electronics", "Textiles", "Furniture", "Medical", "Automotive", "Agriculture", "Food & Beverage", "Packaging", "Beauty & Personal Care", "Industrial Equipment"];
  const sorts = ["Newest", "Trending", "MOQ"];

  return (
    <div className="sticky top-0 z-40 bg-white/80 backdrop-blur-xl border-b border-slate-200 py-4 mb-8">
      <div className="max-w-[2000px] mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
        
        {/* Search */}
        <div className="relative w-full sm:max-w-md group">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-5 w-5 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
          </div>
          <input
            type="text"
            className="block w-full pl-10 pr-3 py-2.5 border border-slate-200 rounded-full leading-5 bg-slate-50 placeholder-slate-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all sm:text-sm"
            placeholder="Search products, materials, or suppliers..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3 w-full sm:w-auto overflow-x-auto pb-2 sm:pb-0 hide-scrollbar">
          <div className="flex items-center gap-2">
            {categories.slice(0, 4).map(cat => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`whitespace-nowrap px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                  activeCategory === cat 
                    ? "bg-slate-900 text-white shadow-md" 
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {cat}
              </button>
            ))}
            <div className="relative">
              <select 
                className="appearance-none bg-slate-100 text-slate-600 hover:bg-slate-200 px-4 py-2 pr-8 rounded-full text-sm font-medium focus:outline-none cursor-pointer"
                value={categories.includes(activeCategory) && categories.indexOf(activeCategory) >= 4 ? activeCategory : "More"}
                onChange={(e) => {
                  if(e.target.value !== "More") setActiveCategory(e.target.value);
                }}
              >
                <option disabled value="More">More</option>
                {categories.slice(4).map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
            </div>
          </div>

          <div className="h-6 w-px bg-slate-200 mx-2 hidden sm:block"></div>

          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-500 font-medium whitespace-nowrap hidden lg:block">Sort by:</span>
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-full">
              {sorts.map(sort => (
                <button
                  key={sort}
                  onClick={() => setActiveSort(sort)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                    activeSort === sort
                      ? "bg-white text-slate-900 shadow-sm"
                      : "text-slate-500 hover:text-slate-700"
                  }`}
                >
                  {sort}
                </button>
              ))}
            </div>
          </div>

          <button className="p-2.5 rounded-full border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors shrink-0">
            <SlidersHorizontal className="w-4 h-4" />
          </button>
        </div>

      </div>
    </div>
  );
}
