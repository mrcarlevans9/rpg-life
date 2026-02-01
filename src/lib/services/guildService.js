import { supabase } from '../supabase/client.js';

// ============ GUILD MANAGEMENT ============

/**
 * Create a new guild
 */
export async function createGuild(name, description = '') {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'Not authenticated' };

  // Check if user is already in a guild
  const existingMembership = await getMyGuild();
  if (existingMembership) {
    return { success: false, error: 'Already in a guild. Leave first.' };
  }

  // Create the guild
  const { data: guild, error: guildError } = await supabase
    .from('guilds')
    .insert({
      name,
      description,
      leader_id: user.id
    })
    .select()
    .single();

  if (guildError) {
    if (guildError.code === '23505') {
      return { success: false, error: 'Guild name already taken' };
    }
    console.error('Failed to create guild:', guildError);
    return { success: false, error: guildError.message };
  }

  // Add creator as leader member
  const { error: memberError } = await supabase
    .from('guild_members')
    .insert({
      guild_id: guild.id,
      user_id: user.id,
      role: 'leader'
    });

  if (memberError) {
    // Rollback guild creation
    await supabase.from('guilds').delete().eq('id', guild.id);
    console.error('Failed to add leader as member:', memberError);
    return { success: false, error: memberError.message };
  }

  return { success: true, guild };
}

/**
 * Join an existing guild
 */
export async function joinGuild(guildId) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'Not authenticated' };

  // Check if user is already in a guild
  const existingMembership = await getMyGuild();
  if (existingMembership) {
    return { success: false, error: 'Already in a guild. Leave first.' };
  }

  // Check guild exists and has space
  const { data: guild, error: guildError } = await supabase
    .from('guilds')
    .select('id, max_members')
    .eq('id', guildId)
    .single();

  if (guildError || !guild) {
    return { success: false, error: 'Guild not found' };
  }

  // Count current members
  const { count } = await supabase
    .from('guild_members')
    .select('*', { count: 'exact', head: true })
    .eq('guild_id', guildId);

  if (count >= guild.max_members) {
    return { success: false, error: 'Guild is full' };
  }

  // Join guild
  const { data, error } = await supabase
    .from('guild_members')
    .insert({
      guild_id: guildId,
      user_id: user.id,
      role: 'member'
    })
    .select()
    .single();

  if (error) {
    console.error('Failed to join guild:', error);
    return { success: false, error: error.message };
  }

  return { success: true, membership: data };
}

/**
 * Leave current guild
 */
export async function leaveGuild() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'Not authenticated' };

  // Get current membership
  const { data: membership, error: memberError } = await supabase
    .from('guild_members')
    .select('id, guild_id, role')
    .eq('user_id', user.id)
    .single();

  if (memberError || !membership) {
    return { success: false, error: 'Not in a guild' };
  }

  // Leaders cannot leave - must transfer or disband
  if (membership.role === 'leader') {
    return { success: false, error: 'Leaders must transfer leadership or disband the guild' };
  }

  const { error } = await supabase
    .from('guild_members')
    .delete()
    .eq('id', membership.id);

  if (error) {
    console.error('Failed to leave guild:', error);
    return { success: false, error: error.message };
  }

  return { success: true };
}

/**
 * Disband guild (leader only)
 */
export async function disbandGuild() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'Not authenticated' };

  // Get user's guild where they are leader
  const { data: guild, error: guildError } = await supabase
    .from('guilds')
    .select('id')
    .eq('leader_id', user.id)
    .single();

  if (guildError || !guild) {
    return { success: false, error: 'Not a guild leader' };
  }

  // Delete guild (cascade will remove members)
  const { error } = await supabase
    .from('guilds')
    .delete()
    .eq('id', guild.id);

  if (error) {
    console.error('Failed to disband guild:', error);
    return { success: false, error: error.message };
  }

  return { success: true };
}

/**
 * Transfer leadership (leader only)
 */
