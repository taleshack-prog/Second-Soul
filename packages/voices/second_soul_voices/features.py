"""Features estilométricas — capturam o JEITO de escrever, não o assunto.

A intuição: clustering semântico separa TEMAS (código vs. conscienciologia).
Mas duas pessoas podem falar do mesmo tema. O estilo (tamanho de frase, gíria,
emoji, pontuação, xingamento) é mais invariante à pessoa do que ao tema, então
serve de sinal complementar pra distinguir QUEM escreveu.

Sem dependências: tudo aqui é string pura.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, asdict

# marcadores de registro informal / gíria pt-BR (não é lista de ofensa moral,
# é sinal estilístico: quem usa "mano/porra/kkk" tem registro diferente)
_SLANG = re.compile(
    r"\b(mano|cara|porra|caralho|puta|merda|foda|massa|top|vlw|blz|pprt|tmj|"
    r"kk+|rs+|slk|mds|eita|nossa|pqp)\b",
    re.IGNORECASE,
)
_EMOJI = re.compile(
    "[\U0001F300-\U0001FAFF\U00002600-\U000027BF\U0001F000-\U0001F0FF]"
)
_CODE = re.compile(
    r"(def |import |print\(|return |\bnumpy\b|\bpandas\b|\bnp\.|\bpd\.|"
    r"[\[\]{};=]|\(\)|=>|::|</?\w+>|\bfor \w+ in\b)"
)
_WORD = re.compile(r"\w+", re.UNICODE)
_SENT_SPLIT = re.compile(r"[.!?]+")


@dataclass
class StyleFeatures:
    char_len: int
    word_count: int
    avg_word_len: float
    avg_sentence_len: float  # palavras por frase
    uppercase_ratio: float
    punct_ratio: float
    digit_ratio: float
    question: float          # termina com "?"
    slang_rate: float        # gírias por 100 palavras
    emoji_rate: float        # emojis por 100 palavras
    code_score: float        # densidade de sinais de código

    def to_dict(self) -> dict:
        return asdict(self)

    def vector(self) -> list[float]:
        """Ordem estável pra virar vetor de clustering."""
        return [
            self.avg_word_len,
            self.avg_sentence_len,
            self.uppercase_ratio,
            self.punct_ratio,
            self.digit_ratio,
            self.question,
            self.slang_rate,
            self.emoji_rate,
            self.code_score,
        ]


def extract(text: str) -> StyleFeatures:
    text = text or ""
    chars = len(text)
    words = _WORD.findall(text)
    n_words = len(words) or 1
    sentences = [s for s in _SENT_SPLIT.split(text) if s.strip()]
    n_sent = len(sentences) or 1

    letters = sum(c.isalpha() for c in text)
    uppers = sum(c.isupper() for c in text)
    puncts = sum(not c.isalnum() and not c.isspace() for c in text)
    digits = sum(c.isdigit() for c in text)

    return StyleFeatures(
        char_len=chars,
        word_count=len(words),
        avg_word_len=sum(len(w) for w in words) / n_words,
        avg_sentence_len=len(words) / n_sent,
        uppercase_ratio=uppers / (letters or 1),
        punct_ratio=puncts / (chars or 1),
        digit_ratio=digits / (chars or 1),
        question=1.0 if text.rstrip().endswith("?") else 0.0,
        slang_rate=100 * len(_SLANG.findall(text)) / n_words,
        emoji_rate=100 * len(_EMOJI.findall(text)) / n_words,
        code_score=min(1.0, len(_CODE.findall(text)) / 5.0),
    )
