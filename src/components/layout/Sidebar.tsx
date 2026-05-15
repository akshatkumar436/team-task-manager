import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Layers,
  LayoutDashboard,
  FolderKanban,
  CheckSquare,
  Settings,
  ChevronLeft,
  ChevronRight,
  Plus,
  LogOut,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useProjects } from '../../contexts/ProjectContext';
import CreateProjectModal from '../projects/CreateProjectModal';
import { getInitials, getAvatarColor } from '../../lib/utils';

interface SidebarProps {
  mobileOpen: boolean;
  onClose: () => void;
}

export default function Sidebar({ mobileOpen, onClose }: SidebarProps) {
  const { profile, signOut } = useAuth();
  const { projects } = useProjects();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);
  const [showCreateProject, setShowCreateProject] = useState(false);

  const navItems = [
    { icon: LayoutDashboard, label: 'Dashboard', to: '/dashboard' },
    { icon: FolderKanban, label: 'Projects', to: '/projects' },
    { icon: CheckSquare, label: 'My Tasks', to: '/tasks' },
    { icon: Settings, label: 'Settings', to: '/settings' },
  ];

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  const sidebarContent = (
    <div className="flex h-full flex-col">
      <div className={`flex h-16 items-center border-b border-white/10 px-4 ${collapsed ? 'justify-center' : 'gap-2.5'}`}>
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-cyan-400 shadow-lg shadow-blue-950/30">
          <Layers size={15} className="text-white" />
        </div>
        <AnimatePresence>
          {!collapsed && (
            <motion.span
              initial={{ opacity: 0, width: 0 }}
              animate={{ opacity: 1, width: 'auto' }}
              exit={{ opacity: 0, width: 0 }}
              transition={{ duration: 0.15 }}
              className="overflow-hidden whitespace-nowrap text-lg font-semibold tracking-tight text-white"
            >
              Planify
            </motion.span>
          )}
        </AnimatePresence>
        <button
          onClick={() => setCollapsed((c) => !c)}
          className="ml-auto hidden rounded-lg p-1 text-slate-400 transition-colors hover:bg-white/10 hover:text-white lg:flex"
        >
          {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
        </button>
      </div>

      <nav className="scrollbar-hide flex-1 space-y-1 overflow-y-auto px-2 py-4">
        {navItems.map(({ icon: Icon, label, to }) => (
          <NavLink
            key={to}
            to={to}
            onClick={onClose}
            className={({ isActive }) =>
              `relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all ${
                collapsed ? 'justify-center' : ''
              } ${
                isActive
                  ? 'bg-white/10 text-white shadow-sm ring-1 ring-white/10'
                  : 'text-slate-400 hover:bg-white/5 hover:text-white'
              }`
            }
          >
            {({ isActive }) => (
              <>
                {isActive && !collapsed && (
                  <span className="absolute left-0 top-1/2 h-6 w-1 -translate-y-1/2 rounded-r-full bg-cyan-300" />
                )}
                <Icon size={16} className={isActive ? 'text-cyan-300' : ''} />
                <AnimatePresence>
                  {!collapsed && (
                    <motion.span
                      initial={{ opacity: 0, width: 0 }}
                      animate={{ opacity: 1, width: 'auto' }}
                      exit={{ opacity: 0, width: 0 }}
                      transition={{ duration: 0.15 }}
                      className="overflow-hidden whitespace-nowrap"
                    >
                      {label}
                    </motion.span>
                  )}
                </AnimatePresence>
              </>
            )}
          </NavLink>
        ))}

        {!collapsed && projects.length > 0 && (
          <div className="pt-4">
            <div className="mb-2 flex items-center justify-between px-3">
              <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Projects</span>
              <button
                onClick={() => setShowCreateProject(true)}
                className="rounded-md p-1 text-slate-500 transition-colors hover:bg-white/10 hover:text-white"
              >
                <Plus size={14} />
              </button>
            </div>
            <div className="space-y-1 rounded-2xl bg-black/10 p-1 ring-1 ring-white/5">
              {projects.slice(0, 6).map((project) => (
                <NavLink
                  key={project.id}
                  to={`/projects/${project.id}`}
                  onClick={onClose}
                  className={({ isActive }) =>
                    `flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm transition-colors ${
                      isActive ? 'bg-white/10 text-white ring-1 ring-white/10' : 'text-slate-400 hover:bg-white/5 hover:text-white'
                    }`
                  }
                >
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: project.color }}
                  />
                  <span className="truncate">{project.name}</span>
                </NavLink>
              ))}
            </div>
          </div>
        )}
      </nav>

      <div className={`border-t border-white/10 p-3 ${collapsed ? '' : ''}`}>
        {!collapsed ? (
          <div className="flex items-center gap-2.5 rounded-2xl bg-white/[0.04] p-2 ring-1 ring-white/10">
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-medium shrink-0"
              style={{ backgroundColor: getAvatarColor(profile?.full_name || 'U') }}
            >
              {getInitials(profile?.full_name || 'User')}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white text-xs font-medium truncate">{profile?.full_name || 'User'}</p>
              <p className="text-slate-500 text-xs truncate">{profile?.email}</p>
            </div>
            <button
              onClick={handleSignOut}
              className="rounded-lg p-1 text-slate-500 transition-colors hover:bg-white/10 hover:text-white"
              title="Sign out"
            >
              <LogOut size={14} />
            </button>
          </div>
        ) : (
          <button
            onClick={handleSignOut}
            className="flex w-full items-center justify-center rounded-lg p-2 text-slate-500 transition-colors hover:bg-white/10 hover:text-white"
          >
            <LogOut size={14} />
          </button>
        )}
      </div>
    </div>
  );

  return (
    <>
      <motion.aside
        animate={{ width: collapsed ? 56 : 220 }}
        transition={{ duration: 0.2 }}
        className="hidden shrink-0 flex-col overflow-hidden border-r border-slate-800 bg-[#07111f] lg:flex"
      >
        {sidebarContent}
      </motion.aside>

      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={onClose}
              className="lg:hidden fixed inset-0 bg-black/50 z-40"
            />
            <motion.aside
              initial={{ x: -240 }}
              animate={{ x: 0 }}
              exit={{ x: -240 }}
              transition={{ type: 'spring', damping: 28, stiffness: 300 }}
              className="fixed bottom-0 left-0 top-0 z-50 flex w-60 flex-col bg-[#07111f] lg:hidden"
            >
              {sidebarContent}
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {showCreateProject && <CreateProjectModal onClose={() => setShowCreateProject(false)} />}
    </>
  );
}
