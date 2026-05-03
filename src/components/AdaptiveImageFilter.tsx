import React, { useEffect, useMemo, useRef, useState } from "react";
import { useAdaptive } from "../AdaptiveProvider";
import type { AdaptiveComponentProps, AuraMlEnvelopeV2, AuraProfileV2 } from "../types";

type AnyStyle = Record<string, any>;

type ColorBlindnessMode = "none" | "monochromacy" | "red-green" | "blue-yellow";

type OpenCvLike = {
  Mat?: new (...args: any[]) => any;
  matFromArray?: (...args: any[]) => any;
  imread?: (source: HTMLImageElement | HTMLCanvasElement) => any;
  imshow?: (canvas: HTMLCanvasElement, mat: any) => void;
  transform?: (src: any, dst: any, matrix: any) => void;
  CV_32F?: number;
};

export interface AdaptiveImageFilterProps
  extends Omit<React.ImgHTMLAttributes<HTMLImageElement>, "children" | "style">,
    AdaptiveComponentProps {
  src: string;
  alt?: string;
  width?: number | string;
  height?: number | string;
  canvasStyle?: React.CSSProperties;
  imageStyle?: React.CSSProperties;
  /**
   * Override the ML profile value. If omitted, the component reads
   * profile.color_blindness from AdaptiveProvider.
   */
  colorBlindness?: number;
  /** Optional full ML output envelope/profile for standalone usage. */
  mlOutput?: AuraMlEnvelopeV2 | AuraProfileV2 | { color_blindness?: number };
  /** OpenCV.js instance. Defaults to window.cv when present. */
  cv?: OpenCvLike;
  /**
   * Render the original image if the browser blocks canvas reads, usually due
   * to missing CORS headers on a remote image.
   */
  fallbackToOriginal?: boolean;
  onFilterApplied?: (details: { mode: ColorBlindnessMode; colorBlindness: number }) => void;
  onFilterError?: (error: Error) => void;
}

declare global {
  interface Window {
    cv?: OpenCvLike;
  }
}

function mergeStyle(target: AnyStyle, incoming: any) {
  if (!incoming) return;
  const keys = Object.keys(incoming);
  for (let i = 0; i < keys.length; i++) {
    const k = keys[i];
    const v = incoming[k];
    if (v !== undefined) target[k] = v;
  }
}

function clampChannel(value: number): number {
  if (value < 0) return 0;
  if (value > 255) return 255;
  return Math.round(value);
}

function clampSignal(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return 0;
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

function getProfileFromMlOutput(
  mlOutput?: AuraMlEnvelopeV2 | AuraProfileV2 | { color_blindness?: number }
): { color_blindness?: number } | null {
  if (!mlOutput || typeof mlOutput !== "object") return null;
  const candidate = mlOutput as any;
  if (typeof candidate.color_blindness === "number") return candidate;
  if (candidate.profile?.profile) return candidate.profile.profile;
  if (candidate.profile && typeof candidate.profile.color_blindness === "number") {
    return candidate.profile;
  }
  return null;
}

function resolveColorBlindnessMode(value: number): ColorBlindnessMode {
  if (value === 1) return "monochromacy";
  if (value > 0.5) return "red-green";
  if (value === 0.25) return "blue-yellow";
  return "none";
}

function getTransformMatrix(mode: ColorBlindnessMode): number[] | null {
  if (mode === "monochromacy") {
    return [
      0.299, 0.587, 0.114, 0,
      0.299, 0.587, 0.114, 0,
      0.299, 0.587, 0.114, 0,
      0, 0, 0, 1,
    ];
  }

  if (mode === "red-green") {
    return [
      0.567, 0.433, 0, 0,
      0.558, 0.442, 0, 0,
      0, 0.242, 0.758, 0,
      0, 0, 0, 1,
    ];
  }

  if (mode === "blue-yellow") {
    return [
      0.95, 0.05, 0, 0,
      0, 0.433, 0.567, 0,
      0, 0.475, 0.525, 0,
      0, 0, 0, 1,
    ];
  }

  return null;
}

function applyPixelFilter(imageData: ImageData, mode: ColorBlindnessMode): ImageData {
  const data = imageData.data;
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];

    if (mode === "monochromacy") {
      const y = clampChannel(0.299 * r + 0.587 * g + 0.114 * b);
      data[i] = y;
      data[i + 1] = y;
      data[i + 2] = y;
      continue;
    }

    if (mode === "red-green") {
      data[i] = clampChannel(0.567 * r + 0.433 * g);
      data[i + 1] = clampChannel(0.558 * r + 0.442 * g);
      data[i + 2] = clampChannel(0.242 * g + 0.758 * b);
      continue;
    }

    if (mode === "blue-yellow") {
      data[i] = clampChannel(0.95 * r + 0.05 * g);
      data[i + 1] = clampChannel(0.433 * g + 0.567 * b);
      data[i + 2] = clampChannel(0.475 * g + 0.525 * b);
    }
  }
  return imageData;
}

