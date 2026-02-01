-- ============================================
-- RPGLife Multiplayer Schema
-- Run this in Supabase SQL Editor
-- ============================================

-- ============ PLAYER SNAPSHOTS ============
-- Stores combat-ready copies of player stats for async PvP
CREATE TABLE IF NOT EXISTS player_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,

  -- Display info
  username TEXT NOT NULL DEFAULT 'Adventurer',
  avatar_url TEXT,
  equipped_title TEXT DEFAULT 'rookie',

  -- Core stats (derived from player data)
  level INTEGER NOT NULL DEFAULT 1,
  total_xp INTEGER NOT NULL DEFAULT 0,

  -- Combat stats (from dungeon upgrades)
  max_hp INTEGER NOT NULL DEFAULT 100,
  attack INTEGER NOT NULL DEFAULT 10,
  defense INTEGER NOT NULL DEFAULT 5,
  speed INTEGER NOT NULL DEFAULT 10,
  crit_chance INTEGER NOT NULL DEFAULT 10,

  -- Equipment/abilities
  custom_spells JSONB DEFAULT '[]'::jsonb,
  upgrades JSONB DEFAULT '[]'::jsonb,

  -- Metadata
  wins INTEGER NOT NULL DEFAULT 0,
  losses INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_snapshots_user ON player_snapshots(user_id);
CREATE INDEX idx_snapshots_level ON player_snapshots(level);

-- ============ BATTLES ============
-- Records of PvP fights
CREATE TABLE IF NOT EXISTS battles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Participants
  challenger_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  opponent_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,

  -- Snapshots at time of battle (for replay accuracy)
  challenger_snapshot JSONB NOT NULL,
  opponent_snapshot JSONB NOT NULL,

  -- Results
  winner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  is_draw BOOLEAN DEFAULT false,

  -- Rewards earned by challenger
  xp_reward INTEGER NOT NULL DEFAULT 0,
  gold_reward INTEGER NOT NULL DEFAULT 0,

  -- Battle replay data
  battle_log JSONB NOT NULL DEFAULT '[]'::jsonb,
  total_turns INTEGER NOT NULL DEFAULT 0,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_battles_challenger ON battles(challenger_id);
CREATE INDEX idx_battles_opponent ON battles(opponent_id);
CREATE INDEX idx_battles_created ON battles(created_at DESC);

-- ============ FRIENDSHIPS ============
-- Friend relationships between players
CREATE TABLE IF NOT EXISTS friendships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  requester_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  addressee_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,

  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'blocked')),

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  -- Prevent duplicate friendships
  UNIQUE(requester_id, addressee_id)
);

CREATE INDEX idx_friendships_requester ON friendships(requester_id);
CREATE INDEX idx_friendships_addressee ON friendships(addressee_id);
CREATE INDEX idx_friendships_status ON friendships(status);

-- ============ GUILDS ============
-- Player organizations
CREATE TABLE IF NOT EXISTS guilds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  name TEXT NOT NULL UNIQUE,
  description TEXT,
  banner_url TEXT,

  leader_id UUID REFERENCES auth.users(id) ON DELETE SET NULL NOT NULL,

  -- Guild progression
  level INTEGER NOT NULL DEFAULT 1,
  xp INTEGER NOT NULL DEFAULT 0,

  -- Limits
  max_members INTEGER NOT NULL DEFAULT 20,

  -- Stats
  total_contribution_xp INTEGER NOT NULL DEFAULT 0,
  bosses_defeated INTEGER NOT NULL DEFAULT 0,

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_guilds_name ON guilds(name);
CREATE INDEX idx_guilds_level ON guilds(level DESC);

-- ============ GUILD MEMBERS ============
-- Guild membership and roles
CREATE TABLE IF NOT EXISTS guild_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  guild_id UUID REFERENCES guilds(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,

  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('leader', 'officer', 'member')),

  -- Contribution tracking
  contribution_xp INTEGER NOT NULL DEFAULT 0,

  joined_at TIMESTAMPTZ DEFAULT now(),

  -- One guild per player
  UNIQUE(user_id)
);

CREATE INDEX idx_guild_members_guild ON guild_members(guild_id);
CREATE INDEX idx_guild_members_user ON guild_members(user_id);
CREATE INDEX idx_guild_members_contribution ON guild_members(contribution_xp DESC);

-- ============ GUILD BOSS FIGHTS ============
-- Cooperative boss encounters for guilds
CREATE TABLE IF NOT EXISTS guild_boss_fights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  guild_id UUID REFERENCES guilds(id) ON DELETE CASCADE NOT NULL,

  -- Boss info
  boss_name TEXT NOT NULL,
  boss_emoji TEXT DEFAULT '🐉',
  boss_max_hp INTEGER NOT NULL,
  boss_current_hp INTEGER NOT NULL,
  boss_stats JSONB NOT NULL DEFAULT '{"attack": 20, "defense": 10}'::jsonb,

  -- Fight status
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'defeated', 'expired')),

  -- Participant tracking: { "user_id": { "damage": 500, "hits": 10, "username": "..." } }
  participants JSONB NOT NULL DEFAULT '{}'::jsonb,

  -- Rewards (distributed on defeat)
  rewards JSONB DEFAULT '{"xp": 500, "gold": 100}'::jsonb,

  -- Timing
  started_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  completed_at TIMESTAMPTZ
);

CREATE INDEX idx_boss_fights_guild ON guild_boss_fights(guild_id);
CREATE INDEX idx_boss_fights_status ON guild_boss_fights(status);
CREATE INDEX idx_boss_fights_expires ON guild_boss_fights(expires_at);

-- ============ ROW LEVEL SECURITY ============

