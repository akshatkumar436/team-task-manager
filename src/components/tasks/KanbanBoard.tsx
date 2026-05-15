import { useState, useMemo } from 'react';
import { DragDropContext, Droppable, DropResult } from 'react-beautiful-dnd';
import { Plus } from 'lucide-react';
import type { TaskWithMeta, TaskStatus, Profile, ProjectMember } from '../../lib/database.types';
import { useTasks } from '../../contexts/TaskContext';
import { STATUS_CONFIG, WORKFLOW_STATUSES, normalizeWorkflowStatus } from '../../lib/utils';
import { TaskCard } from './TaskCard';
import TaskModal from './TaskModal';

interface Props {
  projectId: string;
  members: (ProjectMember & { profile: Profile })[];
  tasks?: TaskWithMeta[];
  currentUserId?: string;
  isAdmin: boolean;
}

export default function KanbanBoard({ projectId, members, tasks: visibleTasks, currentUserId, isAdmin }: Props) {
  const { tasks, moveTask } = useTasks();
  const [selectedTask, setSelectedTask] = useState<TaskWithMeta | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [defaultStatus, setDefaultStatus] = useState<TaskStatus>('todo');

  const columns = useMemo(() => {
    const boardTasks = visibleTasks ?? tasks;
    return WORKFLOW_STATUSES.reduce((acc, status) => {
      acc[status] = boardTasks
        .filter((t) => normalizeWorkflowStatus(t.status) === status)
        .sort((a, b) => a.position - b.position);
      return acc;
    }, {} as Record<TaskStatus, TaskWithMeta[]>);
  }, [tasks, visibleTasks]);

  const handleDragEnd = (result: DropResult) => {
    const { source, destination, draggableId } = result;
    if (!destination) return;
    if (source.droppableId === destination.droppableId && source.index === destination.index) return;

    const task = (visibleTasks ?? tasks).find((candidate) => candidate.id === draggableId);
    if (!task || (!isAdmin && task.assigned_to !== currentUserId)) return;

    const newStatus = destination.droppableId as TaskStatus;
    moveTask(draggableId, newStatus, destination.index);
  };

  const openNewTask = (status: TaskStatus) => {
    setSelectedTask(null);
    setDefaultStatus(status);
    setModalOpen(true);
  };

  const openEditTask = (task: TaskWithMeta) => {
    if (!isAdmin && task.assigned_to !== currentUserId) return;
    setSelectedTask(task);
    setModalOpen(true);
  };

  return (
    <>
      <DragDropContext onDragEnd={handleDragEnd}>
        <div className="flex gap-3 overflow-x-auto pb-4 min-h-0">
          {WORKFLOW_STATUSES.map((status) => {
            const config = STATUS_CONFIG[status];
            const colTasks = columns[status] ?? [];
            return (
              <div
                key={status}
                className="flex-shrink-0 w-64 flex flex-col"
              >
                <div className={`flex items-center justify-between px-3 py-2.5 rounded-t-xl border-t-2 border-x ${config.border} bg-white mb-0.5`}
                  style={{ borderTopColor: status === 'in_progress' ? '#3B82F6' : status === 'done' ? '#10B981' : '#E2E8F0' }}
                >
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-semibold ${config.color}`}>{config.label}</span>
                    <span className="text-xs text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded-full font-medium">
                      {colTasks.length}
                    </span>
                  </div>
                  {isAdmin && (
                    <button
                      onClick={() => openNewTask(status)}
                      className="text-slate-400 hover:text-slate-600 hover:bg-slate-100 p-0.5 rounded transition-colors"
                    >
                      <Plus size={14} />
                    </button>
                  )}
                </div>

                <Droppable droppableId={status}>
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className={`flex-1 min-h-32 rounded-b-xl space-y-2 p-2 border border-t-0 transition-colors ${config.border} ${
                        snapshot.isDraggingOver ? 'bg-blue-50' : 'bg-slate-50'
                      }`}
                    >
                      {colTasks.map((task, index) => (
                        <TaskCard
                          key={task.id}
                          task={task}
                          index={index}
                          onClick={openEditTask}
                          isDragDisabled={!isAdmin && task.assigned_to !== currentUserId}
                        />
                      ))}
                      {provided.placeholder}
                      {colTasks.length === 0 && !snapshot.isDraggingOver && (
                        <div className="flex flex-col items-center justify-center py-6 text-center">
                          <p className="text-xs text-slate-300">Drop tasks here</p>
                        </div>
                      )}
                    </div>
                  )}
                </Droppable>
              </div>
            );
          })}
        </div>
      </DragDropContext>

      {modalOpen && (
        <TaskModal
          task={selectedTask}
          projectId={projectId}
          members={members}
          defaultStatus={defaultStatus}
          isAdmin={isAdmin}
          currentUserId={currentUserId}
          onClose={() => {
            setModalOpen(false);
            setSelectedTask(null);
          }}
        />
      )}
    </>
  );
}
