import { memo } from 'react';
import { Draggable } from 'react-beautiful-dnd';
import { Calendar, MessageSquare } from 'lucide-react';
import type { TaskWithMeta } from '../../lib/database.types';
import { PRIORITY_CONFIG, formatDate, isOverdue, getInitials, getAvatarColor } from '../../lib/utils';

interface Props {
  task: TaskWithMeta;
  index: number;
  onClick: (task: TaskWithMeta) => void;
  isDragDisabled?: boolean;
}

function TaskCardInner({ task, index, onClick, isDragDisabled = false }: Props) {
  const priority = PRIORITY_CONFIG[task.priority];
  const overdue = isOverdue(task.due_date);

  return (
    <Draggable draggableId={task.id} index={index} isDragDisabled={isDragDisabled}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          onClick={() => onClick(task)}
          className={`group relative overflow-hidden rounded-2xl border p-3.5 shadow-sm transition-all duration-200 ${
            snapshot.isDragging
              ? 'rotate-1 border-blue-200 bg-white shadow-xl'
              : overdue
                ? 'border-red-200 bg-red-50/80 hover:border-red-300 hover:shadow-md'
                : 'border-slate-200 bg-white hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-lg'
          } ${isDragDisabled ? 'cursor-default opacity-80' : 'cursor-pointer'}`}
        >
          <span className={`absolute inset-y-3 left-0 w-1 rounded-r-full ${priority.dot}`} />
          <span className="pointer-events-none absolute right-0 top-0 h-12 w-12 rounded-bl-full bg-slate-50 opacity-0 transition-opacity group-hover:opacity-100" />

          <div className="relative mb-3 flex flex-wrap items-center gap-1.5 pl-1">
            <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${priority.color} ${priority.bg}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${priority.dot}`} />
              {priority.label}
            </span>
            {task.tags.slice(0, 2).map((tag) => (
              <span key={tag} className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500">
                {tag}
              </span>
            ))}
          </div>

          <p className="relative mb-2.5 line-clamp-2 pl-1 text-sm font-semibold leading-snug text-slate-800 group-hover:text-slate-950">
            {task.title}
          </p>

          {task.description && (
            <p className="relative mb-3 line-clamp-2 pl-1 text-xs leading-relaxed text-slate-500">
              {task.description}
            </p>
          )}

          <div className="relative flex items-center justify-between gap-2 border-t border-slate-100 pt-2.5">
            <div className="flex items-center gap-2">
              {task.due_date && (
                <span
                  className={`flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-semibold ${
                    overdue ? 'bg-red-100 text-red-600' : 'bg-slate-50 text-slate-500'
                  }`}
                >
                  <Calendar size={10} />
                  {formatDate(task.due_date)}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5">
              {task.description && (
                <span className="rounded-full bg-slate-50 p-1 text-slate-300">
                  <MessageSquare size={11} />
                </span>
              )}
              {task.assignee && (
                <div
                  className="flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold text-white ring-2 ring-white"
                  style={{ backgroundColor: getAvatarColor(task.assignee.full_name) }}
                  title={task.assignee.full_name}
                >
                  {getInitials(task.assignee.full_name)}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </Draggable>
  );
}

export const TaskCard = memo(TaskCardInner);
