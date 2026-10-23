# -*- coding: utf-8 -*-
"""文件类型（设备族）识别：决定走哪个规则分支。

优先级：SLG（激光） > EXP（扩片） > SDC（刀轮/切割） > unknown。
文件名前缀（SDC/EXP/SLG）优先参与判断，避免产品名不含关键词时误判。
无法识别时返回 'unknown'：仍按主干规则归类，但输出会标注“未知类型，需复核”，
与“已知设备族使用主干规则”区分开。
"""
import os


def detect_family(product, model, stages, file_name=''):
    p = product or ''
    m = (model or '').upper()
    stem = os.path.splitext(os.path.basename(file_name or ''))[0].upper()
    stage_text = ' '.join(stages or [])

    if (stem.startswith('SLG') or 'SLG' in m or '激光' in p
            or '光路' in stage_text or '激光器' in stage_text):
        return 'slg'
    if stem.startswith('EXP') or 'EXP' in m or '扩片' in p:
        return 'exp'
    if stem.startswith('SDC') or 'SDC' in m or '刀轮' in p or '切割' in p:
        return 'sdc'
    return 'unknown'


def detect_family_from_rows(rows, file_name=''):
    if not rows:
        return 'unknown'
    return detect_family(rows[0].get('product', ''),
                         rows[0].get('model', ''),
                         [r.get('stage', '') for r in rows],
                         file_name=file_name)
