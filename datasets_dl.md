# DATASETS.md — Demand Letter Generator (MVP)

There is no public “demand letter corpus.” For an MVP, combine **public complaint narratives** (for realistic facts) with **public templates/guides** (for structure). Then synthesize a tiny gold set for eval.

---

## What to use now
1) **CFPB Consumer Complaint Database** (facts)
   - Portal: https://www.consumerfinance.gov/data-research/consumer-complaints/
   - API: https://cfpb.github.io/api/ccdb/
   - Use complaint narratives to synthesize **facts JSON** (e.g., billing errors, collections, bank disputes).

2) **Public templates & guidance** (structure)
   - California Courts Self‑Help demand letters (examples/guides)
   - Massachusetts 93A 30‑day demand letter guidance (consumer protection)
   - Purpose: headings, tone, mandatory elements; avoid copying proprietary firm templates.

3) **Clause/style corpora (adjacent)**
   - CUAD (contract clauses), LEDGAR (clause dataset) → retrieval/style cues, not actual demand letters.

---

## Repository layout (suggested)
```
/steno-demand-letter
  /data
    complaints.csv          # raw CFPB sample
    facts_seed.json         # generated facts
    templates/              # public/generic templates
    LICENSES.md             # provenance & licenses
```

---

## Tiny importer — CFPB CSV → `facts_seed.json`
```python
import csv, json
rows = []
with open('data/complaints.csv', newline='', encoding='utf-8') as f:
    for i, r in enumerate(csv.DictReader(f)):
        if i >= 1000: break  # small seed for MVP
        rows.append({
          'parties': {
            'plaintiff': 'Consumer',
            'defendant': (r.get('company') or 'Unknown').strip()
          },
          'incident': (r.get('consumer_complaint_narrative') or '').strip(),
          'damages': {'amount_claimed': None},
          'venue': (r.get('state') or '').strip(),
          'category': (r.get('product') or '').strip()
        })
open('data/facts_seed.json','w',encoding='utf-8').write(json.dumps(rows, indent=2))
```

**Download a CSV sample**
```bash
mkdir -p data && cd data
# Example: pull 5k complaints with narratives (you can also use the web export UI)
# See CCDB API docs for parameters. For quick start, export via portal to CSV.
```

---

## Synthetic corpus recipe
- Pick **3–4 tracks** (e.g., *car accident*, *slip & fall*, *security deposit*, *consumer billing*).
- Create **20–30** fact JSONs per track (hand‑crafted or extracted snippets).
- Generate drafts with your template & guardrails; **post‑edit 5–10** per track → tiny **gold** set.

---

## Evals hook
- Use the repo’s `EVALS.md` rubric: completeness, factual fidelity (no unsupported claims), tone.
- Regression gate: any hallucination → **FAIL**; otherwise ≥ 80/100 average rubric.

---

## Licensing & privacy
- Respect each source’s license and terms.
- Avoid storing PII beyond MVP testing; redact names/addresses in generated artifacts.
- Keep a provenance log in `data/LICENSES.md`.

