# -*- coding: utf-8 -*-
"""规则调度：主干（通用/已验证基线）+ 设备族分支。

对外保持原有 API：classify / load_reference / norm / header_key / MAIN_ORDER。
新增 family 参数：
  - 'sdc'  刀轮/晶圆切割机
  - 'exp'  扩片机
  - 'slg'  激光切割设备
  - 'trunk' 显式只用主干
  - 'unknown' 未识别设备族：按主干规则归类，输出标注“未知类型，需复核”
"""
from sip_rules_trunk import (  # noqa: F401
    M, W, D, Q, S, L, G, U, B,
    MAIN_ORDER, SUB_ORDER, MAIN_IDX, SUB_IDX,
    norm, header_key, BOM_RE, load_reference,
    STAGE_RULES as TRUNK_STAGE_RULES,
    EXACT as TRUNK_EXACT,
    BOM_STAGES as TRUNK_BOM_STAGES,
)
import sip_family_sdc as _sdc  # noqa: E402
import sip_family_exp as _exp  # noqa: E402
import sip_family_slg as _slg  # noqa: E402

_FAMILY_MODULES = {'sdc': _sdc, 'exp': _exp, 'slg': _slg}
_FAMILY_NAMES = {'trunk': '主干', 'sdc': 'SDC', 'exp': 'EXP', 'slg': 'SLG',
                 'unknown': '未知类型（按主干，需复核）'}


def family_label(family):
    return _FAMILY_NAMES.get(family, family or '主干')


def _merged(family):
    mod = _FAMILY_MODULES.get(family)
    stage = dict(TRUNK_STAGE_RULES)
    exact = dict(TRUNK_EXACT)
    prefix = []
    bom = set(TRUNK_BOM_STAGES)
    keywords = []
    if mod:
        stage.update(getattr(mod, 'STAGE_RULES', {}))
        exact.update(getattr(mod, 'EXACT', {}))
        prefix = list(getattr(mod, 'STAGE_PREFIX_RULES', []))
        bom |= set(getattr(mod, 'BOM_STAGES', set()))
        keywords = list(getattr(mod, 'KEYWORD_RULES', []))
    return stage, exact, prefix, bom, keywords


def _branch_has(family, stage, item):
    mod = _FAMILY_MODULES.get(family)
    if not mod:
        return False
    if (stage, item) in getattr(mod, 'EXACT', {}):
        return True
    if stage in getattr(mod, 'STAGE_RULES', {}):
        return True
    if stage in getattr(mod, 'BOM_STAGES', set()):
        return True
    return any(stage.startswith(p) for p, _, _ in getattr(mod, 'STAGE_PREFIX_RULES', []))


