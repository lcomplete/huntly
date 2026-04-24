import { useCallback, useRef, useState, type DragEvent } from "react";

import { DROPPABLE_STRING_TYPES } from "../utils/dropPayload";

interface UseDragAndDropZoneOptions {
  /**
   * Called when the user drops an external payload into the zone. The hook
   * manages visual state (drag-over overlay) and filters out internal drags;
   * the caller handles the actual payload processing.
   */
  onDrop: (dataTransfer: DataTransfer) => void | Promise<void>;
}

export interface DragZoneHandlers {
  onDragEnter: (event: DragEvent<HTMLDivElement>) => void;
  onDragOver: (event: DragEvent<HTMLDivElement>) => void;
  onDragLeave: (event: DragEvent<HTMLDivElement>) => void;
  onDrop: (event: DragEvent<HTMLDivElement>) => void;
  onDragStartCapture: () => void;
  onDragEndCapture: () => void;
}

interface UseDragAndDropZoneResult {
  isDraggingOver: boolean;
  handlers: DragZoneHandlers;
}

/**
 * Owns the drag-over visual state for a drop zone. Distinguishes external
 * payloads (files or URL strings) from internal drags within the zone so the
 * overlay doesn't flash when moving children around.
 */
export function useDragAndDropZone(
  options: UseDragAndDropZoneOptions
): UseDragAndDropZoneResult {
  const { onDrop } = options;

  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const dragDepthRef = useRef(0);
  const internalDragRef = useRef(false);

  const hasExternalPayload = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      if (internalDragRef.current) {
        return false;
      }

      const items = Array.from(event.dataTransfer?.items || []);
      if (items.length > 0) {
        return items.some(
          (item) =>
            item.kind === "file" ||
            (item.kind === "string" && DROPPABLE_STRING_TYPES.has(item.type))
        );
      }

      return Array.from(event.dataTransfer?.types || []).some(
        (type) => type === "Files" || DROPPABLE_STRING_TYPES.has(type)
      );
    },
    []
  );

  const handleDragEnter = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      if (!hasExternalPayload(event)) return;
      event.preventDefault();
      dragDepthRef.current += 1;
      setIsDraggingOver(true);
    },
    [hasExternalPayload]
  );

  const handleDragOver = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      if (!hasExternalPayload(event)) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = "copy";
    },
    [hasExternalPayload]
  );

  const handleDragLeave = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      if (!hasExternalPayload(event)) return;
      dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
      if (dragDepthRef.current === 0) setIsDraggingOver(false);
    },
    [hasExternalPayload]
  );

  const handleDrop = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      if (!hasExternalPayload(event)) return;
      event.preventDefault();
      internalDragRef.current = false;
      dragDepthRef.current = 0;
      setIsDraggingOver(false);

      void onDrop(event.dataTransfer);
    },
    [hasExternalPayload, onDrop]
  );

  const handleInternalDragStartCapture = useCallback(() => {
    internalDragRef.current = true;
  }, []);

  const handleInternalDragEndCapture = useCallback(() => {
    internalDragRef.current = false;
    dragDepthRef.current = 0;
    setIsDraggingOver(false);
  }, []);

  return {
    isDraggingOver,
    handlers: {
      onDragEnter: handleDragEnter,
      onDragOver: handleDragOver,
      onDragLeave: handleDragLeave,
      onDrop: handleDrop,
      onDragStartCapture: handleInternalDragStartCapture,
      onDragEndCapture: handleInternalDragEndCapture,
    },
  };
}
