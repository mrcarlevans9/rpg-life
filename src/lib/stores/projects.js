import { writable } from 'svelte/store';
import { liveQuery } from 'dexie';
import { db } from '../db/index.js';

// Create a store from a Dexie liveQuery
function createLiveQueryStore(queryFn, defaultValue = null) {
  const { subscribe, set } = writable(defaultValue);

  let subscription;

  const store = {
    subscribe(run, invalidate) {
      if (!subscription) {
        const observable = liveQuery(queryFn);
        subscription = observable.subscribe({
          next: value => set(value),
          error: err => console.error('LiveQuery error:', err)
        });
      }
      return subscribe(run, invalidate);
    }
  };

  return store;
}

// All projects from DB (non-archived)
export const projectsData = createLiveQueryStore(
  () => db.projects.where('archived').equals(0).sortBy('order'),
  []
);

// Archived projects
export const archivedProjects = createLiveQueryStore(
  () => db.projects.where('archived').equals(1).toArray(),
  []
);

// Currently selected project ID
export const currentProjectId = writable(null);

// Create a new project
export async function createProject(name, description = '', color = '#6366f1') {
  const count = await db.projects.count();

  const id = await db.projects.add({
    name,
    description,
    color,
    order: count,
    archived: false,
    columns: [
      { id: 'todo', name: 'To Do', order: 0 },
      { id: 'in-progress', name: 'In Progress', order: 1 },
      { id: 'done', name: 'Done', order: 2 }
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });

  return id;
}

// Update a project
export async function updateProject(id, updates) {
  await db.projects.update(id, {
    ...updates,
    updatedAt: new Date().toISOString()
  });
}

// Delete a project and its tasks
export async function deleteProject(id) {
  await db.tasks.where('projectId').equals(id).delete();
  await db.projects.delete(id);
}

// Archive a project
export async function archiveProject(id) {
  await db.projects.update(id, {
    archived: true,
    updatedAt: new Date().toISOString()
  });
}

// Unarchive a project
export async function unarchiveProject(id) {
  await db.projects.update(id, {
    archived: false,
    updatedAt: new Date().toISOString()
  });
}

// Add a column to a project
export async function addColumn(projectId, columnName) {
  const project = await db.projects.get(projectId);
  if (!project) return;

  const newColumn = {
    id: `col-${Date.now()}`,
    name: columnName,
    order: project.columns.length
  };

  await db.projects.update(projectId, {
    columns: [...project.columns, newColumn],
    updatedAt: new Date().toISOString()
  });
}

// Update a column
export async function updateColumn(projectId, columnId, name) {
  const project = await db.projects.get(projectId);
  if (!project) return;

  const columns = project.columns.map(col =>
    col.id === columnId ? { ...col, name } : col
  );

  await db.projects.update(projectId, {
    columns,
    updatedAt: new Date().toISOString()
  });
}

// Delete a column (moves tasks to first column)
export async function deleteColumn(projectId, columnId) {
  const project = await db.projects.get(projectId);
  if (!project || project.columns.length <= 1) return;

  const firstColumnId = project.columns[0].id;

  // Move tasks to first column
  await db.tasks
    .where('projectId')
    .equals(projectId)
    .and(task => task.columnId === columnId)
    .modify({ columnId: firstColumnId });

  // Remove column
  const columns = project.columns
    .filter(col => col.id !== columnId)
    .map((col, i) => ({ ...col, order: i }));

  await db.projects.update(projectId, {
    columns,
    updatedAt: new Date().toISOString()
  });
}

// Reorder columns
export async function reorderColumns(projectId, columns) {
  await db.projects.update(projectId, {
    columns,
    updatedAt: new Date().toISOString()
  });
}

// Get a single project
export async function getProject(id) {
  return db.projects.get(id);
}
