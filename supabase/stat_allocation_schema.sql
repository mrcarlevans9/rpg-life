-- Stat Allocation System Schema
-- Run this SQL in your Supabase SQL Editor to enable stat sync
-- This only requires the base 'players' table to exist

-- Add stat columns to players table
ALTER TABLE players
  ADD COLUMN IF NOT EXISTS unspent_stat_points INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS stat_vitality INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS stat_power INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS stat_arcana INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS stat_agility INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS stat_fortune INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_stat_points_earned INTEGER DEFAULT 0;

-- Update existing rows to have default values
UPDATE players SET
  unspent_stat_points = COALESCE(unspent_stat_points, 0),
  stat_vitality = COALESCE(stat_vitality, 0),
  stat_power = COALESCE(stat_power, 0),
  stat_arcana = COALESCE(stat_arcana, 0),
  stat_agility = COALESCE(stat_agility, 0),
  stat_fortune = COALESCE(stat_fortune, 0),
  total_stat_points_earned = COALESCE(total_stat_points_earned, 0)
WHERE unspent_stat_points IS NULL
   OR stat_vitality IS NULL
   OR stat_power IS NULL
   OR stat_arcana IS NULL
   OR stat_agility IS NULL
   OR stat_fortune IS NULL
   OR total_stat_points_earned IS NULL;
