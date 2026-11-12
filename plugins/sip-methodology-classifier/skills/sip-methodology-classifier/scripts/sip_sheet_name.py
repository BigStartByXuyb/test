# -*- coding: utf-8 -*-
"""Excel Sheet 名清洗与去重。"""


EXPLANATION_SHEET = '说明'
PENDING_SHEET = '待确认项（规则推断）'
RESERVED_SHEET_NAMES = (EXPLANATION_SHEET, PENDING_SHEET)


def safe_name(name, used, fallback='Sheet'):
    for ch in '\\/*?:[]':
        name = name.replace(ch, '_')
    name = (name or fallback)[:31]
    base, i = name, 2
    while any(name.casefold() == existing.casefold() for existing in used):
        suffix = f'_{i}'
        name = base[:31 - len(suffix)] + suffix
        i += 1
    used.add(name)
    return name
