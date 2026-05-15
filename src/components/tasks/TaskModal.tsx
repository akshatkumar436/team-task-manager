import { useState, useEffect } from 'react';
import { useForm, type SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Trash2, Calendar, Tag, User, Flag, AlertTriangle } from 'lucide-react';
import type { TaskWithMeta, Profile, TaskStatus, TaskPriority } from '../../lib/database.types';
import { useTasks } from '../../contexts/TaskContext';
import { PRIORITY_CONFIG, STATUS_CONFIG, WORKFLOW_STATUSES, normalizeWorkflowStatus, getInitials, getAvatarColor } from '../../lib/utils';
import toast from 'react-hot-toast';

const schema = z.object({
  title: z.string().min(1, 'Title is required').max(200),
  description: z.string().max(2000).optional(),
  status: z.enum(['todo', 'in_progress', 'done']),
  priority: z.enum(['low', 'medium', 'high', 'urgent']),
  due_date: z.string().optional(),
  assigned_to: z.string().optional(),
  tags: z.string().optional(),
});

type FormData = z.infer<typeof schema>;
type WorkflowStatus = FormData['status'];

interface Props {
  task: TaskWithMeta | null;
  projectId: string;
  members: { user_id: string; profile: Profile }[];
  onClose: () => void;
  defaultStatus?: TaskStatus;
  isAdmin: boolean;
  currentUserId?: string;
}

