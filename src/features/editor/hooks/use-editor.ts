import { fabric } from "fabric";
import { useCallback, useState, useMemo, useRef } from "react";

import {
  Editor,
  FILL_COLOR,
  STROKE_WIDTH,
  STROKE_COLOR,
  BuildEditorProps,
  EditorHookProps,
  STROKE_DASH_ARRAY,
  FONT_FAMILY,
  JSON_KEYS,
} from "@/features/editor/types";
import { buildShapeActions } from "@/features/editor/hooks/builders/build-shape-actions";
import { buildTextActions } from "@/features/editor/hooks/builders/build-text-actions";
import { buildExportActions } from "@/features/editor/hooks/builders/build-export-actions";
import { useHistory } from "@/features/editor/hooks/use-history";
import {
  createFilter,
  isTextType,
} from "@/features/editor/utils";
import { useHotkeys } from "@/features/editor/hooks/use-hotkeys";
import { useClipboard } from "@/features/editor/hooks//use-clipboard";
import { useAutoResize } from "@/features/editor/hooks/use-auto-resize";
import { useCanvasEvents } from "@/features/editor/hooks/use-canvas-events";
import { useWindowEvents } from "@/features/editor/hooks/use-window-events";
import { useLoadState } from "@/features/editor/hooks/use-load-state";

