const parseRowIndexes = (values, rowCount) => {
  if (values.length === 0) throw new Error("必须提供至少一个 0 起始行索引");
  const indexes = values.map((value) => {
    if (!/^\d+$/.test(value)) throw new Error(`行索引必须是非负整数: ${value}`);
    return Number(value);
  });
  if (new Set(indexes).size !== indexes.length) throw new Error("行索引不得重复");
  const invalid = indexes.filter((index) => !Number.isSafeInteger(index) || index >= rowCount);
  if (invalid.length) throw new Error(`行索引超出当前 ${rowCount} 行的范围: ${invalid.join(", ")}`);
  return indexes;
};

module.exports = { parseRowIndexes };
