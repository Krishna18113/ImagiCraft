import Link from "next/link";
import { useRef, useState } from "react";
import { AlertTriangle, Loader, Loader2, Upload } from "lucide-react";

import { ActiveTool, Editor } from "@/features/editor/types";
import { ToolSidebarClose } from "@/features/editor/components/tool-sidebar-close";
import { ToolSidebarHeader } from "@/features/editor/components/tool-sidebar-header";

import { useGetImages } from "@/features/images/api/use-get-images";
import { useGetUserImages } from "@/features/images/api/use-get-user-images";
import { useSaveUserImage } from "@/features/images/api/use-save-user-image";
import { uploadToCloudinary } from "@/lib/cloudinary";

import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";

interface ImageSidebarProps {
  editor: Editor | undefined;
  activeTool: ActiveTool;
  onChangeActiveTool: (tool: ActiveTool) => void;
}

export const ImageSidebar = ({ editor, activeTool, onChangeActiveTool }: ImageSidebarProps) => {
  const { data, isLoading, isError } = useGetImages();
  const { data: userImages, isLoading: userImagesLoading } = useGetUserImages();
  const saveImage = useSaveUserImage();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const onClose = () => {
    onChangeActiveTool("select");
  };

  const handleUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      const file = files[0];
      const { url, name } = await uploadToCloudinary(file);
      editor?.addImage(url);
      saveImage.mutate({ url, name });
    } catch (e) {
      console.error("Upload failed:", e);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <aside
      className={cn(
        "bg-white relative border-r z-[40] w-[360px] h-full flex flex-col",
        activeTool === "images" ? "visible" : "hidden"
      )}
    >
      <ToolSidebarHeader title="Images" description="Add images to your canvas" />
      <div className="p-4 border-b">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => handleUpload(e.target.files)}
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="w-full flex items-center justify-center gap-2 py-2 px-4 text-sm font-medium text-white bg-blue-500 hover:bg-blue-600 rounded-md transition disabled:opacity-60"
        >
          {uploading ? (
            <><Loader2 className="size-4 animate-spin" /> Uploading…</>
          ) : (
            <><Upload className="size-4" /> Upload Image</>
          )}
        </button>
      </div>

      <ScrollArea>
        <div className="p-4 space-y-4">

          {/* Your Uploads */}
          {userImagesLoading && (
            <div className="flex items-center justify-center py-4">
              <Loader className="size-4 text-muted-foreground animate-spin" />
            </div>
          )}
          {userImages && userImages.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">
                Your uploads
              </p>
              <div className="grid grid-cols-2 gap-4">
                {userImages.map((image) => (
                  <button
                    key={image.id}
                    onClick={() => editor?.addImage(image.url)}
                    className="relative w-full h-[100px] group hover:opacity-75 transition bg-muted rounded-sm overflow-hidden border"
                  >
                    <img
                      src={image.url}
                      alt={image.name}
                      className="object-cover w-full h-full"
                      loading="lazy"
                    />
                    <span className="opacity-0 group-hover:opacity-100 absolute left-0 bottom-0 w-full text-[10px] truncate text-white p-1 bg-black/50 text-left">
                      {image.name}
                    </span>
                  </button>
                ))}
              </div>
              <hr className="mt-4" />
            </div>
          )}

          {/* Unsplash images */}
          {isLoading && (
            <div className="flex items-center justify-center flex-1">
              <Loader className="size-4 text-muted-foreground animate-spin" />
            </div>
          )}
          {isError && (
            <div className="flex flex-col gap-y-4 items-center justify-center flex-1">
              <AlertTriangle className="size-4 text-muted-foreground" />
              <p className="text-muted-foreground text-xs">Failed to fetch images</p>
            </div>
          )}
          <div className="grid grid-cols-2 gap-4">
            {data &&
              data.map((image) => (
                <button
                  onClick={() => editor?.addImage(image.urls.regular)}
                  key={image.id}
                  className="relative w-full h-[100px] group hover:opacity-75 transition bg-muted rounded-sm overflow-hidden border"
                >
                  <img
                    src={image?.urls?.small || image?.urls?.thumb}
                    alt={image.alt_description || "Image"}
                    className="object-cover"
                    loading="lazy"
                  />
                  <Link
                    target="_blank"
                    href={image.links.html}
                    className="opacity-0 group-hover:opacity-100 absolute left-0 bottom-0 w-full text-[10px] truncate text-white hover:underline p-1 bg-black/50 text-left"
                  >
                    {image.user.name}
                  </Link>
                </button>
              ))}
          </div>

        </div>
      </ScrollArea>
      <ToolSidebarClose onClick={onClose} />
    </aside>
  );
};
