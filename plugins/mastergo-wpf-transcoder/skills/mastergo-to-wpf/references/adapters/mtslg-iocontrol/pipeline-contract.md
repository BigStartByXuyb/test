# 一键流水线步骤契约（生成物，勿手改）

本文件由 `scripts/gen-pipeline-contract.mjs` 从 `scripts/run-all.ps1` 的步骤定义生成；
**真值源是脚本，不是本文件**——要改契约就改 `run-all.ps1` 的 `$Steps`，然后重新生成本文件
（`node scripts/gen-pipeline-contract.mjs`）。回归测试用 `--check` 重新生成并比对，手改本文件会直接挂测试。

## 怎么跑

**一条命令跑完全部 12 步**，不需要逐个手工调用，也不要为每一步单独起一次 `run-all`：

```powershell
pwsh -NoProfile -File <skill>\scripts\run-all.ps1 -ProjectRoot <项目> -Target <Target>   # 首次生成：不加 -Overwrite
```

默认区间是第 1 步 → 第 12 步。下面的 12 个阶段用于**定位失败**与**断点续跑**：失败后从该步继续 `-Progress <步骤名>`；需要人工补语义输入时先跑到 `-StopAfter discover`。
续跑/停止示例都要带上目标信息（`-ProjectRoot` 与 `-Target`，多页登记表下还可加 `-LayerId`）——只给 `-Progress` 时脚本取不到本次页面的来源。

## 步骤总览（同一条命令内部的阶段）

| 步骤 | 名称 | 内容 |
|---|---|---|
| 1 | `fetch` | 取数 getDsl（只落盘，不进上下文） |
| 2 | `capture` | DSL 结构化快照 + 覆盖校验 |
| 3 | `svg` | extractSvg 图标几何 |
| 4 | `visibility` | 显隐事实提取 |
| 5 | `mapping` | mapping 草稿（按当前台账） |
| 6 | `discover` | 图标候选发现 + 打印待命名清单 |
| 7 | `ledger` | 由命名表生成图标台账 + 图标几何来源核对 |
| 8 | `layout` | Layout 清单机械推导（底部栏 MenuItem） |
| 9 | `inputs` | 校验译文并生成 Bundle 清单 |
| 10 | `bundle` | Bundle 生成页面 XML / Icon / Layout / 宿主壳 |
| 11 | `gates` | 严格门禁（审计逐条断言） |
| 12 | `verify` | 四项独立验证（provenance / 坐标 / Icon / 结构） |

## 每一步的输入 / 产物 / 失败 / 怎么修

### 1. `fetch` —— 取数 getDsl（只落盘，不进上下文）

- **输入**：
  - MasterGo 文件 id 与图层 id（命令行 -FileId/-LayerId，或项目登记表 docs/page-registry.json 里能命中本次页面的那一条）
  - MasterGo MCP token（MASTERGO_MCP_TOKEN 或 -ConfigPath 指向的配置）
- **产物**：
  - Generated/runs/<Target>/getDsl.json
  - 运行登记表 Generated/runs/<Target>/run.json（产出即登记）
- **失败语义**：
  - 缺 fileId 或 layerId
  - 登记表有多条页面，但没用 -Target/-LayerId 命中本次页面（脚本不取第一页顶上）
  - MasterGo MCP token 缺失或失效
  - MCP 调用失败/超时
  - MCP 返回业务错误码（如 code=20001「获取文件key异常」，说明 fileId/layerId 不存在或无权限）
- **怎么修**：
  - 显式传 -FileId/-LayerId，或在登记表里登记本次页面；多页登记表必须先用 -Target 或 -LayerId 选中本次页面
  - 补 token 后重跑：-Progress fetch
  - 业务错误码：核对该 fileId/layerId（或登记表设计来源）后重跑：-Progress fetch

### 2. `capture` —— DSL 结构化快照 + 覆盖校验

- **输入**：
  - 第 1 步的 getDsl.json
  - 区域前缀 -Ui（缺失时按 run-all 取值链解析）
  - 设计页名 -DesignPageName（命令行或项目登记表；为空时 capture 用 DSL 根节点名兜底，再取不到用 layerId）
- **产物**：
  - Generated/runs/<Target>/dsl.snapshot.json
  - coverage-report.json（节点覆盖/重复 ref/断裂父子链）
- **失败语义**：
  - 覆盖校验 status≠complete
  - 存在重复 ref 或断裂父子链
  - 区域前缀取值链取不到
- **怎么修**：
  - 改 fileId / layerId 后必须重取数：从第 1 步 -Progress fetch 重跑（capture 只消费第 1 步的 getDsl.json，本身不取数）；来源不变而捕获失败时才重跑：-Progress capture
  - 区域前缀显式传 -Ui

### 3. `svg` —— extractSvg 图标几何

- **输入**：
  - fileId / layerId
  - MasterGo MCP token
- **产物**：
  - Generated/runs/<Target>/extractSvg.json（PATH 自身几何，按分页取全）
- **失败语义**：
  - MCP 调用失败或分页中断
- **怎么修**：
  - 重跑：-Progress svg（响应只落盘，不进上下文）

### 4. `visibility` —— 显隐事实提取

- **输入**：
  - 第 2 步的 dsl.snapshot.json
- **产物**：
  - Generated/runs/<Target>/visibility.json（每个节点的 visible/hidden 事实与 omit 角色）
- **失败语义**：
  - 快照缺字段（旧版快照或手工删改）
- **怎么修**：
  - 重跑第 2 步后重跑：-Progress visibility

### 5. `mapping` —— mapping 草稿（按当前台账）

- **输入**：
  - dsl.snapshot.json + visibility.json
  - 正式映射表 mtslg-iocontrol-map.json
  - 图标台账（尚无台账时用空 candidates 占位）
