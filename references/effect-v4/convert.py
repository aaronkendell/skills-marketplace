"""Convert one effect.website docs page (Astro HTML on stdin) to markdown on stdout.

Keeps the <article> only; code blocks are rebuilt line-by-line from expressive-code markup.
Run via refresh.sh (needs: uv run --with beautifulsoup4 --with markdownify).
"""
import re
import sys

from bs4 import BeautifulSoup
from markdownify import markdownify

soup = BeautifulSoup(sys.stdin.read(), "html.parser")
art = soup.find("article")
if art is None:
    sys.exit("no <article> found")

for el in art.select("script, style, link, svg, .copy, .open-in-playground, .heading-permalink, .gutter"):
    el.decompose()

blocks = []
for fig in art.select("div.expressive-code"):
    pre = fig.find("pre")
    lang = (pre.get("data-language") if pre else "") or ""
    title_el = fig.find("figcaption")
    title = title_el.get_text(strip=True) if title_el else ""
    lines = [ln.get_text() for ln in fig.select("div.ec-line div.code")] if pre else []
    if not lines and pre:
        lines = pre.get_text().split("\n")
    head = f"// {title}\n" if title else ""
    blocks.append(f"```{lang}\n{head}" + "\n".join(lines).rstrip() + "\n```")
    fig.replace_with(soup.new_string(f"@@CODEBLOCK{len(blocks) - 1}@@"))

md = markdownify(str(art), heading_style="ATX", bullets="-", code_language="")
for i, b in enumerate(blocks):
    md = md.replace(f"@@CODEBLOCK{i}@@", f"\n\n{b}\n\n")
md = re.sub(r"\n{3,}", "\n\n", md).strip() + "\n"
sys.stdout.write(md)
