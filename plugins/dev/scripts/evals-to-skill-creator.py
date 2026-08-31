#!/usr/bin/env python3
"""Derive skill-creator `evals/evals.json` from native `claude plugin eval` cases.

Source of truth stays `<skill>/evals/<case>/{prompt.md,graders/*.md}` (runs under the CLI once
`plugin eval` leaves early access). This writes the derived `<skill>/evals/evals.json` that the
official skill-creator loop reads, turning each grader into an expectation string.

    python3 evals-to-skill-creator.py <skills-dir> [<skills-dir> ...]
"""
import json, re, sys, pathlib

def fm(text):
    m = re.match(r"^---\n(.*?)\n---\n?(.*)$", text, re.S)
    if not m: return {}, text
    meta = {}
    for line in m.group(1).splitlines():
        k, _, v = line.partition(":")
        if _: meta[k.strip()] = v.strip().strip('"').strip("'")
    return meta, m.group(2).strip()

def expectation(g):
    meta, body = fm(g.read_text())
    t = meta.get("type")
    if t == "llm":
        crit = re.search(r"criteria:\s*>\n((?:  .*\n?)+)", g.read_text())
        return " ".join(l.strip() for l in crit.group(1).splitlines()) if crit else body.split("\n")[0]
    if t == "regex":
        neg = meta.get("match") == "not_contains"
        return f"The final response does {'NOT ' if neg else ''}contain text matching /{meta.get('pattern')}/."
    if t == "tool_used":
        mx = meta.get("max"); mn = meta.get("min")
        if mx == "0": return f"The agent never called the {meta.get('tool')} tool with input matching /{meta.get('input_match', '.*')}/."
        return f"The agent called the {meta.get('tool')} tool (input matching /{meta.get('input_match', '.*')}/) at least {mn or 1} time(s)."
    if t == "file_exists": return f"A file matching {meta.get('path')} exists in the outputs."
    return body.split("\n")[0]

for root in map(pathlib.Path, sys.argv[1:]):
    for skill in sorted(p for p in root.iterdir() if (p / "SKILL.md").exists()):
        cases = sorted(skill.glob("evals/*/prompt.md"))
        if not cases: continue
        evals = []
        for i, c in enumerate(cases):
            meta, prompt = fm(c.read_text())
            evals.append({"id": i, "prompt": prompt, "expected_output": meta.get("name", c.parent.name),
                          "expectations": [expectation(g) for g in sorted((c.parent / "graders").glob("*.md"))]})
        out = skill / "evals" / "evals.json"
        out.write_text(json.dumps({"skill_name": skill.name, "evals": evals}, indent=2) + "\n")
        print(f"{skill.name}: {len(evals)} case(s) -> {out.relative_to(root)}")
