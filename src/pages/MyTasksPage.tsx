import { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import type { Task, TaskStatus, TaskPriority } from '../lib/database.types';
import { PRIORITY_CONFIG, STATUS_CONFIG, WORKFLOW_STATUSES, formatDate, isOverdue, normalizeWorkflowStatus } from '../lib/utils';
import { CheckSquare, Calendar, ExternalLink } from 'lucide-react';

interface TaskWithProject extends Task {
  project?: { id: string; name: string; color: string } | null;
}

export default function MyTasksPage() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<TaskWithProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<TaskStatus | ''>('');
  const [filterPriority, setFilterPriority] = useState<TaskPriority | ''>('');

  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from('tasks')
        .select('*, project:projects(id, name, color)')
        .eq('assigned_to', user.id)
        .order('due_date', { ascending: true, nullsFirst: false });
      setTasks((data as TaskWithProject[]) ?? []);
      setLoading(false);
    })();
  }, [user]);

  const filtered = useMemo(() => {
    return tasks.filter((t) => {
      if (filterStatus && normalizeWorkflowStatus(t.status) !== filterStatus) return false;
      if (filterPriority && t.priority !== filterPriority) return false;
      return true;
    });
  }, [tasks, filterStatus, filterPriority]);

  const grouped = useMemo(() => {
    const overdue = filtered.filter((t) => isOverdue(t.due_date) && t.status !== 'done');
    const upcoming = filtered.filter((t) => !isOverdue(t.due_date) && t.status !== 'done');
    const done = filtered.filter((t) => t.status === 'done');
    return { overdue, upcoming, done };
  }, [filtered]);

  return (
    <div className="p-5 lg:p-6 max-w-3xl">
      <div className="mb-6">
        <h1 className="text-lg font-semibold text-slate-900">My Tasks</h1>
        <p className="text-sm text-slate-400 mt-0.5">{tasks.filter((t) => t.status !== 'done').length} open tasks assigned to you</p>
      </div>

      <div className="flex items-center gap-2 mb-6">
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value as TaskStatus | '')}
          className="text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white text-slate-600 outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All statuses</option>
          {WORKFLOW_STATUSES.map((s) => (
            <option key={s} value={s}>{STATUS_CONFIG[s].label}</option>
          ))}
        </select>
        <select
          value={filterPriority}
          onChange={(e) => setFilterPriority(e.target.value as TaskPriority | '')}
          className="text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white text-slate-600 outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All priorities</option>
          {(['low', 'medium', 'high', 'urgent'] as TaskPriority[]).map((p) => (
            <option key={p} value={p}>{PRIORITY_CONFIG[p].label}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="bg-white rounded-xl border border-slate-100 p-4 h-16 animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-12 h-12 bg-green-50 rounded-xl flex items-center justify-center mb-3">
            <CheckSquare size={22} className="text-green-500" />
          </div>
          <h3 className="text-sm font-semibold text-slate-700 mb-1">You're all caught up!</h3>
          <p className="text-xs text-slate-400">No tasks assigned to you right now.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {grouped.overdue.length > 0 && (
            <Section title="Overdue" color="text-red-600" tasks={grouped.overdue} />
          )}
          {grouped.upcoming.length > 0 && (
            <Section title="Upcoming" color="text-slate-700" tasks={grouped.upcoming} />
          )}
          {grouped.done.length > 0 && (
            <Section title="Completed" color="text-slate-400" tasks={grouped.done} />
          )}
        </div>
      )}
    </div>
  );
}

function Section({ title, color, tasks }: { title: string; color: string; tasks: TaskWithProject[] }) {
  return (
    <div>
      <h2 className={`text-xs font-semibold uppercase tracking-wider mb-2.5 ${color}`}>{title}</h2>
      <div className="bg-white rounded-xl border border-slate-100 overflow-hidden">
        {tasks.map((task, i) => {
          const priority = PRIORITY_CONFIG[task.priority];
          const status = STATUS_CONFIG[normalizeWorkflowStatus(task.status)];
          const overdue = isOverdue(task.due_date);
          return (
            <div
              key={task.id}
              className={`flex items-center gap-3 px-4 py-3 ${i < tasks.length - 1 ? 'border-b border-slate-50' : ''} hover:bg-slate-50 transition-colors`}
            >
              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${priority.dot}`} />
              <div className="flex-1 min-w-0">
                <p className="text-sm text-slate-800 truncate">{task.title}</p>
                {task.project && (
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: task.project.color }} />
                    <span className="text-xs text-slate-400">{task.project.name}</span>
                  </div>
                )}
              </div>
              {task.due_date && (
                <span className={`flex items-center gap-1 text-xs whitespace-nowrap ${overdue ? 'text-red-500' : 'text-slate-400'}`}>
                  <Calendar size={11} />
                  {formatDate(task.due_date)}
                </span>
              )}
              <span className={`text-xs px-1.5 py-0.5 rounded font-medium whitespace-nowrap ${status.color} ${status.bg}`}>
                {status.label}
              </span>
              {task.project && (
                <Link
                  to={`/projects/${task.project.id}`}
                  className="text-slate-300 hover:text-slate-500 transition-colors"
                >
                  <ExternalLink size={13} />
                </Link>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
