from io import BytesIO

from pypdf import PdfReader

from app.core.errors import ParsingError


def parse_pdf(data: bytes) -> str:
    """Extract plain text from a PDF; raises ParsingError when empty/unreadable."""
    try:
        reader = PdfReader(BytesIO(data))
        text = "\n".join((page.extract_text() or "") for page in reader.pages).strip()
    except Exception as exc:  # pypdf raises several error types for corrupt files
        raise ParsingError(f"PDF Parsing failed: {exc}") from exc
    if not text:
        raise ParsingError("Failed to extract text from PDF; parsed document is empty.")
    return text