function tryApplyOpenCvFilter(
  cv: OpenCvLike | undefined,
  source: HTMLImageElement,
  canvas: HTMLCanvasElement,
  mode: ColorBlindnessMode
): boolean {
  const matrix = getTransformMatrix(mode);
  if (!cv || !matrix || !cv.imread || !cv.imshow || !cv.transform || !cv.matFromArray || !cv.Mat) {
    return false;
  }

  try {
    const src = cv.imread(source);
    const dst = new cv.Mat();
    const transform = cv.matFromArray(4, 4, cv.CV_32F ?? 5, matrix);

    try {
    cv.transform(src, dst, transform);
    cv.imshow(canvas, dst);
    return true;
    } finally {
      if (typeof src?.delete === "function") src.delete();
      if (typeof dst?.delete === "function") dst.delete();
      if (typeof transform?.delete === "function") transform.delete();
    }
  } catch {
    return false;
  }
}

export function AdaptiveImageFilter(props: AdaptiveImageFilterProps) {
  const {
    src,
    alt = "",
    width,
    height,
    className,
    style,
    canvasStyle,
    imageStyle,
    colorBlindness,
    mlOutput,
    cv,
    crossOrigin = "anonymous",
    fallbackToOriginal = true,
    onFilterApplied,
    onFilterError,
    ...imgProps
  } = props;

  const { profile, tokens } = useAdaptive();
  const imageRef = useRef<HTMLImageElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [renderOriginal, setRenderOriginal] = useState(false);

  const resolvedColorBlindness = useMemo(() => {
    const outputProfile = getProfileFromMlOutput(mlOutput);
    return clampSignal(
      colorBlindness ??
        outputProfile?.color_blindness ??
        profile?.color_blindness ??
        0
    );
  }, [colorBlindness, mlOutput, profile]);

  const mode = resolveColorBlindnessMode(resolvedColorBlindness);

  useEffect(() => {
    const image = imageRef.current;
    const canvas = canvasRef.current;
    if (!image || !canvas) return;

    let cancelled = false;

    const draw = () => {
      if (cancelled) return;

      const naturalWidth = image.naturalWidth || image.width;
      const naturalHeight = image.naturalHeight || image.height;
      if (!naturalWidth || !naturalHeight) return;

      canvas.width = naturalWidth;
      canvas.height = naturalHeight;

      try {
        const context = canvas.getContext("2d");
        if (!context) throw new Error("2D canvas context is not available.");

        context.clearRect(0, 0, naturalWidth, naturalHeight);
        context.drawImage(image, 0, 0, naturalWidth, naturalHeight);

        if (mode !== "none") {
          const openCv = cv ?? (typeof window !== "undefined" ? window.cv : undefined);
          const usedOpenCv = tryApplyOpenCvFilter(openCv, image, canvas, mode);

          if (!usedOpenCv) {
            const imageData = context.getImageData(0, 0, naturalWidth, naturalHeight);
            context.putImageData(applyPixelFilter(imageData, mode), 0, 0);
          }
        }

        setRenderOriginal(false);
        if (onFilterApplied) {
          onFilterApplied({ mode, colorBlindness: resolvedColorBlindness });
        }
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        if (onFilterError) onFilterError(error);
        setRenderOriginal(fallbackToOriginal);
      }
    };

    if (image.complete) {
      draw();
    } else {
      image.addEventListener("load", draw, { once: true });
    }

    return () => {
      cancelled = true;
      image.removeEventListener("load", draw);
    };
  }, [src, mode, cv, fallbackToOriginal, onFilterApplied, onFilterError, resolvedColorBlindness]);

  const { colors } = tokens;

  const wrapperStyle: AnyStyle = {
    display: "inline-block",
    maxWidth: "100%",
    lineHeight: 0,
    borderColor: colors.border,
  };
  mergeStyle(wrapperStyle, style);

  const resolvedCanvasStyle: AnyStyle = {
    display: renderOriginal ? "none" : "block",
    width: width ?? "100%",
    height: height ?? "auto",
    maxWidth: "100%",
    objectFit: "contain",
  };
  mergeStyle(resolvedCanvasStyle, canvasStyle);

  const resolvedImageStyle: AnyStyle = {
    display: renderOriginal ? "block" : "none",
    width: width ?? "100%",
    height: height ?? "auto",
    maxWidth: "100%",
    objectFit: "contain",
  };
  mergeStyle(resolvedImageStyle, imageStyle);

  return React.createElement(
    "span",
    {
      className: "adaptive-image-filter " + (className || ""),
      style: wrapperStyle,
      "data-aura-color-blindness": resolvedColorBlindness,
      "data-aura-image-filter": mode,
    } as any,
    React.createElement("img", {
      ...imgProps,
      ref: imageRef,
      src,
      alt,
      crossOrigin,
      style: resolvedImageStyle,
      "aria-hidden": renderOriginal ? undefined : true,
    } as any),
    React.createElement("canvas", {
      ref: canvasRef,
      role: "img",
      "aria-label": alt,
      style: resolvedCanvasStyle,
    } as any)
  );
}
