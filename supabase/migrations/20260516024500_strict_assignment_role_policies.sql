-- Final assignment-aligned role policies.
-- Run after:
-- 1. 20260514222852_create_core_tables_v1.sql
-- 2. 20260516013000_fix_project_membership_rls.sql

-- Keep the creator admin bootstrap behavior intact.
CREATE OR REPLACE FUNCTION public.handle_new_project()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.project_members (project_id, user_id, role)
  VALUES (NEW.id, NEW.owner_id, 'admin')
  ON CONFLICT (project_id, user_id) DO UPDATE
    SET role = 'admin';
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_project_created ON public.projects;
CREATE TRIGGER on_project_created
  AFTER INSERT ON public.projects
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_project();

-- Backfill admin membership for projects that already exist.
INSERT INTO public.project_members (project_id, user_id, role)
SELECT id, owner_id, 'admin'
FROM public.projects
ON CONFLICT (project_id, user_id) DO UPDATE
  SET role = 'admin';

-- Replace broad member-management policies with admin-only management.
DROP POLICY IF EXISTS "Allow self or admin to insert members" ON public.project_members;
DROP POLICY IF EXISTS "Project admins can insert members" ON public.project_members;
DROP POLICY IF EXISTS "Project admins can delete members" ON public.project_members;

CREATE POLICY "Project admins can insert members"
ON public.project_members FOR INSERT
TO authenticated
WITH CHECK (
  public.is_project_admin(project_id)
  OR public.is_project_owner(project_id)
);

CREATE POLICY "Project admins can delete members"
ON public.project_members FOR DELETE
TO authenticated
USING (
  public.is_project_admin(project_id)
  OR public.is_project_owner(project_id)
);

-- Replace broad task policies with assignment-specific member updates.
DROP POLICY IF EXISTS "Project members can create tasks" ON public.tasks;
DROP POLICY IF EXISTS "Project members can update tasks" ON public.tasks;
DROP POLICY IF EXISTS "Task creator or admin can delete tasks" ON public.tasks;
DROP POLICY IF EXISTS "Project admins can create tasks" ON public.tasks;
DROP POLICY IF EXISTS "Admins update any task, members update assigned task" ON public.tasks;
DROP POLICY IF EXISTS "Project admins can delete tasks" ON public.tasks;

CREATE POLICY "Project admins can create tasks"
ON public.tasks FOR INSERT
TO authenticated
WITH CHECK (
  created_by = auth.uid()
  AND (
    public.is_project_admin(project_id)
    OR public.is_project_owner(project_id)
  )
);

CREATE POLICY "Admins update any task, members update assigned task"
ON public.tasks FOR UPDATE
TO authenticated
USING (
  public.is_project_admin(project_id)
  OR public.is_project_owner(project_id)
  OR assigned_to = auth.uid()
)
WITH CHECK (
  public.is_project_admin(project_id)
  OR public.is_project_owner(project_id)
  OR assigned_to = auth.uid()
);

CREATE POLICY "Project admins can delete tasks"
ON public.tasks FOR DELETE
TO authenticated
USING (
  public.is_project_admin(project_id)
  OR public.is_project_owner(project_id)
);

-- Prevent members from editing task details through direct API calls.
-- Members may only move their assigned tasks through the workflow.
CREATE OR REPLACE FUNCTION public.prevent_member_task_detail_edits()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.is_project_admin(OLD.project_id) OR public.is_project_owner(OLD.project_id) THEN
    RETURN NEW;
  END IF;

  IF OLD.assigned_to = auth.uid() THEN
    IF NEW.project_id IS DISTINCT FROM OLD.project_id
      OR NEW.title IS DISTINCT FROM OLD.title
      OR NEW.description IS DISTINCT FROM OLD.description
      OR NEW.priority IS DISTINCT FROM OLD.priority
      OR NEW.due_date IS DISTINCT FROM OLD.due_date
      OR NEW.assigned_to IS DISTINCT FROM OLD.assigned_to
      OR NEW.created_by IS DISTINCT FROM OLD.created_by
      OR NEW.tags IS DISTINCT FROM OLD.tags THEN
      RAISE EXCEPTION 'Members can only update status and position for assigned tasks';
    END IF;

    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'Members can only update assigned tasks';
END;
$$;

DROP TRIGGER IF EXISTS enforce_member_task_detail_edits ON public.tasks;
CREATE TRIGGER enforce_member_task_detail_edits
  BEFORE UPDATE ON public.tasks
  FOR EACH ROW EXECUTE PROCEDURE public.prevent_member_task_detail_edits();
