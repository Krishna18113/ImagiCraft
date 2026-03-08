"use client";

import { useEffect, useState, useCallback } from "react";
import { fabric } from "fabric";
import { X, ChevronLeft, ChevronRight } from "lucide-react";

import { Editor } from "@/features/editor/types";
import { Button } from "@/components/ui/button";

interface PresentModalProps {
    editor: Editor | undefined;
}

export const PresentModal = ({ editor }: PresentModalProps) => {
    const [isOpen, setIsOpen] = useState(false);
    const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
    const [presentCanvas, setPresentCanvas] = useState<fabric.StaticCanvas | null>(null);

    useEffect(() => {
        const handleOpen = () => {
            setIsOpen(true);
            setCurrentSlideIndex(editor?.currentPageIndex || 0);

            // Try to request full screen on the document element
            document.documentElement.requestFullscreen().catch((e) => {
                console.error("Error attempting to enable fullscreen:", e);
            });
        };

        window.addEventListener("open-present-modal", handleOpen);
        return () => window.removeEventListener("open-present-modal", handleOpen);
    }, [editor]);

    // Keyboard navigation
    useEffect(() => {
        if (!isOpen) return;

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "ArrowRight" || e.key === " ") {
                setCurrentSlideIndex((prev) =>
                    Math.min(prev + 1, (editor?.pages?.length || 1) - 1)
                );
            } else if (e.key === "ArrowLeft") {
                setCurrentSlideIndex((prev) => Math.max(prev - 1, 0));
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [isOpen, editor?.pages?.length]);

    useEffect(() => {
        if (!isOpen || !editor) return;

        const initCanvas = () => {
            const container = document.getElementById("presentation-container");
            if (!container) return;

            // Use live canvas data for the active page, or saved JSON for other pages
            let workspaceJSON;
            if (currentSlideIndex === editor.currentPageIndex) {
                workspaceJSON = editor.canvas.toJSON([
                    "name", "gradientAngle", "selectable", "hasControls", "linkData"
                ]);
            } else {
                if (editor.pages && editor.pages[currentSlideIndex]) {
                    workspaceJSON = JSON.parse(editor.pages[currentSlideIndex]);
                } else {
                    return;
                }
            }

            const canvas = new fabric.StaticCanvas("presentation-canvas", {
                width: container.clientWidth,
                height: container.clientHeight,
                backgroundColor: "#f0f0f0", // or match the editor background
            });

            // Calculate the scale required to fit the design in the full screen window
            const designRect = workspaceJSON.objects.find((obj: any) => obj.name === "clip");
            if (designRect && designRect.width && designRect.height) {
                const scaleX = container.clientWidth / designRect.width;
                const scaleY = container.clientHeight / designRect.height;
                const scale = Math.min(scaleX, scaleY) * 0.95; // 95% to leave a tiny margin

                // Pre-scale the JSON objects before loading
                canvas.loadFromJSON(workspaceJSON, () => {
                    const workspace = canvas.getObjects().find((obj) => obj.name === "clip");
                    if (workspace) {
                        // Center the workspace on the screen
                        const center = canvas.getCenter();
                        canvas.zoomToPoint(new fabric.Point(center.left, center.top), scale);
                        // @ts-ignore
                        canvas._centerObject(workspace, center);
                        canvas.renderAll();
                    }
                });
            }

            setPresentCanvas(canvas);
        };

        // Delay to allow DOM container to take full width
        const timeoutId = setTimeout(initCanvas, 100);

        return () => {
            clearTimeout(timeoutId);
            presentCanvas?.dispose();
        };
        // Need to re-fire this effect if currentSlideIndex changes
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen, editor, currentSlideIndex]);

    const handleClose = () => {
        setIsOpen(false);
        if (document.fullscreenElement) {
            document.exitFullscreen().catch((e) => {
                console.error("Error exiting fullscreen:", e);
            });
        }
    };

    const handleNext = () => setCurrentSlideIndex((prev) => Math.min(prev + 1, (editor?.pages?.length || 1) - 1));
    const handlePrev = () => setCurrentSlideIndex((prev) => Math.max(prev - 1, 0));

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] bg-[#e6e6e6] flex flex-col items-center justify-center pointer-events-auto">
            <div
                id="presentation-container"
                className="w-full h-full relative flex items-center justify-center flex-1"
            >
                <canvas id="presentation-canvas" />
            </div>

            {/* Slide Navigation Overlay (Left/Right Chevrons) */}
            <Button
                variant="ghost"
                size="icon"
                onClick={handlePrev}
                disabled={currentSlideIndex === 0}
                className="absolute left-6 top-1/2 -translate-y-1/2 size-12 rounded-full bg-white/50 hover:bg-white/80 text-black shadow-lg backdrop-blur z-[101]"
            >
                <ChevronLeft className="size-8" />
            </Button>

            <Button
                variant="ghost"
                size="icon"
                onClick={handleNext}
                disabled={currentSlideIndex === (editor?.pages?.length || 1) - 1}
                className="absolute right-6 top-1/2 -translate-y-1/2 size-12 rounded-full bg-white/50 hover:bg-white/80 text-black shadow-lg backdrop-blur z-[101]"
            >
                <ChevronRight className="size-8" />
            </Button>

            {/* Floating UI overlay for presentation tools */}
            <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 flex items-center justify-center gap-x-4 bg-gray-900/80 backdrop-blur px-6 py-3 rounded-full shadow-2xl z-[101]">
                <div className="text-white font-medium text-sm">
                    Page {currentSlideIndex + 1} / {editor?.pages?.length || 1}
                </div>
                <div className="w-px h-4 bg-white/30 mx-2" />
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleClose}
                    className="text-white hover:bg-white/20 hover:text-white rounded-full"
                >
                    <X className="size-4 mr-2" />
                    Exit Presentation
                </Button>
            </div>
        </div>
    );
};
