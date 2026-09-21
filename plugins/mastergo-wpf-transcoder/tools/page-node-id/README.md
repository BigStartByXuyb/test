# MasterGoPageNodeId —— 按名字查页面 ID

**用途**：开发不经过转码流程、自己手写页面 XML 控件时，需要知道"设计稿上这个控件该用哪个 ID"。

```
MasterGoPageNodeId.exe 确认按钮
MasterGoPageNodeId.exe 调光 F7
MasterGoPageNodeId.exe --all
MasterGoPageNodeId.exe 序列设置 --snapshot dsl.snapshot.json
```

输出一行一个控件：

```
MX_60ccce6959030631cad8edefcf70be50  名称：确认按钮  文本：确认  layer_id：1158:251921  位置：1090,414
```

把那一串 `MX_…` 直接填到控件的 `ID="…"` 上即可。

## 需要什么

一份该页面的 DSL 快照：`dsl.snapshot.json`（我们转码时产出）或 `getDsl.json`（MCP 原始响应）。
把 exe 和快照放同一个目录，双击/命令行都能跑；也可以用 `--snapshot` 指定路径。

> ID 是按设计稿节点算出来的：`MX_` + `sha256(页面键 + "\n" + 节点 ref)` 前 32 位。
> 所以**同一条设计稿在任何机器、任何时候算出来都一样**；不需要任何表、也不联网。

## 编译（一般用不到，已随插件带 exe）

```
pwsh -NoProfile -File build.ps1
```

用 Windows 自带的 `csc.exe`（.NET Framework 4.x）编译，不需要装 Node / VS / .NET SDK。

## 注意

- 这个 ID 与转码器生成的完全一致（同一公式）；**不要改已有控件的 ID**（改了等于换了个控件）。
- 你们自己新增的控件随便起唯一 ID 即可（沿用 GUID 写法），不用非得用本工具算。
- 工具只做一件事：**名字 → ID**。文案、语言键、Layout 注册都不在这里管。