export async function transferLeadership(newLeaderId) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'Not authenticated' };

  // Get user's guild where they are leader
  const { data: guild, error: guildError } = await supabase
    .from('guilds')
    .select('id')
    .eq('leader_id', user.id)
    .single();

  if (guildError || !guild) {
    return { success: false, error: 'Not a guild leader' };
  }

  // Verify new leader is a member
  const { data: newLeaderMember } = await supabase
    .from('guild_members')
    .select('id')
    .eq('guild_id', guild.id)
    .eq('user_id', newLeaderId)
    .single();

  if (!newLeaderMember) {
    return { success: false, error: 'User is not a guild member' };
  }

  // Update guild leader
  const { error: updateGuildError } = await supabase
    .from('guilds')
    .update({ leader_id: newLeaderId })
    .eq('id', guild.id);

  if (updateGuildError) {
    console.error('Failed to transfer leadership:', updateGuildError);
    return { success: false, error: updateGuildError.message };
  }

  // Update member roles
  await supabase
    .from('guild_members')
    .update({ role: 'member' })
    .eq('guild_id', guild.id)
    .eq('user_id', user.id);

  await supabase
    .from('guild_members')
    .update({ role: 'leader' })
    .eq('guild_id', guild.id)
    .eq('user_id', newLeaderId);

  return { success: true };
}

// ============ MEMBER MANAGEMENT ============

/**
 * Promote member to officer (leader only)
 */
export async function promoteMember(memberId) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'Not authenticated' };

  // Verify user is leader of the member's guild
  const { data: member } = await supabase
    .from('guild_members')
    .select('id, guild_id, role')
    .eq('user_id', memberId)
    .single();

  if (!member) {
    return { success: false, error: 'Member not found' };
  }

  const { data: guild } = await supabase
    .from('guilds')
    .select('leader_id')
    .eq('id', member.guild_id)
    .single();

  if (guild?.leader_id !== user.id) {
    return { success: false, error: 'Not authorized' };
  }

  if (member.role === 'officer') {
    return { success: false, error: 'Already an officer' };
  }

  const { error } = await supabase
    .from('guild_members')
    .update({ role: 'officer' })
    .eq('user_id', memberId)
    .eq('guild_id', member.guild_id);

  if (error) {
    console.error('Failed to promote member:', error);
    return { success: false, error: error.message };
  }

  return { success: true };
}

/**
 * Demote officer to member (leader only)
 */
export async function demoteMember(memberId) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'Not authenticated' };

  const { data: member } = await supabase
    .from('guild_members')
    .select('id, guild_id, role')
    .eq('user_id', memberId)
    .single();

  if (!member) {
    return { success: false, error: 'Member not found' };
  }

  const { data: guild } = await supabase
    .from('guilds')
    .select('leader_id')
    .eq('id', member.guild_id)
    .single();

  if (guild?.leader_id !== user.id) {
    return { success: false, error: 'Not authorized' };
  }

  const { error } = await supabase
    .from('guild_members')
    .update({ role: 'member' })
    .eq('user_id', memberId)
    .eq('guild_id', member.guild_id);

  if (error) {
    console.error('Failed to demote member:', error);
    return { success: false, error: error.message };
  }

  return { success: true };
}

/**
 * Kick member from guild (leader/officer only)
 */
