import assert from "node:assert/strict";
import test from "node:test";
import { dashboardTasks, getNextTaskOrder, moveTask, normalizeTaskTitle, remainingTaskCount, sortActiveTasks, sortCompletedTasks } from "./utils.ts";

const timestamp = (value) => ({ toMillis: () => value });
const task = (id, order, extra = {}) => ({ id, title: id, completed: false, order, createdAt: timestamp(order), completedAt: null, ...extra });

test("task titles reject empty input and trim valid input", () => {
  assert.equal(normalizeTaskTitle("  \t "), null);
  assert.equal(normalizeTaskTitle("  Buy milk  "), "Buy milk");
});

test("active tasks sort by manual order and counts ignore completed tasks", () => {
  const tasks = [task("third", 3), task("done", 0, { completed: true }), task("first", 1)];
  assert.deepEqual(sortActiveTasks(tasks).map(({ id }) => id), ["first", "third"]);
  assert.equal(remainingTaskCount(tasks), 2);
});

test("new tasks append after the greatest active order", () => {
  assert.equal(getNextTaskOrder([task("a", 4), task("b", 10), task("done", 30, { completed: true })]), 11);
  assert.equal(getNextTaskOrder([]), 0);
});

test("moving tasks preserves every task and applies the target position", () => {
  const tasks = [task("a", 0), task("b", 1), task("c", 2)];
  assert.deepEqual(moveTask(tasks, "c", 0).map(({ id }) => id), ["c", "a", "b"]);
});

test("completed tasks are recent-first and dashboard output is ordered and limited", () => {
  const completed = [task("older", 0, { completed: true, completedAt: timestamp(10) }), task("newer", 0, { completed: true, completedAt: timestamp(20) })];
  assert.deepEqual(sortCompletedTasks(completed).map(({ id }) => id), ["newer", "older"]);
  const active = [task("c", 2), task("a", 0), task("b", 1)];
  assert.deepEqual(dashboardTasks(active, 2).map(({ id }) => id), ["a", "b"]);
});

