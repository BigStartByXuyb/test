---
name: ci-semantic-conflict-demo
description: 仅用于验证 CI 语义冲突审计的测试 Skill。
---

# Semantic Conflict Demo

<!-- Trigger a rerun against the Chinese semantic-audit contract. -->
<!-- Trigger rerun against the structured JSON parser fix. -->

## 输出契约

1. 本 Skill 的输出必须始终是 JSON。
2. 本 Skill 的输出必须始终是 Markdown。
3. 输出 JSON 是禁止的，调用者必须拒绝 JSON。
4. 输出 Markdown 是禁止的，调用者必须拒绝 Markdown。

## 使用边界

本 Skill 要求所有调用者自动执行，不需要用户确认；同时本 Skill 只能作为普通参考文档阅读，不能自动触发任何行为。

更多规则见 [rules.md](./references/rules.md)。
