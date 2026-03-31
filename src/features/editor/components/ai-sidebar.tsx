import { useState } from "react";
import { toast } from "sonner";
import {
  ImageIcon,
  Type,
  Sparkles,
  Loader2,
  Wand2,
  CheckCircle,
  Circle,
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
  { label: "Minimal", suffix: ", minimalist flat design, soft pastel color palette, elegant" },
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
  
  // Refactored to be GLOBAL across both tabs
  const [sharedContext, setSharedContext] = useState("");
  const [globalPurpose, setGlobalPurpose] = useState<string>("none");

  const [imageComposition, setImageComposition] = useState<string>("none");
  const [needsNegativeSpace, setNeedsNegativeSpace] = useState<boolean>(false);

  const [textPrompt, setTextPrompt] = useState("");
  const [textType, setTextType] = useState<TextType>("headline");
  const [generatedElements, setGeneratedElements] = useState<any[]>([]);

  const onSubmitImage = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    let enhancedPrompt = imagePrompt;
    
    // Inject global context
    if (sharedContext.trim() !== "") {
      enhancedPrompt = `Theme: ${sharedContext}. ` + enhancedPrompt;
    }

    if (imageComposition === "background") {
      enhancedPrompt += ", poster background design, border frame layout";
    } else if (imageComposition === "object") {
      enhancedPrompt = "isolated object on white background, " + enhancedPrompt;
    }

    if (globalPurpose === "business") enhancedPrompt += ", corporate design";
    if (globalPurpose === "project") enhancedPrompt += ", creative project";
    if (globalPurpose === "workshop") enhancedPrompt += ", educational workshop";

    if (needsNegativeSpace) {
      enhancedPrompt += ", with open space in center for text overlay";
    }

    const fullPrompt = (selectedStyle
      ? enhancedPrompt + selectedStyle
      : enhancedPrompt);

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

    let fullTextPrompt = textPrompt;
    if (sharedContext.trim() !== "") {
      fullTextPrompt = `Global Theme: ${sharedContext}. ` + fullTextPrompt;
    }
    if (globalPurpose !== "none") {
      fullTextPrompt += `. Tailor the writing and colors for a ${globalPurpose} poster.`;
    }

    textMutation.mutate({ prompt: fullTextPrompt, type: textType }, {
      onSuccess: (response) => {
        if ("data" in response && Array.isArray(response.data)) {
          setGeneratedElements(response.data);
          toast.success("Text generated!");
        }
      },
      onError: () => {
        toast.error("Failed to generate text. Please try again.");
      },
    });
  };

  const addTextToCanvas = () => {
    if (!generatedElements.length) return;

    const workspace = editor?.getWorkspace();
    const maxWidth = (workspace?.width || 800) * 0.8;
    
    // Auto-scale font sizes dynamically based on how massive the canvas is
    const scaleFactor = (workspace?.width || 800) / 800;

    generatedElements.forEach((el, index) => {
      editor?.addText(el.content, {
        fontSize: (el.fontSize || 32) * Math.max(1, scaleFactor * 0.8), // Scale up smoothly for big posters
        fontWeight: el.fontWeight || 400,
        fontFamily: el.fontFamily || "Arial",
        textAlign: el.textAlign || "center",
        fill: el.fill || "#000000",
        width: maxWidth,
        top: 100 + (index * (80 * scaleFactor)), // scale spatial offset too
        left: workspace?.width ? workspace.width / 2 : 100,
        originX: "center",
        lineHeight: 1.2
      });
    });

    toast.success("Text elements added to canvas!");
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

      {/* Global Context Section */}
      <div className="p-4 border-b bg-slate-50 space-y-3">
        <p className="text-xs font-semibold text-slate-700">Global Project Theme</p>
        <Textarea
          placeholder="e.g. Gen AI and Safety 2026..."
          value={sharedContext}
          onChange={(e) => setSharedContext(e.target.value)}
          className="text-xs min-h-[40px] resize-none pb-1 h-12"
          rows={2}
        />
        <div className="flex gap-2 flex-wrap">
          {[
            { id: "business", label: "Business" },
            { id: "project", label: "Project" },
            { id: "workshop", label: "Workshop" },
          ].map((purp) => (
            <button
              key={purp.id}
              onClick={() => setGlobalPurpose(globalPurpose === purp.id ? "none" : purp.id)}
              className={cn(
                "text-[10px] px-2.5 py-1 rounded-full border transition",
                globalPurpose === purp.id ? "bg-blue-100 border-blue-600 text-blue-700" : "bg-white text-muted-foreground hover:bg-muted"
              )}
            >
              For {purp.label}
            </button>
          ))}
        </div>
      </div>

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

            <div className="space-y-4 pb-4 border-b">
              {/* Composition Type */}
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-2">What are you generating?</p>
                <div className="flex gap-2 flex-wrap">
                  {[
                    { id: "background", label: "Background Design" },
                    { id: "object", label: "Standalone Object" },
                  ].map((comp) => (
                    <button
                      key={comp.id}
                      type="button"
                      onClick={() => setImageComposition(imageComposition === comp.id ? "none" : comp.id)}
                      className={cn(
                        "text-xs px-3 py-1.5 rounded-full border transition",
                        imageComposition === comp.id ? "bg-blue-100 border-blue-600 text-blue-700" : "bg-white text-muted-foreground hover:bg-muted"
                      )}
                    >
                      {comp.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Checkbox / Toggle for Space */}
              <button
                type="button"
                onClick={() => setNeedsNegativeSpace(!needsNegativeSpace)}
                className={cn(
                  "w-full text-left text-xs px-3 py-2 rounded-md border flex items-center justify-between transition",
                  needsNegativeSpace ? "bg-blue-50 border-blue-600 text-blue-800" : "bg-white text-muted-foreground hover:bg-muted"
                )}
              >
                <span>Leave blank space for text / margins</span>
                {needsNegativeSpace ? <CheckCircle className="size-4 text-blue-600" /> : <Circle className="size-4" />}
              </button>
            </div>

            {/* Style Presets */}
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2">Style Filter</p>
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
            {generatedElements.length > 0 && (
              <div className="space-y-3">
                <p className="text-xs font-medium text-muted-foreground">Generated Elements</p>
                <div className="bg-gray-50 rounded-lg p-3 text-sm border space-y-3">
                  {generatedElements.map((el, i) => (
                    <div key={i} className="border-b border-gray-200 last:border-0 pb-3 last:pb-0">
                      <p style={{ color: el.fill, fontWeight: el.fontWeight, fontFamily: el.fontFamily }}>
                        {el.content}
                      </p>
                      <p className="text-[10px] text-gray-400 font-mono mt-1">
                        {el.fontFamily} • {el.fontSize}px • {el.fill}
                      </p>
                    </div>
                  ))}
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
