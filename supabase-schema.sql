-- RPG Life Supabase Schema
-- Run this in your Supabase SQL Editor

-- Enable Row Level Security on all tables
-- Each user can only access their own data

-- Player profile table
CREATE TABLE IF NOT EXISTS players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  total_xp INTEGER DEFAULT 0,
  current_streak INTEGER DEFAULT 0,
  longest_streak INTEGER DEFAULT 0,
  last_active_date DATE,
  total_tasks_completed INTEGER DEFAULT 0,
  total_expedition_minutes INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Avatar customization
CREATE TABLE IF NOT EXISTS avatars (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  skin_tone TEXT DEFAULT 'medium',
  hair_style TEXT DEFAULT 'default',
  hair_color TEXT DEFAULT 'brown',
  outfit TEXT DEFAULT 'casual',
  accessory TEXT DEFAULT 'none',
  equipped_title TEXT DEFAULT 'rookie',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Projects/Boards
CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  color TEXT DEFAULT '#6366f1',
  sort_order INTEGER DEFAULT 0,
  archived BOOLEAN DEFAULT FALSE,
  columns JSONB DEFAULT '[{"id": "todo", "name": "To Do", "order": 0}, {"id": "in-progress", "name": "In Progress", "order": 1}, {"id": "done", "name": "Done", "order": 2}]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tasks
CREATE TABLE IF NOT EXISTS tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
  column_id TEXT DEFAULT 'todo',
  title TEXT NOT NULL,
  description TEXT,
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
  due_date DATE,
  completed BOOLEAN DEFAULT FALSE,
  completed_at TIMESTAMPTZ,
  sort_order INTEGER DEFAULT 0,
  tags TEXT[],
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tags
CREATE TABLE IF NOT EXISTS tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  color TEXT DEFAULT '#6366f1',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, name)
);

-- Expeditions (formerly walks)
CREATE TABLE IF NOT EXISTS expeditions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  duration INTEGER NOT NULL, -- in minutes
  xp_earned INTEGER DEFAULT 0,
  goal_completed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Achievements
CREATE TABLE IF NOT EXISTS achievements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  key TEXT NOT NULL,
  progress INTEGER DEFAULT 0,
  unlocked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, key)
);

-- Unlockables
CREATE TABLE IF NOT EXISTS unlockables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  type TEXT NOT NULL,
  key TEXT NOT NULL,
  unlocked BOOLEAN DEFAULT FALSE,
  unlocked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, type, key)
);

-- Settings
CREATE TABLE IF NOT EXISTS settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  theme TEXT DEFAULT 'dark',
  accent_color TEXT DEFAULT '#6366f1',
  nav_mode TEXT DEFAULT 'sidebar',
  daily_expedition_goal INTEGER DEFAULT 20,
  sound_enabled BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

-- XP History
CREATE TABLE IF NOT EXISTS xp_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  amount INTEGER NOT NULL,
  source TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Daily Stats
CREATE TABLE IF NOT EXISTS daily_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  xp_earned INTEGER DEFAULT 0,
  tasks_completed INTEGER DEFAULT 0,
  expedition_minutes INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, date)
);

-- Enable Row Level Security
ALTER TABLE players ENABLE ROW LEVEL SECURITY;
ALTER TABLE avatars ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE expeditions ENABLE ROW LEVEL SECURITY;
ALTER TABLE achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE unlockables ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE xp_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_stats ENABLE ROW LEVEL SECURITY;

-- Row Level Security Policies
-- Players
CREATE POLICY "Users can view own player data" ON players FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own player data" ON players FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own player data" ON players FOR UPDATE USING (auth.uid() = user_id);

-- Avatars
CREATE POLICY "Users can view own avatar" ON avatars FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own avatar" ON avatars FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own avatar" ON avatars FOR UPDATE USING (auth.uid() = user_id);

-- Projects
CREATE POLICY "Users can view own projects" ON projects FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own projects" ON projects FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own projects" ON projects FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own projects" ON projects FOR DELETE USING (auth.uid() = user_id);

-- Tasks
CREATE POLICY "Users can view own tasks" ON tasks FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own tasks" ON tasks FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own tasks" ON tasks FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own tasks" ON tasks FOR DELETE USING (auth.uid() = user_id);

-- Tags
CREATE POLICY "Users can view own tags" ON tags FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own tags" ON tags FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own tags" ON tags FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own tags" ON tags FOR DELETE USING (auth.uid() = user_id);

-- Expeditions
CREATE POLICY "Users can view own expeditions" ON expeditions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own expeditions" ON expeditions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own expeditions" ON expeditions FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own expeditions" ON expeditions FOR DELETE USING (auth.uid() = user_id);

-- Achievements
CREATE POLICY "Users can view own achievements" ON achievements FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own achievements" ON achievements FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own achievements" ON achievements FOR UPDATE USING (auth.uid() = user_id);

-- Unlockables
CREATE POLICY "Users can view own unlockables" ON unlockables FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own unlockables" ON unlockables FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own unlockables" ON unlockables FOR UPDATE USING (auth.uid() = user_id);

-- Settings
CREATE POLICY "Users can view own settings" ON settings FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own settings" ON settings FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own settings" ON settings FOR UPDATE USING (auth.uid() = user_id);

-- XP History
CREATE POLICY "Users can view own xp_history" ON xp_history FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own xp_history" ON xp_history FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Daily Stats
CREATE POLICY "Users can view own daily_stats" ON daily_stats FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own daily_stats" ON daily_stats FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own daily_stats" ON daily_stats FOR UPDATE USING (auth.uid() = user_id);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at
CREATE TRIGGER update_players_updated_at BEFORE UPDATE ON players FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_avatars_updated_at BEFORE UPDATE ON avatars FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON projects FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_tasks_updated_at BEFORE UPDATE ON tasks FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_settings_updated_at BEFORE UPDATE ON settings FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_daily_stats_updated_at BEFORE UPDATE ON daily_stats FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Function to initialize user data on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Create player profile
  INSERT INTO players (user_id) VALUES (NEW.id);

  -- Create avatar
  INSERT INTO avatars (user_id) VALUES (NEW.id);

  -- Create settings
  INSERT INTO settings (user_id) VALUES (NEW.id);

  -- Create default project
  INSERT INTO projects (user_id, name, description, color, sort_order)
  VALUES (NEW.id, 'My First Project', 'Welcome to RPG Life!', '#6366f1', 0);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to initialize user data on auth.users insert
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION handle_new_user();
