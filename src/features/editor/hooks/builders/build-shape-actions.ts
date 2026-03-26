import { fabric } from "fabric";

import {
  CIRCLE_OPTIONS,
  RECTANGLE_OPTIONS,
  TRIANGLE_OPTIONS,
  DIAMOND_OPTIONS,
} from "@/features/editor/types";

interface BuildShapeActionsProps {
  canvas: fabric.Canvas;
  fillColor: string;
  strokeColor: string;
  strokeWidth: number;
  strokeDashArray: number[];
  addToCanvas: (object: fabric.Object) => void;
}

export const buildShapeActions = ({
  canvas,
  fillColor,
  strokeColor,
  strokeWidth,
  strokeDashArray,
  addToCanvas,
}: BuildShapeActionsProps) => ({
  addCircle: () => {
    const object = new fabric.Circle({
      ...CIRCLE_OPTIONS,
      fill: fillColor,
      stroke: strokeColor,
      strokeWidth: strokeWidth,
      strokeDashArray: strokeDashArray,
    });
    addToCanvas(object);
  },
  addSoftRectangle: () => {
    const object = new fabric.Rect({
      ...RECTANGLE_OPTIONS,
      rx: 50,
      ry: 50,
      fill: fillColor,
      stroke: strokeColor,
      strokeWidth: strokeWidth,
      strokeDashArray: strokeDashArray,
    });
    addToCanvas(object);
  },
  addRectangle: () => {
    const object = new fabric.Rect({
      ...RECTANGLE_OPTIONS,
      fill: fillColor,
      stroke: strokeColor,
      strokeWidth: strokeWidth,
      strokeDashArray: strokeDashArray,
    });
    addToCanvas(object);
  },
  addTriangle: () => {
    const object = new fabric.Triangle({
      ...TRIANGLE_OPTIONS,
      fill: fillColor,
      stroke: strokeColor,
      strokeWidth: strokeWidth,
      strokeDashArray: strokeDashArray,
    });
    addToCanvas(object);
  },
  addInverseTriangle: () => {
    const HEIGHT = TRIANGLE_OPTIONS.height;
    const WIDTH = TRIANGLE_OPTIONS.width;

    const object = new fabric.Polygon(
      [
        { x: 0, y: 0 },
        { x: WIDTH, y: 0 },
        { x: WIDTH / 2, y: HEIGHT },
      ],
      {
        ...TRIANGLE_OPTIONS,
        fill: fillColor,
        stroke: strokeColor,
        strokeWidth: strokeWidth,
        strokeDashArray: strokeDashArray,
      }
    );
    addToCanvas(object);
  },
  addDiamond: () => {
    const HEIGHT = DIAMOND_OPTIONS.height;
    const WIDTH = DIAMOND_OPTIONS.width;

    const object = new fabric.Polygon(
      [
        { x: WIDTH / 2, y: 0 },
        { x: WIDTH, y: HEIGHT / 2 },
        { x: WIDTH / 2, y: HEIGHT },
        { x: 0, y: HEIGHT / 2 },
      ],
      {
        ...DIAMOND_OPTIONS,
        fill: fillColor,
        stroke: strokeColor,
        strokeWidth: strokeWidth,
        strokeDashArray: strokeDashArray,
      }
    );
    addToCanvas(object);
  },
});
