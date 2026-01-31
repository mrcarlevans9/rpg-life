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

// Reactive store for the global board
export const boardData = createLiveQueryStore(
  () => db.board.get(1),
  null
);

// Get the board
export async function getBoard() {
  return db.board.get(1);
}

// Add a new column
export async function addColumn(columnName) {
  const board = await db.board.get(1);
  if (!board) return;

  const newColumn = {
    id: `col-${Date.now()}`,
    name: columnName,
    order: board.columns.length
  };

  await db.board.update(1, {
    columns: [...board.columns, newColumn],
    updatedAt: new Date().toISOString()
  });

  return newColumn;
}

// Update a column name
export async function updateColumn(columnId, name) {
  const board = await db.board.get(1);
  if (!board) return;

  const columns = board.columns.map(col =>
    col.id === columnId ? { ...col, name } : col
  );

  await db.board.update(1, {
    columns,
    updatedAt: new Date().toISOString()
  });
}

// Delete a column (moves tasks to first column)
export async function deleteColumn(columnId) {
  const board = await db.board.get(1);
  if (!board || board.columns.length <= 1) return;

  const firstColumnId = board.columns[0].id;

  // Move tasks from deleted column to first column
  const tasksToMove = await db.tasks
    .where('columnId')
    .equals(columnId)
    .toArray();

  for (const task of tasksToMove) {
    await db.tasks.update(task.id, { columnId: firstColumnId });
  }

  // Remove column and reorder
  const columns = board.columns
    .filter(col => col.id !== columnId)
    .map((col, i) => ({ ...col, order: i }));

  await db.board.update(1, {
    columns,
    updatedAt: new Date().toISOString()
  });
}

// Reorder columns
export async function reorderColumns(columns) {
  await db.board.update(1, {
    columns,
    updatedAt: new Date().toISOString()
  });
}
