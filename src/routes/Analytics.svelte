<script>
  import { onMount } from 'svelte';
  import Card from '../components/common/Card.svelte';
  import { playerData, xpProgress, currentLevel } from '../lib/stores/player.js';
  import { achievementCount } from '../lib/stores/achievements.js';
  import { db } from '../lib/db/index.js';

  let weeklyStats = [];
  let loading = true;

  onMount(async () => {
    await loadStats();
  });

  async function loadStats() {
    loading = true;

    // Get last 7 days of stats
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      days.push(date.toISOString().split('T')[0]);
    }

    const stats = await db.dailyStats.where('date').anyOf(days).toArray();
    const statsMap = {};
    stats.forEach(s => { statsMap[s.date] = s; });

    weeklyStats = days.map(date => ({
      date,
      dayName: new Date(date).toLocaleDateString('en-US', { weekday: 'short' }),
      xpEarned: statsMap[date]?.xpEarned || 0,
      tasksCompleted: statsMap[date]?.tasksCompleted || 0,
      expeditionMinutes: statsMap[date]?.expeditionMinutes || 0
    }));

    loading = false;
  }

  function getMaxValue(key) {
    return Math.max(...weeklyStats.map(s => s[key]), 1);
  }

  $: maxXP = getMaxValue('xpEarned');
  $: maxTasks = getMaxValue('tasksCompleted');
  $: maxExpedition = getMaxValue('expeditionMinutes');

  $: totalWeeklyXP = weeklyStats.reduce((sum, s) => sum + s.xpEarned, 0);
  $: totalWeeklyTasks = weeklyStats.reduce((sum, s) => sum + s.tasksCompleted, 0);
  $: totalWeeklyExpedition = weeklyStats.reduce((sum, s) => sum + s.expeditionMinutes, 0);
</script>

