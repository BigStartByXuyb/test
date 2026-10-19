const test = require("node:test");
const assert = require("node:assert/strict");
const { parseRowIndexes } = require("../row-selection.cjs");

test("accepts unique 0-based row indexes in range", () => {
  assert.deepEqual(parseRowIndexes(["0", "2"], 3), [0, 2]);
});

test("rejects missing, nonnumeric, negative, duplicate, and out-of-range indexes", () => {
  assert.throws(() => parseRowIndexes([], 1), /至少一个/);
  assert.throws(() => parseRowIndexes(["1x"], 2), /非负整数/);
  assert.throws(() => parseRowIndexes(["-1"], 2), /非负整数/);
  assert.throws(() => parseRowIndexes(["1", "1"], 2), /不得重复/);
  assert.throws(() => parseRowIndexes(["2"], 2), /超出当前 2 行/);
});
