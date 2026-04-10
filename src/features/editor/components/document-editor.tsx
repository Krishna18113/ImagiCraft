"use client";

import { useCallback, useState, useRef, useEffect, useMemo } from "react";
import Link from "next/link";
import debounce from "lodash.debounce";
import { useEditor, EditorContent } from "@tiptap/react";
import { BubbleMenu, FloatingMenu } from "@tiptap/react/menus";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import CharacterCount from "@tiptap/extension-character-count";
import Underline from "@tiptap/extension-underline";
import TextAlign from "@tiptap/extension-text-align";
import TaskItem from "@tiptap/extension-task-item";
import TaskList from "@tiptap/extension-task-list";
import TiptapImage from "@tiptap/extension-image";
import { Table } from "@tiptap/extension-table";
import TableRow from "@tiptap/extension-table-row";
import TableCell from "@tiptap/extension-table-cell";
import TableHeader from "@tiptap/extension-table-header";
import Highlight from "@tiptap/extension-highlight";
import Color from "@tiptap/extension-color";
import { TextStyle } from "@tiptap/extension-text-style";

import { ResponseType } from "@/features/projects/api/use-get-project";
import { useUpdateProject } from "@/features/projects/api/use-update-project";
import { usePretext } from "@/features/editor/hooks/use-pretext";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Loader2,
  Sparkles,
  Wand2,
  Type,
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Strikethrough,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  List,
  ListOrdered,
  CheckSquare,
  Undo,
  Redo,
  Image as ImageIcon,
  Upload,
  Download,
  FileText,
  FileCode,
  Scissors,
  Table as TableIcon,
  Highlighter,
  Palette,
  BookOpen,
  ChevronRight,
  Clock,
  Hash,
  Minus,
  Plus,
  PanelLeft,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { uploadToCloudinary } from "@/lib/cloudinary";
import { useMutation } from "@tanstack/react-query";

interface DocumentEditorProps {
  initialData: ResponseType["data"];
}

// ─── Custom Image Extension with Float support ─────────────────────────
const FloatImage = TiptapImage.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      "data-float": {
        default: null,
        parseHTML: (element) => element.getAttribute("data-float"),
        renderHTML: (attributes) => {
          if (!attributes["data-float"]) return {};
          return { "data-float": attributes["data-float"] };
        },
      },
      width: {
        default: null,
        parseHTML: (element) => element.getAttribute("width"),
        renderHTML: (attributes) => {
          if (!attributes.width) return {};
          return { width: attributes.width };
        },
      },
    };
  },
});

// ─── Heading item for TOC ──────────────────────────────────────────────
interface TocHeading {
  level: number;
  text: string;
  id: string;
  pos: number;
}

