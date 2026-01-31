<script>
  import { onMount, onDestroy } from 'svelte';
  import Button from '../components/common/Button.svelte';
  import Modal from '../components/common/Modal.svelte';
  import { db } from '../lib/db/index.js';
  import {
    createTask,
    updateTask,
    deleteTask,
    startTask,
    pauseTask,
    completeTask,
    activeTaskTimer,
    formatTimeSpent
  } from '../lib/stores/tasks.js';
  import { showXPGain } from '../lib/stores/notifications.js';

  let tasks = [];
  let loading = true;
  let filter = 'all'; // 'all', 'todo', 'active', 'done'

  // Task form
  let showTaskModal = false;
  let editingTask = null;
  let taskForm = {
    title: '',
    description: '',
    priority: 'medium',
    dueDate: ''
  };

  // Timer
  let timerInterval = null;
  let currentTime = 0;

  onMount(async () => {
    await loadTasks();
    startTimerInterval();
  });

  onDestroy(() => {
    if (timerInterval) {
      clearInterval(timerInterval);
    }
  });

  function startTimerInterval() {
    timerInterval = setInterval(() => {
      const timer = $activeTaskTimer;
      if (timer.taskId && timer.startTime) {
        currentTime = Math.floor((Date.now() - timer.startTime) / 1000);
      } else {
        currentTime = 0;
      }
    }, 1000);
  }

  async function loadTasks() {
    loading = true;
    tasks = await db.tasks.orderBy('order').toArray();
    loading = false;
  }

  // Reactive subscription to db changes
  $: {
    const subscription = db.tasks.hook('changes', () => {
      loadTasks();
    });
  }

  function getFilteredTasks() {
    if (!tasks) return [];

    let filtered = tasks.filter(t => !t.completed || filter === 'done');

    switch (filter) {
      case 'todo':
        return filtered.filter(t => t.status === 'todo');
      case 'active':
        return filtered.filter(t => t.status === 'active');
      case 'done':
        return tasks.filter(t => t.completed).sort((a, b) =>
          new Date(b.completedAt) - new Date(a.completedAt)
        );
      default:
        return filtered.filter(t => !t.completed);
    }
  }

  function openTaskModal(task = null) {
    editingTask = task;
    if (task) {
      taskForm = {
        title: task.title,
        description: task.description || '',
        priority: task.priority,
        dueDate: task.dueDate || ''
      };
    } else {
      taskForm = {
        title: '',
        description: '',
        priority: 'medium',
        dueDate: ''
      };
    }
    showTaskModal = true;
  }

  async function handleSaveTask() {
    if (!taskForm.title.trim()) return;

    if (editingTask) {
      await updateTask(editingTask.id, {
        title: taskForm.title,
        description: taskForm.description,
        priority: taskForm.priority,
        dueDate: taskForm.dueDate || null
      });
    } else {
      await createTask({
        status: 'todo',
        title: taskForm.title,
        description: taskForm.description,
        priority: taskForm.priority,
        dueDate: taskForm.dueDate || null
      });
    }

    showTaskModal = false;
    editingTask = null;
    await loadTasks();
  }

  async function handleStartTask(task) {
    await startTask(task.id);
    await loadTasks();
  }

  async function handlePauseTask(task) {
    await pauseTask(task.id);
    await loadTasks();
  }

  async function handleCompleteTask(task) {
    const result = await completeTask(task.id);
    if (result) {
      showXPGain(result.amount, 'task');
    }
    await loadTasks();
  }

  async function handleDeleteTask(task) {
    if (confirm('Delete this bounty?')) {
      await deleteTask(task.id);
      await loadTasks();
    }
  }

  function getPriorityLabel(priority) {
    switch (priority) {
      case 'high': return 'Hard';
      case 'medium': return 'Normal';
      case 'low': return 'Easy';
      default: return 'Normal';
    }
  }

  function getPriorityXP(priority) {
    switch (priority) {
      case 'high': return '50 XP';
      case 'medium': return '25 XP';
      case 'low': return '10 XP';
      default: return '25 XP';
    }
  }

  function isOverdue(dueDate) {
    if (!dueDate) return false;
    const today = new Date().toISOString().split('T')[0];
    return dueDate < today;
  }

  function isDueToday(dueDate) {
    if (!dueDate) return false;
    const today = new Date().toISOString().split('T')[0];
    return dueDate === today;
  }

  function formatTimer(seconds) {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hrs > 0) {
      return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  $: filteredTasks = getFilteredTasks();
  $: activeTask = tasks.find(t => t.status === 'active');
  $: todoCount = tasks.filter(t => t.status === 'todo' && !t.completed).length;
  $: activeCount = tasks.filter(t => t.status === 'active').length;
  $: doneCount = tasks.filter(t => t.completed).length;
</script>

<div class="bounty-board">
  <header class="board-header">
    <h1>Bounty Board</h1>
    <Button on:click={() => openTaskModal()}>+ New Bounty</Button>
  </header>

  <!-- Active Task Banner -->
  {#if activeTask}
    <div class="active-banner">
      <div class="active-info">
        <span class="active-label">Working on:</span>
        <span class="active-title">{activeTask.title}</span>
      </div>
      <div class="active-timer">
        {formatTimer(currentTime + (activeTask.timeSpent || 0) * 60)}
      </div>
      <div class="active-actions">
        <button class="btn-pause" on:click={() => handlePauseTask(activeTask)}>
          Pause
        </button>
        <button class="btn-complete" on:click={() => handleCompleteTask(activeTask)}>
          Complete
        </button>
      </div>
    </div>
  {/if}

  <!-- Filter Tabs -->
  <div class="filter-tabs">
    <button
      class="filter-tab"
      class:active={filter === 'all'}
      on:click={() => filter = 'all'}
    >
      All ({todoCount + activeCount})
    </button>
    <button
      class="filter-tab"
      class:active={filter === 'todo'}
      on:click={() => filter = 'todo'}
    >
      To Do ({todoCount})
    </button>
    <button
      class="filter-tab"
      class:active={filter === 'active'}
      on:click={() => filter = 'active'}
    >
      Active ({activeCount})
    </button>
    <button
      class="filter-tab"
      class:active={filter === 'done'}
      on:click={() => filter = 'done'}
    >
      Done ({doneCount})
    </button>
  </div>

  <!-- Task List -->
  {#if loading}
    <div class="loading">Loading bounties...</div>
  {:else if filteredTasks.length === 0}
    <div class="empty-state">
      {#if filter === 'all'}
        <p>No bounties yet. Create your first one!</p>
      {:else if filter === 'done'}
        <p>No completed bounties yet.</p>
      {:else}
        <p>No {filter} bounties.</p>
      {/if}
    </div>
  {:else}
    <div class="task-list">
      {#each filteredTasks as task (task.id)}
        <div
          class="task-card"
          class:active={task.status === 'active'}
          class:completed={task.completed}
          class:overdue={isOverdue(task.dueDate) && !task.completed}
          class:due-today={isDueToday(task.dueDate) && !task.completed}
        >
          <div class="task-main" on:click={() => openTaskModal(task)}>
            <div class="task-header">
              <span class="priority-badge priority-{task.priority}">
                {getPriorityLabel(task.priority)}
              </span>
              <span class="xp-reward">{getPriorityXP(task.priority)}</span>
            </div>

            <h3 class="task-title">{task.title}</h3>

            {#if task.description}
              <p class="task-description">{task.description}</p>
            {/if}

            <div class="task-meta">
              {#if task.dueDate}
                <span class="due-date" class:overdue={isOverdue(task.dueDate)}>
                  {task.dueDate}
                </span>
              {/if}
              {#if task.timeSpent > 0 || task.status === 'active'}
                <span class="time-spent">
                  {formatTimeSpent(task.timeSpent || 0)}
                  {#if task.status === 'active'}
                    + {formatTimer(currentTime)}
                  {/if}
                </span>
              {/if}
            </div>
          </div>

          {#if !task.completed}
            <div class="task-actions">
              {#if task.status === 'active'}
                <button class="action-btn pause" on:click={() => handlePauseTask(task)}>
                  Pause
                </button>
                <button class="action-btn complete" on:click={() => handleCompleteTask(task)}>
                  Complete
                </button>
              {:else}
                <button class="action-btn start" on:click={() => handleStartTask(task)}>
                  Start
                </button>
                <button class="action-btn complete" on:click={() => handleCompleteTask(task)}>
                  Done
                </button>
              {/if}
              <button class="action-btn delete" on:click={() => handleDeleteTask(task)}>
                Delete
              </button>
            </div>
          {:else}
            <div class="completed-info">
              <span class="completed-check">Completed</span>
              {#if task.timeSpent > 0}
                <span class="final-time">Time: {formatTimeSpent(task.timeSpent)}</span>
              {/if}
            </div>
          {/if}
        </div>
      {/each}
    </div>
  {/if}
</div>

<!-- Task Modal -->
<Modal
  open={showTaskModal}
  title={editingTask ? 'Edit Bounty' : 'New Bounty'}
  on:close={() => { showTaskModal = false; editingTask = null; }}
>
  <form on:submit|preventDefault={handleSaveTask}>
    <div class="form-group">
      <label for="task-title">Title</label>
      <input
        id="task-title"
        type="text"
        bind:value={taskForm.title}
        placeholder="What needs to be done?"
        required
      />
    </div>

    <div class="form-group">
      <label for="task-description">Description (optional)</label>
      <textarea
        id="task-description"
        bind:value={taskForm.description}
        placeholder="Add more details..."
        rows="3"
      ></textarea>
    </div>

    <div class="form-row">
      <div class="form-group">
        <label for="task-priority">Difficulty</label>
        <select id="task-priority" bind:value={taskForm.priority}>
          <option value="low">Easy (10 XP)</option>
          <option value="medium">Normal (25 XP)</option>
          <option value="high">Hard (50 XP)</option>
        </select>
      </div>

      <div class="form-group">
        <label for="task-due">Due Date</label>
        <input
          id="task-due"
          type="date"
          bind:value={taskForm.dueDate}
        />
      </div>
    </div>
  </form>

  <svelte:fragment slot="footer">
    <Button variant="secondary" on:click={() => { showTaskModal = false; editingTask = null; }}>
      Cancel
    </Button>
    <Button on:click={handleSaveTask} disabled={!taskForm.title.trim()}>
      {editingTask ? 'Save Changes' : 'Create Bounty'}
    </Button>
  </svelte:fragment>
</Modal>

<style>
  .bounty-board {
    max-width: 800px;
    margin: 0 auto;
    padding-bottom: 100px;
  }

  .board-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: var(--spacing-lg);
  }

  .board-header h1 {
    font-size: 1.5rem;
  }

  /* Active Task Banner */
  .active-banner {
    background: linear-gradient(135deg, var(--accent) 0%, var(--accent-dark, #4f46e5) 100%);
    border-radius: var(--radius-lg);
    padding: var(--spacing-md);
    margin-bottom: var(--spacing-lg);
    color: white;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--spacing-md);
  }

  .active-info {
    flex: 1;
    min-width: 150px;
  }

  .active-label {
    font-size: 0.75rem;
    opacity: 0.9;
    display: block;
  }

  .active-title {
    font-weight: 600;
    font-size: 1rem;
  }

  .active-timer {
    font-size: 1.5rem;
    font-weight: 700;
    font-family: monospace;
  }

  .active-actions {
    display: flex;
    gap: var(--spacing-xs);
  }

  .btn-pause, .btn-complete {
    padding: var(--spacing-xs) var(--spacing-md);
    border-radius: var(--radius-md);
    font-weight: 500;
    font-size: 0.875rem;
  }

  .btn-pause {
    background-color: rgba(255, 255, 255, 0.2);
    color: white;
  }

  .btn-complete {
    background-color: white;
    color: var(--accent);
  }

  /* Filter Tabs */
  .filter-tabs {
    display: flex;
    gap: var(--spacing-xs);
    margin-bottom: var(--spacing-lg);
    overflow-x: auto;
    padding-bottom: var(--spacing-xs);
  }

  .filter-tab {
    padding: var(--spacing-sm) var(--spacing-md);
    border-radius: var(--radius-md);
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--text-muted);
    background-color: var(--bg-secondary);
    white-space: nowrap;
    transition: all var(--transition-fast);
  }

  .filter-tab:hover {
    color: var(--text-primary);
  }

  .filter-tab.active {
    background-color: var(--accent);
    color: white;
  }

  /* Task List */
  .task-list {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-md);
  }

  .task-card {
    background-color: var(--bg-secondary);
    border: 1px solid var(--border);
    border-radius: var(--radius-lg);
    overflow: hidden;
    transition: all var(--transition-fast);
  }

  .task-card:hover {
    border-color: var(--border-light);
  }

  .task-card.active {
    border-color: var(--accent);
    box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.2);
  }

  .task-card.completed {
    opacity: 0.7;
  }

  .task-card.overdue {
    border-left: 4px solid var(--error);
  }

  .task-card.due-today {
    border-left: 4px solid var(--warning);
  }

  .task-main {
    padding: var(--spacing-md);
    cursor: pointer;
  }

  .task-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: var(--spacing-sm);
  }

  .priority-badge {
    font-size: 0.75rem;
    font-weight: 600;
    padding: 2px 8px;
    border-radius: var(--radius-full);
    text-transform: uppercase;
  }

  .priority-low {
    background-color: rgba(34, 197, 94, 0.2);
    color: var(--success);
  }

  .priority-medium {
    background-color: rgba(234, 179, 8, 0.2);
    color: var(--warning);
  }

  .priority-high {
    background-color: rgba(239, 68, 68, 0.2);
    color: var(--error);
  }

  .xp-reward {
    font-size: 0.75rem;
    color: var(--accent);
    font-weight: 600;
  }

  .task-title {
    font-size: 1rem;
    font-weight: 600;
    color: var(--text-primary);
    margin-bottom: var(--spacing-xs);
  }

  .task-description {
    font-size: 0.875rem;
    color: var(--text-muted);
    margin-bottom: var(--spacing-sm);
    line-height: 1.4;
  }

  .task-meta {
    display: flex;
    gap: var(--spacing-md);
    font-size: 0.75rem;
    color: var(--text-muted);
  }

  .due-date.overdue {
    color: var(--error);
  }

  .time-spent {
    color: var(--accent);
  }

  /* Task Actions */
  .task-actions {
    display: flex;
    gap: var(--spacing-xs);
    padding: var(--spacing-sm) var(--spacing-md);
    background-color: var(--bg-tertiary);
    border-top: 1px solid var(--border);
  }

  .action-btn {
    flex: 1;
    padding: var(--spacing-sm);
    border-radius: var(--radius-md);
    font-size: 0.875rem;
    font-weight: 500;
    transition: all var(--transition-fast);
  }

  .action-btn.start {
    background-color: var(--accent);
    color: white;
  }

  .action-btn.pause {
    background-color: var(--warning);
    color: white;
  }

  .action-btn.complete {
    background-color: var(--success);
    color: white;
  }

  .action-btn.delete {
    background-color: transparent;
    color: var(--text-muted);
    flex: 0;
    padding: var(--spacing-sm);
  }

  .action-btn.delete:hover {
    color: var(--error);
  }

  /* Completed Info */
  .completed-info {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: var(--spacing-sm) var(--spacing-md);
    background-color: var(--bg-tertiary);
    border-top: 1px solid var(--border);
    font-size: 0.875rem;
  }

  .completed-check {
    color: var(--success);
    font-weight: 500;
  }

  .final-time {
    color: var(--text-muted);
  }

  /* Empty & Loading States */
  .empty-state, .loading {
    text-align: center;
    padding: var(--spacing-2xl);
    color: var(--text-muted);
  }

  /* Form Styles */
  .form-group {
    margin-bottom: var(--spacing-md);
  }

  .form-group label {
    display: block;
    font-weight: 500;
    margin-bottom: var(--spacing-xs);
  }

  .form-group input,
  .form-group textarea,
  .form-group select {
    width: 100%;
  }

  .form-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--spacing-md);
  }

  @media (max-width: 480px) {
    .form-row {
      grid-template-columns: 1fr;
    }

    .active-banner {
      flex-direction: column;
      text-align: center;
    }

    .active-actions {
      width: 100%;
      justify-content: center;
    }
  }
</style>
