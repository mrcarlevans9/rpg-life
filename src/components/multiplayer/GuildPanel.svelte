<script>
  import { onMount } from 'svelte';
  import { createEventDispatcher } from 'svelte';
  import {
    getMyGuild,
    searchGuilds,
    createGuild,
    joinGuild,
    leaveGuild,
    disbandGuild,
    kickMember,
    promoteMember,
    demoteMember,
    transferLeadership,
    getActiveBossFight,
    startBossFight,
    dealBossDamage
  } from '../../lib/services/guildService.js';
  import Card from '../common/Card.svelte';
  import ProgressBar from '../common/ProgressBar.svelte';

  const dispatch = createEventDispatcher();

  let view = 'loading'; // loading, no-guild, guild, search, create
  let guildData = null;
  let activeBoss = null;
  let searchResults = [];
  let searchQuery = '';
  let loading = false;
  let actionLoading = null;

  // Create guild form
  let newGuildName = '';
  let newGuildDescription = '';

  // Boss fight
  let bossPresets = [
    { name: 'Forest Giant', emoji: '🌲', hp: 5000, attack: 30, defense: 15 },
    { name: 'Ancient Dragon', emoji: '🐉', hp: 10000, attack: 50, defense: 25 },
    { name: 'Shadow Lord', emoji: '👤', hp: 7500, attack: 40, defense: 20 },
    { name: 'Crystal Golem', emoji: '💎', hp: 8000, attack: 35, defense: 35 }
  ];
  let selectedBoss = null;
  let showBossSelect = false;

  onMount(async () => {
    await loadGuildData();
  });

  async function loadGuildData() {
    view = 'loading';
    try {
      guildData = await getMyGuild();
      if (guildData) {
        view = 'guild';
        activeBoss = await getActiveBossFight();
      } else {
        view = 'no-guild';
      }
    } catch (err) {
      console.error('Failed to load guild data:', err);
      view = 'no-guild';
    }
  }

  async function handleSearchGuilds() {
    loading = true;
    try {
      searchResults = await searchGuilds(searchQuery);
    } catch (err) {
      console.error('Search failed:', err);
    } finally {
      loading = false;
    }
  }

  async function handleCreateGuild() {
    if (!newGuildName.trim()) return;

    loading = true;
    try {
      const result = await createGuild(newGuildName, newGuildDescription);
      if (result.success) {
        await loadGuildData();
      } else {
        alert(result.error || 'Failed to create guild');
      }
    } catch (err) {
      console.error('Failed to create guild:', err);
    } finally {
      loading = false;
    }
  }

  async function handleJoinGuild(guildId) {
    actionLoading = guildId;
    try {
      const result = await joinGuild(guildId);
      if (result.success) {
        await loadGuildData();
      } else {
        alert(result.error || 'Failed to join guild');
      }
    } catch (err) {
      console.error('Failed to join guild:', err);
    } finally {
      actionLoading = null;
    }
  }

  async function handleLeaveGuild() {
    if (!confirm('Are you sure you want to leave this guild?')) return;

    loading = true;
    try {
      const result = await leaveGuild();
      if (result.success) {
        await loadGuildData();
      } else {
        alert(result.error || 'Failed to leave guild');
      }
    } catch (err) {
      console.error('Failed to leave guild:', err);
    } finally {
      loading = false;
    }
  }

  async function handleDisbandGuild() {
    if (!confirm('Are you sure you want to DISBAND this guild? This cannot be undone!')) return;
    if (!confirm('All members will be removed. Are you absolutely sure?')) return;

    loading = true;
    try {
      const result = await disbandGuild();
      if (result.success) {
        await loadGuildData();
      } else {
        alert(result.error || 'Failed to disband guild');
      }
    } catch (err) {
      console.error('Failed to disband guild:', err);
    } finally {
      loading = false;
    }
  }

  async function handleKickMember(userId, username) {
    if (!confirm(`Kick ${username} from the guild?`)) return;

    actionLoading = userId;
    try {
      const result = await kickMember(userId);
      if (result.success) {
        await loadGuildData();
      } else {
        alert(result.error || 'Failed to kick member');
      }
    } catch (err) {
      console.error('Failed to kick member:', err);
    } finally {
      actionLoading = null;
    }
  }

  async function handlePromoteMember(userId) {
    actionLoading = userId;
    try {
      const result = await promoteMember(userId);
      if (result.success) {
        await loadGuildData();
      } else {
        alert(result.error || 'Failed to promote member');
      }
    } catch (err) {
      console.error('Failed to promote member:', err);
    } finally {
      actionLoading = null;
    }
  }

  async function handleDemoteMember(userId) {
    actionLoading = userId;
    try {
      const result = await demoteMember(userId);
      if (result.success) {
        await loadGuildData();
      } else {
        alert(result.error || 'Failed to demote member');
      }
    } catch (err) {
      console.error('Failed to demote member:', err);
    } finally {
      actionLoading = null;
    }
  }

  async function handleTransferLeadership(userId, username) {
    if (!confirm(`Transfer leadership to ${username}? You will become a regular member.`)) return;

    actionLoading = userId;
    try {
      const result = await transferLeadership(userId);
      if (result.success) {
        await loadGuildData();
      } else {
        alert(result.error || 'Failed to transfer leadership');
      }
    } catch (err) {
      console.error('Failed to transfer leadership:', err);
    } finally {
      actionLoading = null;
    }
  }

  async function handleStartBossFight() {
    if (!selectedBoss) return;

    loading = true;
    try {
      const result = await startBossFight(
        selectedBoss.name,
        selectedBoss.emoji,
        selectedBoss.hp,
        { attack: selectedBoss.attack, defense: selectedBoss.defense },
        24
      );
      if (result.success) {
        activeBoss = result.bossFight;
        showBossSelect = false;
        selectedBoss = null;
      } else {
        alert(result.error || 'Failed to start boss fight');
      }
    } catch (err) {
      console.error('Failed to start boss fight:', err);
    } finally {
      loading = false;
    }
  }

  async function handleAttackBoss() {
    if (!activeBoss) return;

    actionLoading = 'boss';
    try {
      // Calculate damage based on player stats (simplified for now)
      const baseDamage = Math.floor(50 + Math.random() * 50);
      const result = await dealBossDamage(activeBoss.id, baseDamage);

      if (result.success) {
        activeBoss = result.bossFight;
        if (result.wasDefeated) {
          alert('Boss defeated! Great teamwork!');
        }
      } else {
        alert(result.error || 'Failed to attack');
      }
    } catch (err) {
      console.error('Failed to attack boss:', err);
    } finally {
      actionLoading = null;
    }
  }

  function getRoleBadgeClass(role) {
    switch (role) {
      case 'leader': return 'role-leader';
      case 'officer': return 'role-officer';
      default: return 'role-member';
    }
  }

  function formatTimeRemaining(expiresAt) {
    const now = new Date();
    const expires = new Date(expiresAt);
    const diff = expires - now;

    if (diff <= 0) return 'Expired';

    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    return `${hours}h ${minutes}m`;
  }