const buildEditor = ({
  save,
  undo,
  redo,
  canRedo,
  canUndo,
  autoZoom,
  copy,
  paste,
  canvas,
  fillColor,
  fontFamily,
  setFontFamily,
  setFillColor,
  strokeColor,
  setStrokeColor,
  strokeWidth,
  setStrokeWidth,
  selectedObjects,
  strokeDashArray,
  setStrokeDashArray,
  pages,
  currentPageIndex,
  addPage,
  setPageIndex,
  deletePage,
}: BuildEditorProps): Editor => {
  const getWorkspace = () => {
    return canvas
      .getObjects()
      .find((object) => object.name === "clip");
  };

  const center = (object: fabric.Object) => {
    const workspace = getWorkspace();
    const centerPoint = workspace?.getCenterPoint();
    if (!centerPoint) return;
    // @ts-ignore
    canvas._centerObject(object, centerPoint);
  };

  const addToCanvas = (object: fabric.Object) => {
    center(object);
    canvas.add(object);
    canvas.setActiveObject(object);
  };

  // Compose from sub-builders
  const shapeActions = buildShapeActions({
    canvas, fillColor, strokeColor, strokeWidth, strokeDashArray, addToCanvas,
  });

  const textActions = buildTextActions({
    canvas, fillColor, fontFamily, setFontFamily, selectedObjects, addToCanvas,
  });

  const exportActions = buildExportActions({
    canvas, pages, currentPageIndex, autoZoom, getWorkspace,
  });

  return {
    // Export actions
    ...exportActions,
    // Shape actions
    ...shapeActions,
    // Text actions
    ...textActions,
    // History & navigation
    canUndo,
    canRedo,
    autoZoom,
    getZoomLevel: () => Math.round(canvas.getZoom() * 100),
    getWorkspace,
    zoomIn: () => {
      let zoomRatio = canvas.getZoom();
      zoomRatio += 0.05;
      const center = canvas.getCenter();
      canvas.zoomToPoint(
        new fabric.Point(center.left, center.top),
        zoomRatio > 1 ? 1 : zoomRatio
      );
    },
    zoomOut: () => {
      let zoomRatio = canvas.getZoom();
      zoomRatio -= 0.05;
      const center = canvas.getCenter();
      canvas.zoomToPoint(
        new fabric.Point(center.left, center.top),
        zoomRatio < 0.2 ? 0.2 : zoomRatio,
      );
    },
    changeSize: (value: { width: number; height: number }) => {
      const workspace = getWorkspace();
      workspace?.set(value);
      autoZoom();
      save();
    },
    changeBackground: (value: string) => {
      const workspace = getWorkspace();
      workspace?.set({ fill: value });
      canvas.renderAll();
      save();
    },
    enableDrawingMode: () => {
      canvas.discardActiveObject();
      canvas.renderAll();
      canvas.isDrawingMode = true;
      canvas.freeDrawingBrush.width = strokeWidth;
      canvas.freeDrawingBrush.color = strokeColor;
    },
    disableDrawingMode: () => {
      canvas.isDrawingMode = false;
    },
    onUndo: () => undo(),
    onRedo: () => redo(),
    onCopy: () => copy(),
    onPaste: () => paste(),
    changeImageFilter: (value: string) => {
      const objects = canvas.getActiveObjects();
      objects.forEach((object) => {
        if (object.type === "image") {
          const imageObject = object as fabric.Image;
          const effect = createFilter(value);
          imageObject.filters = effect ? [effect] : [];
          imageObject.applyFilters();
          canvas.renderAll();
        }
      });
    },
    addImage: (value: string) => {
      let finalUrl = value;
      if (value.includes("res.cloudinary.com") && value.match(/\.(pdf|ppt|pptx)$/i)) {
        // Cloudinary Aspose: keep original extension, append .jpg to trigger rasterization
        // e.g. /raw/upload/.../file.ppt  →  /image/upload/.../file.ppt.jpg
        finalUrl = value
          .replace("/raw/upload/", "/image/upload/")
          + ".jpg";
      }

      fabric.Image.fromURL(
        finalUrl,
        (image) => {
          const workspace = getWorkspace();
          image.scaleToWidth(workspace?.width || 0);
          image.scaleToHeight(workspace?.height || 0);
          addToCanvas(image);
        },
        { crossOrigin: "anonymous" },
      );
    },
    addVideo: (value: string) => {
      const videoEl = document.createElement("video");
      videoEl.src = value;
      videoEl.crossOrigin = "anonymous";
      videoEl.loop = true;
      videoEl.muted = true;
      videoEl.autoplay = true;
      videoEl.onloadeddata = () => {
        const workspace = getWorkspace();
        const fabricVideo = new fabric.Image(videoEl as any, {
          left: 0,
          top: 0,
        });
        const scaleX = (workspace?.width || videoEl.videoWidth) / videoEl.videoWidth;
        const scaleY = (workspace?.height || videoEl.videoHeight) / videoEl.videoHeight;
        const scale = Math.min(scaleX, scaleY);
        fabricVideo.scale(scale);
        addToCanvas(fabricVideo);
        videoEl.play();
        // Continuously re-render so the video animates on the canvas
        const render = () => {
          canvas.renderAll();
          fabric.util.requestAnimFrame(render);
        };
        fabric.util.requestAnimFrame(render);
      };
    },
    delete: () => {
      canvas.getActiveObjects().forEach((object) => canvas.remove(object));
      canvas.discardActiveObject();
      canvas.renderAll();
    },
    getActiveOpacity: () => {
      const selectedObject = selectedObjects[0];
      if (!selectedObject) return 1;
      return selectedObject.get("opacity") || 1;
    },
    changeOpacity: (value: number) => {
      canvas.getActiveObjects().forEach((object) => {
        object.set({ opacity: value });
      });
      canvas.renderAll();
    },
    bringForward: () => {
      canvas.getActiveObjects().forEach((object) => {
        canvas.bringForward(object);
      });
      canvas.renderAll();
      const workspace = getWorkspace();
      workspace?.sendToBack();
    },
    sendBackwards: () => {
      canvas.getActiveObjects().forEach((object) => {
        canvas.sendBackwards(object);
      });
      canvas.renderAll();
      const workspace = getWorkspace();
      workspace?.sendToBack();
    },
    changeFillColor: (value: string) => {
      setFillColor(value);
      canvas.getActiveObjects().forEach((object) => {
        object.set({ fill: value });
      });
      canvas.renderAll();
    },
    changeStrokeColor: (value: string) => {
      setStrokeColor(value);
      canvas.getActiveObjects().forEach((object) => {
        if (isTextType(object.type)) {
          object.set({ fill: value });
          return;
        }
        object.set({ stroke: value });
      });
      canvas.freeDrawingBrush.color = value;
      canvas.renderAll();
    },
    changeStrokeWidth: (value: number) => {
      setStrokeWidth(value);
      canvas.getActiveObjects().forEach((object) => {
        object.set({ strokeWidth: value });
      });
      canvas.freeDrawingBrush.width = value;
      canvas.renderAll();
    },
    changeStrokeDashArray: (value: number[]) => {
      setStrokeDashArray(value);
      canvas.getActiveObjects().forEach((object) => {
        object.set({ strokeDashArray: value });
      });
      canvas.renderAll();
    },
    canvas,
    getActiveFillColor: () => {
      const selectedObject = selectedObjects[0];
      if (!selectedObject) return fillColor;
      const value = selectedObject.get("fill") || fillColor;
      return value as string;
    },
    getActiveStrokeColor: () => {
      const selectedObject = selectedObjects[0];
      if (!selectedObject) return strokeColor;
      const value = selectedObject.get("stroke") || strokeColor;
      return value;
    },
    getActiveStrokeWidth: () => {
      const selectedObject = selectedObjects[0];
      if (!selectedObject) return strokeWidth;
      return selectedObject.get("strokeWidth") || strokeWidth;
    },
    getActiveStrokeDashArray: () => {
      const selectedObject = selectedObjects[0];
      if (!selectedObject) return strokeDashArray;
      return selectedObject.get("strokeDashArray") || strokeDashArray;
    },
    selectedObjects,
    pages,
    currentPageIndex,
    addPage,
    setPageIndex,
    deletePage,
  };
};