<div class="analytics-page">
  <header class="page-header">
    <h1>Analytics</h1>
  </header>

  <section class="overview-section">
    <div class="stat-cards">
      <Card>
        <div class="stat-card">
          <span class="stat-icon">⭐</span>
          <div class="stat-info">
            <span class="stat-value">{$playerData?.totalXP?.toLocaleString() || 0}</span>
            <span class="stat-label">Total XP</span>
          </div>
        </div>
      </Card>

      <Card>
        <div class="stat-card">
          <span class="stat-icon">🎖️</span>
          <div class="stat-info">
            <span class="stat-value">{$currentLevel}</span>
            <span class="stat-label">Current Level</span>
          </div>
        </div>
      </Card>

      <Card>
        <div class="stat-card">
          <span class="stat-icon">✅</span>
          <div class="stat-info">
            <span class="stat-value">{$playerData?.totalTasksCompleted || 0}</span>
            <span class="stat-label">Tasks Completed</span>
          </div>
        </div>
      </Card>

      <Card>
        <div class="stat-card">
          <span class="stat-icon">🗺️</span>
          <div class="stat-info">
            <span class="stat-value">{$playerData?.totalExpeditionMinutes || 0}</span>
            <span class="stat-label">Expedition Minutes</span>
          </div>
        </div>
      </Card>

      <Card>
        <div class="stat-card">
          <span class="stat-icon">🔥</span>
          <div class="stat-info">
            <span class="stat-value">{$playerData?.longestStreak || 0}</span>
            <span class="stat-label">Longest Streak</span>
          </div>
        </div>
      </Card>

      <Card>
        <div class="stat-card">
          <span class="stat-icon">🏆</span>
          <div class="stat-info">
            <span class="stat-value">{$achievementCount?.unlocked || 0}/{$achievementCount?.total || 0}</span>
            <span class="stat-label">Achievements</span>
          </div>
        </div>
      </Card>
    </div>
  </section>

  <section class="charts-section">
    <h2>This Week</h2>

    {#if loading}
      <div class="loading">Loading stats...</div>
    {:else}
      <div class="weekly-summary">
        <span>{totalWeeklyXP} XP</span>
        <span>{totalWeeklyTasks} tasks</span>
        <span>{totalWeeklyExpedition} min explored</span>
      </div>

      <div class="charts-grid">
        <Card>
          <div class="chart-card">
            <h3>XP Earned</h3>
            <div class="bar-chart">
              {#each weeklyStats as day}
                <div class="bar-container">
                  <div
                    class="bar xp"
                    style="height: {(day.xpEarned / maxXP) * 100}%"
                    title="{day.xpEarned} XP"
                  ></div>
                  <span class="bar-label">{day.dayName}</span>
                </div>
              {/each}
            </div>
          </div>
        </Card>

        <Card>
          <div class="chart-card">
            <h3>Tasks Completed</h3>
            <div class="bar-chart">
              {#each weeklyStats as day}
                <div class="bar-container">
                  <div
                    class="bar tasks"
                    style="height: {(day.tasksCompleted / maxTasks) * 100}%"
                    title="{day.tasksCompleted} tasks"
                  ></div>
                  <span class="bar-label">{day.dayName}</span>
                </div>
              {/each}
            </div>
          </div>
        </Card>

        <Card>
          <div class="chart-card">
            <h3>Expedition Minutes</h3>
            <div class="bar-chart">
              {#each weeklyStats as day}
                <div class="bar-container">
                  <div
                    class="bar expedition"
                    style="height: {(day.expeditionMinutes / maxExpedition) * 100}%"
                    title="{day.expeditionMinutes} min"
                  ></div>
                  <span class="bar-label">{day.dayName}</span>
                </div>
              {/each}
            </div>
          </div>
        </Card>
      </div>
    {/if}
  </section>
</div>

<style>
  .analytics-page {
    max-width: 1000px;
    margin: 0 auto;
  }

  .page-header {
    margin-bottom: var(--spacing-xl);
  }

  .overview-section {
    margin-bottom: var(--spacing-xl);
  }

  .stat-cards {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
    gap: var(--spacing-md);
  }

  .stat-card {
    display: flex;
    align-items: center;
    gap: var(--spacing-md);
    padding: var(--spacing-md);
  }

  .stat-icon {
    font-size: 1.5rem;
  }

  .stat-info {
    display: flex;
    flex-direction: column;
  }

  .stat-value {
    font-size: 1.25rem;
    font-weight: 700;
    color: var(--text-primary);
  }

  .stat-label {
    font-size: 0.75rem;
    color: var(--text-muted);
  }

  .charts-section h2 {
    margin-bottom: var(--spacing-md);
  }

  .weekly-summary {
    display: flex;
    gap: var(--spacing-lg);
    margin-bottom: var(--spacing-lg);
    color: var(--text-muted);
    font-size: 0.875rem;
  }

  .charts-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
    gap: var(--spacing-md);
  }

  .chart-card {
    padding: var(--spacing-md);
  }

  .chart-card h3 {
    font-size: 0.875rem;
    color: var(--text-muted);
    margin-bottom: var(--spacing-md);
  }

  .bar-chart {
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    height: 150px;
    gap: var(--spacing-xs);
  }

  .bar-container {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    height: 100%;
  }

  .bar {
    width: 100%;
    max-width: 32px;
    min-height: 4px;
    border-radius: var(--radius-sm) var(--radius-sm) 0 0;
    margin-top: auto;
    transition: height var(--transition-normal);
  }

  .bar.xp {
    background-color: var(--xp-color);
  }

  .bar.tasks {
    background-color: var(--success);
  }

  .bar.expedition {
    background-color: var(--accent);
  }

  .bar-label {
    font-size: 0.625rem;
    color: var(--text-muted);
    margin-top: var(--spacing-xs);
  }

  .loading {
    text-align: center;
    padding: var(--spacing-xl);
    color: var(--text-muted);
  }
</style>