export default function TaskModal({ task, projectId, members, onClose, defaultStatus, isAdmin, currentUserId }: Props) {
  const { createTask, updateTask, deleteTask } = useTasks();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const isEdit = !!task;
  const canEditDetails = isAdmin;
  const canUpdateStatus = isAdmin || task?.assigned_to === currentUserId;
  const canDelete = isAdmin;
  const statusOnlyMode = isEdit && !canEditDetails && canUpdateStatus;
  const toWorkflowStatus = (status: TaskStatus): WorkflowStatus => normalizeWorkflowStatus(status) as WorkflowStatus;

  const { register, handleSubmit, reset, formState: { errors, isDirty } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: task?.title ?? '',
      description: task?.description ?? '',
      status: toWorkflowStatus(task?.status ?? defaultStatus ?? 'todo'),
      priority: task?.priority ?? 'medium',
      due_date: task?.due_date ?? '',
      assigned_to: task?.assigned_to ?? '',
      tags: task?.tags?.join(', ') ?? '',
    },
  });

  useEffect(() => {
    reset({
      title: task?.title ?? '',
      description: task?.description ?? '',
      status: toWorkflowStatus(task?.status ?? defaultStatus ?? 'todo'),
      priority: task?.priority ?? 'medium',
      due_date: task?.due_date ?? '',
      assigned_to: task?.assigned_to ?? '',
      tags: task?.tags?.join(', ') ?? '',
    });
  }, [task, reset, defaultStatus]);

  const onSubmit: SubmitHandler<FormData> = async (data) => {
    if (!isAdmin && !canUpdateStatus) {
      toast.error('You can only update tasks assigned to you');
      return;
    }

    setIsSubmitting(true);
    const tags = data.tags
      ? data.tags.split(',').map((t) => t.trim()).filter(Boolean)
      : [];

    const payload = isAdmin
      ? {
          title: data.title,
          description: data.description || '',
          status: data.status as TaskStatus,
          priority: data.priority as TaskPriority,
          due_date: data.due_date || null,
          assigned_to: data.assigned_to || null,
          tags,
          project_id: projectId,
        }
      : {
          status: data.status as TaskStatus,
          project_id: projectId,
        };

    if (isEdit && task) {
      await updateTask(task.id, payload);
      toast.success('Task updated');
    } else if (isAdmin) {
      const created = await createTask(payload);
      if (created) toast.success('Task created');
    } else {
      toast.error('Only admins can create tasks');
    }
    setIsSubmitting(false);
    onClose();
  };

  const handleDelete = async () => {
    if (!task) return;
    if (!canDelete) {
      toast.error('Only admins can delete tasks');
      return;
    }
    await deleteTask(task.id);
    toast.success('Task deleted');
    onClose();
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
        onClick={(e) => e.target === e.currentTarget && onClose()}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.97, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.97, y: 12 }}
          transition={{ duration: 0.18 }}
          className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
        >
          <div className="flex items-center justify-between p-5 pb-4 border-b border-slate-100">
            <h2 className="text-base font-semibold text-slate-900">
              {isEdit ? 'Edit Task' : 'New Task'}
            </h2>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1 rounded-md hover:bg-slate-100 transition-colors">
              <X size={16} />
            </button>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="p-5 space-y-4">
            <div>
              <input
                {...register('title')}
                type="text"
                placeholder="Task title..."
                disabled={!canEditDetails}
                className="w-full text-sm font-medium text-slate-900 placeholder-slate-300 outline-none border-0 bg-transparent p-0 focus:ring-0 disabled:text-slate-500"
                autoFocus={!isEdit}
              />
              {errors.title && <p className="mt-1 text-xs text-red-500">{errors.title.message}</p>}
            </div>

            <div>
              <textarea
                {...register('description')}
                placeholder="Add a description..."
                rows={3}
                disabled={!canEditDetails}
                className="w-full text-sm text-slate-600 placeholder-slate-400 outline-none border border-slate-100 rounded-lg p-3 bg-slate-50 resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="flex items-center gap-1.5 text-xs font-medium text-slate-500 mb-1.5">
                  <Flag size={11} />
                  Status
                </label>
                <select
                  {...register('status')}
                  disabled={!canUpdateStatus}
                  className="w-full text-sm border border-slate-200 rounded-lg px-2.5 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition text-slate-700 disabled:bg-slate-50 disabled:text-slate-400"
                >
                  {WORKFLOW_STATUSES.map((s) => (
                    <option key={s} value={s}>{STATUS_CONFIG[s].label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="flex items-center gap-1.5 text-xs font-medium text-slate-500 mb-1.5">
                  <AlertTriangle size={11} />
                  Priority
                </label>
                <select
                  {...register('priority')}
                  disabled={!canEditDetails}
                  className="w-full text-sm border border-slate-200 rounded-lg px-2.5 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition text-slate-700"
                >
                  {(['low', 'medium', 'high', 'urgent'] as TaskPriority[]).map((p) => (
                    <option key={p} value={p}>{PRIORITY_CONFIG[p].label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="flex items-center gap-1.5 text-xs font-medium text-slate-500 mb-1.5">
                  <Calendar size={11} />
                  Due date
                </label>
                <input
                  {...register('due_date')}
                  type="date"
                  disabled={!canEditDetails}
                  className="w-full text-sm border border-slate-200 rounded-lg px-2.5 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition text-slate-700"
                />
              </div>

              <div>
                <label className="flex items-center gap-1.5 text-xs font-medium text-slate-500 mb-1.5">
                  <User size={11} />
                  Assignee
                </label>
                <select
                  {...register('assigned_to')}
                  disabled={!canEditDetails}
                  className="w-full text-sm border border-slate-200 rounded-lg px-2.5 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition text-slate-700"
                >
                  <option value="">Unassigned</option>
                  {members.map((m) => (
                    <option key={m.user_id} value={m.user_id}>
                      {m.profile.full_name || m.profile.email}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="flex items-center gap-1.5 text-xs font-medium text-slate-500 mb-1.5">
                <Tag size={11} />
                Tags
              </label>
              <input
                {...register('tags')}
                type="text"
                placeholder="design, frontend, bug (comma-separated)"
                disabled={!canEditDetails}
                className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition placeholder-slate-400"
              />
            </div>

            {task?.assignee && (
              <div className="flex items-center gap-2 pt-1">
                <div
                  className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-medium"
                  style={{ backgroundColor: getAvatarColor(task.assignee.full_name) }}
                >
                  {getInitials(task.assignee.full_name)}
                </div>
                <span className="text-xs text-slate-500">Assigned to <span className="text-slate-700 font-medium">{task.assignee.full_name}</span></span>
              </div>
            )}

            <AnimatePresence>
              {showDeleteConfirm && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="bg-red-50 border border-red-200 rounded-lg p-3"
                >
                  <p className="text-sm text-red-700 mb-3">Are you sure you want to delete this task? This cannot be undone.</p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={handleDelete}
                      className="flex-1 bg-red-600 hover:bg-red-700 text-white text-xs font-medium py-1.5 rounded-lg transition-colors"
                    >
                      Delete task
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowDeleteConfirm(false)}
                      className="flex-1 border border-red-200 text-red-600 text-xs font-medium py-1.5 rounded-lg hover:bg-red-50 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
              {isEdit && canDelete && (
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(true)}
                  className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                  title="Delete task"
                >
                  <Trash2 size={15} />
                </button>
              )}
              <div className="flex-1" />
              <button
                type="button"
                onClick={onClose}
                className="px-3.5 py-2 text-sm font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              {statusOnlyMode && (
                <p className="mr-auto text-xs text-slate-400">Members can update assigned task status only.</p>
              )}
              <button
                type="submit"
                disabled={isSubmitting || (isEdit && !isDirty) || (!isAdmin && !canUpdateStatus)}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
              >
                {isSubmitting ? (
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : isEdit ? (
                  'Save changes'
                ) : (
                  'Create task'
                )}
              </button>
            </div>
          </form>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
