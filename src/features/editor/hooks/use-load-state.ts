import { fabric } from "fabric";
import { useEffect, useRef } from "react";

import { JSON_KEYS } from "@/features/editor/types";

interface UseLoadStateProps {
  autoZoom: () => void;
  canvas: fabric.Canvas | null;
  initialState: React.MutableRefObject<string | undefined>;
  canvasHistory: React.MutableRefObject<string[]>;
  setHistoryIndex: React.Dispatch<React.SetStateAction<number>>;
  setPages: React.Dispatch<React.SetStateAction<string[]>>;
};

export const useLoadState = ({
  canvas,
  autoZoom,
  initialState,
  canvasHistory,
  setHistoryIndex,
  setPages,
}: UseLoadStateProps) => {
  const initialized = useRef(false);

  useEffect(() => {
    if (!initialized.current && initialState?.current && canvas) {
      let parsed;
      try {
        parsed = JSON.parse(initialState.current);
      } catch (e) {
        // failed
      }

      let dataToLoad = parsed;
      if (parsed && parsed.isMultiPage && parsed.pages && parsed.pages.length > 0) {
        dataToLoad = JSON.parse(parsed.pages[0]);
        setPages(parsed.pages);
      } else if (initialState.current) {
        setPages([initialState.current]);
      }

      const loadData = dataToLoad || {};

      canvas.loadFromJSON(loadData, () => {
        const currentState = JSON.stringify(
          canvas.toJSON(JSON_KEYS),
        );

        canvasHistory.current = [currentState];
        setHistoryIndex(0);
        autoZoom();
      });
      initialized.current = true;
    }
  },
    [
      canvas,
      autoZoom,
      setPages, // dispatch function
    ]);
};
