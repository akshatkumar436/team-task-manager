CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL DEFAULT '',
  email text NOT NULL DEFAULT '',
  avatar_url text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read all profiles" ON profiles;
CREATE POLICY "Authenticated users can read all profiles"
  ON profiles FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE TABLE IF NOT EXISTS projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text DEFAULT '',
  color text DEFAULT '#3B82F6',
  owner_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS project_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member')),
  joined_at timestamptz DEFAULT now(),
  UNIQUE(project_id, user_id)
);

ALTER TABLE project_members ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_project_owner(target_project_id uuid, target_user_id uuid DEFAULT auth.uid())
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

CREATE OR REPLACE FUNCTION public.is_project_member(target_project_id uuid, target_user_id uuid DEFAULT auth.uid())
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

CREATE OR REPLACE FUNCTION public.is_project_admin(target_project_id uuid, target_user_id uuid DEFAULT auth.uid())
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

DROP POLICY IF EXISTS "Project members can view project" ON projects;
CREATE POLICY "Project members can view project"
  ON projects FOR SELECT
  TO authenticated
  USING (public.is_project_member(projects.id) OR public.is_project_owner(projects.id));

DROP POLICY IF EXISTS "Project owners can view own project" ON projects;
CREATE POLICY "Project owners can view own project"
  ON projects FOR SELECT
  TO authenticated
  USING (auth.uid() = owner_id);

DROP POLICY IF EXISTS "Authenticated users can create projects" ON projects;
CREATE POLICY "Authenticated users can create projects"
  ON projects FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = owner_id);

DROP POLICY IF EXISTS "Project admins can update project" ON projects;
CREATE POLICY "Project admins can update project"
  ON projects FOR UPDATE
  TO authenticated
  USING (public.is_project_admin(projects.id) OR public.is_project_owner(projects.id))
  WITH CHECK (public.is_project_admin(projects.id) OR public.is_project_owner(projects.id));

DROP POLICY IF EXISTS "Project admins can delete project" ON projects;
CREATE POLICY "Project admins can delete project"
  ON projects FOR DELETE
  TO authenticated
  USING (public.is_project_admin(projects.id) OR public.is_project_owner(projects.id));

DROP POLICY IF EXISTS "Project members can view members" ON project_members;
CREATE POLICY "Project members can view members"
  ON project_members FOR SELECT
  TO authenticated
  USING (public.is_project_member(project_id) OR public.is_project_owner(project_id));

DROP POLICY IF EXISTS "Allow self or admin to insert members" ON project_members;
CREATE POLICY "Allow self or admin to insert members"
  ON project_members FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    OR public.is_project_admin(project_id)
    OR public.is_project_owner(project_id)
  );

DROP POLICY IF EXISTS "Project admins can delete members" ON project_members;
CREATE POLICY "Project admins can delete members"
  ON project_members FOR DELETE
  TO authenticated
  USING (user_id = auth.uid() OR public.is_project_admin(project_id) OR public.is_project_owner(project_id));

CREATE TABLE IF NOT EXISTS tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text DEFAULT '',
  status text NOT NULL DEFAULT 'todo' CHECK (status IN ('backlog', 'todo', 'in_progress', 'review', 'done')),
  priority text NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  due_date date,
  assigned_to uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_by uuid NOT NULL REFERENCES profiles(id),
  tags text[] DEFAULT '{}',
  position int DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS tasks_project_id_idx ON tasks(project_id);
CREATE INDEX IF NOT EXISTS tasks_assigned_to_idx ON tasks(assigned_to);
CREATE INDEX IF NOT EXISTS tasks_status_idx ON tasks(status);

ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Project members can view tasks" ON tasks;
CREATE POLICY "Project members can view tasks"
  ON tasks FOR SELECT
  TO authenticated
  USING (public.is_project_member(tasks.project_id) OR public.is_project_owner(tasks.project_id));

DROP POLICY IF EXISTS "Project members can create tasks" ON tasks;
CREATE POLICY "Project members can create tasks"
  ON tasks FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = created_by
    AND (public.is_project_member(tasks.project_id) OR public.is_project_owner(tasks.project_id))
  );

DROP POLICY IF EXISTS "Project members can update tasks" ON tasks;
CREATE POLICY "Project members can update tasks"
  ON tasks FOR UPDATE
  TO authenticated
  USING (public.is_project_member(tasks.project_id) OR public.is_project_owner(tasks.project_id))
  WITH CHECK (public.is_project_member(tasks.project_id) OR public.is_project_owner(tasks.project_id));

DROP POLICY IF EXISTS "Task creator or admin can delete tasks" ON tasks;
CREATE POLICY "Task creator or admin can delete tasks"
  ON tasks FOR DELETE
  TO authenticated
  USING (
    created_by = auth.uid()
    OR public.is_project_admin(tasks.project_id)
    OR public.is_project_owner(tasks.project_id)
  );

CREATE TABLE IF NOT EXISTS activity_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES projects(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  action text NOT NULL,
  entity_type text NOT NULL DEFAULT 'task',
  entity_id uuid,
  meta jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS activity_log_project_id_idx ON activity_log(project_id);
CREATE INDEX IF NOT EXISTS activity_log_user_id_idx ON activity_log(user_id);

ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Project members can view activity" ON activity_log;
CREATE POLICY "Project members can view activity"
  ON activity_log FOR SELECT
  TO authenticated
  USING (
    project_id IS NULL
    OR public.is_project_member(activity_log.project_id)
    OR public.is_project_owner(activity_log.project_id)
  );

DROP POLICY IF EXISTS "Authenticated users can insert activity" ON activity_log;
CREATE POLICY "Authenticated users can insert activity"
  ON activity_log FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.email, '')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
