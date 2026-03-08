"use client";

import { useState } from "react";
import { Search } from "lucide-react";
import { CategoriesSection } from "./categories-section";

export const Banner = () => {
  const [searchValue, setSearchValue] = useState("");

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Implementation for search, e.g., router.push(`/search?q=${searchValue}`)
  };

  return (
    <div className="w-full pt-10 pb-6 flex flex-col items-center justify-center bg-gradient-to-r from-blue-50 via-purple-50 to-pink-50 rounded-2xl relative mb-6">
      <h1 className="text-4xl md:text-5xl font-semibold text-indigo-700 mb-8 tracking-tight text-center">
        What will you design today?
      </h1>

      <form
        onSubmit={onSubmit}
        className="w-full max-w-3xl px-4 mb-10"
      >
        <div className="relative flex items-center w-full h-14 rounded-full bg-white shadow-md hover:shadow-lg transition-shadow border border-gray-100 overflow-hidden">
          <div className="pl-5 pr-3 text-gray-400">
            <Search className="size-5" />
          </div>
          <input
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            placeholder="Search millions of templates"
            className="flex-1 h-full outline-none text-base bg-transparent text-gray-800"
          />
        </div>
      </form>

      <CategoriesSection />
    </div>
  );
};
