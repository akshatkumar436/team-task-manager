import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import type { Project, ProjectWithMeta, ProjectMember, Profile } from '../lib/database.types';
import { useAuth } from './AuthContext';
import toast from 'react-hot-toast';

interface ProjectContextType {
  projects: ProjectWithMeta[];
  currentProject: ProjectWithMeta | null;
  members: (ProjectMember & { profile: Profile })[];
  loadingProjects: boolean;
  fetchProjects: () => Promise<void>;
  fetchProject: (id: string) => Promise<void>;
  createProject: (data: { name: string; description: string; color: string }) => Promise<Project | null>;
  updateProject: (id: string, data: Partial<Project>) => Promise<void>;
  deleteProject: (id: string) => Promise<void>;
  inviteMember: (projectId: string, email: string) => Promise<void>;
  removeMember: (projectId: string, userId: string) => Promise<void>;
}

const ProjectContext = createContext<ProjectContextType | undefined>(undefined);

export function ProjectProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [projects, setProjects] = useState<ProjectWithMeta[]>([]);
  const [currentProject, setCurrentProject] = useState<ProjectWithMeta | null>(null);
  const [members, setMembers] = useState<(ProjectMember & { profile: Profile })[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(false);

  const enrichProjects = async (projectRows: Project[]): Promise<ProjectWithMeta[]> => {
    return Promise.all(
      projectRows.map(async (p) => {
        const [{ count: memberCount }, { count: taskCount }, { count: completedCount }] = await Promise.all([
          supabase.from('project_members').select('*', { count: 'exact', head: true }).eq('project_id', p.id),
          supabase.from('tasks').select('*', { count: 'exact', head: true }).eq('project_id', p.id),
          supabase.from('tasks').select('*', { count: 'exact', head: true }).eq('project_id', p.id).eq('status', 'done'),
        ]);
        return {
          ...p,
          member_count: memberCount ?? 0,
          task_count: taskCount ?? 0,
          completed_count: completedCount ?? 0,
        };
      })
    );
  };

  const fetchProjects = useCallback(async () => {
    if (!user) {
      setProjects([]);
      setCurrentProject(null);
      setMembers([]);
      return;
    }

    setLoadingProjects(true);
    try {
      const [{ data: memberRows, error: memberError }, { data: ownedProjects, error: ownerError }] =
        await Promise.all([
          supabase
            .from('project_members')
            .select('project_id')
            .eq('user_id', user.id),
          supabase
            .from('projects')
            .select('*')
            .eq('owner_id', user.id),
        ]);

      if (memberError) throw memberError;
      if (ownerError) throw ownerError;

      const projectIds = Array.from(new Set((memberRows ?? []).map((r) => r.project_id)));
      if (projectIds.length === 0) {
        setProjects(await enrichProjects(ownedProjects ?? []));
        setLoadingProjects(false);
        return;
      }

      const { data: projectData, error: projectError } = await supabase
        .from('projects')
        .select('*')
        .in('id', projectIds)
        .order('updated_at', { ascending: false });

      if (projectError) throw projectError;

      if (!projectData) {
        setProjects([]);
        setLoadingProjects(false);
        return;
      }

      const mergedProjects = [...(projectData ?? []), ...(ownedProjects ?? [])].filter(
        (project, index, all) => all.findIndex((candidate) => candidate.id === project.id) === index
      );
      const enriched = await enrichProjects(mergedProjects);

      setProjects(enriched);
    } catch {
      toast.error('Unable to load projects');
      setProjects([]);
    } finally {
      setLoadingProjects(false);
    }
  }, [user]);

  const fetchProject = useCallback(async (id: string) => {
    const { data: p, error } = await supabase.from('projects').select('*').eq('id', id).maybeSingle();
    if (error) {
      toast.error('Unable to load project');
      setCurrentProject(null);
      return;
    }

    if (!p) return;

    const [{ count: memberCount }, { count: taskCount }, { count: completedCount }, { data: memberData }] =
      await Promise.all([
        supabase.from('project_members').select('*', { count: 'exact', head: true }).eq('project_id', id),
        supabase.from('tasks').select('*', { count: 'exact', head: true }).eq('project_id', id),
        supabase.from('tasks').select('*', { count: 'exact', head: true }).eq('project_id', id).eq('status', 'done'),
        supabase.from('project_members').select('*, profile:profiles(*)').eq('project_id', id),
      ]);

    const enriched: ProjectWithMeta = {
      ...p,
      member_count: memberCount ?? 0,
      task_count: taskCount ?? 0,
      completed_count: completedCount ?? 0,
      members: (memberData as (ProjectMember & { profile: Profile })[]) ?? [],
    };

    setCurrentProject(enriched);
    setMembers((memberData as (ProjectMember & { profile: Profile })[]) ?? []);
  }, []);

  const createProject = useCallback(
    async (data: { name: string; description: string; color: string }): Promise<Project | null> => {
      if (!user) return null;
      const { data: project, error } = await supabase
        .from('projects')
        .insert({ ...data, owner_id: user.id })
        .select()
        .single();

      if (error || !project) {
        toast.error(error?.message || 'Failed to create project');
        return null;
      }

      await supabase.from('activity_log').insert({
        project_id: project.id,
        user_id: user.id,
        action: 'created project',
        entity_type: 'project',
        entity_id: project.id,
        meta: { name: project.name },
      });

      await fetchProjects();
      return project;
    },
    [user, fetchProjects]
  );

  const updateProject = useCallback(
    async (id: string, data: Partial<Project>) => {
      const { error } = await supabase.from('projects').update({ ...data, updated_at: new Date().toISOString() }).eq('id', id);
      if (error) {
        toast.error('Failed to update project');
        return;
      }
      await fetchProjects();
      if (currentProject?.id === id) await fetchProject(id);
    },
    [fetchProjects, fetchProject, currentProject]
  );

  const deleteProject = useCallback(
    async (id: string) => {
      const { error } = await supabase.from('projects').delete().eq('id', id);
      if (error) {
        toast.error('Failed to delete project');
        return;
      }
      setProjects((prev) => prev.filter((p) => p.id !== id));
      if (currentProject?.id === id) setCurrentProject(null);
    },
    [currentProject]
  );

  const inviteMember = useCallback(
    async (projectId: string, email: string) => {
      const { data: targetProfile } = await supabase
        .from('profiles')
        .select('*')
        .eq('email', email)
        .maybeSingle();

      if (!targetProfile) {
        toast.error('No user found with that email address');
        return;
      }

      const { error } = await supabase.from('project_members').insert({
        project_id: projectId,
        user_id: targetProfile.id,
        role: 'member',
      });

      if (error) {
        if (error.code === '23505') {
          toast.error('This user is already a member');
        } else {
          toast.error('Failed to invite member');
        }
        return;
      }

      if (user) {
        await supabase.from('activity_log').insert({
          project_id: projectId,
          user_id: user.id,
          action: 'invited member',
          entity_type: 'member',
          entity_id: targetProfile.id,
          meta: { email },
        });
      }

      await fetchProject(projectId);
      toast.success(`${targetProfile.full_name || email} added to project`);
    },
    [user, fetchProject]
  );

  const removeMember = useCallback(
    async (projectId: string, userId: string) => {
      await supabase.from('project_members').delete().eq('project_id', projectId).eq('user_id', userId);
      await fetchProject(projectId);
      toast.success('Member removed');
    },
    [fetchProject]
  );

  return (
    <ProjectContext.Provider
      value={{
        projects,
        currentProject,
        members,
        loadingProjects,
        fetchProjects,
        fetchProject,
        createProject,
        updateProject,
        deleteProject,
        inviteMember,
        removeMember,
      }}
    >
      {children}
    </ProjectContext.Provider>
  );
}

export function useProjects() {
  const ctx = useContext(ProjectContext);
  if (!ctx) throw new Error('useProjects must be used within ProjectProvider');
  return ctx;
}
