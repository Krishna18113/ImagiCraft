import { fabric } from "fabric";

import { isTextType } from "@/features/editor/utils";
import {
  TEXT_OPTIONS,
  FONT_SIZE,
  FONT_WEIGHT,
} from "@/features/editor/types";

interface BuildTextActionsProps {
  canvas: fabric.Canvas;
  fillColor: string;
  fontFamily: string;
  setFontFamily: (value: string) => void;
  selectedObjects: fabric.Object[];
  addToCanvas: (object: fabric.Object) => void;
}

export const buildTextActions = ({
  canvas,
  fillColor,
  fontFamily,
  setFontFamily,
  selectedObjects,
  addToCanvas,
}: BuildTextActionsProps) => ({
  addText: (value: string, options?: fabric.ITextboxOptions) => {
    const object = new fabric.Textbox(value, {
      ...TEXT_OPTIONS,
      fill: fillColor,
      ...options,
    });
    addToCanvas(object);
  },
  changeFontSize: (value: number) => {
    canvas.getActiveObjects().forEach((object) => {
      if (isTextType(object.type)) {
        // @ts-ignore
        object.set({ fontSize: value });
      }
    });
    canvas.renderAll();
  },
  getActiveFontSize: () => {
    const selectedObject = selectedObjects[0];
    if (!selectedObject) return FONT_SIZE;
    // @ts-ignore
    return selectedObject.get("fontSize") || FONT_SIZE;
  },
  changeTextAlign: (value: string) => {
    canvas.getActiveObjects().forEach((object) => {
      if (isTextType(object.type)) {
        // @ts-ignore
        object.set({ textAlign: value });
      }
    });
    canvas.renderAll();
  },
  getActiveTextAlign: () => {
    const selectedObject = selectedObjects[0];
    if (!selectedObject) return "left";
    // @ts-ignore
    return selectedObject.get("textAlign") || "left";
  },
  changeFontUnderline: (value: boolean) => {
    canvas.getActiveObjects().forEach((object) => {
      if (isTextType(object.type)) {
        // @ts-ignore
        object.set({ underline: value });
      }
    });
    canvas.renderAll();
  },
  getActiveFontUnderline: () => {
    const selectedObject = selectedObjects[0];
    if (!selectedObject) return false;
    // @ts-ignore
    return selectedObject.get("underline") || false;
  },
  changeFontLinethrough: (value: boolean) => {
    canvas.getActiveObjects().forEach((object) => {
      if (isTextType(object.type)) {
        // @ts-ignore
        object.set({ linethrough: value });
      }
    });
    canvas.renderAll();
  },
  getActiveFontLinethrough: () => {
    const selectedObject = selectedObjects[0];
    if (!selectedObject) return false;
    // @ts-ignore
    return selectedObject.get("linethrough") || false;
  },
  changeFontStyle: (value: string) => {
    canvas.getActiveObjects().forEach((object) => {
      if (isTextType(object.type)) {
        // @ts-ignore
        object.set({ fontStyle: value });
      }
    });
    canvas.renderAll();
  },
  getActiveFontStyle: () => {
    const selectedObject = selectedObjects[0];
    if (!selectedObject) return "normal";
    // @ts-ignore
    return selectedObject.get("fontStyle") || "normal";
  },
  changeFontWeight: (value: number) => {
    canvas.getActiveObjects().forEach((object) => {
      if (isTextType(object.type)) {
        // @ts-ignore
        object.set({ fontWeight: value });
      }
    });
    canvas.renderAll();
  },
  getActiveFontWeight: () => {
    const selectedObject = selectedObjects[0];
    if (!selectedObject) return FONT_WEIGHT;
    // @ts-ignore
    return selectedObject.get("fontWeight") || FONT_WEIGHT;
  },
  changeFontFamily: (value: string) => {
    setFontFamily(value);
    canvas.getActiveObjects().forEach((object) => {
      if (isTextType(object.type)) {
        // @ts-ignore
        object.set({ fontFamily: value });
      }
    });
    canvas.renderAll();
  },
  getActiveFontFamily: () => {
    const selectedObject = selectedObjects[0];
    if (!selectedObject) return fontFamily;
    // @ts-ignore
    return selectedObject.get("fontFamily") || fontFamily;
  },
});
