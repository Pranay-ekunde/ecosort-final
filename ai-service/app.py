"""
EcoSort AI Microservice — Flask + MobileNetV3Large
POST /predict          — single image classification
POST /predict/batch    — multiple images
POST /features/extract — extract CNN features for duplicate detection
GET  /health           — service status
"""
import os, io, json, sys
import numpy as np
from flask import Flask, request, jsonify
from PIL import Image

app = Flask(__name__)

MODEL_PATH  = os.getenv("MODEL_PATH", "models/best_model.keras")
IMG_SIZE    = 224
# Class order matches training: alphabetical order from folders
# hazardous, non_recyclable, recyclable (how image_dataset_from_directory assigns indices)
CLASS_NAMES = ["hazardous", "non_recyclable", "recyclable"]

model = None
feature_model = None

def load_model():
    global model, feature_model
    import tensorflow as tf
    tf.get_logger().setLevel("ERROR")
    try:
        model = tf.keras.models.load_model(MODEL_PATH, compile=False)

        feature_model = tf.keras.Model(
            inputs=model.input,
            outputs=model.output
        )
        print(f"Model loaded: {MODEL_PATH}")
        print(f"Output shape: {feature_model.output.shape}")
        print(f"Class names: {CLASS_NAMES}")
    except Exception as e:
        import sys
        print(f"ERROR: Could not load model ({e})", file=sys.stderr)
        import traceback; traceback.print_exc(file=sys.stderr)
        model = None
        feature_model = None

def preprocess(image_bytes):
    img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    img = img.resize((IMG_SIZE, IMG_SIZE), Image.BILINEAR)
    # Training used Rescaling(1./255) in the model, so we pass raw [0,255] values
    # No scaling here - the model's Rescaling layer handles normalization
    arr = np.array(img, dtype=np.float32)
    return np.expand_dims(arr, axis=0)

def mock_predict():
    import random
    idx   = random.choices([0, 1, 2], weights=[0.10, 0.25, 0.65])[0]
    conf  = round(0.65 + random.random() * 0.30, 4)
    rest  = round(1.0 - conf, 4)
    sp    = round(random.random() * rest, 4)
    scores = [0.0, 0.0, 0.0]
    scores[idx] = conf
    others = [i for i in range(3) if i != idx]
    scores[others[0]] = sp
    scores[others[1]] = round(rest - sp, 4)
    return {
        "prediction": CLASS_NAMES[idx],
        "confidence": conf,
        "scores": {
            CLASS_NAMES[0]: scores[0],
            CLASS_NAMES[1]: scores[1],
            CLASS_NAMES[2]: scores[2],
        },
    }

@app.route("/health", methods=["GET"])
def health():
    return jsonify({
        "status":       "ok",
        "service":      "ecosort-ai",
        "model_loaded": model is not None,
        "model_path":   MODEL_PATH,
    })

@app.route("/predict", methods=["POST"])
def predict():
    if "file" not in request.files:
        return jsonify({"error": "No image file provided"}), 400

    file = request.files["file"]
    if not file.filename:
        return jsonify({"error": "Empty filename"}), 400

    allowed = {"jpg", "jpeg", "png", "webp"}
    ext = file.filename.rsplit(".", 1)[-1].lower() if "." in file.filename else ""
    if ext not in allowed:
        return jsonify({"error": f"Unsupported format: {ext}"}), 400

    try:
        image_bytes = file.read()

        if model is None:
            result = mock_predict()
            print(f"[MOCK] prediction: {result['prediction']}, conf: {result['confidence']}")
        else:
            arr   = preprocess(image_bytes)
            preds = model.predict(arr, verbose=0)[0]
            idx   = int(np.argmax(preds))
            print(f"[PREDICT] raw preds: {preds}, argmax: {idx}, class: {CLASS_NAMES[idx]}")
            result = {
                "prediction": CLASS_NAMES[idx],
                "confidence": round(float(preds[idx]), 4),
                "scores": {
                    CLASS_NAMES[0]: round(float(preds[0]), 4),
                    CLASS_NAMES[1]: round(float(preds[1]), 4),
                    CLASS_NAMES[2]: round(float(preds[2]), 4),
                },
            }
        return jsonify(result)

    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/predict/batch", methods=["POST"])
def predict_batch():
    files = request.files.getlist("files")
    if not files:
        return jsonify({"error": "No files provided"}), 400

    results = []
    for f in files:
        try:
            if model is None:
                r = mock_predict()
            else:
                arr   = preprocess(f.read())
                preds = model.predict(arr, verbose=0)[0]
                idx   = int(np.argmax(preds))
                r = {
                    "prediction": CLASS_NAMES[idx],
                    "confidence": round(float(preds[idx]), 4),
                    "scores": {n: round(float(p), 4) for n, p in zip(CLASS_NAMES, preds)},
                }
            results.append({"filename": f.filename, **r})
        except Exception as e:
            results.append({"filename": f.filename, "error": str(e)})

    return jsonify({"results": results})

@app.route("/features/extract", methods=["POST"])
def extract_features():
    """Extract CNN features for duplicate detection."""
    if "file" not in request.files:
        return jsonify({"error": "No image file provided"}), 400

    file = request.files["file"]
    if not file.filename:
        return jsonify({"error": "Empty filename"}), 400

    allowed = {"jpg", "jpeg", "png", "webp"}
    ext = file.filename.rsplit(".", 1)[-1].lower() if "." in file.filename else ""
    if ext not in allowed:
        return jsonify({"error": f"Unsupported format: {ext}"}), 400

    try:
        image_bytes = file.read()
        arr = preprocess(image_bytes)

        if feature_model is None:
            import random
            features = np.random.rand(1280).astype(np.float32)
        else:
            features = feature_model.predict(arr, verbose=0)[0]
            features = features.flatten().astype(np.float32)

        return jsonify({
            "features": features.tolist(),
            "feature_dim": len(features),
        })

    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/features/similarity", methods=["POST"])
def feature_similarity():
    """Compare two images using CNN feature similarity."""
    files = request.files.getlist("files")
    if len(files) != 2:
        return jsonify({"error": "Exactly 2 image files required"}), 400

    try:
        features = []
        for f in files:
            image_bytes = f.read()
            arr = preprocess(image_bytes)
            if feature_model is None:
                feat = np.random.rand(1280).astype(np.float32)
            else:
                feat = feature_model.predict(arr, verbose=0)[0]
                feat = feat.flatten().astype(np.float32)
            features.append(feat)

        cos_sim = np.dot(features[0], features[1]) / (
            np.linalg.norm(features[0]) * np.linalg.norm(features[1]) + 1e-8
        )

        euclidean = float(np.linalg.norm(features[0] - features[1]))

        return jsonify({
            "cosine_similarity": round(float(cos_sim), 6),
            "euclidean_distance": round(euclidean, 6),
            "is_similar": bool(cos_sim > 0.85),
        })

    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == "__main__":
    port = int(os.getenv("PORT", 8000))
    print(f"EcoSort AI Service starting on port {port}")
    app.run(host="0.0.0.0", port=port, debug=False)
else:
    # Called by gunicorn — load model at import time
    load_model()
