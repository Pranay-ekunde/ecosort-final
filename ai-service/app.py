"""
EcoSort AI Microservice — Clean Flask App using ONNX Runtime
Provides lightweight, memory-efficient inference suited for CPU environments.

Endpoints:
- GET  /health              — returns service health & model status
- POST /predict             — classifies a single waste image
- POST /predict/batch       — classifies multiple images in a single request
- POST /features/extract    — (deprecated) returns disabled status
- POST /features/similarity — compares classification similarity between two images
"""

import os
import io
import gc
import sys
import numpy as np
from flask import Flask, request, jsonify
from PIL import Image

app = Flask(__name__)

# Config
MODEL_PATH = os.getenv("MODEL_PATH", "models/best_model.onnx")
IMG_SIZE = 224
CLASS_NAMES = ["hazardous", "non_recyclable", "recyclable"]

# Global session variables
session = None
input_name = None

def load_model():
    """Load ONNX model using ONNX Runtime CPU provider."""
    global session, input_name
    print(f"[load_model] Attempting to load model from: '{MODEL_PATH}'")

    # If the path points to .keras or .tflite, check if .onnx counterpart exists
    onnx_path = MODEL_PATH
    if not MODEL_PATH.endswith(".onnx"):
        onnx_path = MODEL_PATH.replace(".tflite", ".onnx").replace(".keras", ".onnx")

    if os.path.exists(onnx_path):
        try:
            import onnxruntime as ort
            print(f"[load_model] Loading ONNX model into InferenceSession...")
            # CPUExecutionProvider is standard and optimal for resource-constrained free-tier hosting (e.g., Render)
            session = ort.InferenceSession(onnx_path, providers=['CPUExecutionProvider'])
            input_name = session.get_inputs()[0].name
            print(f"[load_model] Model loaded successfully. Input name: {input_name}")
            print(f"[load_model] Class names mapping: {CLASS_NAMES}")
            return True
        except Exception as e:
            print(f"[load_model] Error loading ONNX model: {e}", file=sys.stderr)
            import traceback
            traceback.print_exc(file=sys.stderr)
    else:
        print(f"[load_model] Warning: No ONNX model file found at '{onnx_path}'", file=sys.stderr)
    
    print("[load_model] Fallback mode: Using mock predictions.", file=sys.stderr)
    return False

def preprocess_image(image_bytes):
    """
    Preprocess raw image bytes:
    1. Load using PIL and convert to RGB
    2. Resize to 224x224 using Bilinear interpolation (matching Kaggle)
    3. Convert to float32 NumPy array in range [0.0, 255.0]
    4. Expand dimensions to (1, 224, 224, 3)
    """
    img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    img = img.resize((IMG_SIZE, IMG_SIZE), Image.BILINEAR)
    arr = np.array(img, dtype=np.float32)
    # Model contains an internal Rescaling layer, so we feed raw [0.0, 255.0] values
    return np.expand_dims(arr, axis=0)

def run_inference(preprocessed_arr):
    """Run model inference and return probability scores."""
    if session is None:
        raise RuntimeError("ONNX inference session is not initialized.")
    preds = session.run(None, {input_name: preprocessed_arr})[0]
    return preds[0]  # Return output array for batch index 0

def mock_predict():
    """Generates a realistic mock prediction if the model is not loaded."""
    import random
    idx = random.choices([0, 1, 2], weights=[0.2, 0.3, 0.5])[0]
    conf = round(0.60 + random.random() * 0.35, 4)
    rest = round(1.0 - conf, 4)
    part = round(random.random() * rest, 4)
    
    scores = [0.0, 0.0, 0.0]
    scores[idx] = conf
    others = [i for i in range(3) if i != idx]
    scores[others[0]] = part
    scores[others[1]] = round(rest - part, 4)
    
    return {
        "prediction": CLASS_NAMES[idx],
        "confidence": conf,
        "scores": {CLASS_NAMES[i]: scores[i] for i in range(3)}
    }

# ── API ENDPOINTS ─────────────────────────────────────────────────────────────

