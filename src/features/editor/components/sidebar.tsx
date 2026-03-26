"use client";

import {
  LayoutTemplate,
  ImageIcon,
  Pencil,
  Settings,
  Shapes,
  Sparkles,
  Type,
  SlidersHorizontal,
} from "lucide-react";

import { ActiveTool, ProjectType } from "@/features/editor/types";
import { SidebarItem } from "@/features/editor/components/sidebar-item";

interface SidebarProps {
  activeTool: ActiveTool;
  onChangeActiveTool: (tool: ActiveTool) => void;
  projectType: ProjectType;
};

type SidebarTool = {
  icon: typeof LayoutTemplate;
  label: string;
  tool: ActiveTool;
};

// Tool definitions per project type — order determines priority (top = most important)
const getToolsForProjectType = (projectType: ProjectType): SidebarTool[] => {
  const allTools: Record<string, SidebarTool> = {
    design:   { icon: LayoutTemplate, label: "Design",    tool: "templates" },
    elements: { icon: Shapes,         label: "Elements",  tool: "shapes" },
    text:     { icon: Type,           label: "Text",      tool: "text" },
    images:   { icon: ImageIcon,      label: "Images",    tool: "images" },
    draw:     { icon: Pencil,         label: "Draw",      tool: "draw" },
    ai:       { icon: Sparkles,       label: "AI",        tool: "ai" },
    filters:  { icon: SlidersHorizontal, label: "Filters", tool: "filter" },
    settings: { icon: Settings,       label: "Settings",  tool: "settings" },
  };

  switch (projectType) {
    case "PRESENTATION":
      return [
        allTools.design,
        allTools.text,
        allTools.elements,
        allTools.images,
        allTools.draw,
        allTools.ai,
        allTools.settings,
      ];
    case "IMAGE":
      return [
        allTools.images,
        allTools.filters,
        allTools.ai,
        allTools.elements,
        allTools.text,
        allTools.draw,
        allTools.settings,
      ];
    case "LOGO":
      return [
        allTools.elements,
        allTools.text,
        allTools.design,
        allTools.images,
        allTools.draw,
        allTools.settings,
      ];
    case "POSTER":
      return [
        allTools.design,
        allTools.text,
        allTools.images,
        allTools.elements,
        allTools.filters,
        allTools.draw,
        allTools.ai,
        allTools.settings,
      ];
    default:
      return [
        allTools.design,
        allTools.elements,
        allTools.text,
        allTools.images,
        allTools.draw,
        allTools.ai,
        allTools.settings,
      ];
  }
};

export const Sidebar = ({
  activeTool,
  onChangeActiveTool,
  projectType,
}: SidebarProps) => {
  const tools = getToolsForProjectType(projectType);

  return (
    <aside className="bg-white flex flex-col w-[100px] h-full border-r overflow-y-auto z-[50]">
      <ul className="flex flex-col">
        {tools.map((item) => (
          <SidebarItem
            key={item.tool}
            icon={item.icon}
            label={item.label}
            isActive={activeTool === item.tool}
            onClick={() => onChangeActiveTool(item.tool)}
          />
        ))}
      </ul>
    </aside>
  );
};
