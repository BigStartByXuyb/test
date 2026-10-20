---
description: 按 SIP 方法论归类成品检验指导书（zip/文件夹 → 带主顺序/子顺序的 Excel）
---

使用 `sip-methodology-classifier` Skill 处理：$ARGUMENTS

要求：
1. 确认输入 zip/文件夹、输出 xlsx、可选标准答案 xlsx 的绝对路径。
2. 先列出项目文件夹与 xlsx 清单，再做归类。
3. 运行 `scripts/build_sip_mapping.py`；如给了标准答案，确认逐行校验结果。
4. 交付时报告：输出路径、总行数、各主顺序分布、标准答案校验结果、待确认项数量。
5. 标准答案没有“共用”区；水气混行按行拆到通气/通水。标黄列不纳入。
