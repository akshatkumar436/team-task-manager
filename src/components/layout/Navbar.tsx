import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown, LogOut, Menu, Settings, User } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { getAvatarColor, getInitials } from '../../lib/utils';

interface NavbarProps {
  onMenuClick: () => void;
  title?: string;
}

export default function Navbar({ onMenuClick, title }: NavbarProps) {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSignOut = async () => {
    await signOut();
    navigate('/login', { replace: true });
  };

  const displayName = profile?.full_name || 'User';

  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b border-slate-100 bg-white px-4">
      <button
        onClick={onMenuClick}
        className="rounded-md p-1.5 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 lg:hidden"
        aria-label="Open navigation"
      >
        <Menu size={18} />
      </button>

      {title && <h1 className="text-sm font-semibold text-slate-800">{title}</h1>}

      <div className="flex-1" />

      <div className="relative" ref={dropdownRef}>
        <button
          onClick={() => setDropdownOpen((open) => !open)}
          className="flex items-center gap-2 rounded-lg px-2 py-1.5 transition-colors hover:bg-slate-50"
          aria-expanded={dropdownOpen}
          aria-haspopup="menu"
        >
          <div
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-medium text-white"
            style={{ backgroundColor: getAvatarColor(displayName) }}
          >
            {getInitials(displayName)}
          </div>
          <div className="hidden text-left sm:block">
            <p className="text-xs font-medium leading-none text-slate-700">{displayName}</p>
          </div>
          <ChevronDown size={12} className="hidden text-slate-400 sm:block" />
        </button>

        <AnimatePresence>
          {dropdownOpen && (
            <motion.div
              initial={{ opacity: 0, y: 6, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 6, scale: 0.97 }}
              transition={{ duration: 0.12 }}
              className="absolute right-0 top-full z-50 mt-1.5 w-52 rounded-xl border border-slate-100 bg-white py-1.5 shadow-lg"
              role="menu"
            >
              <div className="border-b border-slate-100 px-3.5 py-2.5">
                <p className="text-sm font-medium text-slate-800">{displayName}</p>
                <p className="mt-0.5 truncate text-xs text-slate-400">{profile?.email}</p>
              </div>
              <div className="py-1">
                <button
                  onClick={() => {
                    navigate('/settings');
                    setDropdownOpen(false);
                  }}
                  className="flex w-full items-center gap-2.5 px-3.5 py-2 text-sm text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-900"
                  role="menuitem"
                >
                  <User size={14} className="text-slate-400" />
                  Profile
                </button>
                <button
                  onClick={() => {
                    navigate('/settings');
                    setDropdownOpen(false);
                  }}
                  className="flex w-full items-center gap-2.5 px-3.5 py-2 text-sm text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-900"
                  role="menuitem"
                >
                  <Settings size={14} className="text-slate-400" />
                  Settings
                </button>
              </div>
              <div className="border-t border-slate-100 py-1">
                <button
                  onClick={handleSignOut}
                  className="flex w-full items-center gap-2.5 px-3.5 py-2 text-sm text-red-500 transition-colors hover:bg-red-50"
                  role="menuitem"
                >
                  <LogOut size={14} />
                  Sign out
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </header>
  );
}
