"""Testes do pipeline de ingestão contra um export sintético do ChatGPT."""

import json
from pathlib import Path

import pytest

from second_soul_importer import ImportPipeline
from second_soul_importer.parsers import ChatGPTParser


def _fake_export() -> list[dict]:
    """Reproduz o formato real: lista de conversas com mapping de nós."""
    return [
        {
            "title": "Conscienciologia — estudos",
            "conversation_id": "c1",
            "mapping": {
                "n0": {"message": None},  # nó raiz sem mensagem
                "n1": {
                    "message": {
                        "author": {"role": "user"},
                        "create_time": 1_700_000_000.0,
                        "content": {
                            "content_type": "text",
                            "parts": [
                                "A consciência não se limita ao cérebro físico."
                            ],
                        },
                    }
                },
                "n2": {
                    "message": {
                        "author": {"role": "assistant"},
                        "create_time": 1_700_000_060.0,
                        "content": {"content_type": "text", "parts": ["Entendo."]},
                    }
                },
                "n3": {  # duplicata exata de n1 -> deve ser removida
                    "message": {
                        "author": {"role": "user"},
                        "content": {
                            "content_type": "text",
                            "parts": [
                                "A consciência não se limita ao cérebro físico."
                            ],
                        },
                    }
                },
                "n4": {  # contém PII -> deve ser scrubbed no nível strict
                    "message": {
                        "author": {"role": "user"},
                        "content": {
                            "content_type": "text",
                            "parts": ["Meu CPF é 123.456.789-00, anota aí por favor."],
                        },
                    }
                },
            },
        }
    ]


@pytest.fixture
def export_file(tmp_path: Path) -> Path:
    p = tmp_path / "conversations.json"
    p.write_text(json.dumps(_fake_export()), encoding="utf-8")
    return p


def test_parser_extracts_messages(export_file: Path):
    items = ChatGPTParser().parse(export_file, user_id="mae")
    # 4 mensagens com conteúdo (n0 sem message é ignorado)
    assert len(items) == 4
    assert {i.role for i in items} == {"user", "assistant"}
    assert all(i.source == "chatgpt" for i in items)
    assert all(i.conversation_id == "c1" for i in items)


def test_pipeline_dedup_and_pii(export_file: Path):
    result = ImportPipeline(user_id="mae", pii_level="strict").run(export_file)
    items = result["items"]

    # dedup: n1 e n3 são idênticos -> um some
    assert result["raw_count"] == 4
    assert result["clean_count"] == 3

    # PII: o CPF foi mascarado
    pii_items = [i for i in items if i.pii_scrubbed]
    assert len(pii_items) == 1
    assert "123.456.789-00" not in pii_items[0].content
    assert "[CPF_REMOVIDO]" in pii_items[0].content
    assert pii_items[0].classification == "sensitive"


def test_pii_minimal_keeps_cpf(export_file: Path):
    result = ImportPipeline(user_id="mae", pii_level="minimal").run(export_file)
    # nível minimal não remove CPF
    assert result["scrubbed_count"] == 0


def test_auto_detection(export_file: Path):
    result = ImportPipeline(user_id="mae").run(export_file, platform="auto")
    assert result["platform"] == "chatgpt"
