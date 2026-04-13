"""OCR service for extracting text values from circuit component images"""
import torch
import torch.nn as nn
import numpy as np
import cv2
from pathlib import Path
from typing import Tuple, Optional
from torchvision import transforms
import re

from app.core.logging import get_logger

logger = get_logger(__name__)


class BidirectionalLSTM(nn.Module):
    """Bidirectional LSTM for sequence modeling"""
    
    def __init__(self, input_size, hidden_size, output_size):
        super(BidirectionalLSTM, self).__init__()
        self.rnn = nn.LSTM(input_size, hidden_size, bidirectional=True, batch_first=True)
        self.linear = nn.Linear(hidden_size * 2, output_size)

    def forward(self, input):
        """
        input : visual feature [batch_size x T x input_size]
        output : contextual feature [batch_size x T x output_size]
        """
        try:
            self.rnn.flatten_parameters()
        except:
            pass
        recurrent, _ = self.rnn(input)
        output = self.linear(recurrent)
        return output


class VGG_FeatureExtractor(nn.Module):
    """VGG-based feature extractor for image to sequence conversion"""

    def __init__(self, input_channel, output_channel=512):
        super(VGG_FeatureExtractor, self).__init__()
        self.output_channel = [int(output_channel / 8), int(output_channel / 4),
                               int(output_channel / 2), output_channel]
        self.ConvNet = nn.Sequential(
            nn.Conv2d(input_channel, self.output_channel[0], 3, 1, 1), nn.ReLU(True),
            nn.MaxPool2d(2, 2),
            nn.Conv2d(self.output_channel[0], self.output_channel[1], 3, 1, 1), nn.ReLU(True),
            nn.MaxPool2d(2, 2),
            nn.Conv2d(self.output_channel[1], self.output_channel[2], 3, 1, 1), nn.ReLU(True),
            nn.Conv2d(self.output_channel[2], self.output_channel[2], 3, 1, 1), nn.ReLU(True),
            nn.MaxPool2d((2, 1), (2, 1)),
            nn.Conv2d(self.output_channel[2], self.output_channel[3], 3, 1, 1, bias=False),
            nn.BatchNorm2d(self.output_channel[3]), nn.ReLU(True),
            nn.Conv2d(self.output_channel[3], self.output_channel[3], 3, 1, 1, bias=False),
            nn.BatchNorm2d(self.output_channel[3]), nn.ReLU(True),
            nn.MaxPool2d((2, 1), (2, 1)),
            nn.Conv2d(self.output_channel[3], self.output_channel[3], 2, 1, 0), nn.ReLU(True))

    def forward(self, input):
        return self.ConvNet(input)


class CRNN(nn.Module):
    """CRNN model combining CNN feature extraction with RNN sequence modeling"""

    def __init__(self, input_channel=1, output_channel=512, hidden_size=256, num_class=95):
        super(CRNN, self).__init__()
        """ Feature Extraction """
        self.FeatureExtraction = VGG_FeatureExtractor(input_channel, output_channel)
        self.FeatureExtraction_output = output_channel
        self.AdaptiveAvgPool = nn.AdaptiveAvgPool2d((None, 1))

        """ Sequence Modeling """
        self.SequenceModeling = nn.Sequential(
            BidirectionalLSTM(self.FeatureExtraction_output, hidden_size, hidden_size),
            BidirectionalLSTM(hidden_size, hidden_size, hidden_size))
        self.SequenceModeling_output = hidden_size

        """ Prediction """
        self.Prediction = nn.Linear(self.SequenceModeling_output, num_class)

    def forward(self, input):
        """ Feature extraction stage """
        visual_feature = self.FeatureExtraction(input)
        visual_feature = self.AdaptiveAvgPool(visual_feature.permute(0, 3, 1, 2))
        visual_feature = visual_feature.squeeze(3)

        """ Sequence modeling stage """
        contextual_feature = self.SequenceModeling(visual_feature)

        """ Prediction stage """
        prediction = self.Prediction(contextual_feature.contiguous())
        prediction = prediction.permute(1, 0, 2)  # T x B x C

        return prediction


# ── Auto-discover the trained CRNN weights ──────────────────────────────────
_BACKEND_ROOT = Path(__file__).resolve().parents[2]  # …/backend

_CANDIDATE_PATHS = [
    _BACKEND_ROOT / "ocr" / "crnn_last.pth",
    _BACKEND_ROOT / "ocr" / "best_model.pth",
    _BACKEND_ROOT / "model" / "ocr.pth",
]


