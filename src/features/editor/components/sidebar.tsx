"use client";

import {
  LayoutTemplate,
  ImageIcon,
  Pencil,
  Settings,
  Shapes,
  Sparkles,
  Type,
  UploadCloud,
  FolderOpen
} from "lucide-react";

import { ActiveTool } from "@/features/editor/types";
import { SidebarItem } from "@/features/editor/components/sidebar-item";

interface SidebarProps {
  activeTool: ActiveTool;
  onChangeActiveTool: (tool: ActiveTool) => void;
};

export const Sidebar = ({
  activeTool,
  onChangeActiveTool,
}: SidebarProps) => {
  return (
    <aside className="bg-white flex flex-col w-[100px] h-full border-r overflow-y-auto z-[50]">
      <ul className="flex flex-col">
        <SidebarItem
          icon={LayoutTemplate}
          label="Design"
          isActive={activeTool === "templates"}
          onClick={() => onChangeActiveTool("templates")}
        />
        <SidebarItem
          icon={Shapes}
          label="Elements"
          isActive={activeTool === "shapes"}
          onClick={() => onChangeActiveTool("shapes")}
        />
        <SidebarItem
          icon={Type}
          label="Text"
          isActive={activeTool === "text"}
          onClick={() => onChangeActiveTool("text")}
        />
        <SidebarItem
          icon={ImageIcon}
          label="Brand"
          isActive={activeTool === "images"} // Mocking Brand with images for MVP
          onClick={() => onChangeActiveTool("images")}
        />
        <SidebarItem
          icon={UploadCloud}
          label="Uploads"
          isActive={activeTool === "images"} // Re-using image uploader for now
          onClick={() => onChangeActiveTool("images")}
        />
        <SidebarItem
          icon={Pencil}
          label="Draw"
          isActive={activeTool === "draw"}
          onClick={() => onChangeActiveTool("draw")}
        />
        <SidebarItem
          icon={FolderOpen}
          label="Projects"
          isActive={activeTool === "settings"} // Placeholder
          onClick={() => onChangeActiveTool("settings")}
        />
        <SidebarItem
          icon={Sparkles}
          label="Apps"
          isActive={activeTool === "ai"}
          onClick={() => onChangeActiveTool("ai")}
        />
      </ul>
    </aside>
  );
};