</script>

<div class="guild-panel">
  <header class="header">
    <h1>Guild</h1>
  </header>

  {#if view === 'loading'}
    <div class="loading-state">Loading...</div>

  {:else if view === 'no-guild'}
    <div class="no-guild">
      <Card>
        <div class="no-guild-content">
          <span class="no-guild-icon">No Guild</span>
          <p>You're not in a guild yet. Join one or create your own!</p>

          <div class="no-guild-actions">
            <button class="btn-primary" on:click={() => view = 'create'}>
              Create Guild
            </button>
            <button class="btn-secondary" on:click={() => { view = 'search'; handleSearchGuilds(); }}>
              Find Guild
            </button>
          </div>
        </div>
      </Card>
    </div>

  {:else if view === 'create'}
    <Card>
      <div class="create-form">
        <h2>Create Guild</h2>

        <div class="form-group">
          <label for="guildName">Guild Name</label>
          <input
            id="guildName"
            type="text"
            bind:value={newGuildName}
            placeholder="Enter guild name"
            maxlength="30"
          />
        </div>

        <div class="form-group">
          <label for="guildDesc">Description (optional)</label>
          <textarea
            id="guildDesc"
            bind:value={newGuildDescription}
            placeholder="Describe your guild..."
            rows="3"
            maxlength="200"
          ></textarea>
        </div>

        <div class="form-actions">
          <button class="btn-secondary" on:click={() => view = 'no-guild'}>
            Cancel
          </button>
          <button
            class="btn-primary"
            on:click={handleCreateGuild}
            disabled={!newGuildName.trim() || loading}
          >
            {loading ? 'Creating...' : 'Create Guild'}
          </button>
        </div>
      </div>
    </Card>

  {:else if view === 'search'}
    <div class="search-view">
      <div class="search-box">
        <input
          type="text"
          bind:value={searchQuery}
          placeholder="Search guilds..."
          on:input={handleSearchGuilds}
        />
      </div>

      {#if loading}
        <div class="loading-state">Searching...</div>
      {:else if searchResults.length === 0}
        <div class="empty-state">No guilds found</div>
      {:else}
        <div class="guild-list">
          {#each searchResults as guild}
            <div class="guild-card">
              <div class="guild-info">
                <span class="guild-name">{guild.name}</span>
                <span class="guild-level">Lv. {guild.level}</span>
                {#if guild.description}
                  <p class="guild-desc">{guild.description}</p>
                {/if}
                <span class="guild-members">
                  {guild.memberCount}/{guild.max_members} members
                </span>
              </div>
              <button
                class="btn-join"
                on:click={() => handleJoinGuild(guild.id)}
                disabled={actionLoading === guild.id || guild.memberCount >= guild.max_members}
              >
                {guild.memberCount >= guild.max_members ? 'Full' : 'Join'}
              </button>
            </div>
          {/each}
        </div>
      {/if}

      <button class="back-btn" on:click={() => view = 'no-guild'}>
        Back
      </button>
    </div>

  {:else if view === 'guild'}
    <div class="guild-view">
      <!-- Guild Header -->
      <Card>
        <div class="guild-header">
          <div class="guild-title">
            <h2>{guildData.guild.name}</h2>
            <span class="guild-level">Level {guildData.guild.level}</span>
          </div>
          {#if guildData.guild.description}
            <p class="guild-description">{guildData.guild.description}</p>
          {/if}
          <div class="guild-stats">
            <div class="stat">
              <span class="stat-value">{guildData.members.length}</span>
              <span class="stat-label">Members</span>
            </div>
            <div class="stat">
              <span class="stat-value">{guildData.guild.total_contribution_xp}</span>
              <span class="stat-label">Total XP</span>
            </div>
            <div class="stat">
              <span class="stat-value">{guildData.guild.bosses_defeated}</span>
              <span class="stat-label">Bosses</span>
            </div>
          </div>
        </div>
      </Card>

      <!-- Boss Fight Section -->
      <div class="section">
        <h3 class="section-title">Guild Boss</h3>

        {#if activeBoss}
          <Card>
            <div class="boss-fight">
              <div class="boss-header">
                <span class="boss-emoji">{activeBoss.boss_emoji}</span>
                <div class="boss-info">
                  <span class="boss-name">{activeBoss.boss_name}</span>
                  <span class="boss-timer">
                    Expires in {formatTimeRemaining(activeBoss.expires_at)}
                  </span>
                </div>
              </div>

              <div class="boss-hp">
                <ProgressBar
                  value={activeBoss.boss_current_hp}
                  max={activeBoss.boss_max_hp}
                  size="lg"
                  color="warning"
                  showLabel
                />
              </div>

              <button
                class="btn-attack"
                on:click={handleAttackBoss}
                disabled={actionLoading === 'boss'}
              >
                {actionLoading === 'boss' ? 'Attacking...' : 'Attack Boss!'}
              </button>

              {#if Object.keys(activeBoss.participants || {}).length > 0}
                <div class="participants">
                  <span class="participants-label">Top Contributors:</span>
                  {#each Object.entries(activeBoss.participants).slice(0, 3) as [userId, data]}
                    <span class="participant">
                      {data.username}: {data.damage} dmg
                    </span>
                  {/each}
                </div>
              {/if}
            </div>
          </Card>
        {:else if guildData.myRole !== 'member'}
          {#if showBossSelect}
            <Card>
              <div class="boss-select">
                <h4>Select a Boss</h4>
                <div class="boss-options">
                  {#each bossPresets as boss}
                    <button
                      class="boss-option"
                      class:selected={selectedBoss === boss}
                      on:click={() => selectedBoss = boss}
                    >
                      <span class="boss-option-emoji">{boss.emoji}</span>
                      <span class="boss-option-name">{boss.name}</span>
                      <span class="boss-option-hp">{boss.hp} HP</span>
                    </button>
                  {/each}
                </div>
                <div class="boss-select-actions">
                  <button class="btn-secondary" on:click={() => showBossSelect = false}>
                    Cancel
                  </button>
                  <button
                    class="btn-primary"
                    on:click={handleStartBossFight}
                    disabled={!selectedBoss || loading}
                  >
                    Start Fight
                  </button>
                </div>
              </div>
            </Card>
          {:else}
            <button class="btn-start-boss" on:click={() => showBossSelect = true}>
              Start Boss Fight
            </button>
          {/if}
        {:else}
          <div class="no-boss">No active boss fight</div>
        {/if}
      </div>

      <!-- Members Section -->
      <div class="section">
        <h3 class="section-title">Members ({guildData.members.length})</h3>

        <div class="member-list">
          {#each guildData.members as member}
            <div class="member-card">
              <div class="member-info">
                <span class="member-name">
                  {member.snapshot?.username || 'Unknown'}
                </span>
                <span class="role-badge {getRoleBadgeClass(member.role)}">
                  {member.role}
                </span>
                <span class="member-contribution">
                  {member.contribution_xp} XP contributed
                </span>
              </div>

              {#if guildData.myRole === 'leader' && member.role !== 'leader'}
                <div class="member-actions">
                  {#if member.role === 'member'}
                    <button
                      class="action-btn"
                      on:click={() => handlePromoteMember(member.user_id)}
                      disabled={actionLoading === member.user_id}
                    >
                      Promote
                    </button>
                  {:else if member.role === 'officer'}
                    <button
                      class="action-btn"
                      on:click={() => handleDemoteMember(member.user_id)}
                      disabled={actionLoading === member.user_id}
                    >
                      Demote
                    </button>
                  {/if}
                  <button
                    class="action-btn kick"
                    on:click={() => handleKickMember(member.user_id, member.snapshot?.username)}
                    disabled={actionLoading === member.user_id}
                  >
                    Kick
                  </button>
                  <button
                    class="action-btn transfer"
                    on:click={() => handleTransferLeadership(member.user_id, member.snapshot?.username)}
                    disabled={actionLoading === member.user_id}
                  >
                    Make Leader
                  </button>
                </div>
              {:else if guildData.myRole === 'officer' && member.role === 'member'}
                <div class="member-actions">
                  <button
                    class="action-btn kick"
                    on:click={() => handleKickMember(member.user_id, member.snapshot?.username)}
                    disabled={actionLoading === member.user_id}
                  >
                    Kick
                  </button>
                </div>
              {/if}
            </div>
          {/each}
        </div>
      </div>

      <!-- Guild Actions -->
      <div class="guild-actions">
        {#if guildData.myRole === 'leader'}
          <button class="btn-danger" on:click={handleDisbandGuild} disabled={loading}>
            Disband Guild
          </button>
        {:else}
          <button class="btn-leave" on:click={handleLeaveGuild} disabled={loading}>
            Leave Guild
          </button>
        {/if}
      </div>
    </div>
  {/if}

  <button class="back-btn" on:click={() => dispatch('back')}>
    Back
  </button>
</div>

<style>
  .guild-panel {
    max-width: 600px;
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

  .loading-state, .empty-state {
    text-align: center;
    padding: 40px;
    color: var(--text-muted);
  }

  /* No Guild View */
  .no-guild-content {
    text-align: center;
    padding: 20px;
  }

  .no-guild-icon {
    font-size: 3rem;
    display: block;
    margin-bottom: 16px;
  }

  .no-guild-content p {
    color: var(--text-muted);
    margin-bottom: 24px;
  }

  .no-guild-actions {
    display: flex;
    gap: 12px;
    justify-content: center;
  }

  /* Buttons */
  .btn-primary {
    padding: 12px 24px;
    background: var(--accent);
    color: white;
    border: none;
    border-radius: 10px;
    font-weight: 600;
    cursor: pointer;
  }

  .btn-primary:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .btn-secondary {
    padding: 12px 24px;
    background: var(--bg-tertiary);
    color: var(--text-primary);
    border: 1px solid var(--border);
    border-radius: 10px;
    font-weight: 600;
    cursor: pointer;
  }

  .btn-danger {
    padding: 12px 24px;
    background: transparent;
    color: var(--error);
    border: 1px solid var(--error);
    border-radius: 10px;
    font-weight: 600;
    cursor: pointer;
  }

  .btn-leave {
    padding: 12px 24px;
    background: transparent;
    color: var(--text-muted);
    border: 1px solid var(--border);
    border-radius: 10px;
    font-weight: 600;
    cursor: pointer;
  }

  /* Create Form */
  .create-form {
    padding: 8px;
  }

  .create-form h2 {
    margin-bottom: 20px;
    font-size: 1.25rem;
  }

  .form-group {
    margin-bottom: 16px;
  }

  .form-group label {
    display: block;
    margin-bottom: 6px;
    font-weight: 500;
    color: var(--text-primary);
  }

  .form-group input,
  .form-group textarea {
    width: 100%;
    padding: 12px;
    border: 1px solid var(--border);
    border-radius: 8px;
    background: var(--bg-tertiary);
    color: var(--text-primary);
    font-size: 1rem;
  }

  .form-actions {
    display: flex;
    gap: 12px;
    justify-content: flex-end;
    margin-top: 20px;
  }

  /* Search View */
  .search-box {
    margin-bottom: 16px;
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

  .guild-list {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .guild-card {
    display: flex;
    justify-content: space-between;
    align-items: center;
    background: var(--bg-secondary);
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 14px;
  }

  .guild-info {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .guild-name {
    font-weight: 600;
    color: var(--text-primary);
  }

  .guild-level {
    font-size: 0.8rem;
    color: var(--accent);
    font-weight: 500;
  }

  .guild-desc {
    font-size: 0.85rem;
    color: var(--text-muted);
    margin: 4px 0;
  }

  .guild-members {
    font-size: 0.8rem;
    color: var(--text-muted);
  }

  .btn-join {
    padding: 8px 16px;
    background: var(--accent);
    color: white;
    border: none;
    border-radius: 6px;
    font-weight: 500;
    cursor: pointer;
  }

  .btn-join:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  /* Guild View */
  .guild-header {
    padding: 8px;
  }

  .guild-title {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 8px;
  }

  .guild-title h2 {
    font-size: 1.25rem;
    color: var(--text-primary);
  }

  .guild-description {
    color: var(--text-muted);
    font-size: 0.9rem;
    margin-bottom: 16px;
  }

  .guild-stats {
    display: flex;
    gap: 24px;
    padding-top: 12px;
    border-top: 1px solid var(--border);
  }

  .stat {
    display: flex;
    flex-direction: column;
    align-items: center;
  }

  .stat-value {
    font-size: 1.25rem;
    font-weight: 700;
    color: var(--text-primary);
  }

  .stat-label {
    font-size: 0.75rem;
    color: var(--text-muted);
    text-transform: uppercase;
  }

  .section {
    margin-top: 24px;
  }

  .section-title {
    font-size: 1rem;
    font-weight: 600;
    color: var(--text-secondary);
    margin-bottom: 12px;
  }

  /* Boss Fight */
  .boss-fight {
    padding: 8px;
  }

  .boss-header {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 16px;
  }

  .boss-emoji {
    font-size: 2.5rem;
  }

  .boss-info {
    display: flex;
    flex-direction: column;
  }

  .boss-name {
    font-weight: 600;
    font-size: 1.1rem;
    color: var(--text-primary);
  }

  .boss-timer {
    font-size: 0.85rem;
    color: var(--warning);
  }

  .boss-hp {
    margin-bottom: 16px;
  }

  .btn-attack {
    width: 100%;
    padding: 14px;
    background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
    color: white;
    border: none;
    border-radius: 10px;
    font-size: 1.1rem;
    font-weight: 600;
    cursor: pointer;
  }

  .btn-attack:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .participants {
    margin-top: 12px;
    padding-top: 12px;
    border-top: 1px solid var(--border);
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    align-items: center;
  }

  .participants-label {
    font-size: 0.8rem;
    color: var(--text-muted);
  }

  .participant {
    font-size: 0.8rem;
    padding: 4px 10px;
    background: var(--bg-tertiary);
    border-radius: 999px;
    color: var(--text-secondary);
  }

  .no-boss {
    text-align: center;
    padding: 20px;
    color: var(--text-muted);
    background: var(--bg-secondary);
    border: 1px dashed var(--border);
    border-radius: 10px;
  }

  .btn-start-boss {
    width: 100%;
    padding: 14px;
    background: var(--bg-secondary);
    color: var(--accent);
    border: 2px dashed var(--accent);
    border-radius: 10px;
    font-weight: 600;
    cursor: pointer;
  }

  .boss-select {
    padding: 8px;
  }

  .boss-select h4 {
    margin-bottom: 16px;
    color: var(--text-primary);
  }

  .boss-options {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
    margin-bottom: 16px;
  }

  .boss-option {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    padding: 12px;
    background: var(--bg-tertiary);
    border: 2px solid var(--border);
    border-radius: 10px;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .boss-option:hover {
    border-color: var(--accent);
  }

  .boss-option.selected {
    border-color: var(--accent);
    background: rgba(99, 102, 241, 0.1);
  }

  .boss-option-emoji {
    font-size: 1.5rem;
  }

  .boss-option-name {
    font-weight: 600;
    font-size: 0.85rem;
    color: var(--text-primary);
  }

  .boss-option-hp {
    font-size: 0.75rem;
    color: var(--text-muted);
  }

  .boss-select-actions {
    display: flex;
    gap: 12px;
    justify-content: flex-end;
  }

  /* Member List */
  .member-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .member-card {
    display: flex;
    justify-content: space-between;
    align-items: center;
    background: var(--bg-secondary);
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 12px 14px;
  }

  .member-info {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
  }

  .member-name {
    font-weight: 600;
    color: var(--text-primary);
  }

  .role-badge {
    font-size: 0.7rem;
    font-weight: 600;
    padding: 3px 8px;
    border-radius: 999px;
    text-transform: uppercase;
  }

  .role-leader {
    background: rgba(234, 179, 8, 0.2);
    color: #eab308;
  }

  .role-officer {
    background: rgba(99, 102, 241, 0.2);
    color: #6366f1;
  }

  .role-member {
    background: var(--bg-tertiary);
    color: var(--text-muted);
  }

  .member-contribution {
    font-size: 0.8rem;
    color: var(--text-muted);
    width: 100%;
  }

  .member-actions {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
  }

  .action-btn {
    padding: 6px 10px;
    font-size: 0.75rem;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    background: var(--bg-tertiary);
    color: var(--text-secondary);
  }

  .action-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .action-btn.kick {
    color: var(--error);
  }

  .action-btn.transfer {
    background: rgba(234, 179, 8, 0.2);
    color: #eab308;
  }

  .guild-actions {
    margin-top: 24px;
    display: flex;
    justify-content: center;
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
