# -*- coding: utf-8 -*-
"""SDC 分支（刀轮/晶圆切割机）。

当前已验证的 SDC 规则仍在主干基线 `sip_rules_trunk.py` 中，以保持
SDC1D 408/408 的行为不变；本分支预留给后续把 SDC 专属规则从主干剥离。
"""

STAGE_RULES = {}
EXACT = {}
STAGE_PREFIX_RULES = []
BOM_STAGES = set()
KEYWORD_RULES = []
