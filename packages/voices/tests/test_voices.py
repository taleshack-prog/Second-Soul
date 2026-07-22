"""Testes de separação de vozes contra uma conta sintética de 2 pessoas."""

import json
from pathlib import Path

import pytest

from second_soul_voices import separate


def _mixed_account() -> list[dict]:
    coder = [
        "mano me manda o código refeito com pandas e numpy",
        "porra o vscode não reconhece o pandas de novo",
        "como faço pra transpor essa matriz no numpy",
        "cara esse loop tá dando index out of range",
        "manda o código atual com numpy pra eu testar",
        "como concatenar dois dataframes do pandas rapidão",
        "esse numpy array tá com dtype errado mano",
        "faz um for que percorre a lista e printa",
    ]
    elder = [
        "A consciência não se limita ao cérebro físico, ensina a conscienciologia.",
        "Compreendo que evoluímos ao longo de muitas existências numa longa travessia.",
        "A projeção da consciência seria atuar temporariamente fora do corpo físico.",
        "Ajudar o próximo é a forma mais concreta de crescer interiormente.",
        "A serenidade vem de aceitar que somos parte de algo maior e permanente.",
        "Reflito sobre o desapego das coisas materiais e a paz que isso traz.",
        "Cada experiência difícil traz um aprendizado valioso para a consciência.",
        "Contemplo a continuidade da consciência para além da matéria densa.",
    ]
    rows = []
    for _ in range(4):  # volume
        for t in coder:
            rows.append({"role": "user", "content": t, "true": "coder"})
        for t in elder:
            rows.append({"role": "user", "content": t, "true": "elder"})
    return rows


@pytest.fixture
def account(tmp_path: Path) -> Path:
    p = tmp_path / "conta.jsonl"
    with p.open("w", encoding="utf-8") as fh:
        for r in _mixed_account():
            fh.write(json.dumps(r, ensure_ascii=False) + "\n")
    return p


def test_finds_two_voices(account: Path):
    res = separate(account, backend="tfidf")
    assert res["status"] == "success"
    # duas pessoas na conta -> duas vozes
    assert res["voices_found"] == 2


def test_voices_are_stylistically_distinct(account: Path):
    res = separate(account, backend="tfidf")
    # uma voz deve ter código/gíria alto (coder), a outra baixo (elder)
    code_scores = sorted(v["style"]["code_score"] for v in res["voices"])
    assert code_scores[0] < code_scores[-1]  # há contraste de estilo


def test_only_user_messages_considered(account: Path, tmp_path: Path):
    # injeta mensagens de assistant; não podem virar voz
    p = tmp_path / "com_assistant.jsonl"
    rows = _mixed_account()
    for _ in range(20):
        rows.append({"role": "assistant", "content": "Claro, aqui está o resultado.", "true": "ia"})
    with p.open("w", encoding="utf-8") as fh:
        for r in rows:
            fh.write(json.dumps(r, ensure_ascii=False) + "\n")
    res = separate(p, backend="tfidf")
    # total analisado = só falas user (assistant fora)
    assert res["total_user_messages"] == sum(1 for r in rows if r["role"] == "user")