def _find_model_path() -> Optional[Path]:
    """Return the first model file that exists on disk, or None."""
    for p in _CANDIDATE_PATHS:
        if p.exists():
            return p
    return None


class OCRService:
    """Service for extracting text from component images using CRNN model
    trained in the EasyOCR notebook (backend/ocr/EasyOCR.ipynb)."""
    
    def __init__(self, model_path: Optional[str] = None):
        self.device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
        self.model = None
        self.model_path: Optional[Path] = (
            Path(model_path) if model_path else _find_model_path()
        )
        self.char2idx = None
        self.idx2char = None
        self.transform = None
        
        # Initialize character mapping
        self._init_char_mapping()
        
        # Load model
        self._load_model()
    
    def _init_char_mapping(self):
        """Initialize character to index mapping - matches EasyOCR notebook"""
        # Full character set from the notebook
        CHARS = list(
            '!"#$%&' +
            "()*+,-./0123456789:<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ^_`abcdefghijklmnopqrstuvwxyz~§µ×ßäöüΩ"
        )
        
        # Reserve 0 for CTC blank; labels start at 1
        self.char2idx = {c: i+1 for i, c in enumerate(CHARS)}
        self.char2idx[''] = 0  # CTC blank
        self.idx2char = {i: c for c, i in self.char2idx.items()}
        
        logger.info(f"Character mapping initialized with {len(CHARS)} characters")
    
    def _load_model(self):
        """Load pre-trained CRNN model from the EasyOCR notebook weights."""
        try:
            if self.model_path is None or not self.model_path.exists():
                logger.warning(
                    f"OCR model not found (searched: "
                    f"{', '.join(str(p) for p in _CANDIDATE_PATHS)})"
                )
                self.model = None
                return

            num_chars = len(self.char2idx)
            self.model = CRNN(
                input_channel=1,
                output_channel=512,
                hidden_size=256,
                num_class=num_chars,
            ).to(self.device)

            # Load weights – handle PyTorch 2.x weights_only flag
            try:
                state_dict = torch.load(
                    str(self.model_path),
                    map_location=self.device,
                    weights_only=False,
                )
            except TypeError:
                # Older PyTorch versions don't support weights_only
                state_dict = torch.load(
                    str(self.model_path), map_location=self.device
                )

            # Handle different state-dict wrappers
            if isinstance(state_dict, dict) and "model_state_dict" in state_dict:
                state_dict = state_dict["model_state_dict"]

            self.model.load_state_dict(state_dict)
            self.model.eval()

            # Transform: resize to 32px height, normalise
            self.transform = transforms.Compose([
                transforms.ToTensor(),
                transforms.Normalize((0.5,), (0.5,)),
            ])

            logger.info(
                f"OCR CRNN model loaded from {self.model_path} "
                f"({num_chars} classes, device={self.device})"
            )

        except Exception as e:
            logger.error(f"Failed to load OCR model: {e}")
            self.model = None
    
    def is_available(self) -> bool:
        """Check if OCR model is available"""
        return self.model is not None
    
    def extract_text(self, image_crop: np.ndarray, confidence_threshold: float = 0.3) -> Tuple[str, float]:
        """
        Extract text from an image crop using CRNN model
        
        Args:
            image_crop: Image region containing text (BGR or RGB)
            confidence_threshold: Confidence threshold for accepting predictions
            
        Returns:
            Tuple of (extracted_text, confidence_score)
        """
        if not self.is_available():
            logger.debug("OCR model not available")
            return "", 0.0
        
        try:
            # Convert to grayscale
            if len(image_crop.shape) == 3:
                image_crop = cv2.cvtColor(image_crop, cv2.COLOR_BGR2GRAY)
            
            # Resize to standard height while maintaining aspect ratio
            h, w = image_crop.shape[:2]
            if h > 0 and w > 0:
                new_w = max(8, int(w * 32 / h))
                image_resized = cv2.resize(image_crop, (new_w, 32), interpolation=cv2.INTER_LANCZOS4)
            else:
                return "", 0.0
            
            # Convert to tensor
            img_tensor = torch.from_numpy(image_resized).float() / 255.0
            img_tensor = img_tensor.unsqueeze(0).unsqueeze(0)  # Add batch and channel dims: 1x1xHxW
            
            if self.transform:
                # Apply normalization
                img_tensor = transforms.Normalize((0.5,), (0.5,))(img_tensor)
            
            img_tensor = img_tensor.to(self.device)
            
            # Run inference
            with torch.no_grad():
                output = self.model(img_tensor)  # Returns T x B x C
            
            # Decode output
            text, confidence = self._decode_output(output)
            
            # Clean up text
            text = self._clean_text(text)
            
            logger.debug(f"OCR extracted: '{text}' (confidence: {confidence:.3f})")
            
            return text, confidence
            
        except Exception as e:
            logger.debug(f"Error during OCR inference: {str(e)}")
            return "", 0.0
    
    def _decode_output(self, output: torch.Tensor) -> Tuple[str, float]:
        """Decode CRNN output using greedy decoding (matches EasyOCR notebook)"""
        output = output.softmax(2)  # T x B x C
        max_indices = output.argmax(2).permute(1, 0)  # B x T
        
        decoded = ""
        prev = 0
        confidences = []
        
        # Process first batch item
        indices = max_indices[0] if max_indices.shape[0] > 0 else max_indices
        
        for i, idx in enumerate(indices):
            idx = idx.item()
            # Get confidence for this prediction
            conf = output[i, 0, idx].item() if output.shape[1] > 0 else output[i, idx].item()
            
            if idx != prev and idx != 0:  # 0 is CTC blank
                if idx in self.idx2char:
                    char = self.idx2char[idx]
                    decoded += char
                    confidences.append(conf)
            prev = idx
        
        # Calculate average confidence
        avg_confidence = float(np.mean(confidences)) if confidences else 0.0
        
        return decoded, avg_confidence
    
    def _clean_text(self, text: str) -> str:
        """Clean extracted text to valid component values"""
        # Remove spaces
        text = text.strip()
        
        # Handle common OCR mistakes
        replacements = {
            'O': '0',  # Letter O -> 0
            'l': '1',  # Letter l -> 1
            'S': '5',  # Letter S -> 5
            'Z': '2',  # Letter Z -> 2
            'I': '1',  # Letter I -> 1
        }
        
        for old, new in replacements.items():
            text = text.replace(old, new)
        
        # Keep only valid characters for component values
        # Valid: digits, decimal point, unit suffixes (m, k, M, G, T, K, p, n, u, µ, -, +, %)
        valid_pattern = r'^[0-9.mkMGTKpnuµ\-%+]*$'
        
        if not re.match(valid_pattern, text):
            logger.debug(f"Text '{text}' contains invalid characters, filtering")
            # Keep only valid characters
            text = ''.join(c for c in text if re.match(r'[0-9.mkMGTKpnuµ\-%+]', c))
        
        return text
    
    # ── batch API (drop-in replacement for the old EasyOCR OCREngine) ──────

    def extract_texts(
        self,
        image_bgr: np.ndarray,
        text_boxes: list,
        padding: int = 4,
    ) -> list:
        """
        Run OCR on every text bounding box – same interface as the old
        ``OCREngine.extract_texts`` so callers need no changes.

        Parameters
        ----------
        image_bgr : full circuit image (BGR, uint8).
        text_boxes : list of dicts, each with key ``bbox`` → [x1, y1, x2, y2].
        padding : extra pixels around each crop for context.

        Returns
        -------
        List of dicts: original box fields + ``ocr_text`` and ``ocr_confidence``.
        """
        h, w = image_bgr.shape[:2]
        results: list = []

        for tb in text_boxes:
            x1, y1, x2, y2 = tb["bbox"]
            x1p, y1p = max(0, x1 - padding), max(0, y1 - padding)
            x2p, y2p = min(w, x2 + padding), min(h, y2 + padding)

            crop = image_bgr[y1p:y2p, x1p:x2p]
            if crop.size == 0:
                results.append({**tb, "ocr_text": "", "ocr_confidence": 0.0})
                continue

            text, conf = self.extract_text(crop)
            results.append({
                **tb,
                "ocr_text": text,
                "ocr_confidence": round(conf, 4),
            })

        return results

    def extract_value_and_unit(self, text: str) -> Tuple[str, str]:
        """
        Extract value and unit from OCR text
        
        Args:
            text: Extracted text (e.g., "10k", "2.2M", "100n")
            
        Returns:
            Tuple of (value, unit)
        """
        if not text:
            return "", ""
        
        # Pattern to match value and unit
        # Matches: number (with optional decimal) followed by optional unit
        pattern = r'^([\d.]+)(.*?)$'
        match = re.match(pattern, text)
        
        if match:
            value = match.group(1)
            unit = match.group(2).strip()
            return value, unit
        
        return text, ""


# Global OCR service instance
_ocr_service = None


def get_ocr_service() -> OCRService:
    """Get or create global OCR service instance"""
    global _ocr_service
    if _ocr_service is None:
        _ocr_service = OCRService()
    return _ocr_service
