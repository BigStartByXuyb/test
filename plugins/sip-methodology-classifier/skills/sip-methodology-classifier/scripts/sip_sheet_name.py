# -*- coding: utf-8 -*-
"""Excel Sheet 名清洗与去重。"""


def safe_name(name, used):
    for ch in '\\/*?:[]':
        name = name.replace(ch, '_')
    name = (name or 'Sheet')[:31]
    base, i = name, 2
    while name in used:
        suffix = f'_{i}'
        name = base[:31 - len(suffix)] + suffix
        i += 1
    used.add(name)
    return name
