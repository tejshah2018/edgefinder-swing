"""Offline smoke checks for field extraction. Run with `python tests/test_backend.py`."""
from __future__ import annotations
import importlib.util, pathlib, sys, types
import pandas as pd

sys.modules.setdefault('yfinance', types.SimpleNamespace(download=lambda **_: None))
spec = importlib.util.spec_from_file_location('scanner', pathlib.Path(__file__).parents[1]/'scripts/update_data.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
index = pd.date_range('2025-01-01', periods=220, freq='B')
record={}
for t in ('SPY','NVDA'):
    for col,base in [('Open',100),('High',103),('Low',97),('Close',101),('Volume',1_000_000)]:
        record[(t,col)] = [base+i*0.1 if col!='Volume' else base for i in range(len(index))]
frame = pd.DataFrame(record,index=index)
for ticker in ('SPY','NVDA'):
    rows=module.extract_rows(module.pick_frame(frame,ticker,['SPY','NVDA']))
    assert len(rows)==220
    assert rows[0]['date']=='2025-01-01'
    assert rows[-1]['h']>=rows[-1]['c']>=rows[-1]['l']
print('Backend extraction smoke tests passed')
