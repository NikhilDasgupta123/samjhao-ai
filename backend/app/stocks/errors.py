class StockDataUnavailableError(Exception):
    """Raised when the NSE MCP server cannot provide requested stock data."""