- **产物**：
  - Generated/runs/<Target>/mapping 草稿与映射审计（unmappedComponents / pending / templateConflicts）
- **失败语义**：
  - 组件与固定模板冲突
  - 结构签名部分命中
- **怎么修**：
  - 只补输入（用 manifest.excludeInstances 隔离该实例、把偏差写进待确认），不改 mapping 产物；重跑：-Progress mapping

### 6. `discover` —— 图标候选发现 + 打印待命名清单

- **输入**：
  - extractSvg.json + mapping 草稿 + dsl.snapshot.json
- **产物**：
  - Generated/_inputs/<Target>.icon-candidates.json（待命名清单：候选下标/归属控件/层名/尺寸）
- **失败语义**：
  - 缺 svg 或 mapping（前置步骤未跑）
- **怎么修**：
  - 先补跑前置步骤，再重跑：-Progress discover

### 7. `ledger` —— 由命名表生成图标台账 + 图标几何来源核对

- **输入**：
  - 候选清单
  - 命名表 Generated/_inputs/<Target>.icon-naming.json（人工/AI 语义输入）
- **产物**：
  - 图标台账 Generated/_inputs/<Target>.icon-map.json
  - verify-icon-source 的几何来源核对结果
- **失败语义**：
  - 缺命名表（未加 -AllowEmptyLedger）
  - icons[] 为空
  - sourceId 指向页面根或被多条共用
  - 缺 extractSvg 条目且未声明 fromDsl
- **怎么修**：
  - 在命名表里定名或标 fromDsl，重跑：-Progress ledger；本页确实无图标槽位时加 -AllowEmptyLedger

### 8. `layout` —— Layout 清单机械推导（底部栏 MenuItem）

- **输入**：
  - dsl.snapshot.json + 图标台账 + 正式映射表
- **产物**：
  - Layout 清单与推导报告 Generated/_inputs/<Target>.layout-manifest.json(.report.json)
- **失败语义**：
  - layoutStatus 不属于 complete/none
  - layoutEvidence.unresolvedBottomBarItems≠0
- **怎么修**：
  - 补齐底部栏变体命中后重跑：-Progress layout（校验失败表示清单不完整，不是拒绝生成页面）；本页确实没有菜单项与常驻分组时 none 是合法终态（此时 menuItems 与两个计数必须全为 0）

### 9. `inputs` —— 校验译文并生成 Bundle 清单

- **输入**：
  - Layout 清单
  - 运行登记表 run.json（采集输入只按它取）
  - 译文清单 Generated/_inputs/<Target>.lang-translations.json（术语表可选）
- **产物**：
  - Bundle 清单 Generated/_inputs/<Target>.bundle.json（含 runRegistry 指纹）
- **失败语义**：
  - 缺区域前缀 area
  - 缺 --run-json 或译文清单
  - 发现未登记的旧同名采集文件
  - 登记表 sha256 与文件不符
- **怎么修**：
  - 补齐输入后重跑：-Progress inputs（采集输入只按登记表取，未登记的旧同名文件一律拒绝）

### 10. `bundle` —— Bundle 生成页面 XML / Icon / Layout / 宿主壳

- **输入**：
  - Bundle 清单
  - 复校通过的采集输入（getDsl/snapshot/extractSvg，按登记表取）
- **产物**：
  - 页面 XML、本页 Icons.xaml、CN/EN 语言字典、Layout 增量注册、View + code-behind + ViewModel、宿主壳
  - Bundle 审计与其 files[] 统一登记
- **失败语义**：
  - 同名目标文件已存在且未 -Overwrite
  - area/路径不合法
  - 语言键引用闭环失败
  - 清单指纹与登记表不符
- **怎么修**：
  - 确认要替换时用 operation=replace-existing + -Overwrite（覆盖前逐个备份，保留最近 2 份），否则改名或先确认；重跑：-Progress bundle

### 11. `gates` —— 严格门禁（审计逐条断言）

- **输入**：
  - Bundle 审计 + mapping 审计 + coverage-report.json
- **产物**：
  - 门禁结论（失败即停；通过时列出必须写进交付说明的警告）
- **失败语义**：
  - 临时语言键
  - 待翻译条目
  - 容器嵌套冲突
  - 底部栏未命中变体
  - Bundle 静态校验未通过
- **怎么修**：
  - 回到产出该字段的步骤补输入（译文/命名表/隔离清单），重跑：-Progress gates

### 12. `verify` —— 四项独立验证（provenance / 坐标 / Icon / 结构）

- **输入**：
  - 页面 XML + 本页 Icon/语言字典 + 项目 Layout + 审计文件
- **产物**：
  - Generated/_work/verification/<页面>/ 的 provenance/坐标/Icon/结构报告
- **失败语义**：
  - provenance 与设计文本不符
  - 坐标与 DSL bbox 不符
  - Icon 引用闭环缺失
  - 页面结构校验失败
- **怎么修**：
  - 修输入或生成器后重跑：-Progress verify（不要改报告）

## 运行方式

```powershell
pwsh -NoProfile -File <skill>\scripts\run-all.ps1 -ProjectRoot <项目> -Target <Target>              # 一次跑完 12 步
pwsh -NoProfile -File <skill>\scripts\run-all.ps1 -ProjectRoot <项目> -Target <Target> -Progress <步骤名> # 失败后从该步继续
pwsh -NoProfile -File <skill>\scripts\run-all.ps1 -ProjectRoot <项目> -Target <Target> -Overwrite # 仅用户明确要求替换时
pwsh -NoProfile -File <skill>\scripts\run-all.ps1 -List -Format json                            # 本文件的机器可读来源
```