export async function kickMember(memberId) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'Not authenticated' };

  const { data: targetMember } = await supabase
    .from('guild_members')
    .select('id, guild_id, role')
    .eq('user_id', memberId)
    .single();

  if (!targetMember) {
    return { success: false, error: 'Member not found' };
  }

  // Can't kick leader
  if (targetMember.role === 'leader') {
    return { success: false, error: 'Cannot kick the leader' };
  }

  // Verify user has permission
  const { data: userMember } = await supabase
    .from('guild_members')
    .select('role')
    .eq('guild_id', targetMember.guild_id)
    .eq('user_id', user.id)
    .single();

  if (!userMember || userMember.role === 'member') {
    return { success: false, error: 'Not authorized' };
  }

  // Officers can only kick members, not other officers
  if (userMember.role === 'officer' && targetMember.role === 'officer') {
    return { success: false, error: 'Officers cannot kick other officers' };
  }

  const { error } = await supabase
    .from('guild_members')
    .delete()
    .eq('user_id', memberId)
    .eq('guild_id', targetMember.guild_id);

  if (error) {
    console.error('Failed to kick member:', error);
    return { success: false, error: error.message };
  }

  return { success: true };
}

// ============ GUILD INFO ============

/**
 * Get current user's guild with all members
 */
export async function getMyGuild() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  // Get membership
  const { data: membership, error: memberError } = await supabase
    .from('guild_members')
    .select('guild_id, role, contribution_xp, joined_at')
    .eq('user_id', user.id)
    .single();

  if (memberError || !membership) {
    return null;
  }

  // Get guild info
  const { data: guild, error: guildError } = await supabase
    .from('guilds')
    .select('*')
    .eq('id', membership.guild_id)
    .single();

  if (guildError || !guild) {
    return null;
  }

  // Get all members with their snapshots
  const { data: members } = await supabase
    .from('guild_members')
    .select('user_id, role, contribution_xp, joined_at')
    .eq('guild_id', guild.id)
    .order('contribution_xp', { ascending: false });

  // Get snapshots for all members
  const memberIds = members?.map(m => m.user_id) || [];
  const { data: snapshots } = await supabase
    .from('player_snapshots')
    .select('*')
    .in('user_id', memberIds);

  const membersWithSnapshots = members?.map(member => ({
    ...member,
    snapshot: snapshots?.find(s => s.user_id === member.user_id) || null
  })) || [];

  return {
    guild,
    myRole: membership.role,
    myContribution: membership.contribution_xp,
    members: membersWithSnapshots
  };
}

/**
 * Get guild by ID
 */
export async function getGuild(guildId) {
  const { data: guild, error } = await supabase
    .from('guilds')
    .select('*')
    .eq('id', guildId)
    .single();

  if (error) {
    console.error('Failed to get guild:', error);
    return null;
  }

  // Get member count
  const { count } = await supabase
    .from('guild_members')
    .select('*', { count: 'exact', head: true })
    .eq('guild_id', guildId);

  return {
    ...guild,
    memberCount: count || 0
  };
}

/**
 * Search for guilds
 */
export async function searchGuilds(query = '', limit = 20) {
  let queryBuilder = supabase
    .from('guilds')
    .select('id, name, description, level, leader_id, max_members')
    .order('level', { ascending: false })
    .limit(limit);

  if (query) {
    queryBuilder = queryBuilder.ilike('name', `%${query}%`);
  }

  const { data, error } = await queryBuilder;

  if (error) {
    console.error('Failed to search guilds:', error);
    return [];
  }

  // Get member counts for all guilds
  const guildIds = data?.map(g => g.id) || [];
  const memberCounts = {};

  for (const guildId of guildIds) {
    const { count } = await supabase
      .from('guild_members')
      .select('*', { count: 'exact', head: true })
      .eq('guild_id', guildId);
    memberCounts[guildId] = count || 0;
  }

  return data?.map(guild => ({
    ...guild,
    memberCount: memberCounts[guild.id] || 0
  })) || [];
}

// ============ GUILD BOSS FIGHTS ============

/**
 * Start a new boss fight (leader/officer only)
 */
