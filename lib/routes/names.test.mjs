import test from "node:test";
import assert from "node:assert/strict";

const { isUniqueRouteName, nextUniqueRouteName, normalizeRouteName } = await import("./names.ts");

test("normalizes route names for case-insensitive uniqueness", () => {
  assert.equal(normalizeRouteName("  Café   Loop  "), "café loop");
  assert.equal(normalizeRouteName("Ｃａｆｅ́ Loop"), "café loop");
  assert.equal(isUniqueRouteName("Morning Loop", [{ id: "one", name: " morning   loop " }]), false);
  assert.equal(isUniqueRouteName("Morning Loop", [{ id: "one", name: "morning loop" }], "one"), true);
});

test("generates an available duplicate name", () => {
  const routes = [
    { id: "one", name: "Coffee copy" },
    { id: "two", name: "Coffee copy 2" },
  ];
  assert.equal(nextUniqueRouteName("Coffee", routes), "Coffee copy 3");
});
