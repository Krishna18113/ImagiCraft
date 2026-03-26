"use client";

import { CiFileOn } from "react-icons/ci";
import { BsCloudCheck, BsCloudSlash } from "react-icons/bs";
import { useFilePicker } from "use-file-picker";
import { useMutationState } from "@tanstack/react-query";
import {
  ChevronDown,
  Download,
  Home,
  Loader,
  MonitorPlay,
  Play,
  Redo2,
  Share,
  Undo2,
  Crown
} from "lucide-react";
import { useRouter } from "next/navigation";

import { UserButton } from "@/features/auth/components/user-button";
import { ActiveTool, Editor } from "@/features/editor/types";

import { Hint } from "@/components/hint";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  DropdownMenu,
  DropdownMenuItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface NavbarProps {
  id: string;
  projectName: string;
  editor: Editor | undefined;
  activeTool: ActiveTool;
  onChangeActiveTool: (tool: ActiveTool) => void;
};

export const Navbar = ({
  id,
  projectName,
  editor,
  activeTool,
  onChangeActiveTool,
}: NavbarProps) => {
  const router = useRouter();

  const data = useMutationState({
    filters: {
      mutationKey: ["project", { id }],
      exact: true,
    },
    select: (mutation) => mutation.state.status,
  });

  const currentStatus = data[data.length - 1];

  const isError = currentStatus === "error";
  const isPending = currentStatus === "pending";

  const { openFilePicker } = useFilePicker({
    accept: ".json",
    onFilesSuccessfullySelected: ({ plainFiles }: any) => {
      if (plainFiles && plainFiles.length > 0) {
        const file = plainFiles[0];
        const reader = new FileReader();
        reader.readAsText(file, "UTF-8");
        reader.onload = () => {
          editor?.loadJson(reader.result as string);
        };
      }
    },
  });

  const handlePresent = () => {
    // This will trigger our full-screen modal later
    const event = new CustomEvent("open-present-modal");
    window.dispatchEvent(event);
  };

  return (
    <nav className="w-full flex items-center justify-between p-2 h-[60px] bg-gradient-to-r from-[#00c4cc] to-[#7d2ae8] text-white">
      <div className="flex items-center gap-x-2">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.push("/")}
          className="hover:bg-white/20 text-white"
        >
          <Home className="size-5" />
        </Button>
        <DropdownMenu modal={false}>
          <DropdownMenuTrigger asChild>
            <Button size="sm" variant="ghost" className="hover:bg-white/20 text-white font-semibold">
              File
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="min-w-60">
            <DropdownMenuItem
              onClick={() => openFilePicker()}
              className="flex items-center gap-x-2"
            >
              <CiFileOn className="size-8" />
              <div>
                <p>Open</p>
                <p className="text-xs text-muted-foreground">
                  Open a JSON file
                </p>
              </div>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <Button size="sm" variant="ghost" className="hover:bg-white/20 text-white font-semibold flex items-center">
          <Crown className="size-4 mr-2 text-yellow-400 fill-yellow-400" />
          Resize
        </Button>

        <Separator orientation="vertical" className="mx-2 h-6 bg-white/30" />

        <Hint label="Undo" side="bottom" sideOffset={10}>
          <Button
            disabled={!editor?.canUndo()}
            variant="ghost"
            size="icon"
            onClick={() => editor?.onUndo()}
            className="hover:bg-white/20 text-white"
          >
            <Undo2 className="size-4" />
          </Button>
        </Hint>
        <Hint label="Redo" side="bottom" sideOffset={10}>
          <Button
            disabled={!editor?.canRedo()}
            variant="ghost"
            size="icon"
            onClick={() => editor?.onRedo()}
            className="hover:bg-white/20 text-white"
          >
            <Redo2 className="size-4" />
          </Button>
        </Hint>

        <div className="ml-2 flex items-center">
          {isPending && <Loader className="size-4 animate-spin text-white/70" />}
          {!isPending && isError && <BsCloudSlash className="size-[20px] text-red-200" />}
          {!isPending && !isError && <BsCloudCheck className="size-[20px] text-white/70" />}
        </div>
      </div>

      <div className="flex-1 text-center font-medium opacity-90 truncate max-w-[300px]">
        {projectName || "Untitled design"}
      </div>

      <div className="flex items-center gap-x-3">
        <Button variant="secondary" className="bg-white/20 hover:bg-white/30 text-white border-0 hidden md:flex">
          <Crown className="size-4 mr-2 text-yellow-400 fill-yellow-400" />
          Start your trial for ₹0
        </Button>

        <div className="flex items-center">
          <Button
            variant="secondary"
            className="bg-white text-indigo-900 hover:bg-gray-100 rounded-r-none font-semibold border-r border-gray-200"
            onClick={handlePresent}
          >
            <MonitorPlay className="size-4 mr-2" />
            Present
          </Button>
          <Button
            variant="secondary"
            size="icon"
            className="bg-white text-indigo-900 hover:bg-gray-100 rounded-l-none"
          >
            <ChevronDown className="size-4" />
          </Button>
        </div>

        <DropdownMenu modal={false}>
          <DropdownMenuTrigger asChild>
            <Button size="sm" variant="secondary" className="bg-white text-gray-900 hover:bg-gray-100 font-semibold h-10 px-4">
              <Share className="size-4 mr-2" />
              Share
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-60">
            <DropdownMenuItem
              className="flex items-center gap-x-2"
              onClick={() => editor?.saveJson()}
            >
              <CiFileOn className="size-8" />
              <div>
                <p>JSON</p>
                <p className="text-xs text-muted-foreground">
                  Save for later editing
                </p>
              </div>
            </DropdownMenuItem>
            <DropdownMenuItem
              className="flex items-center gap-x-2"
              onClick={() => editor?.savePng()}
            >
              <CiFileOn className="size-8" />
              <div>
                <p>PNG</p>
                <p className="text-xs text-muted-foreground">
                  Best for sharing on the web
                </p>
              </div>
            </DropdownMenuItem>
            <DropdownMenuItem
              className="flex items-center gap-x-2"
              onClick={() => editor?.saveJpg()}
            >
              <CiFileOn className="size-8" />
              <div>
                <p>JPG</p>
                <p className="text-xs text-muted-foreground">
                  Best for printing
                </p>
              </div>
            </DropdownMenuItem>
            <DropdownMenuItem
              className="flex items-center gap-x-2"
              onClick={() => editor?.saveSvg()}
            >
              <CiFileOn className="size-8" />
              <div>
                <p>SVG</p>
                <p className="text-xs text-muted-foreground">
                  Best for editing in vector software
                </p>
              </div>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <UserButton />
      </div>
    </nav>
  );
};
