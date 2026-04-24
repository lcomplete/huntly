import { useEffect } from "react";
import type React from "react";

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "textarea:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

export function getFocusableElements(
  container: HTMLElement | null
): HTMLElement[] {
  if (!container) return [];

  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR))
    .filter((element) => element.getAttribute("aria-hidden") !== "true")
    .filter((element) => element.getClientRects().length > 0);
}

export function useOutsideClick<T extends HTMLElement>(
  active: boolean,
  ref: React.RefObject<T>,
  onClose: () => void
) {
  useEffect(() => {
    if (!active) return;

    const handler = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        onClose();
      }
    };

    document.addEventListener("mousedown", handler, true);
    return () => document.removeEventListener("mousedown", handler, true);
  }, [active, onClose, ref]);
}

const TEXTAREA_MAX_HEIGHT_PX = 180;

export function useAutosizeTextArea(
  ref: React.RefObject<HTMLTextAreaElement>,
  value: string
) {
  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    element.style.height = "0px";
    element.style.height = `${Math.min(
      element.scrollHeight,
      TEXTAREA_MAX_HEIGHT_PX
    )}px`;
  }, [ref, value]);
}

export function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () =>
      reject(reader.error || new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}

export function readBlobAsDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () =>
      reject(reader.error || new Error("Failed to read blob"));
    reader.readAsDataURL(blob);
  });
}

export function isComposingEnterEvent(
  event: React.KeyboardEvent<HTMLTextAreaElement>
): boolean {
  if (event.key !== "Enter") return false;

  const nativeEvent = event.nativeEvent as KeyboardEvent & {
    isComposing?: boolean;
    keyCode?: number;
  };

  return nativeEvent.isComposing === true || nativeEvent.keyCode === 229;
}
