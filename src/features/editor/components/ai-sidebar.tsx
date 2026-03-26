import { useState } from "react";
import { toast } from "sonner";
import {
  ImageIcon,
  Type,
  Sparkles,
  Loader2,
  Wand2,
} from "lucide-react";

import { ActiveTool, Editor } from "@/features/editor/types";
import { ToolSidebarClose } from "@/features/editor/components/tool-sidebar-close";
import { ToolSidebarHeader } from "@/features/editor/components/tool-sidebar-header";

import { useGenerateImage } from "@/features/ai/api/use-generate-image";
import { useGenerateText } from "@/features/ai/api/use-generate-text";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";

interface AiSidebarProps {
  editor: Editor | undefined;
  activeTool: ActiveTool;
  onChangeActiveTool: (tool: ActiveTool) => void;
};

type AiTab = "image" | "text";
type TextType = "headline" | "tagline" | "body" | "custom";

const IMAGE_STYLE_PRESETS = [
  { label: "Realistic Photo", suffix: ", ultra realistic photograph, 8k, professional lighting" },
  { label: "Digital Art", suffix: ", digital art, vibrant colors, detailed illustration" },
  { label: "Watercolor", suffix: ", watercolor painting, soft brushstrokes, artistic" },
  { label: "3D Render", suffix: ", 3D render, cinema 4D, octane render, volumetric lighting" },
  { label: "Minimal", suffix: ", minimalist design, clean, simple, white background" },
  { label: "Neon", suffix: ", neon glow, cyberpunk, dark background, vibrant neon colors" },
];

const TEXT_TYPE_OPTIONS: { value: TextType; label: string; icon: typeof Type }[] = [
  { value: "headline", label: "Headline", icon: Type },
  { value: "tagline", label: "Tagline", icon: Sparkles },
  { value: "body", label: "Body Text", icon: Type },
  { value: "custom", label: "Custom", icon: Wand2 },
];

