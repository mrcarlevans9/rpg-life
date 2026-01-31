<script>
  // Minimal test - no complex imports
  let showModal = false;
  let tasks = [];
  let loading = false;
  let filter = 'all';

  let taskForm = {
    title: '',
    description: '',
    priority: 'medium',
    dueDate: ''
  };

  function openModal() {
    showModal = true;
  }

  function closeModal() {
    showModal = false;
  }

  async function handleSaveTask() {
    if (!taskForm.title.trim()) return;

    // For now, just add to local array
    tasks = [...tasks, {
      id: Date.now(),
      title: taskForm.title,
      description: taskForm.description,
      priority: taskForm.priority,
      dueDate: taskForm.dueDate,
      status: 'todo',
      completed: false
    }];

    taskForm = { title: '', description: '', priority: 'medium', dueDate: '' };
    showModal = false;
  }

  function getPriorityLabel(priority) {
    switch (priority) {
      case 'high': return 'Hard';
      case 'medium': return 'Normal';
      case 'low': return 'Easy';
      default: return 'Normal';
    }
  }
</script>

<div class="bounty-board">
  <header class="board-header">
    <h1>Bounty Board</h1>
  </header>

  <button class="new-bounty-btn" on:click={openModal}>
    + New Bounty
  </button>

  <!-- Filter Tabs -->
  <div class="filter-tabs">
    <button class="filter-tab" class:active={filter === 'all'} on:click={() => filter = 'all'}>
      All ({tasks.length})
    </button>
    <button class="filter-tab" class:active={filter === 'todo'} on:click={() => filter = 'todo'}>
      To Do
    </button>
    <button class="filter-tab" class:active={filter === 'done'} on:click={() => filter = 'done'}>
      Done
    </button>
  </div>

  <!-- Task List -->
  {#if tasks.length === 0}
    <div class="empty-state">
      <p>No bounties yet. Create your first one!</p>
    </div>
  {:else}
    <div class="task-list">
      {#each tasks as task (task.id)}
        <div class="task-card">
          <div class="task-header">
            <span class="priority-badge priority-{task.priority}">
              {getPriorityLabel(task.priority)}
            </span>
          </div>
          <h3 class="task-title">{task.title}</h3>
          {#if task.description}
            <p class="task-description">{task.description}</p>
          {/if}
        </div>
      {/each}
    </div>
  {/if}
</div>

<!-- Modal -->
{#if showModal}
  <div class="modal-backdrop" on:click={closeModal}>
    <div class="modal-content" on:click|stopPropagation>
      <h2>New Bounty</h2>

      <div class="form-group">
        <label for="title">Title</label>
        <input id="title" type="text" bind:value={taskForm.title} placeholder="What needs to be done?" />
      </div>

      <div class="form-group">
        <label for="description">Description</label>
        <textarea id="description" bind:value={taskForm.description} placeholder="Add details..." rows="3"></textarea>
      </div>

      <div class="form-group">
        <label for="priority">Difficulty</label>
        <select id="priority" bind:value={taskForm.priority}>
          <option value="low">Easy</option>
          <option value="medium">Normal</option>
          <option value="high">Hard</option>
        </select>
      </div>

      <div class="modal-footer">
        <button class="btn-secondary" on:click={closeModal}>Cancel</button>
        <button class="btn-primary" on:click={handleSaveTask} disabled={!taskForm.title.trim()}>
          Create Bounty
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

  .filter-tabs {
    display: flex;
    gap: 8px;
    margin-bottom: 20px;
  }

  .filter-tab {
    padding: 8px 16px;
    border-radius: 8px;
    font-size: 14px;
    background: var(--bg-secondary);
    color: var(--text-muted);
    border: none;
    cursor: pointer;
  }

  .filter-tab.active {
    background: #6366f1;
    color: white;
  }

  .empty-state {
    text-align: center;
    padding: 40px;
    color: var(--text-muted);
  }

  .task-list {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .task-card {
    background: var(--bg-secondary);
    border: 1px solid var(--border);
    border-radius: 12px;
    padding: 16px;
  }

  .task-header {
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

  .task-title {
    font-size: 16px;
    font-weight: 600;
    color: var(--text-primary);
    margin-bottom: 4px;
  }

  .task-description {
    font-size: 14px;
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
</style>