// ─── Minimal Navbar ────────────────────────────────────────────────────
const MinimalNavbar = ({
  projectName,
  editor,
}: {
  projectName: string;
  editor: any;
}) => {
  const onShare = () => {
    navigator.clipboard.writeText(window.location.href);
    toast.success("Link copied to clipboard!");
  };

  const onDownloadPDF = () => {
    window.print();
  };

  const onDownloadText = () => {
    if (!editor) return;
    const blob = new Blob([editor.getText()], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${projectName}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const onDownloadHTML = () => {
    if (!editor) return;
    const blob = new Blob([editor.getHTML()], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${projectName}.html`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <nav className="w-full h-[68px] flex items-center justify-between p-4 border-b bg-white relative z-10 shadow-sm print:hidden">
      <div className="flex items-center gap-x-4">
        <Link href="/">
          <div className="size-10 rounded-xl bg-gradient-to-r from-[#00c4cc] to-[#7d2ae8] flex items-center justify-center shadow-sm hover:opacity-90 transition">
            <span className="text-white font-bold text-xl">I</span>
          </div>
        </Link>
        <div className="flex flex-col">
          <h1 className="text-sm font-semibold text-slate-800">
            {projectName}
          </h1>
          <p className="text-xs text-muted-foreground">Document</p>
        </div>
      </div>
      <div className="flex items-center gap-x-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="gap-x-2">
              <Download className="size-4" />
              Export
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onDownloadPDF}>
              <FileText className="size-4 mr-2" /> PDF / Print
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onDownloadText}>
              <Type className="size-4 mr-2" /> Raw Text (.txt)
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onDownloadHTML}>
              <FileCode className="size-4 mr-2" /> HTML Source
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <div className="w-[1px] h-6 bg-slate-200 mx-1" />

        <Button size="sm" onClick={onShare}>
          Share
        </Button>
      </div>
    </nav>
  );
};

// ─── Document Outline / TOC Panel ──────────────────────────────────────
const OutlinePanel = ({
  headings,
  onSelect,
  open,
  onClose,
}: {
  headings: TocHeading[];
  onSelect: (pos: number) => void;
  open: boolean;
  onClose: () => void;
}) => {
  if (!open) return null;

  return (
    <div className="w-[260px] bg-white border-r shrink-0 flex flex-col print:hidden">
      <div className="flex items-center justify-between p-3 border-b">
        <div className="flex items-center gap-x-2 text-sm font-semibold text-slate-700">
          <BookOpen className="size-4" />
          Outline
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="size-6"
          onClick={onClose}
        >
          <X className="size-3" />
        </Button>
      </div>
      <div className="flex-1 overflow-auto p-2">
        {headings.length === 0 && (
          <p className="text-xs text-muted-foreground p-3">
            Add headings (H1, H2, H3) to see them here.
          </p>
        )}
        {headings.map((h, i) => (
          <button
            key={i}
            onClick={() => onSelect(h.pos)}
            className={`w-full text-left px-3 py-1.5 rounded text-sm hover:bg-slate-50 transition truncate ${
              h.level === 1
                ? "font-semibold text-slate-800"
                : h.level === 2
                ? "pl-6 text-slate-700"
                : "pl-9 text-slate-500 text-xs"
            }`}
          >
            <ChevronRight
              className={`inline-block size-3 mr-1 ${
                h.level === 1 ? "text-indigo-500" : "text-slate-400"
              }`}
            />
            {h.text}
          </button>
        ))}
      </div>
    </div>
  );
};

// ─── Color Picker Dropdown ─────────────────────────────────────────────
const COLORS = [
  "#000000",
  "#434343",
  "#666666",
  "#999999",
  "#B7B7B7",
  "#CCCCCC",
  "#D9D9D9",
  "#EFEFEF",
  "#F3F3F3",
  "#FFFFFF",
  "#980000",
  "#FF0000",
  "#FF9900",
  "#FFFF00",
  "#00FF00",
  "#00FFFF",
  "#4A86E8",
  "#0000FF",
  "#9900FF",
  "#FF00FF",
  "#E6B8AF",
  "#F4CCCC",
  "#FCE5CD",
  "#FFF2CC",
  "#D9EAD3",
  "#D0E0E3",
  "#C9DAF8",
  "#CFE2F3",
  "#D9D2E9",
  "#EAD1DC",
];

const HIGHLIGHT_COLORS = [
  "#FFFF00",
  "#00FF00",
  "#00FFFF",
  "#FF69B4",
  "#FFA500",
  "#DDA0DD",
  "#87CEEB",
  "#FFB6C1",
  "#98FB98",
  "#FFDAB9",
];

const ColorPickerButton = ({
  editor,
  type,
}: {
  editor: any;
  type: "text" | "highlight";
}) => {
  const colors = type === "text" ? COLORS : HIGHLIGHT_COLORS;
  const Icon = type === "text" ? Palette : Highlighter;
  const label = type === "text" ? "Text color" : "Highlight";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 rounded hover:bg-slate-100 text-slate-700"
          title={label}
        >
          <Icon className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-[220px] p-2">
        <p className="text-xs text-muted-foreground mb-2 px-1">{label}</p>
        <div className="grid grid-cols-10 gap-1">
          {colors.map((color) => (
            <button
              key={color}
              className="size-5 rounded-sm border border-slate-200 hover:scale-110 transition-transform"
              style={{ backgroundColor: color }}
              onClick={() => {
                if (type === "text") {
                  editor.chain().focus().setColor(color).run();
                } else {
                  editor
                    .chain()
                    .focus()
                    .toggleHighlight({ color })
                    .run();
                }
              }}
            />
          ))}
        </div>
        {type === "text" && (
          <>
            <DropdownMenuSeparator />
            <button
              className="w-full text-left text-xs px-1 py-1 text-slate-500 hover:text-slate-800"
              onClick={() => editor.chain().focus().unsetColor().run()}
            >
              Reset to default
            </button>
          </>
        )}
        {type === "highlight" && (
          <>
            <DropdownMenuSeparator />
            <button
              className="w-full text-left text-xs px-1 py-1 text-slate-500 hover:text-slate-800"
              onClick={() => editor.chain().focus().unsetHighlight().run()}
            >
              Remove highlight
            </button>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

// ═══════════════════════════════════════════════════════════════════════
//  MAIN DOCUMENT EDITOR
// ═══════════════════════════════════════════════════════════════════════
export const DocumentEditor = ({ initialData }: DocumentEditorProps) => {
  const { mutate: updateProject } = useUpdateProject(initialData.id);
  const { measureText } = usePretext();

  const [outlineOpen, setOutlineOpen] = useState(false);
  const [headings, setHeadings] = useState<TocHeading[]>([]);
  const [pageCount, setPageCount] = useState(1);

  // ── Auto-save ────────────────────────────────────────────────────────
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const debouncedSave = useCallback(
    debounce((html: string) => {
      updateProject({
        json: html,
        width: initialData.width,
        height: initialData.height,
      });
    }, 1500),
    [updateProject]
  );

  // ── Extract TOC headings ─────────────────────────────────────────────
  const extractHeadings = useCallback(
    (editorInstance: ReturnType<typeof useEditor>) => {
      if (!editorInstance) return;
      const h: TocHeading[] = [];
      editorInstance.state.doc.descendants((node, pos) => {
        if (node.type.name === "heading") {
          h.push({
            level: node.attrs.level,
            text: node.textContent,
            id: `heading-${pos}`,
            pos,
          });
        }
      });
      setHeadings(h);
    },
    []
  );

  // ── Measure page count with Pretext ──────────────────────────────────
  const debouncedMeasure = useCallback(
    debounce(async (text: string) => {
      try {
        // A4 page: ~650px content width, 26px line height
        // A4 usable height: ~980px (1056 - padding)
        const result = await measureText(
          text,
          '16px "Inter", system-ui, sans-serif',
          650,
          26
        );
        const pages = Math.max(1, Math.ceil(result.height / 980));
        setPageCount(pages);
      } catch {
        // Pretext not loaded yet, fallback
      }
    }, 500),
    [measureText]
  );

  // ── Editor instance ──────────────────────────────────────────────────
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit,
      FloatImage.configure({
        allowBase64: true,
        HTMLAttributes: {
          class: "doc-image",
        },
      }),
      Underline,
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Placeholder.configure({
        placeholder:
          "Start writing your document...",
      }),
      CharacterCount,
      Table.configure({ resizable: true }),
      TableRow,
      TableCell,
      TableHeader,
      Highlight.configure({ multicolor: true }),
      Color,
      TextStyle,
    ],
    content: initialData.json || "",
    editorProps: {
      attributes: {
        class:
          "prose prose-slate prose-lg max-w-none focus:outline-none min-h-[800px] pb-32",
      },
      handleKeyDown: (view, event) => {
        if (event.shiftKey && event.key === "?") {
          event.preventDefault();
          setAiInputOpen(true);
          return true;
        }
        return false;
      },
    },
    onUpdate: ({ editor: ed }) => {
      const html = ed.getHTML();
      debouncedSave(html);
      extractHeadings(ed as any);
      debouncedMeasure(ed.getText());
    },
  });

  // ── Extract headings on mount ────────────────────────────────────────
  useEffect(() => {
    if (editor) {
      extractHeadings(editor as any);
      debouncedMeasure(editor.getText());
    }
  }, [editor, extractHeadings, debouncedMeasure]);

  // ── Scroll to heading (TOC click) ────────────────────────────────────
  const scrollToHeading = useCallback(
    (pos: number) => {
      if (!editor) return;
      editor.chain().focus().setTextSelection(pos).run();
      // Scroll into view
      const domAtPos = editor.view.domAtPos(pos);
      if (domAtPos.node) {
        const el =
          domAtPos.node instanceof Element
            ? domAtPos.node
            : domAtPos.node.parentElement;
        el?.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    },
    [editor]
  );

  // ── AI states ────────────────────────────────────────────────────────
  const [aiInputOpen, setAiInputOpen] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);

  const askAiMutation = useMutation({
    mutationFn: async (instruction: string) => {
      const res = await fetch("/api/ai/rewrite-text", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: "Write a high quality document paragraph/section from scratch based on the instruction.",
          instruction: instruction,
        }),
      });
      if (!res.ok) throw new Error("Failed to generate text");
      return res.json();
    },
    onSuccess: (res) => {
      if (res.data && editor) {
        editor.chain().focus().insertContent(res.data).run();
        setAiInputOpen(false);
        setAiPrompt("");
      }
    },
    onError: () => toast.error("AI Generation failed"),
    onSettled: () => setIsGenerating(false),
  });

  const handleAskAi = () => {
    if (!aiPrompt.trim()) return;
    setIsGenerating(true);
    askAiMutation.mutate(aiPrompt);
  };

  // ── Rewrite ──────────────────────────────────────────────────────────
  const [isRewriting, setIsRewriting] = useState(false);

  const handleRewrite = async (instruction: string) => {
    if (!editor) return;
    const selection = editor.state.selection;
    const text = editor.state.doc.textBetween(
      selection.from,
      selection.to,
      " "
    );
    if (!text) return;

    setIsRewriting(true);
    try {
      const res = await fetch("/api/ai/rewrite-text", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, instruction }),
      });
      if (!res.ok) throw new Error("Failed");
      const { data } = await res.json();
      if (data) {
        editor.chain().focus().insertContent(data).run();
      }
    } catch {
      toast.error("Rewrite failed");
    } finally {
      setIsRewriting(false);
    }
  };

  // ── AI Image ─────────────────────────────────────────────────────────
  const [aiImageModalOpen, setAiImageModalOpen] = useState(false);
  const [aiImagePrompt, setAiImagePrompt] = useState("");

  const askAiImageMutation = useMutation({
    mutationFn: async (prompt: string) => {
      const res = await fetch("/api/ai/generate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });
      if (!res.ok) throw new Error("Failed to generate image");
      return res.json();
    },
    onSuccess: (res) => {
      if (res.data && editor) {
        editor.chain().focus().setImage({ src: res.data }).run();
        setAiImageModalOpen(false);
        setAiImagePrompt("");
      }
    },
    onError: () => toast.error("AI Image Generation failed"),
  });

  const handleAskAiImage = () => {
    if (!aiImagePrompt.trim()) return;
    askAiImageMutation.mutate(aiImagePrompt);
  };

  // ── File Upload ──────────────────────────────────────────────────────
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);

  const handleNativeUpload = async (file: File) => {
    if (!editor || !file) return;
    setIsUploading(true);
    try {
      const { url } = await uploadToCloudinary(file);
      editor.chain().focus().setImage({ src: url }).run();
      toast.success("Image uploaded!");
    } catch {
      toast.error("Upload failed");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // ── Reading time / stats ─────────────────────────────────────────────
  const wordCount = editor?.storage.characterCount.words() ?? 0;
  const charCount = editor?.storage.characterCount.characters() ?? 0;
  const readingTime = Math.max(1, Math.ceil(wordCount / 200));

  // ════════════════════════════════════════════════════════════════════
  //  RENDER
  // ════════════════════════════════════════════════════════════════════
  return (
    <div className="h-full flex flex-col bg-[#F8F9FA] print:bg-white">
      <MinimalNavbar projectName={initialData.name} editor={editor} />

      <input
        type="file"
        accept="image/*"
        ref={fileInputRef}
        hidden
        onChange={(e) => {
          if (e.target.files && e.target.files[0]) {
            handleNativeUpload(e.target.files[0]);
          }
        }}
      />

      {/* ─── Persistent Docs Toolbar ─────────────────────────────────── */}
      {editor && (
        <div className="sticky top-0 z-20 w-full bg-white border-b shadow-sm flex items-center px-3 overflow-x-auto gap-x-0.5 shrink-0 print:hidden h-11">
          {/* Outline toggle */}
          <Button
            variant="ghost"
            size="icon"
            className={`h-8 w-8 rounded hover:bg-slate-100 ${outlineOpen ? "bg-indigo-50 text-indigo-600" : "text-slate-700"}`}
            onClick={() => setOutlineOpen(!outlineOpen)}
            title="Document Outline"
          >
            <PanelLeft className="size-4" />
          </Button>

          <div className="w-[1px] h-5 bg-slate-200 mx-1" />

          {/* Undo / Redo */}
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded hover:bg-slate-100 text-slate-700"
            onClick={() => editor.chain().focus().undo().run()}
            disabled={!editor.can().undo()}
          >
            <Undo className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded hover:bg-slate-100 text-slate-700"
            onClick={() => editor.chain().focus().redo().run()}
            disabled={!editor.can().redo()}
          >
            <Redo className="size-4" />
          </Button>

          <div className="w-[1px] h-5 bg-slate-200 mx-1" />

          {/* Typography */}
          <select
            className="h-8 bg-transparent hover:bg-slate-100 rounded px-2 text-sm text-slate-700 border-none outline-none cursor-pointer"
            onChange={(e) => {
              if (e.target.value === "p")
                editor.chain().focus().setParagraph().run();
              else
                editor
                  .chain()
                  .focus()
                  .toggleHeading({
                    level: parseInt(e.target.value) as any,
                  })
                  .run();
            }}
            value={
              editor.isActive("heading", { level: 1 })
                ? "1"
                : editor.isActive("heading", { level: 2 })
                ? "2"
                : editor.isActive("heading", { level: 3 })
                ? "3"
                : "p"
            }
          >
            <option value="p">Normal text</option>
            <option value="1">Heading 1</option>
            <option value="2">Heading 2</option>
            <option value="3">Heading 3</option>
          </select>

          <div className="w-[1px] h-5 bg-slate-200 mx-1" />

          {/* Marks */}
          <Button
            variant="ghost"
            size="icon"
            className={`h-8 w-8 rounded hover:bg-slate-100 ${editor.isActive("bold") ? "bg-indigo-100 text-indigo-700" : "text-slate-700"}`}
            onClick={() => editor.chain().focus().toggleBold().run()}
          >
            <Bold className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className={`h-8 w-8 rounded hover:bg-slate-100 ${editor.isActive("italic") ? "bg-indigo-100 text-indigo-700" : "text-slate-700"}`}
            onClick={() => editor.chain().focus().toggleItalic().run()}
          >
            <Italic className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className={`h-8 w-8 rounded hover:bg-slate-100 ${editor.isActive("underline") ? "bg-indigo-100 text-indigo-700" : "text-slate-700"}`}
            onClick={() => editor.chain().focus().toggleUnderline().run()}
          >
            <UnderlineIcon className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className={`h-8 w-8 rounded hover:bg-slate-100 ${editor.isActive("strike") ? "bg-indigo-100 text-indigo-700" : "text-slate-700"}`}
            onClick={() => editor.chain().focus().toggleStrike().run()}
          >
            <Strikethrough className="size-4" />
          </Button>

          <div className="w-[1px] h-5 bg-slate-200 mx-1" />

          {/* Colors */}
          <ColorPickerButton editor={editor} type="text" />
          <ColorPickerButton editor={editor} type="highlight" />

          <div className="w-[1px] h-5 bg-slate-200 mx-1" />

          {/* Alignment */}
          <Button
            variant="ghost"
            size="icon"
            className={`h-8 w-8 rounded hover:bg-slate-100 ${editor.isActive({ textAlign: "left" }) ? "bg-indigo-100 text-indigo-700" : "text-slate-700"}`}
            onClick={() => editor.chain().focus().setTextAlign("left").run()}
          >
            <AlignLeft className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className={`h-8 w-8 rounded hover:bg-slate-100 ${editor.isActive({ textAlign: "center" }) ? "bg-indigo-100 text-indigo-700" : "text-slate-700"}`}
            onClick={() => editor.chain().focus().setTextAlign("center").run()}
          >
            <AlignCenter className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className={`h-8 w-8 rounded hover:bg-slate-100 ${editor.isActive({ textAlign: "right" }) ? "bg-indigo-100 text-indigo-700" : "text-slate-700"}`}
            onClick={() => editor.chain().focus().setTextAlign("right").run()}
          >
            <AlignRight className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className={`h-8 w-8 rounded hover:bg-slate-100 ${editor.isActive({ textAlign: "justify" }) ? "bg-indigo-100 text-indigo-700" : "text-slate-700"}`}
            onClick={() => editor.chain().focus().setTextAlign("justify").run()}
          >
            <AlignJustify className="size-4" />
          </Button>

          <div className="w-[1px] h-5 bg-slate-200 mx-1" />

          {/* Lists */}
          <Button
            variant="ghost"
            size="icon"
            className={`h-8 w-8 rounded hover:bg-slate-100 ${editor.isActive("bulletList") ? "bg-indigo-100 text-indigo-700" : "text-slate-700"}`}
            onClick={() => editor.chain().focus().toggleBulletList().run()}
          >
            <List className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className={`h-8 w-8 rounded hover:bg-slate-100 ${editor.isActive("orderedList") ? "bg-indigo-100 text-indigo-700" : "text-slate-700"}`}
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
          >
            <ListOrdered className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className={`h-8 w-8 rounded hover:bg-slate-100 ${editor.isActive("taskList") ? "bg-indigo-100 text-indigo-700" : "text-slate-700"}`}
            onClick={() => editor.chain().focus().toggleTaskList().run()}
          >
            <CheckSquare className="size-4" />
          </Button>

          <div className="w-[1px] h-5 bg-slate-200 mx-1" />

          {/* Table */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded hover:bg-slate-100 text-slate-700"
                title="Insert Table"
              >
                <TableIcon className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem
                onClick={() =>
                  editor
                    .chain()
                    .focus()
                    .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
                    .run()
                }
              >
                3 × 3 Table
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() =>
                  editor
                    .chain()
                    .focus()
                    .insertTable({ rows: 4, cols: 4, withHeaderRow: true })
                    .run()
                }
              >
                4 × 4 Table
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() =>
                  editor
                    .chain()
                    .focus()
                    .insertTable({ rows: 5, cols: 5, withHeaderRow: true })
                    .run()
                }
              >
                5 × 5 Table
              </DropdownMenuItem>
              {editor.isActive("table") && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() =>
                      editor.chain().focus().addColumnAfter().run()
                    }
                  >
                    <Plus className="size-3 mr-2" /> Add Column
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => editor.chain().focus().addRowAfter().run()}
                  >
                    <Plus className="size-3 mr-2" /> Add Row
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => editor.chain().focus().deleteColumn().run()}
                  >
                    <Minus className="size-3 mr-2" /> Delete Column
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => editor.chain().focus().deleteRow().run()}
                  >
                    <Minus className="size-3 mr-2" /> Delete Row
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => editor.chain().focus().deleteTable().run()}
                    className="text-red-600"
                  >
                    Delete Table
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Page Break */}
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded hover:bg-slate-100 text-slate-700"
            onClick={() => editor.chain().focus().setHorizontalRule().run()}
            title="Insert Page Break"
          >
            <Scissors className="size-4" />
          </Button>

          <div className="w-[1px] h-5 bg-slate-200 mx-1" />

          {/* Upload & AI Image */}
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded hover:bg-slate-100 text-slate-700"
            disabled={isUploading}
            onClick={() => fileInputRef.current?.click()}
            title="Upload Image"
          >
            {isUploading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Upload className="size-4" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded hover:bg-purple-50 text-purple-600"
            onClick={() => setAiImageModalOpen(true)}
            title="AI Generate Image"
          >
            <ImageIcon className="size-4" />
          </Button>

          <div className="flex-1" />

          {/* AI Button */}
          <Button
            size="sm"
            className="h-8 bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-600 hover:to-indigo-700 text-white gap-x-2 rounded-full px-4 shadow-sm"
            onClick={() => setAiInputOpen(true)}
          >
            <Sparkles className="size-4" />
            <span className="font-medium hidden sm:inline-block">Ask AI</span>
          </Button>
        </div>
      )}

      {/* ─── Main Content Area ───────────────────────────────────────── */}
      <div className="flex-1 flex overflow-hidden">
        {/* Outline Panel */}
        <OutlinePanel
          headings={headings}
          onSelect={scrollToHeading}
          open={outlineOpen}
          onClose={() => setOutlineOpen(false)}
        />

        {/* Document Area */}
        <main className="flex-1 overflow-auto flex justify-center py-10 bg-[#F8F9FA] pb-32 print:p-0 print:m-0 print:overflow-visible">
          <div
            className="w-[820px] bg-white border border-gray-200 shadow-md rounded-sm pt-20 px-24 pb-32 min-h-[1100px] cursor-text print:w-full print:border-none print:shadow-none print:p-[1in] print:m-0 relative"
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                editor?.commands.focus();
              }
            }}
          >
            {editor && (
              <>
                {/* BubbleMenu for IMAGE selection — float + resize controls */}
                <BubbleMenu
                  editor={editor}
                  className="flex overflow-hidden rounded-lg border bg-white shadow-xl p-1 gap-0.5"
                  shouldShow={({ editor: e }) => {
                    const sel = e.state.selection as any;
                    return !!(sel.node && sel.node.type.name === "image");
                  }}
                >
                  <Button
                    size="sm"
                    variant={editor.isActive("image", { "data-float": "left" }) ? "default" : "ghost"}
                    className="h-7 text-xs px-2 gap-1"
                    onClick={() =>
                      editor.chain().focus().updateAttributes("image", {
                        "data-float": (editor.state.selection as any).node?.attrs["data-float"] === "left" ? null : "left",
                      }).run()
                    }
                  >
                    <AlignLeft className="size-3" /> Left
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 text-xs px-2 gap-1"
                    onClick={() =>
                      editor.chain().focus().updateAttributes("image", {
                        "data-float": null,
                      }).run()
                    }
                  >
                    <AlignCenter className="size-3" /> Inline
                  </Button>
                  <Button
                    size="sm"
                    variant={editor.isActive("image", { "data-float": "right" }) ? "default" : "ghost"}
                    className="h-7 text-xs px-2 gap-1"
                    onClick={() =>
                      editor.chain().focus().updateAttributes("image", {
                        "data-float": (editor.state.selection as any).node?.attrs["data-float"] === "right" ? null : "right",
                      }).run()
                    }
                  >
                    <AlignRight className="size-3" /> Right
                  </Button>
                  <div className="w-[1px] bg-slate-200 mx-0.5 self-stretch" />
                  <Button size="sm" variant="ghost" className="h-7 text-xs px-2" onClick={() => editor.chain().focus().updateAttributes("image", { width: "200" }).run()}>S</Button>
                  <Button size="sm" variant="ghost" className="h-7 text-xs px-2" onClick={() => editor.chain().focus().updateAttributes("image", { width: "300" }).run()}>M</Button>
                  <Button size="sm" variant="ghost" className="h-7 text-xs px-2" onClick={() => editor.chain().focus().updateAttributes("image", { width: "450" }).run()}>L</Button>
                  <Button size="sm" variant="ghost" className="h-7 text-xs px-2" onClick={() => editor.chain().focus().updateAttributes("image", { width: null }).run()}>Full</Button>
                </BubbleMenu>

                {/* BubbleMenu for TEXT selection — formatting + AI */}
                <BubbleMenu
                  editor={editor}
                  className="flex overflow-hidden rounded-lg border bg-white shadow-xl"
                  shouldShow={({ editor: e }) => {
                    const sel = e.state.selection as any;
                    // Hide for image node selections
                    if (sel.node) return false;
                    // Show only when there's actual text selected
                    return !e.state.selection.empty;
                  }}
                >
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                          editor.chain().focus().toggleBold().run()
                        }
                        className={
                          editor.isActive("bold") ? "bg-slate-100" : ""
                        }
                      >
                        <Bold className="size-3" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                          editor.chain().focus().toggleItalic().run()
                        }
                        className={
                          editor.isActive("italic") ? "bg-slate-100" : ""
                        }
                      >
                        <Italic className="size-3" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                          editor.chain().focus().toggleUnderline().run()
                        }
                        className={
                          editor.isActive("underline") ? "bg-slate-100" : ""
                        }
                      >
                        <UnderlineIcon className="size-3" />
                      </Button>
                      <div className="w-[1px] bg-slate-200 mx-0.5" />
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-purple-600 gap-x-1"
                        disabled={isRewriting}
                        onClick={() =>
                          handleRewrite("Make it sound more professional")
                        }
                      >
                        {isRewriting ? (
                          <Loader2 className="size-3 animate-spin" />
                        ) : (
                          <Sparkles className="size-3" />
                        )}
                        Pro
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-purple-600 gap-x-1"
                        disabled={isRewriting}
                        onClick={() =>
                          handleRewrite("Make it shorter and concise")
                        }
                      >
                        {isRewriting ? (
                          <Loader2 className="size-3 animate-spin" />
                        ) : (
                          <Wand2 className="size-3" />
                        )}
                        Short
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-amber-600 gap-x-1"
                        disabled={isRewriting}
                        onClick={() => handleRewrite("Expand with more detail and examples")}
                      >
                        {isRewriting ? (
                          <Loader2 className="size-3 animate-spin" />
                        ) : (
                          <Plus className="size-3" />
                        )}
                        Expand
                      </Button>
                </BubbleMenu>

                {/* Floating Menu for empty paragraphs */}
                <FloatingMenu
                  editor={editor}
                  className="flex overflow-hidden rounded-lg border bg-white shadow-xl"
                >
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() =>
                      editor
                        .chain()
                        .focus()
                        .toggleHeading({ level: 1 })
                        .run()
                    }
                  >
                    H1
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() =>
                      editor
                        .chain()
                        .focus()
                        .toggleHeading({ level: 2 })
                        .run()
                    }
                  >
                    H2
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() =>
                      editor.chain().focus().toggleBulletList().run()
                    }
                  >
                    List
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() =>
                      editor
                        .chain()
                        .focus()
                        .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
                        .run()
                    }
                  >
                    <TableIcon className="size-3 mr-1" />
                    Table
                  </Button>
                  <div className="w-[1px] bg-slate-200 mx-0.5" />
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setAiImageModalOpen(true)}
                    className="text-purple-600 gap-x-1 font-medium"
                  >
                    <ImageIcon className="size-4" />
                    Img
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setAiInputOpen(true)}
                    className="text-purple-600 gap-x-1 font-medium bg-purple-50"
                  >
                    <Sparkles className="size-4" />
                    Ask AI
                  </Button>
                </FloatingMenu>
              </>
            )}

            {/* AI Command Palette Overlay */}
            {aiInputOpen && (
              <div className="absolute top-24 left-1/2 -translate-x-1/2 w-full max-w-xl z-50 bg-white rounded-xl shadow-2xl border p-4 space-y-4">
                <div className="flex items-center gap-x-2 text-purple-600 font-medium">
                  <Sparkles className="size-5" />
                  <p>What should the AI write?</p>
                </div>
                <Textarea
                  autoFocus
                  placeholder="e.g. Write an introduction about Generative AI safety protocols..."
                  value={aiPrompt}
                  onChange={(e) => setAiPrompt(e.target.value)}
                  className="resize-none"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleAskAi();
                    }
                    if (e.key === "Escape") setAiInputOpen(false);
                  }}
                />
                <div className="flex justify-end gap-x-2">
                  <Button
                    variant="ghost"
                    onClick={() => setAiInputOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleAskAi}
                    disabled={isGenerating || !aiPrompt.trim()}
                    className="bg-purple-600 hover:bg-purple-700"
                  >
                    {isGenerating ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      "Generate"
                    )}
                  </Button>
                </div>
              </div>
            )}

            <EditorContent editor={editor} />
          </div>
        </main>
      </div>

      {/* ─── AI Image Modal ──────────────────────────────────────────── */}
      <Dialog open={aiImageModalOpen} onOpenChange={setAiImageModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-x-2">
              <Sparkles className="size-5 text-purple-600" />
              Generate Image with AI
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <Textarea
              placeholder="e.g. A futuristic robot reading a document..."
              value={aiImagePrompt}
              onChange={(e) => setAiImagePrompt(e.target.value)}
              disabled={askAiImageMutation.isPending}
            />
            <div className="flex justify-end gap-x-2">
              <Button
                variant="ghost"
                onClick={() => setAiImageModalOpen(false)}
              >
                Cancel
              </Button>
              <Button
                onClick={handleAskAiImage}
                disabled={
                  askAiImageMutation.isPending || !aiImagePrompt.trim()
                }
                className="bg-purple-600 hover:bg-purple-700"
              >
                {askAiImageMutation.isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  "Generate & Insert"
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ─── Smart Footer ────────────────────────────────────────────── */}
      <footer className="h-10 border-t bg-white flex items-center px-4 justify-between text-xs text-muted-foreground print:hidden">
        <div className="flex items-center gap-x-4">
          <span className="flex items-center gap-x-1">
            <Hash className="size-3" />
            {wordCount} words
          </span>
          <span>{charCount} characters</span>
          <span className="flex items-center gap-x-1">
            <Clock className="size-3" />
            {readingTime} min read
          </span>
        </div>
        <div className="flex items-center gap-x-4">
          <span className="flex items-center gap-x-1">
            <FileText className="size-3" />
            {pageCount} {pageCount === 1 ? "page" : "pages"}
          </span>
          <span className="flex items-center gap-x-1">
            <Type className="size-3" />
            Shift+? for AI
          </span>
        </div>
      </footer>
    </div>
  );
};