export const useEditor = ({
  defaultState,
  defaultHeight,
  defaultWidth,
  clearSelectionCallback,
  saveCallback,
}: EditorHookProps) => {
  const initialState = useRef(defaultState);
  const initialWidth = useRef(defaultWidth);
  const initialHeight = useRef(defaultHeight);

  const [canvas, setCanvas] = useState<fabric.Canvas | null>(null);
  const [container, setContainer] = useState<HTMLDivElement | null>(null);
  const [selectedObjects, setSelectedObjects] = useState<fabric.Object[]>([]);

  const [fontFamily, setFontFamily] = useState(FONT_FAMILY);
  const [fillColor, setFillColor] = useState(FILL_COLOR);
  const [strokeColor, setStrokeColor] = useState(STROKE_COLOR);
  const [strokeWidth, setStrokeWidth] = useState(STROKE_WIDTH);
  const [strokeDashArray, setStrokeDashArray] = useState<number[]>(STROKE_DASH_ARRAY);

  const [pages, setPages] = useState<string[]>([]);
  const [currentPageIndex, setCurrentPageIndex] = useState(0);

  const isPaging = useRef(false);

  const handleSave = useCallback(
    (values: { json: string; height: number; width: number }) => {
      if (isPaging.current) return;

      setPages((currentPages) => {
        const nextPages = [...currentPages];
        if (nextPages.length === 0) {
          nextPages.push(values.json);
        } else {
          nextPages[currentPageIndex] = values.json;
        }

        const payload = {
          isMultiPage: true,
          pages: nextPages,
        };

        saveCallback?.({
          json: JSON.stringify(payload),
          height: values.height,
          width: values.width,
        });

        return nextPages;
      });
    },
    [currentPageIndex, saveCallback]
  );

  useWindowEvents();

  const {
    save,
    canRedo,
    canUndo,
    undo,
    redo,
    canvasHistory,
    setHistoryIndex,
  } = useHistory({
    canvas,
    saveCallback: handleSave
  });

  const { copy, paste } = useClipboard({ canvas });

  const { autoZoom } = useAutoResize({
    canvas,
    container,
  });

  useCanvasEvents({
    save,
    canvas,
    setSelectedObjects,
    clearSelectionCallback,
  });

  useHotkeys({
    undo,
    redo,
    copy,
    paste,
    save,
    canvas,
  });

  useLoadState({
    canvas,
    autoZoom,
    initialState,
    canvasHistory,
    setHistoryIndex,
    setPages, // newly added parameter
  });

  const setPageIndex = useCallback((index: number) => {
    if (!canvas || index < 0 || index >= pages.length) return;

    isPaging.current = true;
    const currentState = canvas.toJSON(JSON_KEYS);

    // Safely clone from closure. Any pending saves for currentPageIndex 
    // are naturally overwritten by our fresh currentState extraction!
    const nextPages = [...pages];
    nextPages[currentPageIndex] = JSON.stringify(currentState);

    const newPageJson = JSON.parse(nextPages[index]);

    setPages(nextPages);

    canvas.loadFromJSON(newPageJson, () => {
      canvas.renderAll();
      setCurrentPageIndex(index);
      canvasHistory.current = [JSON.stringify(newPageJson)];
      setHistoryIndex(0);
      isPaging.current = false;
    });

    const payload = {
      isMultiPage: true,
      pages: nextPages,
    };

    const workspace = canvas.getObjects().find((obj) => obj.name === "clip");
    const height = workspace?.height || 0;
    const width = workspace?.width || 0;

    saveCallback?.({
      json: JSON.stringify(payload),
      height,
      width,
    });
  }, [canvas, pages, currentPageIndex, canvasHistory, setHistoryIndex, saveCallback]);

  const addPage = useCallback(() => {
    if (!canvas) return;
    isPaging.current = true;

    const currentState = canvas.toJSON(JSON_KEYS);
    const emptyState = { ...currentState };
    emptyState.objects = emptyState.objects.filter((obj: any) => obj.name === "clip");

    const nextPages = [...pages];
    nextPages[currentPageIndex] = JSON.stringify(currentState);
    nextPages.push(JSON.stringify(emptyState));

    const newIndex = nextPages.length - 1;

    setPages(nextPages);

    canvas.loadFromJSON(emptyState, () => {
      canvas.renderAll();
      setCurrentPageIndex(newIndex);
      canvasHistory.current = [JSON.stringify(emptyState)];
      setHistoryIndex(0);
      isPaging.current = false;
    });

    const payload = {
      isMultiPage: true,
      pages: nextPages,
    };

    const workspace = canvas.getObjects().find((obj) => obj.name === "clip");
    const height = workspace?.height || 0;
    const width = workspace?.width || 0;

    saveCallback?.({
      json: JSON.stringify(payload),
      height,
      width,
    });
  }, [canvas, pages, currentPageIndex, canvasHistory, setHistoryIndex, saveCallback]);

  const deletePage = useCallback(() => {
    if (!canvas || pages.length <= 1) return;

    isPaging.current = true;

    const nextPages = [...pages];
    nextPages.splice(currentPageIndex, 1);

    const newIndex = Math.max(0, currentPageIndex - 1);
    const newPageJson = JSON.parse(nextPages[newIndex]);

    setPages(nextPages);

    canvas.loadFromJSON(newPageJson, () => {
      canvas.renderAll();
      setCurrentPageIndex(newIndex);
      canvasHistory.current = [JSON.stringify(newPageJson)];
      setHistoryIndex(0);
      isPaging.current = false;
    });

    const payload = {
      isMultiPage: true,
      pages: nextPages,
    };

    const workspace = canvas.getObjects().find((obj) => obj.name === "clip");
    const height = workspace?.height || 0;
    const width = workspace?.width || 0;

    saveCallback?.({
      json: JSON.stringify(payload),
      height,
      width,
    });
  }, [canvas, pages, currentPageIndex, canvasHistory, setHistoryIndex, saveCallback]);

  const editor = useMemo(() => {
    if (canvas) {
      return buildEditor({
        save,
        undo,
        redo,
        canUndo,
        canRedo,
        autoZoom,
        copy,
        paste,
        canvas,
        fillColor,
        strokeWidth,
        strokeColor,
        setFillColor,
        setStrokeColor,
        setStrokeWidth,
        strokeDashArray,
        selectedObjects,
        setStrokeDashArray,
        fontFamily,
        setFontFamily,
        pages,
        currentPageIndex,
        addPage,
        setPageIndex,
        deletePage,
      });
    }

    return undefined;
  },
    [
      canRedo,
      canUndo,
      undo,
      redo,
      save,
      autoZoom,
      copy,
      paste,
      canvas,
      fillColor,
      strokeWidth,
      strokeColor,
      selectedObjects,
      strokeDashArray,
      fontFamily,
      pages,
      currentPageIndex,
      addPage,
      setPageIndex,
      deletePage,
    ]);

  const init = useCallback(
    ({
      initialCanvas,
      initialContainer,
    }: {
      initialCanvas: fabric.Canvas;
      initialContainer: HTMLDivElement;
    }) => {
      fabric.Object.prototype.set({
        cornerColor: "#FFF",
        cornerStyle: "circle",
        borderColor: "#3b82f6",
        borderScaleFactor: 1.5,
        transparentCorners: false,
        borderOpacityWhenMoving: 1,
        cornerStrokeColor: "#3b82f6",
      });

      const initialWorkspace = new fabric.Rect({
        width: initialWidth.current,
        height: initialHeight.current,
        name: "clip",
        fill: "white",
        selectable: false,
        hasControls: false,
        shadow: new fabric.Shadow({
          color: "rgba(0,0,0,0.8)",
          blur: 5,
        }),
      });

      initialCanvas.setWidth(initialContainer.offsetWidth);
      initialCanvas.setHeight(initialContainer.offsetHeight);

      initialCanvas.add(initialWorkspace);
      initialCanvas.centerObject(initialWorkspace);
      initialCanvas.clipPath = initialWorkspace;

      setCanvas(initialCanvas);
      setContainer(initialContainer);

      const currentState = JSON.stringify(
        initialCanvas.toJSON(JSON_KEYS)
      );
      canvasHistory.current = [currentState];
      setHistoryIndex(0);
    },
    [
      canvasHistory, // No need, this is from useRef
      setHistoryIndex, // No need, this is from useState
    ]
  );

  return { init, editor };
};
