# -*- coding: utf-8 -*-
"""文件类型（设备族）识别：决定走哪个规则分支。

优先级：SLG（激光） > EXP（扩片） > SDC（刀轮/切割） > 主干。
文件名前缀（SDC/EXP/SLG）优先参与判断，避免产品名不含关键词时误判。
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
    return 'trunk'


def detect_family_from_rows(rows, file_name=''):
    if not rows:
        return 'trunk'
    return detect_family(rows[0].get('product', ''),
                         rows[0].get('model', ''),
                         [r.get('stage', '') for r in rows],
                         file_name=file_name)
