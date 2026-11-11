import test from "node:test";
import assert from "node:assert/strict";

const { routeErrorMessage } = await import("./errors.ts");

test("turns Firebase permission details into a friendly route error", () => {
  const original = console.error;
  const logged = [];
  console.error = (...values) => logged.push(values);
  try {
    const message = routeErrorMessage(
      { code: "storage/unauthorized", message: "Firebase Storage: User does not have permission" },
      "Unable to import this route.",
      "Unable to import route",
    );
    assert.equal(message, "We couldn’t save the route file right now. Please try again later.");
    assert.equal(logged.length, 1);
    assert.equal(logged[0][0], "Unable to import route:");
  } finally {
    console.error = original;
  }
});

test("preserves useful domain validation errors", () => {
  assert.equal(
    routeErrorMessage(new Error("Route names must be unique."), "Unable to save.", "Unable to save route"),
    "Route names must be unique.",
  );
});
