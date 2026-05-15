import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Plus, Search, FolderKanban, Users, CheckSquare } from 'lucide-react';
import { useProjects } from '../contexts/ProjectContext';
import CreateProjectModal from '../components/projects/CreateProjectModal';
import type { ProjectWithMeta } from '../lib/database.types';

function ProjectCard({ project }: { project: ProjectWithMeta }) {
  const pct = project.task_count > 0
    ? Math.round((project.completed_count / project.task_count) * 100)
    : 0;

  return (
    <Link to={`/projects/${project.id}`}>
      <motion.div
        whileHover={{ y: -2 }}
        transition={{ duration: 0.15 }}
        className="bg-white rounded-xl border border-slate-100 p-5 hover:shadow-md hover:border-slate-200 transition-all cursor-pointer"
      >
        <div className="flex items-start gap-3 mb-4">
          <div
            className="w-9 h-9 rounded-lg shrink-0"
            style={{ backgroundColor: project.color }}
          />
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold text-slate-800 truncate">{project.name}</h3>
            <p className="text-xs text-slate-400 mt-0.5 line-clamp-2">{project.description || 'No description'}</p>
          </div>
        </div>

        <div className="mb-3">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs text-slate-400">{pct}% complete</span>
            <span className="text-xs text-slate-400">{project.completed_count}/{project.task_count} tasks</span>
          </div>
          <div className="h-1 bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${pct}%`, backgroundColor: project.color }}
            />
          </div>
        </div>

        <div className="flex items-center gap-4 pt-2 border-t border-slate-50">
          <div className="flex items-center gap-1.5 text-xs text-slate-400">
            <Users size={12} />
            <span>{project.member_count} member{project.member_count !== 1 ? 's' : ''}</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-slate-400">
            <CheckSquare size={12} />
            <span>{project.task_count} task{project.task_count !== 1 ? 's' : ''}</span>
          </div>
        </div>
      </motion.div>
    </Link>
  );
}

export default function ProjectsPage() {
  const { projects, loadingProjects } = useProjects();
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);

  const filtered = projects.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-5 lg:p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">Projects</h1>
          <p className="text-sm text-slate-400 mt-0.5">
            {projects.length} project{projects.length !== 1 ? 's' : ''}
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-3.5 py-2 rounded-lg transition-colors"
        >
          <Plus size={15} />
          New Project
        </button>
      </div>

      <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-lg px-3.5 py-2.5 mb-6 max-w-sm">
        <Search size={14} className="text-slate-400" />
        <input
          type="text"
          placeholder="Search projects..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="bg-transparent text-sm text-slate-700 placeholder-slate-400 outline-none flex-1"
        />
      </div>

      {loadingProjects ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="bg-white rounded-xl border border-slate-100 p-5 h-40 animate-pulse">
              <div className="flex gap-3 mb-4">
                <div className="w-9 h-9 bg-slate-100 rounded-lg" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 bg-slate-100 rounded w-32" />
                  <div className="h-2 bg-slate-100 rounded w-24" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center mb-3">
            <FolderKanban size={22} className="text-slate-400" />
          </div>
          <h3 className="text-sm font-semibold text-slate-700 mb-1">
            {search ? 'No projects found' : 'No projects yet'}
          </h3>
          <p className="text-xs text-slate-400 mb-5">
            {search ? 'Try a different search term' : 'Create your first project to get started'}
          </p>
          {!search && (
            <button
              onClick={() => setShowCreate(true)}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
            >
              <Plus size={14} />
              Create Project
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((project, i) => (
            <motion.div
              key={project.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
            >
              <ProjectCard project={project} />
            </motion.div>
          ))}
        </div>
      )}

      {showCreate && <CreateProjectModal onClose={() => setShowCreate(false)} />}
    </div>
  );
}
