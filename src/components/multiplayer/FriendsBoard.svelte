<script>
  import { onMount } from 'svelte';
  import { createEventDispatcher } from 'svelte';
  import {
    getFriends,
    getPendingRequests,
    getSentRequests,
    searchUsers,
    sendFriendRequest,
    acceptFriendRequest,
    declineFriendRequest,
    removeFriend,
    blockUser
  } from '../../lib/services/friendsService.js';
  import Card from '../common/Card.svelte';

  const dispatch = createEventDispatcher();

  let activeTab = 'friends'; // friends, requests, search
  let friends = [];
  let pendingRequests = [];
  let sentRequests = [];
  let searchResults = [];
  let searchQuery = '';
  let loading = true;
  let searching = false;
  let actionLoading = null;

  onMount(async () => {
    await loadData();
  });

  async function loadData() {
    loading = true;
    try {
      const [friendsData, pendingData, sentData] = await Promise.all([
        getFriends(),
        getPendingRequests(),
        getSentRequests()
      ]);
      friends = friendsData;
      pendingRequests = pendingData;
      sentRequests = sentData;
    } catch (err) {
      console.error('Failed to load friends data:', err);
    } finally {
      loading = false;
    }
  }

  async function handleSearch() {
    if (!searchQuery.trim()) {
      searchResults = [];
      return;
    }

    searching = true;
    try {
      searchResults = await searchUsers(searchQuery);
    } catch (err) {
      console.error('Search failed:', err);
      searchResults = [];
    } finally {
      searching = false;
    }
  }

  async function handleSendRequest(userId) {
    actionLoading = userId;
    try {
      const result = await sendFriendRequest(userId);
      if (result.success) {
        // Refresh sent requests
        sentRequests = await getSentRequests();
        // Remove from search results or mark as pending
        searchResults = searchResults.filter(u => u.user_id !== userId);
      } else {
        alert(result.error || 'Failed to send request');
      }
    } catch (err) {
      console.error('Failed to send request:', err);
    } finally {
      actionLoading = null;
    }
  }

  async function handleAcceptRequest(friendshipId) {
    actionLoading = friendshipId;
    try {
      const result = await acceptFriendRequest(friendshipId);
      if (result.success) {
        await loadData();
      } else {
        alert(result.error || 'Failed to accept request');
      }
    } catch (err) {
      console.error('Failed to accept request:', err);
    } finally {
      actionLoading = null;
    }
  }

  async function handleDeclineRequest(friendshipId) {
    actionLoading = friendshipId;
    try {
      const result = await declineFriendRequest(friendshipId);
      if (result.success) {
        pendingRequests = pendingRequests.filter(r => r.friendshipId !== friendshipId);
      }
    } catch (err) {
      console.error('Failed to decline request:', err);
    } finally {
      actionLoading = null;
    }
  }

  async function handleRemoveFriend(friendshipId) {
    if (!confirm('Remove this friend?')) return;

    actionLoading = friendshipId;
    try {
      const result = await removeFriend(friendshipId);
      if (result.success) {
        friends = friends.filter(f => f.friendshipId !== friendshipId);
      }
    } catch (err) {
      console.error('Failed to remove friend:', err);
    } finally {
      actionLoading = null;
    }
  }

  async function handleBlockUser(userId) {
    if (!confirm('Block this user? They will not be able to send you requests.')) return;

    actionLoading = userId;
    try {
      const result = await blockUser(userId);
      if (result.success) {
        await loadData();
      }
    } catch (err) {
      console.error('Failed to block user:', err);
    } finally {
      actionLoading = null;
    }
  }

  function challengeFriend(friend) {
    if (friend.snapshot) {
      dispatch('challenge', { opponent: friend.snapshot });
    }
  }

  function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString();
  }
</script>

