-- Task kanban columns (configurable by admin)
CREATE TABLE IF NOT EXISTS task_columns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  position integer NOT NULL DEFAULT 0,
  color text DEFAULT '#3B9FFF',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Insert default columns
INSERT INTO task_columns (name, position, color) VALUES
  ('A fazer', 0, '#FFAA00'),
  ('Em andamento', 1, '#3B9FFF'),
  ('Concluídas', 2, '#2FC695');

-- Tasks
CREATE TABLE IF NOT EXISTS tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mentee_id uuid REFERENCES mentees(id) ON DELETE CASCADE,
  column_id uuid REFERENCES task_columns(id) ON DELETE SET NULL,
  title text NOT NULL,
  description text,
  notes text,
  due_date date,
  completed_at timestamptz,
  created_by uuid REFERENCES profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Task attachments
CREATE TABLE IF NOT EXISTS task_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid REFERENCES tasks(id) ON DELETE CASCADE,
  file_url text NOT NULL,
  file_name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_tasks_mentee ON tasks(mentee_id);
CREATE INDEX IF NOT EXISTS idx_tasks_column ON tasks(column_id);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks(due_date);
CREATE INDEX IF NOT EXISTS idx_task_attachments_task ON task_attachments(task_id);

-- RLS
ALTER TABLE task_columns ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can manage task_columns" ON task_columns FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated can manage tasks" ON tasks FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated can manage task_attachments" ON task_attachments FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Storage bucket for task attachments
INSERT INTO storage.buckets (id, name, public) VALUES ('task-attachments', 'task-attachments', true) ON CONFLICT (id) DO NOTHING;
CREATE POLICY "Authenticated can upload task attachments" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'task-attachments');
CREATE POLICY "Public can read task attachments" ON storage.objects FOR SELECT TO public USING (bucket_id = 'task-attachments');
CREATE POLICY "Authenticated can update task attachments" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'task-attachments');
CREATE POLICY "Authenticated can delete task attachments" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'task-attachments');
