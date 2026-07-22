"""CLI de ingestão.

Uso:
    python -m second_soul_importer.cli caminho/para/export.zip \
        --user mae --pii strict --out saida.jsonl --preview 3
"""

from __future__ import annotations

import argparse
import json
import sys

from .pipeline import ImportPipeline


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description="Second Soul — importador de memórias")
    ap.add_argument("file", help="export .zip ou conversations.json")
    ap.add_argument("--user", default="demo", help="user_id do dono da memória")
    ap.add_argument("--platform", default="auto")
    ap.add_argument(
        "--pii", default="strict", choices=["strict", "balanced", "minimal"]
    )
    ap.add_argument("--out", default=None, help="grava NormalizedItems em JSONL")
    ap.add_argument("--preview", type=int, default=3)
    args = ap.parse_args(argv)

    pipe = ImportPipeline(user_id=args.user, pii_level=args.pii)
    result = pipe.run(args.file, platform=args.platform)
    items = result.pop("items")

    print(json.dumps(result, ensure_ascii=False, indent=2))

    print("\n--- preview ---")
    for it in items[: args.preview]:
        role = it.role or "?"
        snippet = it.content[:160].replace("\n", " ")
        print(f"[{role}] {snippet}")

    if args.out:
        with open(args.out, "w", encoding="utf-8") as fh:
            for it in items:
                fh.write(json.dumps(it.to_dict(), ensure_ascii=False) + "\n")
        print(f"\n{len(items)} itens gravados em {args.out}")

    return 0


if __name__ == "__main__":
    sys.exit(main())