-- Enable RLS on all tables
ALTER TABLE player_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE battles ENABLE ROW LEVEL SECURITY;
ALTER TABLE friendships ENABLE ROW LEVEL SECURITY;
ALTER TABLE guilds ENABLE ROW LEVEL SECURITY;
ALTER TABLE guild_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE guild_boss_fights ENABLE ROW LEVEL SECURITY;

-- ============ SNAPSHOT POLICIES ============
-- Anyone can read snapshots (for matchmaking)
CREATE POLICY "Snapshots are publicly readable"
  ON player_snapshots FOR SELECT
  USING (true);

-- Users can only update their own snapshot
CREATE POLICY "Users can insert own snapshot"
  ON player_snapshots FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own snapshot"
  ON player_snapshots FOR UPDATE
  USING (auth.uid() = user_id);

-- ============ BATTLE POLICIES ============
-- Users can see battles they participated in
CREATE POLICY "Users can view own battles"
  ON battles FOR SELECT
  USING (auth.uid() = challenger_id OR auth.uid() = opponent_id);

-- Users can create battles where they are the challenger
CREATE POLICY "Users can create battles as challenger"
  ON battles FOR INSERT
  WITH CHECK (auth.uid() = challenger_id);

-- ============ FRIENDSHIP POLICIES ============
-- Users can view friendships they're part of
CREATE POLICY "Users can view own friendships"
  ON friendships FOR SELECT
  USING (auth.uid() = requester_id OR auth.uid() = addressee_id);

-- Users can send friend requests
CREATE POLICY "Users can send friend requests"
  ON friendships FOR INSERT
  WITH CHECK (auth.uid() = requester_id);

-- Users can update friendships they're the addressee of (accept/decline)
CREATE POLICY "Addressee can respond to requests"
  ON friendships FOR UPDATE
  USING (auth.uid() = addressee_id);

-- Users can delete friendships they're part of
CREATE POLICY "Users can remove friendships"
  ON friendships FOR DELETE
  USING (auth.uid() = requester_id OR auth.uid() = addressee_id);

-- ============ GUILD POLICIES ============
-- Anyone can read guilds
CREATE POLICY "Guilds are publicly readable"
  ON guilds FOR SELECT
  USING (true);

-- Any authenticated user can create a guild
CREATE POLICY "Authenticated users can create guilds"
  ON guilds FOR INSERT
  WITH CHECK (auth.uid() = leader_id);

-- Only leader can update guild
CREATE POLICY "Leader can update guild"
  ON guilds FOR UPDATE
  USING (auth.uid() = leader_id);

-- Only leader can delete guild
CREATE POLICY "Leader can delete guild"
  ON guilds FOR DELETE
  USING (auth.uid() = leader_id);

-- ============ GUILD MEMBER POLICIES ============
-- Anyone can read guild members
CREATE POLICY "Guild members are publicly readable"
  ON guild_members FOR SELECT
  USING (true);

-- Users can join guilds (insert themselves)
CREATE POLICY "Users can join guilds"
  ON guild_members FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can leave guilds (delete themselves) OR leaders can kick
CREATE POLICY "Users can leave or be kicked"
  ON guild_members FOR DELETE
  USING (
    auth.uid() = user_id
    OR
    EXISTS (
      SELECT 1 FROM guilds
      WHERE guilds.id = guild_members.guild_id
      AND guilds.leader_id = auth.uid()
    )
  );

-- Leaders/officers can update member roles
CREATE POLICY "Leaders can update member roles"
  ON guild_members FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM guild_members gm
      JOIN guilds g ON g.id = gm.guild_id
      WHERE gm.guild_id = guild_members.guild_id
      AND gm.user_id = auth.uid()
      AND (gm.role = 'leader' OR gm.role = 'officer')
    )
  );

-- ============ GUILD BOSS FIGHT POLICIES ============
-- Guild members can view their guild's boss fights
CREATE POLICY "Guild members can view boss fights"
  ON guild_boss_fights FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM guild_members
      WHERE guild_members.guild_id = guild_boss_fights.guild_id
      AND guild_members.user_id = auth.uid()
    )
  );

-- Leaders/officers can create boss fights
CREATE POLICY "Leaders can create boss fights"
  ON guild_boss_fights FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM guild_members gm
      WHERE gm.guild_id = guild_boss_fights.guild_id
      AND gm.user_id = auth.uid()
      AND gm.role IN ('leader', 'officer')
    )
  );

-- Guild members can update boss fights (to deal damage)
CREATE POLICY "Guild members can update boss fights"
  ON guild_boss_fights FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM guild_members
      WHERE guild_members.guild_id = guild_boss_fights.guild_id
      AND guild_members.user_id = auth.uid()
    )
  );

-- ============ HELPER FUNCTIONS ============

-- Function to update snapshot automatically
CREATE OR REPLACE FUNCTION update_snapshot_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for snapshot updates
DROP TRIGGER IF EXISTS snapshot_updated ON player_snapshots;
CREATE TRIGGER snapshot_updated
  BEFORE UPDATE ON player_snapshots
  FOR EACH ROW
  EXECUTE FUNCTION update_snapshot_timestamp();

-- Function to update guild timestamp
DROP TRIGGER IF EXISTS guild_updated ON guilds;
CREATE TRIGGER guild_updated
  BEFORE UPDATE ON guilds
  FOR EACH ROW
  EXECUTE FUNCTION update_snapshot_timestamp();

-- Function to update friendship timestamp
DROP TRIGGER IF EXISTS friendship_updated ON friendships;
CREATE TRIGGER friendship_updated
  BEFORE UPDATE ON friendships
  FOR EACH ROW
  EXECUTE FUNCTION update_snapshot_timestamp();

-- ============ NOTIFY SCHEMA CACHE ============
NOTIFY pgrst, 'reload schema';
