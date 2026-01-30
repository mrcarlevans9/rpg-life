<script>
  import Card from '../components/common/Card.svelte';
  import Button from '../components/common/Button.svelte';
  import Modal from '../components/common/Modal.svelte';
  import { projectsData, createProject, deleteProject, archiveProject } from '../lib/stores/projects.js';
  import { push } from 'svelte-spa-router';

  let showNewProjectModal = false;
  let newProjectName = '';
  let newProjectDescription = '';
  let newProjectColor = '#6366f1';

  const colors = [
    '#6366f1', '#8b5cf6', '#ec4899', '#ef4444',
    '#f59e0b', '#22c55e', '#14b8a6', '#3b82f6'
  ];

  async function handleCreateProject() {
    if (!newProjectName.trim()) return;

    const id = await createProject(newProjectName, newProjectDescription, newProjectColor);
    showNewProjectModal = false;
    newProjectName = '';
    newProjectDescription = '';
    newProjectColor = '#6366f1';

    push(`/projects/${id}`);
  }

  function openProject(id) {
    push(`/projects/${id}`);
  }
</script>

<div class="projects-page">
  <header class="page-header">
    <h1>Projects</h1>
    <Button on:click={() => showNewProjectModal = true}>
      + New Project
    </Button>
  </header>

  {#if $projectsData && $projectsData.length > 0}
    <div class="projects-grid">
      {#each $projectsData as project}
        <Card hoverable>
          <button class="project-card" on:click={() => openProject(project.id)}>
            <div class="project-color" style="background-color: {project.color}"></div>
            <div class="project-info">
              <h3>{project.name}</h3>
              {#if project.description}
                <p>{project.description}</p>
              {/if}
              <span class="project-meta">
                {project.columns?.length || 0} columns
              </span>
            </div>
          </button>
        </Card>
      {/each}
    </div>
  {:else}
    <div class="empty-state">
      <span class="empty-icon">📋</span>
      <h2>No Projects Yet</h2>
      <p>Create your first project to start organizing tasks!</p>
      <Button on:click={() => showNewProjectModal = true}>
        Create First Project
      </Button>
    </div>
  {/if}
</div>

<Modal
  open={showNewProjectModal}
  title="New Project"
  on:close={() => showNewProjectModal = false}
>
  <form on:submit|preventDefault={handleCreateProject}>
    <div class="form-group">
      <label for="project-name">Project Name</label>
      <input
        id="project-name"
        type="text"
        bind:value={newProjectName}
        placeholder="Enter project name"
        required
      />
    </div>

    <div class="form-group">
      <label for="project-description">Description (optional)</label>
      <textarea
        id="project-description"
        bind:value={newProjectDescription}
        placeholder="What's this project about?"
        rows="3"
      ></textarea>
    </div>

    <div class="form-group">
      <label>Color</label>
      <div class="color-picker">
        {#each colors as color}
          <button
            type="button"
            class="color-option"
            class:selected={newProjectColor === color}
            style="background-color: {color}"
            on:click={() => newProjectColor = color}
          ></button>
        {/each}
      </div>
    </div>
  </form>

  <svelte:fragment slot="footer">
    <Button variant="secondary" on:click={() => showNewProjectModal = false}>
      Cancel
    </Button>
    <Button on:click={handleCreateProject} disabled={!newProjectName.trim()}>
      Create Project
    </Button>
  </svelte:fragment>
</Modal>

<style>
  .projects-page {
    max-width: 1200px;
    margin: 0 auto;
  }

  .page-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: var(--spacing-xl);
  }

  .projects-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: var(--spacing-md);
  }

  .project-card {
    display: flex;
    gap: var(--spacing-md);
    width: 100%;
    text-align: left;
    padding: var(--spacing-md);
  }

  .project-color {
    width: 4px;
    border-radius: var(--radius-full);
    flex-shrink: 0;
  }

  .project-info {
    flex: 1;
  }

  .project-info h3 {
    font-size: 1.125rem;
    margin-bottom: var(--spacing-xs);
  }

  .project-info p {
    font-size: 0.875rem;
    color: var(--text-secondary);
    margin-bottom: var(--spacing-sm);
  }

  .project-meta {
    font-size: 0.75rem;
    color: var(--text-muted);
  }

  .empty-state {
    text-align: center;
    padding: var(--spacing-2xl);
  }

  .empty-icon {
    font-size: 4rem;
    display: block;
    margin-bottom: var(--spacing-md);
  }

  .empty-state h2 {
    margin-bottom: var(--spacing-sm);
  }

  .empty-state p {
    margin-bottom: var(--spacing-lg);
    color: var(--text-secondary);
  }

  .form-group {
    margin-bottom: var(--spacing-md);
  }

  .form-group label {
    display: block;
    font-weight: 500;
    margin-bottom: var(--spacing-xs);
    color: var(--text-primary);
  }

  .form-group input,
  .form-group textarea {
    width: 100%;
  }

  .color-picker {
    display: flex;
    gap: var(--spacing-sm);
  }

  .color-option {
    width: 32px;
    height: 32px;
    border-radius: var(--radius-md);
    border: 2px solid transparent;
    transition: all var(--transition-fast);
  }

  .color-option:hover {
    transform: scale(1.1);
  }

  .color-option.selected {
    border-color: var(--text-primary);
    box-shadow: 0 0 0 2px var(--bg-secondary);
  }
</style>
