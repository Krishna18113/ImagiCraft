import { Video } from "lucide-react";
import { ActiveTool, Editor } from "@/features/editor/types";
import { ToolSidebarClose } from "@/features/editor/components/tool-sidebar-close";
import { ToolSidebarHeader } from "@/features/editor/components/tool-sidebar-header";
import { cn } from "@/lib/utils";
import { UploadButton } from "@/lib/uploadthing";
import { ScrollArea } from "@/components/ui/scroll-area";

interface VideoSidebarProps {
    editor: Editor | undefined;
    activeTool: ActiveTool;
    onChangeActiveTool: (tool: ActiveTool) => void;
}

export const VideoSidebar = ({ editor, activeTool, onChangeActiveTool }: VideoSidebarProps) => {
    const onClose = () => {
        onChangeActiveTool("select");
    };

    return (
        <aside
            className={cn(
                "bg-white relative border-r z-[40] w-[360px] h-full flex flex-col",
                activeTool === "video" ? "visible" : "hidden"
            )}
        >
            <ToolSidebarHeader title="Video" description="Add video to your canvas" />
            <div className="p-4 border-b">
                <UploadButton
                    appearance={{
                        button: "w-full text-sm font-medium",
                        allowedContent: "hidden",
                    }}
                    content={{
                        button: "Upload Video",
                    }}
                    endpoint="imageUploader"
                    onClientUploadComplete={(res) => {
                        editor?.addVideo(res[0].url);
                    }}
                />
            </div>
            <ScrollArea>
                <div className="p-4">
                    <p className="text-muted-foreground text-xs text-center border p-4 rounded-sm flex flex-col items-center justify-center gap-2">
                        <Video className="size-8 text-muted-foreground" />
                        Upload an MP4 or WebM video file. <br />
                        Once uploaded, the video will be embedded in the scene and play seamlessly.
                    </p>
                </div>
            </ScrollArea>
            <ToolSidebarClose onClick={onClose} />
        </aside>
    );
};
