import {
  Minimize,
  ZoomIn,
  ZoomOut,
  FileEdit,
  Timer,
  LayoutGrid,
  Maximize,
  Plus,
  ChevronLeft,
  ChevronRight,
  Trash2
} from "lucide-react";

import { Editor, ProjectType } from "@/features/editor/types";

import { cn } from "@/lib/utils";
import { Hint } from "@/components/hint";
import { Button } from "@/components/ui/button";

interface FooterProps {
  editor: Editor | undefined;
  projectType: ProjectType;
};

export const Footer = ({ editor, projectType }: FooterProps) => {
  const showSlideStrip = projectType === "PRESENTATION";
  const showPageControls = projectType === "PRESENTATION";

  return (
    <footer className="w-full border-t bg-white flex flex-col z-[49] shrink-0">
      {/* Slide Thumbnails strip — only for presentations */}
      {showSlideStrip && (
        <div className="h-32 w-full flex items-center gap-x-4 overflow-x-auto bg-gray-50 border-b px-4 py-2 custom-scrollbar">
          {editor?.pages?.map((page, index) => (
            <div
              key={index}
              onClick={() => editor?.setPageIndex(index)}
              className={cn(
                "h-[90px] w-[140px] bg-white rounded-md border-2 flex items-center justify-center shrink-0 cursor-pointer relative group opacity-90 transition hover:opacity-100 shadow-sm",
                index === editor.currentPageIndex ? "border-blue-600 opacity-100" : "border-gray-200"
              )}
            >
              <span className="text-xs text-muted-foreground font-semibold">
                Slide {index + 1}
              </span>
              {index === editor.currentPageIndex && (
                <div className="absolute -bottom-2 -right-2 bg-blue-600 text-white text-[10px] w-5 h-5 rounded-full flex items-center justify-center">
                  {index + 1}
                </div>
              )}
            </div>
          ))}
          {/* Add new slide button in thumbnails */}
          <button
            className="h-[90px] w-12 flex items-center justify-center border-2 border-dashed border-gray-300 rounded-lg shrink-0 hover:bg-gray-100 transition shadow-sm bg-white"
            onClick={() => editor?.addPage()}
          >
            <Plus className="size-6 text-gray-400" />
          </button>
        </div>
      )}

      <div className="h-[52px] w-full flex items-center justify-between overflow-x-auto p-2 px-4">
        {/* Left side: context-aware tools */}
        <div className="flex items-center gap-x-2 shrink-0">
          {showPageControls && (
            <>
              <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-black shrink-0">
                <FileEdit className="size-4 mr-2" />
                Notes
              </Button>
              <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-black shrink-0">
                <Timer className="size-4 mr-2" />
                Timer
              </Button>
            </>
          )}
          {!showPageControls && (
            <span className="text-xs text-muted-foreground px-2 capitalize">
              {projectType.toLowerCase()} editor
            </span>
          )}
        </div>

        <div className="flex items-center gap-x-4 shrink-0">
          {/* Zoom controls — always visible */}
          <div className="flex items-center gap-x-1">
            <Hint label="Zoom out" side="top" sideOffset={10}>
              <Button
                onClick={() => editor?.zoomOut()}
                size="icon"
                variant="ghost"
                className="h-full rounded-full"
              >
                <ZoomOut className="size-4" />
              </Button>
            </Hint>
            <span className="text-xs text-muted-foreground font-medium w-10 text-center">{editor?.getZoomLevel?.() ?? 100}%</span>
            <Hint label="Zoom in" side="top" sideOffset={10}>
              <Button
                onClick={() => editor?.zoomIn()}
                size="icon"
                variant="ghost"
                className="h-full rounded-full"
              >
                <ZoomIn className="size-4" />
              </Button>
            </Hint>
            <Hint label="Fit to screen" side="top" sideOffset={10}>
              <Button
                onClick={() => editor?.autoZoom()}
                size="icon"
                variant="ghost"
                className="h-full rounded-full"
              >
                <Minimize className="size-4" />
              </Button>
            </Hint>
          </div>

          {/* Page controls — only for presentations */}
          {showPageControls && (
            <div className="flex items-center gap-x-2 border-l pl-4">
              <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-black">
                <LayoutGrid className="size-4 mr-2" />
                Pages
              </Button>

              <div className="flex items-center gap-x-2 bg-gray-100 rounded-md px-2 py-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-6 text-muted-foreground hover:text-black shrink-0"
                  onClick={() => editor?.setPageIndex((editor?.currentPageIndex || 0) - 1)}
                  disabled={(editor?.currentPageIndex || 0) === 0}
                >
                  <ChevronLeft className="size-4" />
                </Button>
                <span className="text-xs font-medium min-w-[40px] text-center">
                  {(editor?.currentPageIndex ?? 0) + 1} / {editor?.pages?.length || 1}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-6 text-muted-foreground hover:text-black shrink-0"
                  onClick={() => editor?.setPageIndex((editor?.currentPageIndex || 0) + 1)}
                  disabled={(editor?.currentPageIndex || 0) === (editor?.pages?.length || 1) - 1}
                >
                  <ChevronRight className="size-4" />
                </Button>
              </div>

              <Hint label="Delete page" side="top" sideOffset={10}>
                <Button
                  variant="ghost"
                  size="icon"
                  className="hover:bg-gray-100 text-destructive shrink-0"
                  disabled={(editor?.pages?.length || 1) <= 1}
                  onClick={() => editor?.deletePage()}
                >
                  <Trash2 className="size-4" />
                </Button>
              </Hint>

              <Button variant="ghost" size="icon" className="ml-2 shrink-0">
                <Maximize className="size-4" />
              </Button>
            </div>
          )}
        </div>
      </div>
    </footer>
  );
};
