#!/usr/bin/env python3
"""Actualiza solo la sección del prompt de las issues ya importadas."""
import json
import re
import subprocess
from pathlib import Path

root = Path(__file__).resolve().parents[2]
batch = json.loads((root / '.scratch/importaciones/feature-flags.json').read_text())
receipt = json.loads((root / '.scratch/importaciones/feature-flags.resultado.json').read_text())
for item in batch['items']:
    number = receipt['issues'][item['key']]['number']
    raw = subprocess.check_output(['gh', 'issue', 'view', str(number), '--repo', batch['repository'], '--json', 'body'], text=True)
    old = json.loads(raw)['body'] or ''
    heading = '## Prompt para trabajar la historia'
    section = heading + item['body'].split(heading, 1)[1]
    pattern = r'^## Prompt para trabajar la historia\s*\n.*?(?=^## |^<!-- bnbtico-import:|\Z)'
    if re.search(pattern, old, flags=re.M | re.S):
        new = re.sub(pattern, lambda match: section + '\n', old, count=1, flags=re.M | re.S)
    else:
        new = old.rstrip() + '\n\n' + section
    if old == new:
        print(f'#{number}: prompt sin cambios')
        continue
    subprocess.run(['gh', 'issue', 'edit', str(number), '--repo', batch['repository'], '--body-file', '-'], input=new, text=True, check=True)
    print(f'#{number}: prompt actualizado')
