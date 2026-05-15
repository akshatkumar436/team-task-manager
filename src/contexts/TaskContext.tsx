import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import type { Task, TaskWithMeta, TaskStatus } from '../lib/database.types';
import { useAuth } from './AuthContext';
import toast from 'react-hot-toast';

interface TaskContextType {
  tasks: TaskWithMeta[];
  loadingTasks: boolean;
  fetchTasks: (projectId: string) => Promise<void>;
  createTask: (data: Partial<Task>) => Promise<Task | null>;
  updateTask: (id: string, data: Partial<Task>) => Promise<void>;
  deleteTask: (id: string) => Promise<void>;
  moveTask: (taskId: string, newStatus: TaskStatus, newPosition: number) => Promise<void>;
}

const TaskContext = createContext<TaskContextType | undefined>(undefined);

export function TaskProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<TaskWithMeta[]>([]);
  const [loadingTasks, setLoadingTasks] = useState(false);

  const fetchTasks = useCallback(async (projectId: string) => {
    setLoadingTasks(true);
    try {
      const { data, error } = await supabase
        .from('tasks')
        .select('*, assignee:profiles!tasks_assigned_to_fkey(*), creator:profiles!tasks_created_by_fkey(*)')
        .eq('project_id', projectId)
        .order('position', { ascending: true });

      if (error) throw error;
      setTasks((data as TaskWithMeta[]) ?? []);
    } catch {
      toast.error('Unable to load tasks');
      setTasks([]);
    } finally {
      setLoadingTasks(false);
    }
  }, []);

  const createTask = useCallback(
    async (data: Partial<Task>): Promise<Task | null> => {
      if (!user) return null;

      const { data: task, error } = await supabase
        .from('tasks')
        .insert({
          ...data,
          created_by: user.id,
          updated_at: new Date().toISOString(),
        } as Task)
        .select('*, assignee:profiles!tasks_assigned_to_fkey(*), creator:profiles!tasks_created_by_fkey(*)')
        .single();

      if (error || !task) {
        toast.error('Failed to create task');
        return null;
      }

      setTasks((prev) => [...prev, task as TaskWithMeta]);

      if (data.project_id) {
        await supabase.from('activity_log').insert({
          project_id: data.project_id,
          user_id: user.id,
          action: 'created task',
          entity_type: 'task',
          entity_id: task.id,
          meta: { title: task.title },
        });
      }

      return task;
    },
    [user]
  );

  const updateTask = useCallback(
    async (id: string, data: Partial<Task>) => {
      const { data: updated, error } = await supabase
        .from('tasks')
        .update({ ...data, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select('*, assignee:profiles!tasks_assigned_to_fkey(*), creator:profiles!tasks_created_by_fkey(*)')
        .single();

      if (error) {
        toast.error('Failed to update task');
        return;
      }

      setTasks((prev) => prev.map((t) => (t.id === id ? (updated as TaskWithMeta) : t)));

      if (data.status && user) {
        const task = tasks.find((t) => t.id === id);
        if (task?.project_id) {
          await supabase.from('activity_log').insert({
            project_id: task.project_id,
            user_id: user.id,
            action: `moved task to ${data.status}`,
            entity_type: 'task',
            entity_id: id,
            meta: { title: task.title, status: data.status },
          });
        }
      }
    },
    [user, tasks]
  );

  const deleteTask = useCallback(
    async (id: string) => {
      const task = tasks.find((t) => t.id === id);
      const { error } = await supabase.from('tasks').delete().eq('id', id);
      if (error) {
        toast.error('Failed to delete task');
        return;
      }
      setTasks((prev) => prev.filter((t) => t.id !== id));

      if (task?.project_id && user) {
        await supabase.from('activity_log').insert({
          project_id: task.project_id,
          user_id: user.id,
          action: 'deleted task',
          entity_type: 'task',
          entity_id: id,
          meta: { title: task.title },
        });
      }
    },
    [tasks, user]
  );

  const moveTask = useCallback(
    async (taskId: string, newStatus: TaskStatus, newPosition: number) => {
      setTasks((prev) =>
        prev.map((t) => (t.id === taskId ? { ...t, status: newStatus, position: newPosition } : t))
      );

      const { error } = await supabase
        .from('tasks')
        .update({ status: newStatus, position: newPosition, updated_at: new Date().toISOString() })
        .eq('id', taskId);

      if (error) {
        toast.error('Failed to move task');
      }
    },
    []
  );

  return (
    <TaskContext.Provider value={{ tasks, loadingTasks, fetchTasks, createTask, updateTask, deleteTask, moveTask }}>
      {children}
    </TaskContext.Provider>
  );
}

export function useTasks() {
  const ctx = useContext(TaskContext);
  if (!ctx) throw new Error('useTasks must be used within TaskProvider');
  return ctx;
}
