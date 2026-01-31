<script>
  import { onMount, onDestroy } from 'svelte';
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
  let filter = 'all';

  let showModal = false;
  let editingTask = null;
  let taskForm = {
    title: '',
    description: '',
    priority: 'medium',
    dueDate: ''
  };

  let timerInterval = null;
  let currentTime = 0;

  onMount(async () => {
    console.log('Board mounted, loading tasks...');
    console.log('localStorage rpglife_db_reset_v:', localStorage.getItem('rpglife_db_reset_v'));
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
    try {
      loading = true;
      // Ensure db is open
      if (!db.isOpen()) {
        console.log('DB was closed, opening...');
        await db.open();
      }
      console.log('DB is open:', db.isOpen());
      const allTasks = await db.tasks.toArray();
      console.log('All tasks in DB:', allTasks);
      tasks = allTasks.sort((a, b) => (a.order || 0) - (b.order || 0));
      console.log('Loaded tasks:', tasks.length, tasks);
    } catch (err) {
      console.error('Error loading tasks:', err);
      tasks = [];
    } finally {
      loading = false;
    }
  }

  function openModal(task = null) {
    editingTask = task;
    if (task) {
      taskForm = {
        title: task.title,
        description: task.description || '',
        priority: task.priority,
        dueDate: task.dueDate || ''
      };
    } else {
      taskForm = { title: '', description: '', priority: 'medium', dueDate: '' };
    }
    showModal = true;
  }

  function closeModal() {
    showModal = false;
    editingTask = null;
  }

  async function handleSaveTask() {
    if (!taskForm.title.trim()) return;

    try {
      console.log('Saving task:', taskForm);

      if (editingTask) {
        await updateTask(editingTask.id, {
          title: taskForm.title,
          description: taskForm.description,
          priority: taskForm.priority,
          dueDate: taskForm.dueDate || null
        });
        console.log('Task updated successfully');
      } else {
        const newId = await createTask({
          status: 'todo',
          title: taskForm.title,
          description: taskForm.description,
          priority: taskForm.priority,
          dueDate: taskForm.dueDate || null
        });
        console.log('Task created with id:', newId);
      }
      closeModal();
      await loadTasks();
      console.log('Tasks reloaded, count:', tasks.length);
    } catch (err) {
      console.error('Error saving task:', err);
      alert('Failed to save bounty: ' + err.message);
    }
  }

  async function handleStartTask(task) {
    try {
      await startTask(task.id);
      await loadTasks();
    } catch (err) {
      console.error('Error starting task:', err);
    }
  }

  async function handlePauseTask(task) {
    try {
      await pauseTask(task.id);
      await loadTasks();
    } catch (err) {
      console.error('Error pausing task:', err);
    }
  }

  async function handleCompleteTask(task) {
    try {
      const result = await completeTask(task.id);
      if (result) {
        showXPGain(result.amount || 25, 'task');
      }
      await loadTasks();
    } catch (err) {
      console.error('Error completing task:', err);
    }
  }

  async function handleDeleteTask(task) {
    if (confirm('Delete this bounty?')) {
      try {
        await deleteTask(task.id);
        await loadTasks();
      } catch (err) {
        console.error('Error deleting task:', err);
      }
    }
  }

  function getFilteredTasks() {
    if (!tasks) return [];

    switch (filter) {
      case 'todo':
        return tasks.filter(t => t.status === 'todo' && !t.completed);
      case 'active':
        return tasks.filter(t => t.status === 'active');
      case 'done':
        return tasks.filter(t => t.completed);
      default:
        return tasks.filter(t => !t.completed);
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

  function getXPReward(priority) {
    switch (priority) {
      case 'high': return '50 XP';
      case 'medium': return '25 XP';
      case 'low': return '10 XP';
      default: return '25 XP';
    }
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
  </header>

  <button class="new-bounty-btn" on:click={() => openModal()}>
    + New Bounty
  </button>

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
        <button class="btn-pause" on:click={() => handlePauseTask(activeTask)}>Pause</button>
        <button class="btn-complete" on:click={() => handleCompleteTask(activeTask)}>Complete</button>
      </div>
    </div>
  {/if}

  <!-- Filter Tabs -->
  <div class="filter-tabs">
    <button class="filter-tab" class:active={filter === 'all'} on:click={() => filter = 'all'}>
      All ({todoCount + activeCount})
    </button>
    <button class="filter-tab" class:active={filter === 'todo'} on:click={() => filter = 'todo'}>
      To Do ({todoCount})
    </button>
    <button class="filter-tab" class:active={filter === 'active'} on:click={() => filter = 'active'}>
      Active ({activeCount})
    </button>
    <button class="filter-tab" class:active={filter === 'done'} on:click={() => filter = 'done'}>
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
        <div class="task-card" class:active={task.status === 'active'} class:completed={task.completed}>
          <div class="task-main" on:click={() => openModal(task)} role="button" tabindex="0" on:keypress={(e) => e.key === 'Enter' && openModal(task)}>
            <div class="task-header">
              <span class="priority-badge priority-{task.priority}">
                {getPriorityLabel(task.priority)}
              </span>
              <span class="xp-reward">{getXPReward(task.priority)}</span>
            </div>
            <h3 class="task-title">{task.title}</h3>
            {#if task.description}
              <p class="task-description">{task.description}</p>
            {/if}
            <div class="task-meta">
              {#if task.dueDate}
                <span class="due-date">{task.dueDate}</span>
              {/if}
              {#if task.timeSpent > 0 || task.status === 'active'}
                <span class="time-spent">
                  {formatTimeSpent(task.timeSpent || 0)}
                  {#if task.status === 'active'}+ {formatTimer(currentTime)}{/if}
                </span>
              {/if}
            </div>
          </div>

          {#if !task.completed}
            <div class="task-actions">
              {#if task.status === 'active'}
                <button class="action-btn pause" on:click={() => handlePauseTask(task)}>Pause</button>
                <button class="action-btn complete" on:click={() => handleCompleteTask(task)}>Complete</button>
              {:else}
                <button class="action-btn start" on:click={() => handleStartTask(task)}>Start</button>
                <button class="action-btn complete" on:click={() => handleCompleteTask(task)}>Done</button>
              {/if}
              <button class="action-btn delete" on:click={() => handleDeleteTask(task)}>Delete</button>
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

<!-- Modal -->
{#if showModal}
  <div class="modal-backdrop" on:click={closeModal} role="button" tabindex="0" on:keypress={(e) => e.key === 'Escape' && closeModal()}>
    <div class="modal-content" on:click|stopPropagation role="dialog" aria-modal="true">
      <h2>{editingTask ? 'Edit Bounty' : 'New Bounty'}</h2>

      <div class="form-group">
        <label for="title">Title</label>
        <input id="title" type="text" bind:value={taskForm.title} placeholder="What needs to be done?" />
      </div>

      <div class="form-group">
        <label for="description">Description</label>
        <textarea id="description" bind:value={taskForm.description} placeholder="Add details..." rows="3"></textarea>
      </div>

      <div class="form-row">
        <div class="form-group">
          <label for="priority">Difficulty</label>
          <select id="priority" bind:value={taskForm.priority}>
            <option value="low">Easy (10 XP)</option>
            <option value="medium">Normal (25 XP)</option>
            <option value="high">Hard (50 XP)</option>
          </select>
        </div>

        <div class="form-group">
          <label for="dueDate">Due Date</label>
          <input id="dueDate" type="date" bind:value={taskForm.dueDate} />
        </div>
      </div>

      <div class="modal-footer">
        <button class="btn-secondary" on:click={closeModal}>Cancel</button>
        <button class="btn-primary" on:click={handleSaveTask} disabled={!taskForm.title.trim()}>
          {editingTask ? 'Save Changes' : 'Create Bounty'}
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  .bounty-board {
    max-width: 800px;
    margin: 0 auto;
    padding: 20px;
    padding-bottom: 100px;
  }

  .board-header {
    margin-bottom: 20px;
  }

  .board-header h1 {
    font-size: 1.5rem;
    color: var(--text-primary);
  }

  .new-bounty-btn {
    display: block;
    width: 100%;
    padding: 16px;
    margin-bottom: 20px;
    background: #6366f1;
    color: white;
    font-size: 18px;
    font-weight: bold;
    border: none;
    border-radius: 12px;
    cursor: pointer;
  }

  .new-bounty-btn:hover {
    background: #4f46e5;
  }

  /* Active Banner */
  .active-banner {
    background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%);
    border-radius: 12px;
    padding: 16px;
    margin-bottom: 20px;
    color: white;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 16px;
  }

  .active-info {
    flex: 1;
    min-width: 150px;
  }

  .active-label {
    font-size: 12px;
    opacity: 0.9;
    display: block;
  }

  .active-title {
    font-weight: 600;
  }

  .active-timer {
    font-size: 1.5rem;
    font-weight: 700;
    font-family: monospace;
  }

  .active-actions {
    display: flex;
    gap: 8px;
  }

  .btn-pause, .btn-complete {
    padding: 8px 16px;
    border-radius: 8px;
    font-weight: 500;
    border: none;
    cursor: pointer;
  }

  .btn-pause {
    background: rgba(255, 255, 255, 0.2);
    color: white;
  }

  .btn-complete {
    background: white;
    color: #6366f1;
  }

  /* Filter Tabs */
  .filter-tabs {
    display: flex;
    gap: 4px;
    margin-bottom: 20px;
    background: var(--bg-secondary);
    padding: 4px;
    border-radius: 12px;
  }

  .filter-tab {
    flex: 1;
    padding: 10px 12px;
    border-radius: 8px;
    font-size: 13px;
    font-weight: 500;
    background: transparent;
    color: var(--text-muted);
    border: none;
    cursor: pointer;
    white-space: nowrap;
    transition: all 0.2s ease;
  }

  .filter-tab:hover {
    color: var(--text-primary);
  }

  .filter-tab.active {
    background: #6366f1;
    color: white;
    box-shadow: 0 2px 4px rgba(99, 102, 241, 0.3);
  }

  /* Task List */
  .task-list {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .task-card {
    background: var(--bg-secondary);
    border: 1px solid var(--border);
    border-radius: 12px;
    overflow: hidden;
  }

  .task-card.active {
    border-color: #6366f1;
    box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.2);
  }

  .task-card.completed {
    opacity: 0.7;
  }

  .task-main {
    padding: 16px;
    cursor: pointer;
  }

  .task-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 8px;
  }

  .priority-badge {
    font-size: 12px;
    font-weight: 600;
    padding: 2px 8px;
    border-radius: 999px;
    text-transform: uppercase;
  }

  .priority-low {
    background: rgba(34, 197, 94, 0.2);
    color: #22c55e;
  }

  .priority-medium {
    background: rgba(234, 179, 8, 0.2);
    color: #eab308;
  }

  .priority-high {
    background: rgba(239, 68, 68, 0.2);
    color: #ef4444;
  }

  .xp-reward {
    font-size: 12px;
    color: #6366f1;
    font-weight: 600;
  }

  .task-title {
    font-size: 16px;
    font-weight: 600;
    color: var(--text-primary);
    margin-bottom: 4px;
  }

  .task-description {
    font-size: 14px;
    color: var(--text-muted);
    margin-bottom: 8px;
  }

  .task-meta {
    display: flex;
    gap: 12px;
    font-size: 12px;
    color: var(--text-muted);
  }

  .time-spent {
    color: #6366f1;
  }

  /* Task Actions */
  .task-actions {
    display: flex;
    gap: 8px;
    padding: 12px 16px;
    background: var(--bg-tertiary);
    border-top: 1px solid var(--border);
  }

  .action-btn {
    flex: 1;
    padding: 10px;
    border-radius: 8px;
    font-size: 14px;
    font-weight: 500;
    border: none;
    cursor: pointer;
  }

  .action-btn.start {
    background: #6366f1;
    color: white;
  }

  .action-btn.pause {
    background: #eab308;
    color: white;
  }

  .action-btn.complete {
    background: #22c55e;
    color: white;
  }

  .action-btn.delete {
    background: transparent;
    color: var(--text-muted);
    flex: 0;
  }

  .action-btn.delete:hover {
    color: #ef4444;
  }

  .completed-info {
    display: flex;
    justify-content: space-between;
    padding: 12px 16px;
    background: var(--bg-tertiary);
    border-top: 1px solid var(--border);
    font-size: 14px;
  }

  .completed-check {
    color: #22c55e;
    font-weight: 500;
  }

  .final-time {
    color: var(--text-muted);
  }

  /* Empty & Loading */
  .empty-state, .loading {
    text-align: center;
    padding: 40px;
    color: var(--text-muted);
  }

  /* Modal */
  .modal-backdrop {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
  }

  .modal-content {
    background: var(--bg-primary);
    border-radius: 16px;
    padding: 24px;
    width: 90%;
    max-width: 400px;
  }

  .modal-content h2 {
    margin-bottom: 20px;
    color: var(--text-primary);
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
  .form-group textarea,
  .form-group select {
    width: 100%;
    padding: 10px;
    border: 1px solid var(--border);
    border-radius: 8px;
    background: var(--bg-secondary);
    color: var(--text-primary);
  }

  .form-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16px;
  }

  .modal-footer {
    display: flex;
    gap: 12px;
    justify-content: flex-end;
    margin-top: 20px;
  }

  .btn-secondary {
    padding: 10px 20px;
    border-radius: 8px;
    background: var(--bg-secondary);
    color: var(--text-primary);
    border: 1px solid var(--border);
    cursor: pointer;
  }

  .btn-primary {
    padding: 10px 20px;
    border-radius: 8px;
    background: #6366f1;
    color: white;
    border: none;
    cursor: pointer;
  }

  .btn-primary:disabled {
    opacity: 0.5;
    cursor: not-allowed;
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
