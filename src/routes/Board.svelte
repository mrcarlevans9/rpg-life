<script>
  import { onMount, onDestroy } from 'svelte';
  import { dndzone } from 'svelte-dnd-action';
  import Card from '../components/common/Card.svelte';
  import Button from '../components/common/Button.svelte';
  import Modal from '../components/common/Modal.svelte';
  import { db } from '../lib/db/index.js';
  import { boardData, getBoard, addColumn, updateColumn, deleteColumn } from '../lib/stores/board.js';
  import { createTask, updateTask, completeTask, deleteTask, moveTaskToColumn } from '../lib/stores/tasks.js';
  import { showXPGain } from '../lib/stores/notifications.js';

  let board = null;
  let tasks = [];
  let loading = true;

  // Task form
  let showTaskModal = false;
  let editingTask = null;
  let taskForm = {
    title: '',
    description: '',
    priority: 'medium',
    dueDate: '',
    columnId: 'todo'
  };

  // Column management
  let showColumnModal = false;
  let newColumnName = '';
  let editingColumn = null;

  // Drag scrolling
  let boardContainer;
  let isDragging = false;

  const flipDurationMs = 200;

  onMount(async () => {
    await loadBoard();
  });

  onDestroy(() => {
    stopAutoScroll();
  });

  async function loadBoard() {
    loading = true;
    board = await getBoard();
    if (board) {
      tasks = await db.tasks.toArray();
    }
    loading = false;
  }

  // Subscribe to board changes
  $: if ($boardData) {
    board = $boardData;
  }

  function getColumnTasks(columnId) {
    return tasks
      .filter(t => t.columnId === columnId && !t.completed)
      .sort((a, b) => a.order - b.order)
      .map(t => ({ ...t, id: t.id }));
  }

  function getCompletedTasks() {
    return tasks.filter(t => t.completed).sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt));
  }

  function handleDndConsider(columnId, e) {
    const newItems = e.detail.items;
    isDragging = true;

    // Update local state temporarily
    tasks = tasks.map(t => {
      const found = newItems.find(item => item.id === t.id);
      if (found) {
        return { ...t, columnId };
      }
      return t;
    });
  }

  async function handleDndFinalize(columnId, e) {
    const newItems = e.detail.items;
    isDragging = false;
    stopAutoScroll();

    // Update database
    for (let i = 0; i < newItems.length; i++) {
      const item = newItems[i];
      await moveTaskToColumn(item.id, columnId, i);
    }

    await loadBoard();
  }

  // Auto-scroll during drag - track pointer position
  let lastPointerX = 0;
  let scrollInterval = null;

  function handlePointerMove(e) {
    // Track position from mouse, touch, or pointer events
    if (e.clientX !== undefined) {
      lastPointerX = e.clientX;
    } else if (e.touches && e.touches[0]) {
      lastPointerX = e.touches[0].clientX;
    }
  }

  // Start polling for scroll when drag begins
  function startDragScrolling() {
    if (scrollInterval) return;

    scrollInterval = setInterval(() => {
      if (!isDragging || !boardContainer) return;

      const rect = boardContainer.getBoundingClientRect();
      const threshold = 60;
      const scrollSpeed = 8;

      if (lastPointerX > 0 && lastPointerX - rect.left < threshold) {
        boardContainer.scrollLeft -= scrollSpeed;
      } else if (lastPointerX > 0 && rect.right - lastPointerX < threshold) {
        boardContainer.scrollLeft += scrollSpeed;
      }
    }, 16);
  }

  function stopAutoScroll() {
    if (scrollInterval) {
      clearInterval(scrollInterval);
      scrollInterval = null;
    }
  }

  // Watch isDragging to start/stop scroll polling
  $: if (isDragging) {
    startDragScrolling();
  } else {
    stopAutoScroll();
  }

  function openTaskModal(columnId = 'todo', task = null) {
    editingTask = task;
    if (task) {
      taskForm = {
        title: task.title,
        description: task.description || '',
        priority: task.priority,
        dueDate: task.dueDate || '',
        columnId: task.columnId
      };
    } else {
      taskForm = {
        title: '',
        description: '',
        priority: 'medium',
        dueDate: '',
        columnId
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
        columnId: taskForm.columnId,
        title: taskForm.title,
        description: taskForm.description,
        priority: taskForm.priority,
        dueDate: taskForm.dueDate || null
      });
    }

    showTaskModal = false;
    editingTask = null;
    await loadBoard();
  }

  async function handleCompleteTask(task) {
    const result = await completeTask(task.id);
    if (result) {
      showXPGain(result.amount, 'task');
    }
    await loadBoard();
  }

  async function handleDeleteTask(task) {
    if (confirm('Delete this task?')) {
      await deleteTask(task.id);
      await loadBoard();
    }
  }

  // Column management
  function openColumnModal(column = null) {
    editingColumn = column;
    newColumnName = column ? column.name : '';
    showColumnModal = true;
  }

  async function handleSaveColumn() {
    if (!newColumnName.trim()) return;

    if (editingColumn) {
      await updateColumn(editingColumn.id, newColumnName);
    } else {
      await addColumn(newColumnName);
    }

    showColumnModal = false;
    editingColumn = null;
    newColumnName = '';
    await loadBoard();
  }

  async function handleDeleteColumn(column) {
    if (board.columns.length <= 1) {
      alert('Cannot delete the last column');
      return;
    }

    const taskCount = getColumnTasks(column.id).length;
    const message = taskCount > 0
      ? `Delete "${column.name}"? ${taskCount} task(s) will be moved to the first column.`
      : `Delete "${column.name}"?`;

    if (confirm(message)) {
      await deleteColumn(column.id);
      await loadBoard();
    }
  }

  function getPriorityClass(priority) {
    return `priority-${priority}`;
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
</script>

<svelte:window
  on:pointermove={handlePointerMove}
  on:pointerup={stopAutoScroll}
  on:touchmove={handlePointerMove}
  on:touchend={stopAutoScroll}
/>

<div class="board-page">
  {#if loading}
    <div class="loading">Loading board...</div>
  {:else if !board}
    <div class="not-found">
      <h2>Board not found</h2>
      <p>Please refresh the page.</p>
    </div>
  {:else}
    <header class="board-header">
      <h1>Task Board</h1>
      <Button variant="secondary" on:click={() => openColumnModal()}>
        + Add Column
      </Button>
    </header>

    <div class="kanban-board" bind:this={boardContainer}>
      {#each board.columns as column}
        <div class="kanban-column">
          <div class="column-header">
            <button class="column-title" on:click={() => openColumnModal(column)}>
              <h3>{column.name}</h3>
            </button>
            <div class="column-actions">
              <span class="task-count">{getColumnTasks(column.id).length}</span>
              {#if board.columns.length > 1}
                <button
                  class="column-delete"
                  on:click={() => handleDeleteColumn(column)}
                  title="Delete column"
                >
                  &times;
                </button>
              {/if}
            </div>
          </div>

          <div
            class="column-tasks"
            use:dndzone={{
              items: getColumnTasks(column.id),
              flipDurationMs,
              dropTargetStyle: { outline: '2px dashed var(--accent)' }
            }}
            on:consider={(e) => handleDndConsider(column.id, e)}
            on:finalize={(e) => handleDndFinalize(column.id, e)}
          >
            {#each getColumnTasks(column.id) as task (task.id)}
              <div
                class="task-card"
                class:overdue={isOverdue(task.dueDate)}
                class:due-today={isDueToday(task.dueDate)}
              >
                <div class="task-header">
                  <span class="priority-dot {getPriorityClass(task.priority)}"></span>
                  <button class="task-title-btn" on:click={() => openTaskModal(column.id, task)}>
                    {task.title}
                  </button>
                </div>

                {#if task.dueDate}
                  <div class="task-due-date" class:overdue={isOverdue(task.dueDate)}>
                    {task.dueDate}
                  </div>
                {/if}

                <div class="task-actions">
                  {#if column.id !== 'done'}
                    <button
                      class="action-btn complete"
                      on:click={() => handleCompleteTask(task)}
                      title="Complete task"
                    >
                      ✓
                    </button>
                  {/if}
                  <button
                    class="action-btn delete"
                    on:click={() => handleDeleteTask(task)}
                    title="Delete task"
                  >
                    &times;
                  </button>
                </div>
              </div>
            {/each}
          </div>

          <button class="add-task-btn" on:click={() => openTaskModal(column.id)}>
            + Add Task
          </button>
        </div>
      {/each}
    </div>

    {#if getCompletedTasks().length > 0}
      <section class="completed-section">
        <h2>Completed ({getCompletedTasks().length})</h2>
        <div class="completed-tasks">
          {#each getCompletedTasks().slice(0, 10) as task}
            <div class="completed-task">
              <span class="check">✓</span>
              <span class="completed-title">{task.title}</span>
              <span class="completed-date">
                {new Date(task.completedAt).toLocaleDateString()}
              </span>
            </div>
          {/each}
        </div>
      </section>
    {/if}
  {/if}
</div>

<!-- Task Modal -->
<Modal
  open={showTaskModal}
  title={editingTask ? 'Edit Task' : 'New Task'}
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
      <label for="task-description">Description</label>
      <textarea
        id="task-description"
        bind:value={taskForm.description}
        placeholder="Add more details..."
        rows="3"
      ></textarea>
    </div>

    <div class="form-row">
      <div class="form-group">
        <label for="task-priority">Priority</label>
        <select id="task-priority" bind:value={taskForm.priority}>
          <option value="low">Low (10 XP)</option>
          <option value="medium">Medium (25 XP)</option>
          <option value="high">High (50 XP)</option>
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
      {editingTask ? 'Save Changes' : 'Create Task'}
    </Button>
  </svelte:fragment>
</Modal>

<!-- Column Modal -->
<Modal
  open={showColumnModal}
  title={editingColumn ? 'Edit Column' : 'New Column'}
  on:close={() => { showColumnModal = false; editingColumn = null; newColumnName = ''; }}
>
  <form on:submit|preventDefault={handleSaveColumn}>
    <div class="form-group">
      <label for="column-name">Column Name</label>
      <input
        id="column-name"
        type="text"
        bind:value={newColumnName}
        placeholder="e.g., Review, Blocked, Testing..."
        required
      />
    </div>
  </form>

  <svelte:fragment slot="footer">
    <Button variant="secondary" on:click={() => { showColumnModal = false; editingColumn = null; newColumnName = ''; }}>
      Cancel
    </Button>
    <Button on:click={handleSaveColumn} disabled={!newColumnName.trim()}>
      {editingColumn ? 'Save' : 'Add Column'}
    </Button>
  </svelte:fragment>
</Modal>

<style>
  .board-page {
    min-height: calc(100vh - var(--header-height) - var(--spacing-lg) * 2);
  }

  .board-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: var(--spacing-lg);
  }

  .kanban-board {
    display: flex;
    gap: var(--spacing-md);
    overflow-x: auto;
    padding-bottom: var(--spacing-md);
    scroll-behavior: auto;
  }

  .kanban-column {
    flex: 0 0 300px;
    background-color: var(--bg-secondary);
    border-radius: var(--radius-lg);
    padding: var(--spacing-md);
    display: flex;
    flex-direction: column;
    max-height: calc(100vh - 200px);
  }

  .column-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: var(--spacing-md);
  }

  .column-title {
    flex: 1;
    text-align: left;
    padding: var(--spacing-xs);
    border-radius: var(--radius-sm);
    transition: background-color var(--transition-fast);
  }

  .column-title:hover {
    background-color: var(--bg-tertiary);
  }

  .column-title h3 {
    font-size: 0.875rem;
    font-weight: 600;
    text-transform: uppercase;
    color: var(--text-muted);
    margin: 0;
  }

  .column-actions {
    display: flex;
    align-items: center;
    gap: var(--spacing-xs);
  }

  .task-count {
    font-size: 0.75rem;
    color: var(--text-muted);
    background-color: var(--bg-tertiary);
    padding: 2px 8px;
    border-radius: var(--radius-full);
  }

  .column-delete {
    width: 24px;
    height: 24px;
    font-size: 1rem;
    color: var(--text-muted);
    opacity: 0.5;
    transition: all var(--transition-fast);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .column-delete:hover {
    opacity: 1;
    color: var(--error);
  }

  .column-tasks {
    flex: 1;
    overflow-y: auto;
    min-height: 100px;
    display: flex;
    flex-direction: column;
    gap: var(--spacing-sm);
  }

  .task-card {
    background-color: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    padding: var(--spacing-sm) var(--spacing-md);
    cursor: grab;
    transition: all var(--transition-fast);
  }

  .task-card:hover {
    border-color: var(--border-light);
    box-shadow: var(--shadow-sm);
  }

  .task-card.overdue {
    border-left: 3px solid var(--error);
  }

  .task-card.due-today {
    border-left: 3px solid var(--warning);
  }

  .task-header {
    display: flex;
    align-items: flex-start;
    gap: var(--spacing-sm);
  }

  .priority-dot {
    width: 8px;
    height: 8px;
    border-radius: var(--radius-full);
    margin-top: 6px;
    flex-shrink: 0;
  }

  .priority-low { background-color: var(--priority-low); }
  .priority-medium { background-color: var(--priority-medium); }
  .priority-high { background-color: var(--priority-high); }

  .task-title-btn {
    flex: 1;
    text-align: left;
    font-weight: 500;
    color: var(--text-primary);
    line-height: 1.3;
  }

  .task-due-date {
    font-size: 0.75rem;
    color: var(--text-muted);
    margin-top: var(--spacing-xs);
    padding-left: calc(8px + var(--spacing-sm));
  }

  .task-due-date.overdue {
    color: var(--error);
  }

  .task-actions {
    display: flex;
    gap: var(--spacing-xs);
    margin-top: var(--spacing-sm);
    padding-left: calc(8px + var(--spacing-sm));
  }

  .action-btn {
    width: 24px;
    height: 24px;
    border-radius: var(--radius-sm);
    font-size: 0.75rem;
    display: flex;
    align-items: center;
    justify-content: center;
    opacity: 0.6;
    transition: all var(--transition-fast);
  }

  .action-btn:hover {
    opacity: 1;
  }

  .action-btn.complete {
    background-color: var(--success);
    color: white;
  }

  .action-btn.delete {
    background-color: var(--error);
    color: white;
  }

  .add-task-btn {
    margin-top: var(--spacing-sm);
    padding: var(--spacing-sm);
    color: var(--text-muted);
    border-radius: var(--radius-md);
    transition: all var(--transition-fast);
    text-align: center;
  }

  .add-task-btn:hover {
    background-color: var(--bg-tertiary);
    color: var(--text-primary);
  }

  .completed-section {
    margin-top: var(--spacing-xl);
  }

  .completed-section h2 {
    font-size: 1rem;
    color: var(--text-muted);
    margin-bottom: var(--spacing-md);
  }

  .completed-tasks {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-xs);
  }

  .completed-task {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
    padding: var(--spacing-sm);
    background-color: var(--bg-secondary);
    border-radius: var(--radius-md);
    opacity: 0.7;
  }

  .check {
    color: var(--success);
    font-weight: 700;
  }

  .completed-title {
    flex: 1;
    text-decoration: line-through;
    color: var(--text-muted);
  }

  .completed-date {
    font-size: 0.75rem;
    color: var(--text-muted);
  }

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

  .loading, .not-found {
    text-align: center;
    padding: var(--spacing-2xl);
    color: var(--text-muted);
  }
</style>