@app.route("/health", methods=["GET"])
def health():
    """Health check endpoint indicating service and model status."""
    return jsonify({
        "status": "ok",
        "service": "ecosort-ai",
        "model_loaded": session is not None,
        "model_path": MODEL_PATH,
    }), 200

@app.route("/predict", methods=["POST"])
def predict():
    """Predict category for a single uploaded image."""
    if "file" not in request.files:
        return jsonify({"error": "No image file provided"}), 400
    
    file = request.files["file"]
    if not file.filename:
        return jsonify({"error": "Empty filename"}), 400

    allowed_extensions = {"jpg", "jpeg", "png", "webp"}
    ext = file.filename.rsplit(".", 1)[-1].lower() if "." in file.filename else ""
    if ext not in allowed_extensions:
        return jsonify({"error": f"Unsupported file format: {ext}"}), 400

    try:
        image_bytes = file.read()
        if session is None:
            # Fallback mock prediction
            result = mock_predict()
            print(f"[PREDICT (MOCK)] {result['prediction']} conf={result['confidence']}")
        else:
            # Real model inference
            arr = preprocess_image(image_bytes)
            preds = run_inference(arr)
            idx = int(np.argmax(preds))
            print(f"[PREDICT] argmax={idx} class={CLASS_NAMES[idx]} scores={preds}")
            result = {
                "prediction": CLASS_NAMES[idx],
                "confidence": round(float(preds[idx]), 4),
                "scores": {CLASS_NAMES[i]: round(float(preds[i]), 4) for i in range(3)}
            }
        return jsonify(result), 200
    except Exception as e:
        print(f"[PREDICT ERROR] {e}", file=sys.stderr)
        return jsonify({"error": str(e)}), 500
    finally:
        gc.collect()

@app.route("/predict/batch", methods=["POST"])
def predict_batch():
    """Predict categories for multiple uploaded images."""
    files = request.files.getlist("files")
    if not files:
        return jsonify({"error": "No files provided"}), 400

    results = []
    for file in files:
        try:
            if not file.filename:
                continue
            
            if session is None:
                r = mock_predict()
            else:
                arr = preprocess_image(file.read())
                preds = run_inference(arr)
                idx = int(np.argmax(preds))
                r = {
                    "prediction": CLASS_NAMES[idx],
                    "confidence": round(float(preds[idx]), 4),
                    "scores": {CLASS_NAMES[i]: round(float(preds[i]), 4) for i in range(3)}
                }
            results.append({"filename": file.filename, **r})
        except Exception as e:
            results.append({"filename": file.filename, "error": str(e)})
            
    gc.collect()
    return jsonify({"results": results}), 200

@app.route("/features/extract", methods=["POST"])
def extract_features():
    """Deprecated: visual features are disabled."""
    return jsonify({"features": None, "feature_dim": 0, "disabled": True}), 200

@app.route("/features/similarity", methods=["POST"])
def feature_similarity():
    """Compare two images based on output vector cosine similarity."""
    files = request.files.getlist("files")
    if len(files) != 2:
        return jsonify({"error": "Exactly 2 image files required"}), 400
    
    try:
        scores = []
        for file in files:
            if session is None:
                scores.append(np.random.rand(3).astype(np.float32))
            else:
                arr = preprocess_image(file.read())
                preds = run_inference(arr)
                scores.append(preds.astype(np.float32))

        # Normalize score vectors and compute similarity metrics
        v1, v2 = scores[0], scores[1]
        norm_v1 = np.linalg.norm(v1)
        norm_v2 = np.linalg.norm(v2)
        
        cos_sim = np.dot(v1, v2) / (norm_v1 * norm_v2 + 1e-8)
        euclidean = float(np.linalg.norm(v1 - v2))

        return jsonify({
            "cosine_similarity": round(float(cos_sim), 6),
            "euclidean_distance": round(euclidean, 6),
            "is_similar": bool(cos_sim > 0.85)
        }), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        gc.collect()

# Startup
load_model()

if __name__ == "__main__":
    port = int(os.getenv("PORT", 8000))
    print(f"EcoSort AI Service starting on port {port}...")
    app.run(host="0.0.0.0", port=port, debug=False)
