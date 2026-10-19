const test = require("node:test");
const assert = require("node:assert/strict");
const { resolveExactNumberOption } = require("../number-selection.cjs");

test("selects one exact visible number option", () => {
  const expected = "MEL6611 V100R001 - 项目编号";
  assert.equal(resolveExactNumberOption([expected], expected), expected);
});

test("rejects missing, partial, or duplicate number options", () => {
  assert.throws(() => resolveExactNumberOption(["MEL6611 V100R001"], "MEL6611"), /精确且唯一/);
  assert.throws(() => resolveExactNumberOption([], "MEL6611 V100R001"), /精确且唯一/);
  assert.throws(() => resolveExactNumberOption(["MEL6611 V100R001", "MEL6611 V100R001"], "MEL6611 V100R001"), /精确且唯一/);
  assert.throws(() => resolveExactNumberOption(["MEL6611 V100R001"], ""), /完整文本/);
});