export const AiSidebar = ({
  editor,
  activeTool,
  onChangeActiveTool,
}: AiSidebarProps) => {
  const imageMutation = useGenerateImage();
  const textMutation = useGenerateText();

  const [tab, setTab] = useState<AiTab>("image");
  const [imagePrompt, setImagePrompt] = useState("");
  const [selectedStyle, setSelectedStyle] = useState<string | null>(null);
  const [textPrompt, setTextPrompt] = useState("");
  const [textType, setTextType] = useState<TextType>("headline");
  const [generatedText, setGeneratedText] = useState("");

  const onSubmitImage = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const fullPrompt = selectedStyle
      ? imagePrompt + selectedStyle
      : imagePrompt;

    imageMutation.mutate({ prompt: fullPrompt }, {
      onSuccess: (response) => {
        if ("data" in response) {
          editor?.addImage(response.data);
          toast.success("Image added to canvas!");
        }
      },
      onError: () => {
        toast.error("Failed to generate image. Please try again.");
      },
    });
  };

  const onSubmitText = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    textMutation.mutate({ prompt: textPrompt, type: textType }, {
      onSuccess: (response) => {
        if ("data" in response) {
          setGeneratedText(response.data);
          toast.success("Text generated!");
        }
      },
      onError: () => {
        toast.error("Failed to generate text. Please try again.");
      },
    });
  };

  const addTextToCanvas = () => {
    if (!generatedText) return;

    const styleMap: Record<TextType, { fontSize: number; fontWeight: number }> = {
      headline: { fontSize: 48, fontWeight: 700 },
      tagline: { fontSize: 28, fontWeight: 500 },
      body: { fontSize: 18, fontWeight: 400 },
      custom: { fontSize: 24, fontWeight: 400 },
    };

    const style = styleMap[textType];
    editor?.addText(generatedText, {
      fontSize: style.fontSize,
      fontWeight: style.fontWeight,
    });
    toast.success("Text added to canvas!");
  };

  const onClose = () => {
    onChangeActiveTool("select");
  };

  const isLoading = imageMutation.isPending || textMutation.isPending;

  return (
    <aside
      className={cn(
        "bg-white relative border-r z-[40] w-[360px] h-full flex flex-col",
        activeTool === "ai" ? "visible" : "hidden",
      )}
    >
      <ToolSidebarHeader
        title="AI Studio"
        description="Generate images and text with AI"
      />

      {/* Tab Switcher */}
      <div className="flex border-b px-4">
        <button
          onClick={() => setTab("image")}
          className={cn(
            "flex-1 flex items-center justify-center gap-x-2 py-3 text-sm font-medium transition border-b-2",
            tab === "image"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-muted-foreground hover:text-black"
          )}
        >
          <ImageIcon className="size-4" />
          Image
        </button>
        <button
          onClick={() => setTab("text")}
          className={cn(
            "flex-1 flex items-center justify-center gap-x-2 py-3 text-sm font-medium transition border-b-2",
            tab === "text"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-muted-foreground hover:text-black"
          )}
        >
          <Type className="size-4" />
          Text
        </button>
      </div>

      <ScrollArea>
        {tab === "image" && (
          <form onSubmit={onSubmitImage} className="p-4 space-y-4">
            <Textarea
              disabled={isLoading}
              placeholder="Describe the image you want to create..."
              cols={30}
              rows={5}
              required
              minLength={3}
              value={imagePrompt}
              onChange={(e) => setImagePrompt(e.target.value)}
            />

            {/* Style Presets */}
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2">Style Presets</p>
              <div className="grid grid-cols-2 gap-2">
                {IMAGE_STYLE_PRESETS.map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() =>
                      setSelectedStyle(
                        selectedStyle === preset.suffix ? null : preset.suffix
                      )
                    }
                    className={cn(
                      "text-xs px-3 py-2 rounded-lg border transition text-left",
                      selectedStyle === preset.suffix
                        ? "border-blue-600 bg-blue-50 text-blue-700"
                        : "border-gray-200 hover:border-gray-400 text-gray-600"
                    )}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>

            <Button
              disabled={isLoading}
              type="submit"
              className="w-full bg-gradient-to-r from-[#00c4cc] to-[#7d2ae8] hover:opacity-90 text-white"
            >
              {imageMutation.isPending ? (
                <Loader2 className="size-4 animate-spin mr-2" />
              ) : (
                <Sparkles className="size-4 mr-2" />
              )}
              {imageMutation.isPending ? "Generating..." : "Generate Image"}
            </Button>
          </form>
        )}

        {tab === "text" && (
          <div className="p-4 space-y-4">
            {/* Text Type Selector */}
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2">Text Type</p>
              <div className="grid grid-cols-2 gap-2">
                {TEXT_TYPE_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setTextType(option.value)}
                    className={cn(
                      "flex items-center gap-x-2 text-xs px-3 py-2 rounded-lg border transition",
                      textType === option.value
                        ? "border-blue-600 bg-blue-50 text-blue-700"
                        : "border-gray-200 hover:border-gray-400 text-gray-600"
                    )}
                  >
                    <option.icon className="size-3" />
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            <form onSubmit={onSubmitText} className="space-y-4">
              <Textarea
                disabled={isLoading}
                placeholder={
                  textType === "headline"
                    ? "E.g., A tech startup launching an AI product..."
                    : textType === "tagline"
                    ? "E.g., A sustainable fashion brand..."
                    : textType === "body"
                    ? "E.g., Write body copy for an app landing page..."
                    : "Describe what text you need..."
                }
                cols={30}
                rows={4}
                required
                minLength={3}
                value={textPrompt}
                onChange={(e) => setTextPrompt(e.target.value)}
              />
              <Button
                disabled={isLoading}
                type="submit"
                className="w-full bg-gradient-to-r from-[#00c4cc] to-[#7d2ae8] hover:opacity-90 text-white"
              >
                {textMutation.isPending ? (
                  <Loader2 className="size-4 animate-spin mr-2" />
                ) : (
                  <Wand2 className="size-4 mr-2" />
                )}
                {textMutation.isPending ? "Generating..." : "Generate Text"}
              </Button>
            </form>

            {/* Generated Text Preview */}
            {generatedText && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">Generated Text</p>
                <div className="bg-gray-50 rounded-lg p-3 text-sm border">
                  {generatedText}
                </div>
                <Button
                  onClick={addTextToCanvas}
                  variant="outline"
                  className="w-full"
                >
                  <Type className="size-4 mr-2" />
                  Add to Canvas
                </Button>
              </div>
            )}
          </div>
        )}
      </ScrollArea>
      <ToolSidebarClose onClick={onClose} />
    </aside>
  );
};
