import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus, ArrowLeft, Trash2, UserPlus,
  Search,
} from 'lucide-react';
import { useProjects } from '../contexts/ProjectContext';
import { useTasks } from '../contexts/TaskContext';
import { useAuth } from '../contexts/AuthContext';
import KanbanBoard from '../components/tasks/KanbanBoard';
import TaskModal from '../components/tasks/TaskModal';
import type { TaskPriority, TaskStatus } from '../lib/database.types';
import { getInitials, getAvatarColor, PRIORITY_CONFIG, normalizeWorkflowStatus } from '../lib/utils';
import toast from 'react-hot-toast';

type Tab = 'board' | 'members' | 'settings';

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { currentProject, members, fetchProject, updateProject, deleteProject, inviteMember, removeMember } =
    useProjects();
  const { tasks, fetchTasks, loadingTasks } = useTasks();
  const [activeTab, setActiveTab] = useState<Tab>('board');
  const [newTaskOpen, setNewTaskOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviting, setInviting] = useState(false);
  const [taskSearch, setTaskSearch] = useState('');
  const [filterPriority, setFilterPriority] = useState<TaskPriority | ''>('');
  const [filterStatus, setFilterStatus] = useState<TaskStatus | ''>('');
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState('');

  const isAdmin = members.find((m) => m.user_id === user?.id)?.role === 'admin';

  useEffect(() => {
    if (id) {
      fetchProject(id);
      fetchTasks(id);
    }
  }, [id, fetchProject, fetchTasks]);

  useEffect(() => {
    if (currentProject) {
      setNameValue(currentProject.name);
    }
  }, [currentProject]);

  const handleInvite = async () => {
    if (!inviteEmail.trim() || !id) return;
    setInviting(true);
    await inviteMember(id, inviteEmail.trim());
    setInviting(false);
    setInviteEmail('');
  };

  const handleDeleteProject = async () => {
    if (!id) return;
    if (window.confirm(`Delete "${currentProject?.name}"? This will remove all tasks.`)) {
      await deleteProject(id);
      toast.success('Project deleted');
      navigate('/projects');
    }
  };

  const handleSaveName = async () => {
    if (!id || !nameValue.trim()) return;
    await updateProject(id, { name: nameValue });
    setEditingName(false);
    toast.success('Project updated');
  };

  if (!currentProject) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-slate-100 rounded w-48" />
          <div className="h-4 bg-slate-100 rounded w-96" />
        </div>
      </div>
    );
  }

  const pct = currentProject.task_count > 0
    ? Math.round((currentProject.completed_count / currentProject.task_count) * 100)
    : 0;

  const filteredTasks = tasks.filter((task) => {
    const query = taskSearch.trim().toLowerCase();
    const matchesSearch = !query
      || task.title.toLowerCase().includes(query)
      || task.description.toLowerCase().includes(query)
      || task.tags.some((tag) => tag.toLowerCase().includes(query));
    const matchesPriority = !filterPriority || task.priority === filterPriority;
    const matchesStatus = !filterStatus || normalizeWorkflowStatus(task.status) === filterStatus;
    return matchesSearch && matchesPriority && matchesStatus;
  });

  return (
    <div className="flex flex-col h-full">
      <div className="bg-white border-b border-slate-100 px-5 lg:px-6 pt-5 pb-0">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/projects')}
              className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
            >
              <ArrowLeft size={16} />
            </button>
            <div
              className="w-8 h-8 rounded-lg shrink-0"
              style={{ backgroundColor: currentProject.color }}
            />
            <div>
              {editingName && isAdmin ? (
                <input
                  value={nameValue}
                  onChange={(e) => setNameValue(e.target.value)}
                  onBlur={handleSaveName}
                  onKeyDown={(e) => e.key === 'Enter' && handleSaveName()}
                  className="text-base font-semibold text-slate-900 outline-none border-b-2 border-blue-500 bg-transparent"
                  autoFocus
                />
              ) : (
                <h1
                  className={`text-base font-semibold text-slate-900 ${isAdmin ? 'cursor-pointer hover:text-blue-600' : ''}`}
                  onClick={() => isAdmin && setEditingName(true)}
                >
                  {currentProject.name}
                </h1>
              )}
              <p className="text-xs text-slate-400">{currentProject.description || 'No description'}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="hidden sm:flex items-center -space-x-1.5">
              {members.slice(0, 4).map((m) => (
                <div
                  key={m.id}
                  className="w-6 h-6 rounded-full border-2 border-white flex items-center justify-center text-white text-xs font-medium"
                  style={{ backgroundColor: getAvatarColor(m.profile.full_name) }}
                  title={m.profile.full_name}
                >
                  {getInitials(m.profile.full_name)}
                </div>
              ))}
              {members.length > 4 && (
                <div className="w-6 h-6 rounded-full border-2 border-white bg-slate-200 flex items-center justify-center text-xs text-slate-500">
                  +{members.length - 4}
                </div>
              )}
            </div>

            {isAdmin && (
              <button
                onClick={() => setNewTaskOpen(true)}
                className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium px-3 py-1.5 rounded-lg transition-colors"
              >
                <Plus size={13} />
                Add Task
              </button>
            )}
          </div>
        </div>

        <div className="mb-4">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
            <span>{currentProject.completed_count} of {currentProject.task_count} tasks done</span>
            <span>{pct}%</span>
          </div>
          <div className="h-1 bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ width: `${pct}%`, backgroundColor: currentProject.color }}
            />
          </div>
        </div>

        <div className="flex gap-0 -mb-px">
          {((isAdmin ? ['board', 'members', 'settings'] : ['board', 'members']) as Tab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors capitalize ${
                activeTab === tab
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              {tab === 'board' ? 'Board' : tab === 'members' ? `Members (${members.length})` : 'Settings'}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-hidden">
        <AnimatePresence mode="wait">
          {activeTab === 'board' && (
            <motion.div
              key="board"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="h-full overflow-auto p-5 lg:p-6"
            >
              <div className="flex items-center gap-2 mb-4 flex-wrap">
                <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-lg px-3 py-1.5">
                  <Search size={12} className="text-slate-400" />
                  <input
                    value={taskSearch}
                    onChange={(e) => setTaskSearch(e.target.value)}
                    placeholder="Search tasks"
                    className="w-40 bg-transparent text-xs text-slate-600 placeholder-slate-400 outline-none"
                  />
                </div>
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value as TaskStatus | '')}
                  className="text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white text-slate-600 outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">All statuses</option>
                  {(['todo', 'in_progress', 'done'] as TaskStatus[]).map((status) => (
                    <option key={status} value={status}>
                      {status === 'todo' ? 'To Do' : status === 'in_progress' ? 'In Progress' : 'Done'}
                    </option>
                  ))}
                </select>
                <select
                  value={filterPriority}
                  onChange={(e) => setFilterPriority(e.target.value as TaskPriority | '')}
                  className="text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white text-slate-600 outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">All priorities</option>
                  {(['low', 'medium', 'high', 'urgent'] as const).map((p) => (
                    <option key={p} value={p}>{PRIORITY_CONFIG[p].label}</option>
                  ))}
                </select>
                <div className="text-xs text-slate-400 ml-2">
                  {filteredTasks.length} of {tasks.length} task{tasks.length !== 1 ? 's' : ''}
                </div>
              </div>

              {loadingTasks ? (
                <div className="flex gap-3">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="w-64 shrink-0">
                      <div className="h-8 bg-white rounded-t-xl border animate-pulse mb-0.5" />
                      <div className="bg-slate-50 rounded-b-xl border border-t-0 p-2 space-y-2 min-h-32">
                        {i < 2 && <div className="h-20 bg-white rounded-lg border animate-pulse" />}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <KanbanBoard
                  projectId={currentProject.id}
                  members={members}
                  tasks={filteredTasks}
                  currentUserId={user?.id}
                  isAdmin={Boolean(isAdmin)}
                />
              )}
            </motion.div>
          )}

          {activeTab === 'members' && (
            <motion.div
              key="members"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="p-5 lg:p-6 max-w-2xl"
            >
              {isAdmin && (
                <div className="bg-white rounded-xl border border-slate-100 p-4 mb-5">
                  <h3 className="text-sm font-medium text-slate-800 mb-3">Invite member</h3>
                  <div className="flex gap-2">
                    <input
                      type="email"
                      placeholder="colleague@company.com"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleInvite()}
                      className="flex-1 text-sm border border-slate-200 rounded-lg px-3.5 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition placeholder-slate-400"
                    />
                    <button
                      onClick={handleInvite}
                      disabled={inviting || !inviteEmail.trim()}
                      className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
                    >
                      {inviting ? (
                        <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <>
                          <UserPlus size={13} />
                          Invite
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}

              <div className="bg-white rounded-xl border border-slate-100 overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-100">
                  <h3 className="text-sm font-medium text-slate-800">Team members</h3>
                </div>
                <div className="divide-y divide-slate-50">
                  {members.map((member) => (
                    <div key={member.id} className="flex items-center gap-3 px-4 py-3">
                      <div
                        className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-medium shrink-0"
                        style={{ backgroundColor: getAvatarColor(member.profile.full_name) }}
                      >
                        {getInitials(member.profile.full_name)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-800">{member.profile.full_name}</p>
                        <p className="text-xs text-slate-400">{member.profile.email}</p>
                      </div>
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          member.role === 'admin'
                            ? 'bg-blue-50 text-blue-600'
                            : 'bg-slate-100 text-slate-500'
                        }`}
                      >
                        {member.role}
                      </span>
                      {isAdmin && member.user_id !== user?.id && (
                        <button
                          onClick={() => id && removeMember(id, member.user_id)}
                          className="text-slate-300 hover:text-red-500 p-1 rounded transition-colors ml-1"
                          title="Remove member"
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'settings' && (
            <motion.div
              key="settings"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="p-5 lg:p-6 max-w-xl"
            >
              <div className="bg-white rounded-xl border border-slate-100 p-5 mb-4">
                <h3 className="text-sm font-medium text-slate-800 mb-4">Project details</h3>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1.5">Name</label>
                    <input
                      value={nameValue}
                      onChange={(e) => setNameValue(e.target.value)}
                      disabled={!isAdmin}
                      className="w-full text-sm border border-slate-200 rounded-lg px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition disabled:bg-slate-50 disabled:text-slate-400"
                    />
                  </div>
                  {isAdmin && (
                    <button
                      onClick={handleSaveName}
                      className="text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg transition-colors"
                    >
                      Save changes
                    </button>
                  )}
                </div>
              </div>

              {isAdmin && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-5">
                  <h3 className="text-sm font-semibold text-red-800 mb-1">Danger zone</h3>
                  <p className="text-xs text-red-600 mb-3">Once deleted, this project and all its tasks cannot be recovered.</p>
                  <button
                    onClick={handleDeleteProject}
                    className="flex items-center gap-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 px-4 py-2 rounded-lg transition-colors"
                  >
                    <Trash2 size={14} />
                    Delete project
                  </button>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {newTaskOpen && (
        <TaskModal
          task={null}
          projectId={currentProject.id}
          members={members}
          defaultStatus={'todo' as TaskStatus}
          isAdmin={Boolean(isAdmin)}
          currentUserId={user?.id}
          onClose={() => setNewTaskOpen(false)}
        />
      )}
    </div>
  );
}
