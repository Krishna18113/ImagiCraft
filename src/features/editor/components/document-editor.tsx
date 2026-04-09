"use client";

import { useCallback, useState, useRef } from "react";
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
import Image from "@tiptap/extension-image";

import { ResponseType } from "@/features/projects/api/use-get-project";
import { useUpdateProject } from "@/features/projects/api/use-update-project";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Loader2, Sparkles, Wand2, Type, Bold, Italic, Underline as UnderlineIcon, Strikethrough, AlignLeft, AlignCenter, AlignRight, AlignJustify, List, ListOrdered, CheckSquare, Undo, Redo, Image as ImageIcon, Upload, Download, FileText, FileCode, Check, Scissors } from "lucide-react";
import { toast } from "sonner";
import { uploadToCloudinary } from "@/lib/cloudinary";
import { useMutation } from "@tanstack/react-query";

interface DocumentEditorProps {
  initialData: ResponseType["data"];
}

const MinimalNavbar = ({ projectName, editor }: { projectName: string, editor: any }) => {
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
          <h1 className="text-sm font-semibold text-slate-800">{projectName}</h1>
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

        <Button size="sm" onClick={onShare}>Share</Button>
      </div>
    </nav>
  );
};

export const DocumentEditor = ({ initialData }: DocumentEditorProps) => {
  const { mutate: updateProject } = useUpdateProject(initialData.id);

  // Debounced auto-save (saves the raw HTML to `json` string for simplicity)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const debouncedSave = useCallback(
    debounce((html: string) => {
      // We store the tiptap HTML inside the `json` column of our database
      updateProject({
        json: html,
        width: initialData.width,
        height: initialData.height,
      });
    }, 1500),
    [updateProject]
  );

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit,
      Image.configure({
        allowBase64: true,
      }),
      Underline,
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Placeholder.configure({
        placeholder: "Press '/' for commands, or Start writing...",
      }),
      CharacterCount,
    ],
    content: initialData.json || "",
    editorProps: {
      attributes: {
        class: "prose prose-slate prose-lg max-w-none focus:outline-none min-h-[800px] pb-32",
      },
      handleKeyDown: (view, event) => {
        // Implement "Shift + ?" shortcut
        if (event.shiftKey && event.key === "?") {
          event.preventDefault();
          setAiInputOpen(true);
          return true;
        }
        return false;
      }
    },
    onUpdate: ({ editor }) => {
      debouncedSave(editor.getHTML());
    },
  });

  const [aiInputOpen, setAiInputOpen] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);

  // Use the existing rewrite-text endpoint which returns simple strings
  const askAiMutation = useMutation({
    mutationFn: async (instruction: string) => {
      const res = await fetch("/api/ai/rewrite-text", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          text: "Write a high quality document paragraph/section from scratch based on the instruction.", 
          instruction: instruction 
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
    onSettled: () => setIsGenerating(false)
  });

  const handleAskAi = () => {
    if (!aiPrompt.trim()) return;
    setIsGenerating(true);
    askAiMutation.mutate(aiPrompt);
  };

  const [isRewriting, setIsRewriting] = useState(false);
  
  const handleRewrite = async (instruction: string) => {
    if (!editor) return;
    const selection = editor.state.selection;
    const text = editor.state.doc.textBetween(selection.from, selection.to, " ");
    
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

      {/* Persistent Docs Toolbar */}
      {editor && (
        <div className="sticky top-0 z-20 w-full h-12 bg-white border-b shadow-sm flex items-center px-4 overflow-x-auto gap-x-1 shrink-0 print:hidden">
          
          <Button variant="ghost" size="icon" className="h-8 w-8 rounded hover:bg-slate-100 text-slate-700" onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()}><Undo className="size-4" /></Button>
          <Button variant="ghost" size="icon" className="h-8 w-8 rounded hover:bg-slate-100 text-slate-700" onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()}><Redo className="size-4" /></Button>
          
          <div className="w-[1px] h-5 bg-slate-300 mx-1" />

          {/* Typography */}
          <select 
            className="h-8 bg-transparent hover:bg-slate-100 rounded px-2 text-sm text-slate-700 border-none outline-none cursor-pointer"
            onChange={(e) => {
              if (e.target.value === "p") editor.chain().focus().setParagraph().run();
              else editor.chain().focus().toggleHeading({ level: parseInt(e.target.value) as any }).run();
            }}
            value={editor.isActive('heading', { level: 1 }) ? '1' : editor.isActive('heading', { level: 2 }) ? '2' : editor.isActive('heading', { level: 3 }) ? '3' : 'p'}
          >
            <option value="p">Normal text</option>
            <option value="1">Heading 1</option>
            <option value="2">Heading 2</option>
            <option value="3">Heading 3</option>
          </select>

          <div className="w-[1px] h-5 bg-slate-300 mx-1" />

          {/* Marks */}
          <Button variant="ghost" size="icon" className={`h-8 w-8 rounded hover:bg-slate-100 ${editor.isActive('bold') ? 'bg-indigo-100 text-indigo-700' : 'text-slate-700'}`} onClick={() => editor.chain().focus().toggleBold().run()}><Bold className="size-4" /></Button>
          <Button variant="ghost" size="icon" className={`h-8 w-8 rounded hover:bg-slate-100 ${editor.isActive('italic') ? 'bg-indigo-100 text-indigo-700' : 'text-slate-700'}`} onClick={() => editor.chain().focus().toggleItalic().run()}><Italic className="size-4" /></Button>
          <Button variant="ghost" size="icon" className={`h-8 w-8 rounded hover:bg-slate-100 ${editor.isActive('underline') ? 'bg-indigo-100 text-indigo-700' : 'text-slate-700'}`} onClick={() => editor.chain().focus().toggleUnderline().run()}><UnderlineIcon className="size-4" /></Button>
          <Button variant="ghost" size="icon" className={`h-8 w-8 rounded hover:bg-slate-100 ${editor.isActive('strike') ? 'bg-indigo-100 text-indigo-700' : 'text-slate-700'}`} onClick={() => editor.chain().focus().toggleStrike().run()}><Strikethrough className="size-4" /></Button>
          
          <div className="w-[1px] h-5 bg-slate-300 mx-1" />

          {/* Alignment */}
          <Button variant="ghost" size="icon" className={`h-8 w-8 rounded hover:bg-slate-100 ${editor.isActive({ textAlign: 'left' }) ? 'bg-indigo-100 text-indigo-700' : 'text-slate-700'}`} onClick={() => editor.chain().focus().setTextAlign('left').run()}><AlignLeft className="size-4" /></Button>
          <Button variant="ghost" size="icon" className={`h-8 w-8 rounded hover:bg-slate-100 ${editor.isActive({ textAlign: 'center' }) ? 'bg-indigo-100 text-indigo-700' : 'text-slate-700'}`} onClick={() => editor.chain().focus().setTextAlign('center').run()}><AlignCenter className="size-4" /></Button>
          <Button variant="ghost" size="icon" className={`h-8 w-8 rounded hover:bg-slate-100 ${editor.isActive({ textAlign: 'right' }) ? 'bg-indigo-100 text-indigo-700' : 'text-slate-700'}`} onClick={() => editor.chain().focus().setTextAlign('right').run()}><AlignRight className="size-4" /></Button>
          <Button variant="ghost" size="icon" className={`h-8 w-8 rounded hover:bg-slate-100 ${editor.isActive({ textAlign: 'justify' }) ? 'bg-indigo-100 text-indigo-700' : 'text-slate-700'}`} onClick={() => editor.chain().focus().setTextAlign('justify').run()}><AlignJustify className="size-4" /></Button>

          <div className="w-[1px] h-5 bg-slate-300 mx-1" />

          {/* Lists */}
          <Button variant="ghost" size="icon" className={`h-8 w-8 rounded hover:bg-slate-100 ${editor.isActive('bulletList') ? 'bg-indigo-100 text-indigo-700' : 'text-slate-700'}`} onClick={() => editor.chain().focus().toggleBulletList().run()}><List className="size-4" /></Button>
          <Button variant="ghost" size="icon" className={`h-8 w-8 rounded hover:bg-slate-100 ${editor.isActive('orderedList') ? 'bg-indigo-100 text-indigo-700' : 'text-slate-700'}`} onClick={() => editor.chain().focus().toggleOrderedList().run()}><ListOrdered className="size-4" /></Button>
          <Button variant="ghost" size="icon" className={`h-8 w-8 rounded hover:bg-slate-100 ${editor.isActive('taskList') ? 'bg-indigo-100 text-indigo-700' : 'text-slate-700'}`} onClick={() => editor.chain().focus().toggleTaskList().run()}><CheckSquare className="size-4" /></Button>

          <div className="w-[1px] h-5 bg-slate-300 mx-1" />

          {/* Page Break */}
          <Button variant="ghost" size="icon" className="h-8 w-8 rounded hover:bg-slate-100 text-slate-700" onClick={() => editor.chain().focus().setHorizontalRule().run()} title="Insert Page Break">
            <Scissors className="size-4" />
          </Button>

          <div className="w-[1px] h-5 bg-slate-300 mx-1" />

          {/* Special Insertion */}
          <Button variant="ghost" size="icon" className="h-8 w-8 rounded hover:bg-slate-100 text-slate-700" disabled={isUploading} onClick={() => fileInputRef.current?.click()} title="Upload Image">
            {isUploading ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8 rounded hover:bg-purple-50 text-purple-600" onClick={() => setAiImageModalOpen(true)} title="AI Generate Image">
            <ImageIcon className="size-4" />
          </Button>

          <div className="flex-1" />

          {/* Trigger AI manually */}
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

      {/* Main Document Area */}
      <main className="flex-1 overflow-auto flex justify-center py-10 bg-[#F8F9FA] pb-32 print:p-0 print:m-0 print:overflow-visible">
        {/* We gently focus the editor only if they clicked the white page wrapper itself, outside the text nodes */}
        <div 
          className="w-[820px] bg-white border border-gray-300 shadow-sm pt-20 px-24 pb-32 min-h-[1100px] cursor-text print:w-full print:border-none print:shadow-none print:p-0 print:m-0"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              editor?.commands.focus();
            }
          }}
        >
          {editor && (
            <>
              {/* Bubble Menu applies to selected text */}
              <BubbleMenu editor={editor} className="flex overflow-hidden rounded-md border bg-white shadow-xl">
                <Button size="sm" variant="ghost" onClick={() => editor.chain().focus().toggleBold().run()} className={editor.isActive('bold') ? 'bg-slate-100' : ''}>Bold</Button>
                <Button size="sm" variant="ghost" onClick={() => editor.chain().focus().toggleItalic().run()} className={editor.isActive('italic') ? 'bg-slate-100' : ''}>Italic</Button>
                <div className="w-[1px] bg-slate-200 mx-1" />
                <Button size="sm" variant="ghost" className="text-purple-600 gap-x-1" disabled={isRewriting} onClick={() => handleRewrite("Make it sound more professional")}>
                  {isRewriting ? <Loader2 className="size-3 animate-spin"/> : <Sparkles className="size-3" />}
                  Professional
                </Button>
                <Button size="sm" variant="ghost" className="text-purple-600 gap-x-1" disabled={isRewriting} onClick={() => handleRewrite("Make it shorter and concise")}>
                  {isRewriting ? <Loader2 className="size-3 animate-spin"/> : <Wand2 className="size-3" />}
                  Shorter
                </Button>
              </BubbleMenu>

              {/* Floating Menu for empty paragraphs (Slash Command Equivalent) */}
              <FloatingMenu editor={editor} className="flex overflow-hidden rounded-md border bg-white shadow-xl">
                <Button size="sm" variant="ghost" onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}>H1</Button>
                <Button size="sm" variant="ghost" onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>H2</Button>
                <Button size="sm" variant="ghost" onClick={() => editor.chain().focus().toggleBulletList().run()}>Bulleted</Button>
                <div className="w-[1px] bg-slate-200 mx-1" />
                <Button size="sm" variant="ghost" onClick={() => setAiImageModalOpen(true)} className="text-purple-600 gap-x-2 font-medium">
                  <ImageIcon className="size-4" />
                  Img
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setAiInputOpen(true)} className="text-purple-600 gap-x-2 font-medium bg-purple-50">
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
                <Button variant="ghost" onClick={() => setAiInputOpen(false)}>Cancel</Button>
                <Button onClick={handleAskAi} disabled={isGenerating || !aiPrompt.trim()} className="bg-purple-600 hover:bg-purple-700">
                  {isGenerating ? <Loader2 className="size-4 animate-spin" /> : "Generate"}
                </Button>
              </div>
            </div>
          )}

          <EditorContent editor={editor} />
        </div>
      </main>

      <Dialog open={aiImageModalOpen} onOpenChange={setAiImageModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-x-2">
              <Sparkles className="size-5 text-purple-600" />
              Generate Image natively
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
              <Button variant="ghost" onClick={() => setAiImageModalOpen(false)}>Cancel</Button>
              <Button onClick={handleAskAiImage} disabled={askAiImageMutation.isPending || !aiImagePrompt.trim()} className="bg-purple-600 hover:bg-purple-700">
                {askAiImageMutation.isPending ? <Loader2 className="size-4 animate-spin" /> : "Generate & Insert"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Footer / Status */}
      <footer className="h-10 border-t bg-white flex items-center px-4 justify-between text-xs text-muted-foreground print:hidden">
        <div>
          {editor?.storage.characterCount.words()} words
        </div>
        <div className="flex items-center gap-x-2">
           <Type className="size-3" />
           Press &apos;?&apos; with Shift to open AI Assistant
        </div>
      </footer>
    </div>
  );
};
