"""Shared NSE symbol validation and normalization."""

import re


_SYMBOL_PATTERN = re.compile(r"^[A-Z0-9][A-Z0-9.&-]{0,29}$")


def normalize_symbol(symbol: str) -> str:
    value = symbol.strip().upper()
    if value.endswith(".NS"):
        value = value[:-3]
    if not _SYMBOL_PATTERN.fullmatch(value):
        raise ValueError("Enter a valid NSE symbol, for example RELIANCE or SBIN.")
    return value
