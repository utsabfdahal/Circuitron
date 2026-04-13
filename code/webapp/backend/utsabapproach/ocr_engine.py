"""
OCR engine – thin compatibility shim.

Delegates all text recognition to the custom CRNN model
(backend/ocr/crnn_last.pth) via ``app.services.ocr_service``.

Any legacy code that does ``from .ocr_engine import OCREngine``
will get the real ``OCRService`` instance transparently.
"""

from __future__ import annotations

from app.services.ocr_service import OCRService as OCREngine, get_ocr_service  # noqa: F401

__all__ = ["OCREngine", "get_ocr_service"]