export async function startBossFight(bossName, bossEmoji, bossMaxHp, bossStats, durationHours = 24) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'Not authenticated' };

  // Get user's guild and verify role
  const { data: membership } = await supabase
    .from('guild_members')
    .select('guild_id, role')
    .eq('user_id', user.id)
    .single();

  if (!membership || membership.role === 'member') {
    return { success: false, error: 'Not authorized. Must be leader or officer.' };
  }

  // Check for active boss fight
  const { data: activeFight } = await supabase
    .from('guild_boss_fights')
    .select('id')
    .eq('guild_id', membership.guild_id)
    .eq('status', 'active')
    .single();

  if (activeFight) {
    return { success: false, error: 'Already have an active boss fight' };
  }

  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + durationHours);

  const { data, error } = await supabase
    .from('guild_boss_fights')
    .insert({
      guild_id: membership.guild_id,
      boss_name: bossName,
      boss_emoji: bossEmoji,
      boss_max_hp: bossMaxHp,
      boss_current_hp: bossMaxHp,
      boss_stats: bossStats,
      expires_at: expiresAt.toISOString()
    })
    .select()
    .single();

  if (error) {
    console.error('Failed to start boss fight:', error);
    return { success: false, error: error.message };
  }

  return { success: true, bossFight: data };
}

/**
 * Deal damage to boss
 */
export async function dealBossDamage(bossFightId, damage) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'Not authenticated' };

  // Get boss fight
  const { data: bossFight, error: fetchError } = await supabase
    .from('guild_boss_fights')
    .select('*')
    .eq('id', bossFightId)
    .eq('status', 'active')
    .single();

  if (fetchError || !bossFight) {
    return { success: false, error: 'Boss fight not found or not active' };
  }

  // Verify user is in this guild
  const { data: membership } = await supabase
    .from('guild_members')
    .select('id')
    .eq('guild_id', bossFight.guild_id)
    .eq('user_id', user.id)
    .single();

  if (!membership) {
    return { success: false, error: 'Not a member of this guild' };
  }

  // Get user's snapshot for username
  const { data: snapshot } = await supabase
    .from('player_snapshots')
    .select('username')
    .eq('user_id', user.id)
    .single();

  // Update boss HP and participants
  const newHp = Math.max(0, bossFight.boss_current_hp - damage);
  const participants = bossFight.participants || {};

  if (!participants[user.id]) {
    participants[user.id] = {
      damage: 0,
      hits: 0,
      username: snapshot?.username || 'Unknown'
    };
  }
  participants[user.id].damage += damage;
  participants[user.id].hits += 1;

  const updates = {
    boss_current_hp: newHp,
    participants
  };

  // Check if boss is defeated
  if (newHp <= 0) {
    updates.status = 'defeated';
    updates.completed_at = new Date().toISOString();
  }

  const { data, error } = await supabase
    .from('guild_boss_fights')
    .update(updates)
    .eq('id', bossFightId)
    .select()
    .single();

  if (error) {
    console.error('Failed to deal damage:', error);
    return { success: false, error: error.message };
  }

  return {
    success: true,
    bossFight: data,
    wasDefeated: newHp <= 0
  };
}

/**
 * Get active boss fight for user's guild
 */
export async function getActiveBossFight() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: membership } = await supabase
    .from('guild_members')
    .select('guild_id')
    .eq('user_id', user.id)
    .single();

  if (!membership) return null;

  const { data, error } = await supabase
    .from('guild_boss_fights')
    .select('*')
    .eq('guild_id', membership.guild_id)
    .eq('status', 'active')
    .single();

  if (error && error.code !== 'PGRST116') {
    console.error('Failed to get boss fight:', error);
    return null;
  }

  return data;
}

/**
 * Get boss fight history for user's guild
 */
export async function getBossFightHistory(limit = 10) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data: membership } = await supabase
    .from('guild_members')
    .select('guild_id')
    .eq('user_id', user.id)
    .single();

  if (!membership) return [];

  const { data, error } = await supabase
    .from('guild_boss_fights')
    .select('*')
    .eq('guild_id', membership.guild_id)
    .neq('status', 'active')
    .order('completed_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Failed to get boss fight history:', error);
    return [];
  }

  return data || [];
}
