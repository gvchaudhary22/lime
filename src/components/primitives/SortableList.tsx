"use client";

/**
 * SortableList<T> — generic drag-and-drop sortable list primitive built
 * on @dnd-kit. Used by the Phase-12 API Tools tabs to drag-reorder
 * modules, operations, and tool-members.
 *
 * Keyboard accessibility comes for free from KeyboardSensor:
 *   Tab to focus an item, Space to "pick up", Arrow keys to move,
 *   Space again to "drop".
 */

import { ReactNode } from "react";
import {
  DndContext,
  DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

export interface SortableListProps<T> {
  items: T[];
  /** Stable id for an item — used as React key + dnd-kit identifier. */
  getId: (item: T) => string | number;
  /** Render the item's row (drag handle wraps this). */
  renderItem: (item: T, dragHandleProps: { isDragging: boolean }) => ReactNode;
  /** Fired with the new array (already in new order) after a successful drop. */
  onReorder: (newOrder: T[]) => void;
  /** When true, drags are no-ops (e.g. mid-save). Items still render. */
  disabled?: boolean;
}

export function SortableList<T>({
  items,
  getId,
  renderItem,
  onReorder,
  disabled = false,
}: SortableListProps<T>) {
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 4 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    if (disabled) return;
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = items.findIndex((it) => String(getId(it)) === String(active.id));
    const newIndex = items.findIndex((it) => String(getId(it)) === String(over.id));
    if (oldIndex === -1 || newIndex === -1) return;
    onReorder(arrayMove(items, oldIndex, newIndex));
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext
        items={items.map((it) => String(getId(it)))}
        strategy={verticalListSortingStrategy}
        disabled={disabled}
      >
        {items.map((item) => (
          <SortableRow
            key={getId(item)}
            id={String(getId(item))}
            disabled={disabled}
            render={(handle) => renderItem(item, handle)}
          />
        ))}
      </SortableContext>
    </DndContext>
  );
}

interface SortableRowProps {
  id: string;
  disabled: boolean;
  render: (handle: { isDragging: boolean }) => ReactNode;
}

function SortableRow({ id, disabled, render }: SortableRowProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id, disabled });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    cursor: disabled ? "default" : "grab",
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      data-testid={`sortable-row-${id}`}
    >
      {render({ isDragging })}
    </div>
  );
}

export default SortableList;
