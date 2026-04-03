import { useCallback, useRef, useEffect } from 'react';

interface DragResizeOptions {
  /** Current width of the panel being resized */
  initialWidth: number;
  /** Min width before auto-collapsing */
  minWidth: number;
  /** Max width the panel can grow to */
  maxWidth: number;
  /** 'left' = dragging left edge grows panel, 'right' = dragging right edge grows panel */
  direction: 'left' | 'right';
  /** Called on every mouse move with the new width */
  onResize: (width: number) => void;
  /** Called when drag ends below minWidth — signals collapse */
  onCollapse?: () => void;
}

/**
 * Hook for drag-resizable panels. Returns a ref to attach to the drag handle element.
 * Handles mousedown/mousemove/mouseup lifecycle, cursor changes, and selection prevention.
 */
export function useDragResize({
  initialWidth,
  minWidth,
  maxWidth,
  direction,
  onResize,
  onCollapse,
}: DragResizeOptions) {
  const dragging = useRef(false);
  const startX = useRef(0);
  const startWidth = useRef(0);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      dragging.current = true;
      startX.current = e.clientX;
      startWidth.current = initialWidth;
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    },
    [initialWidth],
  );

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!dragging.current) return;
      const delta = e.clientX - startX.current;
      const newWidth =
        direction === 'right'
          ? startWidth.current + delta
          : startWidth.current - delta;

      if (newWidth < minWidth * 0.6) {
        // Below collapse threshold — signal collapse
        onCollapse?.();
        dragging.current = false;
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        window.dispatchEvent(new Event('resize'));
        return;
      }

      onResize(Math.min(Math.max(newWidth, minWidth), maxWidth));
    };

    const handleMouseUp = () => {
      if (!dragging.current) return;
      dragging.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      // Notify ReactFlow (and other listeners) that the container resized
      window.dispatchEvent(new Event('resize'));
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [direction, minWidth, maxWidth, onResize, onCollapse]);

  return { onMouseDown: handleMouseDown };
}
