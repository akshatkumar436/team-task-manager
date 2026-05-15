import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  FolderKanban, CheckSquare, AlertCircle, TrendingUp,
  ArrowRight, Clock, BarChart2,
  type LucideIcon,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from 'recharts';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useProjects } from '../contexts/ProjectContext';
import type { Task, ActivityLog, Profile, TaskPriority, TaskStatus } from '../lib/database.types';
import {
  formatRelative,
  PRIORITY_CONFIG,
  STATUS_CONFIG,
  WORKFLOW_STATUSES,
  formatDate,
  isOverdue,
  normalizeWorkflowStatus,
} from '../lib/utils';
import { getInitials, getAvatarColor } from '../lib/utils';

interface Stats {
  totalProjects: number;
  totalTasks: number;
  completedTasks: number;
  overdueTasks: number;
}

interface ActivityItem extends ActivityLog {
  profile?: Profile;
}

function StatCard({ icon: Icon, label, value, sub, color, accent, tone = 'quiet' }: {
  icon: LucideIcon;
  label: string;
  value: number | string;
  sub?: string;
  color: string;
  accent: string;
  tone?: 'quiet' | 'strong';
}) {
  return (
    <div className={`relative min-h-[124px] overflow-hidden rounded-2xl border p-4 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md ${
      tone === 'strong' ? 'border-blue-100 bg-blue-50/70' : 'border-slate-100 bg-white'
    }`}>
      <div className={`absolute left-4 right-4 top-0 h-1 rounded-b-full ${accent}`} />
      <div className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-slate-50/80" />
      <div className="relative flex h-full items-start justify-between gap-4 pt-1">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">{label}</p>
          <p className="mt-2 text-3xl font-semibold leading-none tracking-tight text-slate-950">{value}</p>
          {sub && <p className="mt-2 text-xs font-medium text-slate-500">{sub}</p>}
        </div>
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl shadow-sm ${color}`}>
          <Icon size={17} />
        </div>
      </div>
    </div>
  );
}

function TaskRow({ task }: { task: Task }) {
  const overdue = isOverdue(task.due_date);
  const priority = PRIORITY_CONFIG[task.priority];
  const status = normalizeWorkflowStatus(task.status);
  return (
    <div className={`group flex items-center gap-3 rounded-2xl px-3 py-2.5 transition-all ${
      overdue ? 'bg-red-50 ring-1 ring-red-100' : 'hover:bg-slate-50 hover:ring-1 hover:ring-slate-100'
    }`}>
      <span className={`h-7 w-1 rounded-full shrink-0 ${priority.dot}`} />
      <p className="flex-1 truncate text-sm font-medium text-slate-700 group-hover:text-slate-950">{task.title}</p>
      {task.due_date && (
        <span className={`hidden rounded-full px-2 py-1 text-xs font-medium sm:inline-flex ${overdue ? 'bg-red-100 text-red-600' : 'bg-slate-100 text-slate-500'}`}>
          {formatDate(task.due_date)}
        </span>
      )}
      <span className={`rounded-full px-2 py-1 text-[11px] font-semibold ${STATUS_CONFIG[status].color} ${STATUS_CONFIG[status].bg}`}>
        {STATUS_CONFIG[status].label}
      </span>
    </div>
  );
}

export default function DashboardPage() {
  const { user } = useAuth();
  const { projects } = useProjects();
  const [stats, setStats] = useState<Stats>({ totalProjects: 0, totalTasks: 0, completedTasks: 0, overdueTasks: 0 });
  const [projectTasks, setProjectTasks] = useState<Task[]>([]);
  const [myTasks, setMyTasks] = useState<Task[]>([]);
  const [taskOwners, setTaskOwners] = useState<Profile[]>([]);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [taskSearch, setTaskSearch] = useState('');
  const [taskPriority, setTaskPriority] = useState<TaskPriority | ''>('');
  const [taskStatus, setTaskStatus] = useState<TaskStatus | ''>('');

  const fetchData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError('');
    try {
      const projectIds = projects.map((p) => p.id);
      const projectTasksPromise = projectIds.length
        ? supabase.from('tasks').select('*').in('project_id', projectIds)
        : Promise.resolve({ data: [] as Task[], error: null });
      const activityPromise = projectIds.length
        ? supabase
            .from('activity_log')
            .select('*, profile:profiles(*)')
            .in('project_id', projectIds)
            .order('created_at', { ascending: false })
            .limit(8)
        : Promise.resolve({ data: [] as ActivityItem[], error: null });
      const myTasksPromise = supabase
        .from('tasks')
        .select('*')
        .eq('assigned_to', user.id)
        .neq('status', 'done')
        .order('due_date', { ascending: true })
        .limit(6);

      const [{ data: allTasks, error: tasksError }, { data: activityData, error: activityError }, { data: myTasksData, error: myTasksError }] =
        await Promise.all([projectTasksPromise, activityPromise, myTasksPromise]);

      if (tasksError || activityError || myTasksError) {
        throw tasksError || activityError || myTasksError;
      }

      const tasks = allTasks ?? [];
      const assignedIds = Array.from(new Set(tasks.map((task) => task.assigned_to).filter(Boolean))) as string[];
      const { data: owners, error: ownersError } = assignedIds.length
        ? await supabase.from('profiles').select('*').in('id', assignedIds)
        : { data: [] as Profile[], error: null };
      if (ownersError) throw ownersError;

      const now = new Date().toISOString().split('T')[0];
      const overdue = tasks.filter((t) => t.due_date && t.due_date < now && t.status !== 'done').length;

      setStats({
        totalProjects: projects.length,
        totalTasks: tasks.length,
        completedTasks: tasks.filter((t) => t.status === 'done').length,
        overdueTasks: overdue,
      });

      setMyTasks(myTasksData ?? []);
      setProjectTasks(tasks);
      setTaskOwners((owners as Profile[]) ?? []);
      setActivity((activityData as ActivityItem[]) ?? []);
    } catch {
      setError('Dashboard data could not be loaded. Please refresh or try again later.');
    } finally {
      setLoading(false);
    }
  }, [user, projects]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const productivity = stats.totalTasks > 0
    ? Math.round((stats.completedTasks / stats.totalTasks) * 100)
    : 0;

  const statusData = WORKFLOW_STATUSES.map((status) => ({
    name: STATUS_CONFIG[status].label,
    value: projectTasks.filter((task) => normalizeWorkflowStatus(task.status) === status).length,
    fill: status === 'done'
      ? '#10B981'
      : status === 'in_progress'
        ? '#3B82F6'
        : status === 'todo'
          ? '#64748B'
          : '#94A3B8',
  })).filter((item) => item.value > 0);

  const tasksPerUserData = taskOwners
    .map((owner) => ({
      id: owner.id,
      name: owner.full_name || owner.email,
      count: projectTasks.filter((task) => task.assigned_to === owner.id).length,
      color: getAvatarColor(owner.full_name || owner.email),
    }))
    .filter((item) => item.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, 6);

  const filteredMyTasks = myTasks.filter((task) => {
    const query = taskSearch.trim().toLowerCase();
    const matchesSearch = !query
      || task.title.toLowerCase().includes(query)
      || task.description.toLowerCase().includes(query)
      || task.tags.some((tag) => tag.toLowerCase().includes(query));
    const matchesPriority = !taskPriority || task.priority === taskPriority;
    const matchesStatus = !taskStatus || normalizeWorkflowStatus(task.status) === taskStatus;
    return matchesSearch && matchesPriority && matchesStatus;
  });

  const projectBarData = projects.slice(0, 6).map((p) => ({
    name: p.name.length > 12 ? `${p.name.slice(0, 12)}...` : p.name,
    tasks: p.task_count,
    done: p.completed_count,
  }));

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-white rounded-xl border border-slate-100 p-4 h-24 animate-pulse">
              <div className="h-3 bg-slate-100 rounded w-20 mb-3" />
              <div className="h-7 bg-slate-100 rounded w-12" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-7 bg-slate-50/60 p-5 lg:p-7">
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="flex flex-col gap-3 rounded-3xl border border-slate-200/70 bg-white px-5 py-5 shadow-sm sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-600">Workspace overview</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight text-slate-950">Delivery pulse</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
            A live read on project load, task movement, and work that needs attention.
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-2xl bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-500 ring-1 ring-slate-100">
          <span className="h-2 w-2 rounded-full bg-emerald-500" />
          Live workspace data
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0 }}>
          <StatCard
            icon={FolderKanban}
            label="Total Projects"
            value={stats.totalProjects}
            sub={`${projects.filter((p) => p.member_count > 1).length} collaborative`}
            color="bg-white text-blue-600"
            accent="bg-blue-500"
            tone="strong"
          />
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
          <StatCard
            icon={CheckSquare}
            label="Tasks Done"
            value={stats.completedTasks}
            sub={`of ${stats.totalTasks} total`}
            color="bg-green-50 text-green-600"
            accent="bg-green-500"
          />
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <StatCard
            icon={AlertCircle}
            label="Overdue"
            value={stats.overdueTasks}
            sub="need attention"
            color={stats.overdueTasks > 0 ? "bg-red-50 text-red-600" : "bg-slate-50 text-slate-400"}
            accent={stats.overdueTasks > 0 ? "bg-red-500" : "bg-slate-200"}
          />
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
          <StatCard
            icon={TrendingUp}
            label="Productivity"
            value={`${productivity}%`}
            sub="completion rate"
            color="bg-amber-50 text-amber-600"
            accent="bg-amber-400"
          />
        </motion.div>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="rounded-3xl border border-slate-200/70 bg-white p-5 shadow-sm lg:col-span-2">
          <div className="mb-5 flex items-start justify-between gap-4">
            <div>
              <h3 className="text-lg font-semibold tracking-tight text-slate-900">Project Progress</h3>
              <p className="mt-1 text-xs font-medium text-slate-500">Tasks completed per project</p>
            </div>
            <div className="rounded-2xl bg-blue-50 p-2.5 text-blue-500 ring-1 ring-blue-100">
              <BarChart2 size={16} />
            </div>
          </div>
          {projectBarData.length > 0 ? (
            <div className="rounded-2xl bg-slate-50/70 px-2 pt-4 ring-1 ring-slate-100">
              <ResponsiveContainer width="100%" height={220}>
              <BarChart data={projectBarData} barSize={12} barGap={4}>
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#94A3B8' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#94A3B8' }} axisLine={false} tickLine={false} width={24} />
                <Tooltip
                  contentStyle={{ border: '1px solid #E2E8F0', borderRadius: 12, fontSize: 12, boxShadow: '0 12px 30px rgba(15, 23, 42, 0.08)' }}
                  cursor={{ fill: '#F8FAFC' }}
                />
                <Bar dataKey="tasks" fill="#CBD5E1" radius={[6, 6, 0, 0]} name="Total" />
                <Bar dataKey="done" fill="#2563EB" radius={[6, 6, 0, 0]} name="Done" />
              </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-44 flex flex-col items-center justify-center text-slate-400">
              <BarChart2 size={32} className="mb-2 opacity-30" />
              <p className="text-sm">No projects yet</p>
            </div>
          )}
        </div>

        <div className="relative overflow-hidden rounded-3xl border border-slate-800 bg-slate-950 p-5 text-white shadow-sm">
          <div className="absolute inset-x-5 top-0 h-1 rounded-b-full bg-cyan-400" />
          <h3 className="mb-1 text-lg font-semibold tracking-tight">Task Status</h3>
          <p className="mb-4 text-xs font-medium text-slate-400">Live status distribution</p>
          {stats.totalTasks > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={140}>
                <PieChart>
                  <Pie
                    data={statusData}
                    innerRadius={45}
                    outerRadius={65}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {statusData.map((entry) => (
                      <Cell key={entry.name} fill={entry.fill} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="mt-3 grid grid-cols-2 gap-2">
                {statusData.map((entry) => (
                  <div key={entry.name} className="flex items-center gap-1.5 rounded-xl bg-white/5 px-2.5 py-2 ring-1 ring-white/5">
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.fill }} />
                    <span className="text-xs text-slate-300">{entry.name} ({entry.value})</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="h-44 flex flex-col items-center justify-center text-slate-400">
              <p className="text-sm">No data yet</p>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        <div className="rounded-3xl border border-slate-200/70 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-start justify-between gap-4">
            <div>
              <h3 className="text-lg font-semibold tracking-tight text-slate-900">Assigned to Me</h3>
              <p className="mt-1 text-xs font-medium text-slate-500">Open tasks requiring your attention</p>
            </div>
            <Link to="/tasks" className="flex shrink-0 items-center gap-1 rounded-full bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-600 transition hover:bg-blue-100">
              View all <ArrowRight size={12} />
            </Link>
          </div>
          <div className="mb-4 grid grid-cols-1 gap-2 rounded-2xl bg-slate-50/70 p-2 ring-1 ring-slate-100 sm:grid-cols-3">
            <input
              value={taskSearch}
              onChange={(e) => setTaskSearch(e.target.value)}
              placeholder="Search assigned tasks"
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 outline-none transition focus:border-blue-300 focus:ring-2 focus:ring-blue-500 sm:col-span-1"
            />
            <select
              value={taskStatus}
              onChange={(e) => setTaskStatus(e.target.value as TaskStatus | '')}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 outline-none transition focus:border-blue-300 focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All statuses</option>
              {WORKFLOW_STATUSES.map((status) => (
                <option key={status} value={status}>{STATUS_CONFIG[status].label}</option>
              ))}
            </select>
            <select
              value={taskPriority}
              onChange={(e) => setTaskPriority(e.target.value as TaskPriority | '')}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 outline-none transition focus:border-blue-300 focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All priorities</option>
              {(['low', 'medium', 'high', 'urgent'] as TaskPriority[]).map((priority) => (
                <option key={priority} value={priority}>{PRIORITY_CONFIG[priority].label}</option>
              ))}
            </select>
          </div>
          {filteredMyTasks.length === 0 ? (
            <div className="py-8 text-center">
              <CheckSquare size={28} className="mx-auto text-slate-200 mb-2" />
              <p className="text-sm text-slate-400">
                {myTasks.length === 0 ? "You're all caught up!" : 'No assigned tasks match the filters'}
              </p>
            </div>
          ) : (
            <div className="space-y-1">
              {filteredMyTasks.map((task) => <TaskRow key={task.id} task={task} />)}
            </div>
          )}
        </div>

        <div className="rounded-3xl border border-slate-200/70 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-start justify-between gap-4">
            <div>
              <h3 className="text-lg font-semibold tracking-tight text-slate-900">Tasks Per User</h3>
              <p className="mt-1 text-xs font-medium text-slate-500">Assigned workload across visible projects</p>
            </div>
            <div className="rounded-2xl bg-emerald-50 p-2.5 text-emerald-600 ring-1 ring-emerald-100">
              <CheckSquare size={14} />
            </div>
          </div>
          {tasksPerUserData.length === 0 ? (
            <div className="py-8 text-center">
              <CheckSquare size={28} className="mx-auto text-slate-200 mb-2" />
              <p className="text-sm text-slate-400">No assigned tasks yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {tasksPerUserData.map((item) => {
                const max = Math.max(...tasksPerUserData.map((row) => row.count), 1);
                return (
                  <div key={item.id}>
                    <div className="mb-1.5 flex items-center justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-2">
                        <div
                          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white"
                          style={{ backgroundColor: item.color }}
                        >
                          {getInitials(item.name)}
                        </div>
                        <span className="truncate text-sm font-medium text-slate-700">{item.name}</span>
                      </div>
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">
                        {item.count}
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full bg-emerald-500 transition-all"
                        style={{ width: `${Math.max((item.count / max) * 100, 8)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="rounded-3xl border border-slate-200/70 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-start justify-between gap-4">
            <div>
              <h3 className="text-lg font-semibold tracking-tight text-slate-900">Recent Activity</h3>
              <p className="mt-1 text-xs font-medium text-slate-500">Latest updates across your projects</p>
            </div>
            <div className="rounded-2xl bg-slate-50 p-2.5 text-slate-400 ring-1 ring-slate-100">
              <Clock size={14} />
            </div>
          </div>
          {activity.length === 0 ? (
            <div className="py-8 text-center">
              <Clock size={28} className="mx-auto text-slate-200 mb-2" />
              <p className="text-sm text-slate-400">No activity yet</p>
            </div>
          ) : (
            <div className="space-y-2">
              {activity.map((item) => (
                <div key={item.id} className="flex items-start gap-3 rounded-2xl px-2.5 py-2 transition-colors hover:bg-slate-50">
                  <div
                    className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white ring-2 ring-white"
                    style={{ backgroundColor: getAvatarColor(item.profile?.full_name || 'U') }}
                  >
                    {getInitials(item.profile?.full_name || 'U')}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-slate-700">
                      <span className="font-medium">{item.profile?.full_name || 'Someone'}</span>{' '}
                      {item.action}
                      {(item.meta as { title?: string })?.title && (
                        <> &ldquo;{(item.meta as { title: string }).title}&rdquo;</>
                      )}
                    </p>
                    <p className="text-xs text-slate-400 mt-0.5">{formatRelative(item.created_at)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
