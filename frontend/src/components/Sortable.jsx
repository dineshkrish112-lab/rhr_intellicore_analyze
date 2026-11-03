import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors } from '@dnd-kit/core'
import { SortableContext, arrayMove, rectSortingStrategy, sortableKeyboardCoordinates, useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical } from 'lucide-react'

/** Reorderable grid. Items are dragged by their grip handle (mouse, touch or keyboard). */
export function SortableGrid({ ids, onReorder, className, children }) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )
  const onDragEnd = ({ active, over }) => {
    if (over && active.id !== over.id) {
      onReorder(arrayMove(ids, ids.indexOf(active.id), ids.indexOf(over.id)))
    }
  }
  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <SortableContext items={ids} strategy={rectSortingStrategy}>
        <div className={className}>{children}</div>
      </SortableContext>
    </DndContext>
  )
}

export function SortableItem({ id, className = '', children }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id })
  const style = { transform: CSS.Transform.toString(transform), transition }
  const handle = (
    <button
      ref={setActivatorNodeRef}
      {...attributes}
      {...listeners}
      className="p-1 -m-1 rounded text-gray-300 hover:text-gray-500 dark:text-gray-600 dark:hover:text-gray-400 cursor-grab active:cursor-grabbing touch-none"
      aria-label="Drag to reorder"
      title="Drag to reorder"
    >
      <GripVertical className="w-4 h-4" />
    </button>
  )
  return (
    <div ref={setNodeRef} style={style} className={`${className} ${isDragging ? 'z-20 opacity-80 ring-2 ring-brand-400 rounded-xl' : ''}`}>
      {children(handle)}
    </div>
  )
}