def _classify_raw(stage, item, sub, std, method, family='trunk'):
    stage_rules, exact, prefix_rules, bom_stages, keyword_rules = _merged(family)
    key = (stage, item)
    if key in exact:
        if item == '接触式测高位置及刀刃外观确认':
            result = (D, '6级') if '刀刃外观' in std else (D, '5级')
        else:
            result = exact[key]
        return result, ('branch' if _branch_has(family, stage, item) else 'trunk')

    if stage.startswith('流量、压力及位置检查') or stage.startswith('流量及压力'):
        if stage == '流量及压力表头设定默认值':
            return (D, '1级'), ('branch' if _branch_has(family, stage, item) else 'trunk')
        if 'NCS检查' in item:
            return ((S, '1级') if ('水柱' in std or '冲洗' in std) else (Q, '2级')), 'trunk'
        if '排风' in item or '风量' in item:
            return (D, '1级'), 'trunk'
        if '水气帘' in item:
            return (S, '1级'), 'trunk'
        if '气帘角度' in item or '水帘角度' in item:
            return (S, '1级'), 'trunk'
        if '吹气' in item or '光尺气帘' in item:
            return (Q, '2级'), 'trunk'
        if '真空' in item:
            return (Q, '3级'), 'trunk'
        if '二流体' in item:
            return (S, '1级'), 'trunk'
        if '喷水架' in item:
            return (S, '2级'), 'trunk'
        if any(k in item for k in ('自清洁', '水帘', '水压', '清洗水')) or '水柱' in std:
            return (S, '1级'), 'trunk'
        if any(k in item for k in ('气帘', '正压', '压力', '氮气', '热风', '红外')):
            return (Q, '2级'), 'trunk'
        if any(k in item for k in ('气缸', '位置', '水平', '轴间距', '测高行程')):
            return (D, '5级'), 'trunk'
        if any(k in item for k in ('流量', '传感', '高度', '隔板')):
            return (S, '1级'), 'trunk'

    if stage in ('工控机', '核对工控机'):
        text = item + std
        layer = 'branch' if _branch_has(family, stage, item) else 'trunk'
        if '断电' in text:
            return (U, '2级'), layer
        if ('序列号' in text or 'S/N' in text or '核对规格' in item
                or BOM_RE.match(std)):
            return (M, '2级'), layer
        return (D, '12级'), layer

    if stage == '加密狗':
        text = item + std
        layer = 'branch' if _branch_has(family, stage, item) else 'trunk'
        if '永久版本' in text or '序列号' in text:
            return (B, '1级'), layer
        return (M, '2级'), layer

    if stage == '料库检料传感器确认':
        return (D, '6级'), 'trunk'

    if stage == '气管、水管':
        return ((S, '3级') if ('水管' in std and '气管' not in std) else (Q, '4级')), 'trunk'

    if stage in ('离子棒', '离子风扇', '静电消除棒'):
        result = (W, '1级') if ('安装位置' in std or '安装在' in std) else (D, '9级')
        return result, ('branch' if _branch_has(family, stage, item) else 'trunk')

    if stage == 'NCS光纤':
        return ((W, '1级') if ('外观' in std or '无挤压' in std) else (W, '2级')), 'trunk'

    if stage in ('安全防护检查', '安全防护确认'):
        result = (S, '3级') if ('漏水' in std or '漏水' in item) else (D, '12级')
        return result, ('branch' if _branch_has(family, stage, item) else 'trunk')

    if stage == '陶瓷手臂':
        return ((W, '1级') if '拆解打包' in (item + std) else (D, '9级')), 'trunk'

    if stage in ('工艺验收', '工艺验收标准'):
        text = item + std
        if any(k in text for k in ('尺寸', '厚度', '宽度', '深度')):
            return (G, '1级'), 'trunk'
        if any(k in text for k in ('外观', '崩边', '沾污', '破裂', '分段', '分离')):
            return (G, '2级'), 'trunk'
        return (G, '1级'), 'trunk'

    if stage in stage_rules:
        return stage_rules[stage], ('branch' if _branch_has(family, stage, item) else 'trunk')

    for pfx, main, sub in prefix_rules:
        if stage.startswith(pfx):
            return (main, sub), 'branch'

    if stage in bom_stages:
        if BOM_RE.match(std):
            return (M, '2级'), ('branch' if stage in getattr(
                _FAMILY_MODULES.get(family), 'BOM_STAGES', set()) else 'trunk')
        if any(k in std for k in ('外观', '安装', '完好', '牢固', '无损伤')):
            return (W, '1级'), ('branch' if stage in getattr(
                _FAMILY_MODULES.get(family), 'BOM_STAGES', set()) else 'trunk')
        return (D, '5级'), ('branch' if stage in getattr(
            _FAMILY_MODULES.get(family), 'BOM_STAGES', set()) else 'trunk')

    for kws, result in keyword_rules:
        if any(k in stage for k in kws):
            return result, 'branch'

    if any(k in stage for k in ('精度', '补偿')):
        return (D, '4级'), 'keyword'
    if any(k in stage for k in ('外观', '整理', '清洁', '标识', '布局', '门板', '盖板',
                                '接头', '地脚', '颜色', '外壳')):
        return (W, '1级'), 'keyword'
    if any(k in stage for k in ('复位', '气缸', '电机', '转速', '噪音', '功能', '流程',
                                '测试', '点检', '单元', '工位')):
        return (D, '5级'), 'keyword'
    if any(k in stage for k in ('真空', '气密', '气幕')) or (
            '气' in stage and '水' not in stage):
        return (Q, '2级'), 'keyword'
    if '水' in stage or '漏' in stage:
        return (S, '3级'), 'keyword'
    if '老化' in stage:
        return (L, '2级'), 'keyword'
    if '工艺' in stage:
        return (G, '1级'), 'keyword'
    if '断电' in stage:
        return (U, '1级'), 'keyword'
    if any(k in stage for k in ('备份', '杀毒', '病毒', 'USB', 'window', '加密')):
        return (B, '3级'), 'keyword'
    return None, 'none'


def classify(stage, item, sub='', std='', method='',
             ref_pairs=None, ref_stages=None, family='trunk'):
    """返回 ((主顺序, 子顺序), 归类依据)。

    归类依据：标准答案 / 同类工序 / 分支规则 / 主干规则 / 规则推断。
    """
    result, layer = _classify_raw(stage, item, sub, std, method, family)
    if result is None:
        result, layer = (D, '5级'), 'none'

    key = (stage, item)
    if ref_pairs is not None and key in ref_pairs:
        return result, '标准答案'
    if ref_stages is not None and stage in ref_stages:
        return result, '同类工序'
    if layer == 'branch':
        return result, '分支规则'
    if layer == 'trunk':
        return result, '主干规则'
    return result, '规则推断'
