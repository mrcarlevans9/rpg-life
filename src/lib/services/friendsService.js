import { supabase } from '../supabase/client.js';

// ============ FRIEND REQUESTS ============

/**
 * Send a friend request to another user
 */
export async function sendFriendRequest(addresseeId) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'Not authenticated' };

  if (user.id === addresseeId) {
    return { success: false, error: 'Cannot friend yourself' };
  }

  // Check if friendship already exists
  const { data: existing } = await supabase
    .from('friendships')
    .select('id, status')
    .or(`and(requester_id.eq.${user.id},addressee_id.eq.${addresseeId}),and(requester_id.eq.${addresseeId},addressee_id.eq.${user.id})`)
    .single();

  if (existing) {
    if (existing.status === 'accepted') {
      return { success: false, error: 'Already friends' };
    } else if (existing.status === 'pending') {
      return { success: false, error: 'Request already pending' };
    } else if (existing.status === 'blocked') {
      return { success: false, error: 'Cannot send request' };
    }
  }

  const { data, error } = await supabase
    .from('friendships')
    .insert({
      requester_id: user.id,
      addressee_id: addresseeId,
      status: 'pending'
    })
    .select()
    .single();

  if (error) {
    console.error('Failed to send friend request:', error);
    return { success: false, error: error.message };
  }

  return { success: true, friendship: data };
}

/**
 * Accept a friend request
 */
export async function acceptFriendRequest(friendshipId) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'Not authenticated' };

  const { data, error } = await supabase
    .from('friendships')
    .update({ status: 'accepted' })
    .eq('id', friendshipId)
    .eq('addressee_id', user.id) // Only addressee can accept
    .eq('status', 'pending')
    .select()
    .single();

  if (error) {
    console.error('Failed to accept friend request:', error);
    return { success: false, error: error.message };
  }

  return { success: true, friendship: data };
}

/**
 * Decline a friend request
 */
export async function declineFriendRequest(friendshipId) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'Not authenticated' };

  const { error } = await supabase
    .from('friendships')
    .delete()
    .eq('id', friendshipId)
    .eq('addressee_id', user.id)
    .eq('status', 'pending');

  if (error) {
    console.error('Failed to decline friend request:', error);
    return { success: false, error: error.message };
  }

  return { success: true };
}

/**
 * Block a user
 */
export async function blockUser(userId) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'Not authenticated' };

  // First try to update existing friendship
  const { data: existing } = await supabase
    .from('friendships')
    .select('id')
    .or(`and(requester_id.eq.${user.id},addressee_id.eq.${userId}),and(requester_id.eq.${userId},addressee_id.eq.${user.id})`)
    .single();

  if (existing) {
    const { error } = await supabase
      .from('friendships')
      .update({ status: 'blocked' })
      .eq('id', existing.id);

    if (error) {
      console.error('Failed to block user:', error);
      return { success: false, error: error.message };
    }
  } else {
    // Create new blocked relationship
    const { error } = await supabase
      .from('friendships')
      .insert({
        requester_id: user.id,
        addressee_id: userId,
        status: 'blocked'
      });

    if (error) {
      console.error('Failed to block user:', error);
      return { success: false, error: error.message };
    }
  }

  return { success: true };
}

/**
 * Remove a friend
 */
export async function removeFriend(friendshipId) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'Not authenticated' };

  const { error } = await supabase
    .from('friendships')
    .delete()
    .eq('id', friendshipId);

  if (error) {
    console.error('Failed to remove friend:', error);
    return { success: false, error: error.message };
  }

  return { success: true };
}

// ============ FRIEND LISTS ============

/**
 * Get all accepted friends with their snapshots
 */
export async function getFriends() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  // Get friendships where user is either requester or addressee
  const { data: friendships, error } = await supabase
    .from('friendships')
    .select('id, requester_id, addressee_id, created_at')
    .eq('status', 'accepted')
    .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`);

  if (error) {
    console.error('Failed to get friends:', error);
    return [];
  }

  if (!friendships?.length) return [];

  // Get friend user IDs
  const friendIds = friendships.map(f =>
    f.requester_id === user.id ? f.addressee_id : f.requester_id
  );

  // Get snapshots for all friends
  const { data: snapshots } = await supabase
    .from('player_snapshots')
    .select('*')
    .in('user_id', friendIds);

  // Combine friendship data with snapshots
  return friendships.map(friendship => {
    const friendId = friendship.requester_id === user.id
      ? friendship.addressee_id
      : friendship.requester_id;
    const snapshot = snapshots?.find(s => s.user_id === friendId);

    return {
      friendshipId: friendship.id,
      friendId,
      friendedAt: friendship.created_at,
      snapshot: snapshot || null
    };
  });
}

/**
 * Get pending friend requests (received)
 */
export async function getPendingRequests() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data: requests, error } = await supabase
    .from('friendships')
    .select('id, requester_id, created_at')
    .eq('addressee_id', user.id)
    .eq('status', 'pending');

  if (error) {
    console.error('Failed to get pending requests:', error);
    return [];
  }

  if (!requests?.length) return [];

  // Get snapshots for requesters
  const requesterIds = requests.map(r => r.requester_id);
  const { data: snapshots } = await supabase
    .from('player_snapshots')
    .select('*')
    .in('user_id', requesterIds);

  return requests.map(request => ({
    friendshipId: request.id,
    requesterId: request.requester_id,
    requestedAt: request.created_at,
    snapshot: snapshots?.find(s => s.user_id === request.requester_id) || null
  }));
}

/**
 * Get sent friend requests (pending)
 */
export async function getSentRequests() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data: requests, error } = await supabase
    .from('friendships')
    .select('id, addressee_id, created_at')
    .eq('requester_id', user.id)
    .eq('status', 'pending');

  if (error) {
    console.error('Failed to get sent requests:', error);
    return [];
  }

  if (!requests?.length) return [];

  // Get snapshots for addressees
  const addresseeIds = requests.map(r => r.addressee_id);
  const { data: snapshots } = await supabase
    .from('player_snapshots')
    .select('*')
    .in('user_id', addresseeIds);

  return requests.map(request => ({
    friendshipId: request.id,
    addresseeId: request.addressee_id,
    sentAt: request.created_at,
    snapshot: snapshots?.find(s => s.user_id === request.addressee_id) || null
  }));
}

// ============ SEARCH ============

/**
 * Search for users by username
 */
export async function searchUsers(query, limit = 10) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from('player_snapshots')
    .select('user_id, username, level, equipped_title')
    .ilike('username', `%${query}%`)
    .neq('user_id', user.id)
    .limit(limit);

  if (error) {
    console.error('Failed to search users:', error);
    return [];
  }

  return data || [];
}

/**
 * Get friendship status with a specific user
 */
export async function getFriendshipStatus(otherUserId) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from('friendships')
    .select('id, status, requester_id, addressee_id')
    .or(`and(requester_id.eq.${user.id},addressee_id.eq.${otherUserId}),and(requester_id.eq.${otherUserId},addressee_id.eq.${user.id})`)
    .single();

  if (error && error.code !== 'PGRST116') {
    console.error('Failed to get friendship status:', error);
    return null;
  }

  if (!data) return { status: 'none' };

  return {
    status: data.status,
    friendshipId: data.id,
    isRequester: data.requester_id === user.id
  };
}