<div class="friends-board">
  <header class="header">
    <h1>Friends</h1>
  </header>

  <!-- Tabs -->
  <div class="tabs">
    <button
      class="tab"
      class:active={activeTab === 'friends'}
      on:click={() => activeTab = 'friends'}
    >
      Friends ({friends.length})
    </button>
    <button
      class="tab"
      class:active={activeTab === 'requests'}
      on:click={() => activeTab = 'requests'}
    >
      Requests
      {#if pendingRequests.length > 0}
        <span class="badge">{pendingRequests.length}</span>
      {/if}
    </button>
    <button
      class="tab"
      class:active={activeTab === 'search'}
      on:click={() => activeTab = 'search'}
    >
      Find
    </button>
  </div>

  {#if loading}
    <div class="loading">Loading...</div>
  {:else}

    <!-- Friends List -->
    {#if activeTab === 'friends'}
      {#if friends.length === 0}
        <div class="empty-state">
          <p>No friends yet.</p>
          <button class="add-btn" on:click={() => activeTab = 'search'}>
            Find Friends
          </button>
        </div>
      {:else}
        <div class="list">
          {#each friends as friend}
            <div class="friend-card">
              <div class="friend-info">
                <span class="friend-name">
                  {friend.snapshot?.username || 'Unknown'}
                </span>
                {#if friend.snapshot}
                  <span class="friend-level">Lv. {friend.snapshot.level}</span>
                {/if}
                <span class="friend-meta">
                  Friends since {formatDate(friend.friendedAt)}
                </span>
              </div>

              <div class="friend-actions">
                {#if friend.snapshot}
                  <button
                    class="action-btn challenge"
                    on:click={() => challengeFriend(friend)}
                  >
                    Challenge
                  </button>
                {/if}
                <button
                  class="action-btn remove"
                  on:click={() => handleRemoveFriend(friend.friendshipId)}
                  disabled={actionLoading === friend.friendshipId}
                >
                  Remove
                </button>
              </div>
            </div>
          {/each}
        </div>
      {/if}
    {/if}

    <!-- Requests -->
    {#if activeTab === 'requests'}
      <div class="requests-section">
        <h3 class="section-title">Received ({pendingRequests.length})</h3>
        {#if pendingRequests.length === 0}
          <p class="empty-text">No pending requests</p>
        {:else}
          <div class="list">
            {#each pendingRequests as request}
              <div class="request-card">
                <div class="request-info">
                  <span class="request-name">
                    {request.snapshot?.username || 'Unknown'}
                  </span>
                  {#if request.snapshot}
                    <span class="request-level">Lv. {request.snapshot.level}</span>
                  {/if}
                </div>
                <div class="request-actions">
                  <button
                    class="action-btn accept"
                    on:click={() => handleAcceptRequest(request.friendshipId)}
                    disabled={actionLoading === request.friendshipId}
                  >
                    Accept
                  </button>
                  <button
                    class="action-btn decline"
                    on:click={() => handleDeclineRequest(request.friendshipId)}
                    disabled={actionLoading === request.friendshipId}
                  >
                    Decline
                  </button>
                </div>
              </div>
            {/each}
          </div>
        {/if}

        <h3 class="section-title">Sent ({sentRequests.length})</h3>
        {#if sentRequests.length === 0}
          <p class="empty-text">No sent requests</p>
        {:else}
          <div class="list">
            {#each sentRequests as request}
              <div class="request-card pending">
                <div class="request-info">
                  <span class="request-name">
                    {request.snapshot?.username || 'Unknown'}
                  </span>
                  <span class="pending-label">Pending...</span>
                </div>
              </div>
            {/each}
          </div>
        {/if}
      </div>
    {/if}

    <!-- Search -->
    {#if activeTab === 'search'}
      <div class="search-section">
        <div class="search-box">
          <input
            type="text"
            bind:value={searchQuery}
            placeholder="Search by username..."
            on:input={handleSearch}
          />
          {#if searching}
            <span class="searching">Searching...</span>
          {/if}
        </div>

        {#if searchResults.length > 0}
          <div class="list">
            {#each searchResults as user}
              <div class="search-result">
                <div class="result-info">
                  <span class="result-name">{user.username}</span>
                  <span class="result-level">Lv. {user.level}</span>
                  {#if user.equipped_title && user.equipped_title !== 'rookie'}
                    <span class="result-title">{user.equipped_title}</span>
                  {/if}
                </div>
                <div class="result-actions">
                  <button
                    class="action-btn add"
                    on:click={() => handleSendRequest(user.user_id)}
                    disabled={actionLoading === user.user_id}
                  >
                    {actionLoading === user.user_id ? '...' : 'Add'}
                  </button>
                </div>
              </div>
            {/each}
          </div>
        {:else if searchQuery && !searching}
          <div class="no-results">No users found</div>
        {:else}
          <div class="search-hint">
            Enter a username to search for friends
          </div>
        {/if}
      </div>
    {/if}
  {/if}

  <button class="back-btn" on:click={() => dispatch('back')}>
    Back
  </button>
</div>

<style>
  .friends-board {
    max-width: 500px;
    margin: 0 auto;
    padding: 20px;
    padding-bottom: 100px;
  }

  .header {
    margin-bottom: 20px;
  }

  .header h1 {
    font-size: 1.5rem;
    color: var(--text-primary);
  }

  .tabs {
    display: flex;
    gap: 4px;
    background: var(--bg-secondary);
    padding: 4px;
    border-radius: 12px;
    margin-bottom: 20px;
  }

  .tab {
    flex: 1;
    padding: 10px 12px;
    border-radius: 8px;
    font-size: 0.9rem;
    font-weight: 500;
    background: transparent;
    color: var(--text-muted);
    border: none;
    cursor: pointer;
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
  }

  .tab.active {
    background: var(--accent);
    color: white;
  }

  .badge {
    background: var(--error);
    color: white;
    font-size: 0.7rem;
    font-weight: 600;
    padding: 2px 6px;
    border-radius: 999px;
    min-width: 18px;
    text-align: center;
  }

  .tab.active .badge {
    background: white;
    color: var(--error);
  }

  .loading, .empty-state {
    text-align: center;
    padding: 40px;
    color: var(--text-muted);
  }

  .add-btn {
    margin-top: 16px;
    padding: 10px 20px;
    background: var(--accent);
    color: white;
    border: none;
    border-radius: 8px;
    font-weight: 500;
    cursor: pointer;
  }

  .list {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .friend-card, .request-card, .search-result {
    display: flex;
    justify-content: space-between;
    align-items: center;
    background: var(--bg-secondary);
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 14px;
  }

  .friend-info, .request-info, .result-info {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .friend-name, .request-name, .result-name {
    font-weight: 600;
    color: var(--text-primary);
  }

  .friend-level, .request-level, .result-level {
    font-size: 0.8rem;
    color: var(--accent);
    font-weight: 500;
  }

  .friend-meta {
    font-size: 0.75rem;
    color: var(--text-muted);
  }

  .pending-label {
    font-size: 0.8rem;
    color: var(--text-muted);
    font-style: italic;
  }

  .result-title {
    font-size: 0.75rem;
    color: var(--warning);
    text-transform: capitalize;
  }

  .friend-actions, .request-actions, .result-actions {
    display: flex;
    gap: 8px;
  }

  .action-btn {
    padding: 8px 14px;
    border: none;
    border-radius: 6px;
    font-size: 0.85rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .action-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .action-btn.challenge {
    background: var(--accent);
    color: white;
  }

  .action-btn.remove {
    background: transparent;
    color: var(--text-muted);
    border: 1px solid var(--border);
  }

  .action-btn.remove:hover {
    color: var(--error);
    border-color: var(--error);
  }

  .action-btn.accept {
    background: var(--success);
    color: white;
  }

  .action-btn.decline {
    background: transparent;
    color: var(--text-muted);
    border: 1px solid var(--border);
  }

  .action-btn.add {
    background: var(--accent);
    color: white;
  }

  .section-title {
    font-size: 0.9rem;
    font-weight: 600;
    color: var(--text-secondary);
    margin: 20px 0 12px;
  }

  .section-title:first-child {
    margin-top: 0;
  }

  .empty-text {
    color: var(--text-muted);
    font-size: 0.9rem;
    padding: 12px 0;
  }

  .search-section {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .search-box {
    position: relative;
  }

  .search-box input {
    width: 100%;
    padding: 14px 16px;
    border: 1px solid var(--border);
    border-radius: 10px;
    background: var(--bg-secondary);
    color: var(--text-primary);
    font-size: 1rem;
  }

  .search-box input:focus {
    outline: none;
    border-color: var(--accent);
  }

  .searching {
    position: absolute;
    right: 14px;
    top: 50%;
    transform: translateY(-50%);
    font-size: 0.8rem;
    color: var(--text-muted);
  }

  .no-results, .search-hint {
    text-align: center;
    color: var(--text-muted);
    padding: 30px;
  }

  .back-btn {
    display: block;
    width: 100%;
    margin-top: 24px;
    padding: 14px;
    background: var(--bg-tertiary);
    color: var(--text-primary);
    border: 1px solid var(--border);
    border-radius: 12px;
    font-weight: 500;
    cursor: pointer;
  }

  .back-btn:hover {
    background: var(--bg-secondary);
  }
</style>
