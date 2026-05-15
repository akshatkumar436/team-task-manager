DROP POLICY IF EXISTS "Project members can view project" ON public.projects;
DROP POLICY IF EXISTS "Project owners can view own project" ON public.projects;
DROP POLICY IF EXISTS "Project admins can update project" ON public.projects;
DROP POLICY IF EXISTS "Project admins can delete project" ON public.projects;

DROP POLICY IF EXISTS "Project members can view members" ON public.project_members;
DROP POLICY IF EXISTS "Allow self or admin to insert members" ON public.project_members;
DROP POLICY IF EXISTS "Project admins can delete members" ON public.project_members;

DROP POLICY IF EXISTS "Project members can view tasks" ON public.tasks;
DROP POLICY IF EXISTS "Project members can create tasks" ON public.tasks;
DROP POLICY IF EXISTS "Project members can update tasks" ON public.tasks;
DROP POLICY IF EXISTS "Task creator or admin can delete tasks" ON public.tasks;

DROP POLICY IF EXISTS "Project members can view activity" ON public.activity_log;

CREATE OR REPLACE FUNCTION public.is_project_owner(
  target_project_id uuid,
  target_user_id uuid DEFAULT auth.uid()
)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.projects
    WHERE id = target_project_id
      AND owner_id = target_user_id
  );
$$;

CREATE OR REPLACE FUNCTION public.is_project_member(
  target_project_id uuid,
  target_user_id uuid DEFAULT auth.uid()
)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.project_members
    WHERE project_id = target_project_id
      AND user_id = target_user_id
  );
$$;

CREATE OR REPLACE FUNCTION public.is_project_admin(
  target_project_id uuid,
  target_user_id uuid DEFAULT auth.uid()
)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.project_members
    WHERE project_id = target_project_id
      AND user_id = target_user_id
      AND role = 'admin'
  );
$$;

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

INSERT INTO public.project_members (project_id, user_id, role)
SELECT id, owner_id, 'admin'
FROM public.projects
ON CONFLICT (project_id, user_id) DO UPDATE
  SET role = 'admin';

CREATE POLICY "Project members can view project"
ON public.projects FOR SELECT
TO authenticated
USING (public.is_project_member(id) OR public.is_project_owner(id));

CREATE POLICY "Project owners can view own project"
ON public.projects FOR SELECT
TO authenticated
USING (owner_id = auth.uid());

CREATE POLICY "Project admins can update project"
ON public.projects FOR UPDATE
TO authenticated
USING (public.is_project_admin(id) OR public.is_project_owner(id))
WITH CHECK (public.is_project_admin(id) OR public.is_project_owner(id));

CREATE POLICY "Project admins can delete project"
ON public.projects FOR DELETE
TO authenticated
USING (public.is_project_admin(id) OR public.is_project_owner(id));

CREATE POLICY "Project members can view members"
ON public.project_members FOR SELECT
TO authenticated
USING (public.is_project_member(project_id) OR public.is_project_owner(project_id));

CREATE POLICY "Allow self or admin to insert members"
ON public.project_members FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid()
  OR public.is_project_admin(project_id)
  OR public.is_project_owner(project_id)
);

CREATE POLICY "Project admins can delete members"
ON public.project_members FOR DELETE
TO authenticated
USING (
  user_id = auth.uid()
  OR public.is_project_admin(project_id)
  OR public.is_project_owner(project_id)
);

CREATE POLICY "Project members can view tasks"
ON public.tasks FOR SELECT
TO authenticated
USING (public.is_project_member(project_id) OR public.is_project_owner(project_id));

CREATE POLICY "Project members can create tasks"
ON public.tasks FOR INSERT
TO authenticated
WITH CHECK (
  created_by = auth.uid()
  AND (public.is_project_member(project_id) OR public.is_project_owner(project_id))
);

CREATE POLICY "Project members can update tasks"
ON public.tasks FOR UPDATE
TO authenticated
USING (public.is_project_member(project_id) OR public.is_project_owner(project_id))
WITH CHECK (public.is_project_member(project_id) OR public.is_project_owner(project_id));

CREATE POLICY "Task creator or admin can delete tasks"
ON public.tasks FOR DELETE
TO authenticated
USING (
  created_by = auth.uid()
  OR public.is_project_admin(project_id)
  OR public.is_project_owner(project_id)
);

CREATE POLICY "Project members can view activity"
ON public.activity_log FOR SELECT
TO authenticated
USING (
  project_id IS NULL
  OR public.is_project_member(project_id)
  OR public.is_project_owner(project_id)
);
