<script>
  import { onMount } from 'svelte';
  import { dndzone } from 'svelte-dnd-action';
  import Card from '../components/common/Card.svelte';
  import Button from '../components/common/Button.svelte';
  import Modal from '../components/common/Modal.svelte';
  import { db } from '../lib/db/index.js';
  import { getProject, updateProject } from '../lib/stores/projects.js';
  import { createTask, updateTask, completeTask, deleteTask, moveTaskToColumn } from '../lib/stores/tasks.js';
  import { showXPGain } from '../lib/stores/notifications.js';

  export let params = {};

  let project = null;
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

  const flipDurationMs = 200;

  onMount(async () => {
    await loadProject();
  });

  async function loadProject() {
    loading = true;
    project = await getProject(parseInt(params.id));
    if (project) {
      tasks = await db.tasks.where('projectId').equals(project.id).toArray();
    }
    loading = false;
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
    const columnTasks = getColumnTasks(columnId);
    const newItems = e.detail.items;

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

    // Update database
    for (let i = 0; i < newItems.length; i++) {
      const item = newItems[i];
      await moveTaskToColumn(item.id, columnId, i);
    }

    await loadProject();
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
        projectId: project.id,
        columnId: taskForm.columnId,
        title: taskForm.title,
        description: taskForm.description,
        priority: taskForm.priority,
        dueDate: taskForm.dueDate || null
      });
    }

    showTaskModal = false;
    editingTask = null;
    await loadProject();
  }

  async function handleCompleteTask(task) {
    const result = await completeTask(task.id);
    if (result) {
      showXPGain(result.amount, 'task');
    }
    await loadProject();
  }

  async function handleDeleteTask(task) {
    if (confirm('Delete this task?')) {
      await deleteTask(task.id);
      await loadProject();
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

<div class="board-page">
  {#if loading}
    <div class="loading">Loading project...</div>
  {:else if !project}
    <div class="not-found">
      <h2>Project not found</h2>
      <a href="#/projects">← Back to Projects</a>
    </div>
  {:else}
    <header class="board-header">
      <div class="header-left">
        <a href="#/projects" class="back-link">← Projects</a>
        <h1 style="border-left: 4px solid {project.color}; padding-left: var(--spacing-md);">
          {project.name}
        </h1>
      </div>
    </header>

    <div class="kanban-board">
      {#each project.columns as column}
        <div class="kanban-column">
          <div class="column-header">
            <h3>{column.name}</h3>
            <span class="task-count">{getColumnTasks(column.id).length}</span>
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
                    📅 {task.dueDate}
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
                    ✕
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

  .header-left {
    display: flex;
    align-items: center;
    gap: var(--spacing-lg);
  }

  .back-link {
    color: var(--text-muted);
    font-size: 0.875rem;
  }

  .back-link:hover {
    color: var(--text-primary);
  }

  .kanban-board {
    display: flex;
    gap: var(--spacing-md);
    overflow-x: auto;
    padding-bottom: var(--spacing-md);
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

  .column-header h3 {
    font-size: 0.875rem;
    font-weight: 600;
    text-transform: uppercase;
    color: var(--text-muted);
  }

  .task-count {
    font-size: 0.75rem;
    color: var(--text-muted);
    background-color: var(--bg-tertiary);
    padding: 2px 8px;
    border-radius: var(--radius-full);
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
