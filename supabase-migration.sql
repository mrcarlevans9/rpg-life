-- RPG Life Migration: Projects -> Global Board
-- Run this in your Supabase SQL Editor

-- 1. Create the new board table
CREATE TABLE IF NOT EXISTS board (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  columns JSONB DEFAULT '[{"id": "todo", "name": "To Do", "order": 0}, {"id": "in-progress", "name": "In Progress", "order": 1}, {"id": "done", "name": "Done", "order": 2}]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

-- 2. Enable RLS on board
ALTER TABLE board ENABLE ROW LEVEL SECURITY;

-- 3. Create RLS policies for board
CREATE POLICY "Users can view own board" ON board FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own board" ON board FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own board" ON board FOR UPDATE USING (auth.uid() = user_id);

-- 4. Create trigger for board updated_at
CREATE TRIGGER update_board_updated_at BEFORE UPDATE ON board FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- 5. Remove project_id constraint from tasks (if exists)
ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_project_id_fkey;
ALTER TABLE tasks DROP COLUMN IF EXISTS project_id;

-- 6. Drop old projects table and related objects
DROP TRIGGER IF EXISTS update_projects_updated_at ON projects;
DROP POLICY IF EXISTS "Users can view own projects" ON projects;
DROP POLICY IF EXISTS "Users can insert own projects" ON projects;
DROP POLICY IF EXISTS "Users can update own projects" ON projects;
DROP POLICY IF EXISTS "Users can delete own projects" ON projects;
DROP TABLE IF EXISTS projects;

-- 7. Update handle_new_user function to create board instead of project
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Create player profile
  INSERT INTO players (user_id) VALUES (NEW.id);

  -- Create avatar
  INSERT INTO avatars (user_id) VALUES (NEW.id);

  -- Create settings
  INSERT INTO settings (user_id) VALUES (NEW.id);

  -- Create global kanban board
  INSERT INTO board (user_id) VALUES (NEW.id);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. Create board for existing users who don't have one
INSERT INTO board (user_id)
SELECT id FROM auth.users
WHERE id NOT IN (SELECT user_id FROM board)
ON CONFLICT (user_id) DO NOTHING;

-- Done! Your database is now migrated to the single board structure.
