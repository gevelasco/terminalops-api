import { ChecklistTodo } from './entities/checklist-todo.entity';

export function serializeChecklistTodo(row: ChecklistTodo) {
  return {
    id: String(row.id),
    text: row.text,
    completed: row.completed,
    createdAt: row.createdAt.toISOString(),
  };
}
