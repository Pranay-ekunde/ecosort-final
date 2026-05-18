"""
EcoSort AI Microservice — Flask + TFLite (memory-efficient for free-tier hosting)
POST /predict          — single image classification
POST /predict/batch    — multiple images
POST /features/extract — extract output vector for duplicate detection
GET  /health           — service status
"""
import os, io, gc, sys, threading
import numpy as np
from flask import Flask, request, jsonify
from PIL import Image

app = Flask(__name__)

MODEL_PATH  = os.getenv("MODEL_PATH", "models/best_model.tflite")
IMG_SIZE    = 224
CLASS_NAMES = ["hazardous", "non_recyclable", "recyclable"]

interpreter    = None
input_details  = None
output_details = None
_infer_lock    = threading.Lock()   # TFLite interpreter is NOT thread-safe

def load_model():
    global interpreter, input_details, output_details
    import tensorflow as tf
    tf.get_logger().setLevel("ERROR")
    tf.config.threading.set_inter_op_parallelism_threads(1)
    tf.config.threading.set_intra_op_parallelism_threads(1)

    import os
    print(f"[load_model] MODEL_PATH='{MODEL_PATH}'")
    print(f"[load_model] file exists: {os.path.exists(MODEL_PATH)}")

    # ── Try TFLite first ──────────────────────────────────────────────
    tflite_path = MODEL_PATH if MODEL_PATH.endswith(".tflite") else MODEL_PATH.replace(".keras", ".tflite")
    if os.path.exists(tflite_path):
        try:
            print(f"[load_model] loading TFLite: {tflite_path}")
            interpreter = tf.lite.Interpreter(model_path=tflite_path)
            interpreter.allocate_tensors()
            input_details  = interpreter.get_input_details()
            output_details = interpreter.get_output_details()
            print(f"TFLite model loaded: {tflite_path}")
            print(f"Input shape:  {input_details[0]['shape']}")
            print(f"Output shape: {output_details[0]['shape']}")
            print(f"Class names:  {CLASS_NAMES}")
            _prewarm()
            return
        except Exception as e:
            print(f"[load_model] TFLite failed ({e}), trying Keras...", file=sys.stderr)

    # ── Fallback: load full Keras model ───────────────────────────────
    keras_path = MODEL_PATH if MODEL_PATH.endswith(".keras") else MODEL_PATH.replace(".tflite", ".keras")
    if os.path.exists(keras_path):
        try:
            print(f"[load_model] loading Keras: {keras_path}")
            _keras_model = tf.keras.models.load_model(keras_path, compile=False)
            # Wrap as a callable so run_inference still works
            import types
            _fake_interp = types.SimpleNamespace()
            _input = [{"index": 0, "shape": [1, 224, 224, 3], "dtype": "float32"}]
            _output = [{"index": 0}]

            def _set_tensor(idx, val): _fake_interp._input = val
            def _invoke():
                # preprocess() already divided by 255 for TFLite.
                # Keras model has Rescaling(1/255) built-in, so undo the /255 here.
                raw = _fake_interp._input * 255.0
                _fake_interp._output = _keras_model(raw, training=False).numpy()
            def _get_tensor(idx): return _fake_interp._output

            _fake_interp.set_tensor      = _set_tensor
            _fake_interp.invoke          = _invoke
            _fake_interp.get_tensor      = _get_tensor
            _fake_interp.get_input_details  = lambda: _input
            _fake_interp.get_output_details = lambda: _output

            interpreter    = _fake_interp
            input_details  = _input
            output_details = _output
            print(f"Keras model loaded (fallback): {keras_path}")
            print(f"Class names: {CLASS_NAMES}")
            _prewarm()
            return
        except Exception as e:
            print(f"[load_model] Keras fallback also failed: {e}", file=sys.stderr)
            import traceback; traceback.print_exc(file=sys.stderr)

    print(f"ERROR: No model found at '{MODEL_PATH}' (tried .tflite and .keras)", file=sys.stderr)
    interpreter = None

def _prewarm():
    """Run one dummy inference to force Flex ops JIT compilation at startup.
    Without this, the first real request triggers JIT which takes 60-120s
    and causes gunicorn to SIGKILL the worker (WORKER TIMEOUT).
    """
    print("[prewarm] Initializing Flex ops delegate (may take 60-120s)...")
    try:
        dummy = np.zeros((1, IMG_SIZE, IMG_SIZE, 3), dtype=np.float32)
        run_inference(dummy)
        print("[prewarm] Flex ops delegate ready. Service accepting requests.")
    except Exception as e:
        print(f"[prewarm] Warning: pre-warm failed ({e}) — first request may be slow", file=sys.stderr)


def preprocess(image_bytes):
    img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    img = img.resize((IMG_SIZE, IMG_SIZE), Image.BILINEAR)
    # Normalize to [0,1] — TFLite conversion removes the Rescaling layer from the graph,
    # so we must apply 1/255 normalization here explicitly.
    arr = np.array(img, dtype=np.float32) / 255.0
    return np.expand_dims(arr, axis=0)

def run_inference(arr):
    """Run TFLite inference (thread-safe via lock), return output array."""
    with _infer_lock:
        interpreter.set_tensor(input_details[0]['index'], arr)
        interpreter.invoke()
        output = interpreter.get_tensor(output_details[0]['index'])[0].copy()
    print(f"[inference] raw scores: {output}")  # debug — remove after confirming
    return output

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
        "model_loaded": interpreter is not None,
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
        if interpreter is None:
            result = mock_predict()
            print(f"[MOCK] {result['prediction']} conf={result['confidence']}")
        else:
            arr   = preprocess(image_bytes)
            preds = run_inference(arr)
            idx   = int(np.argmax(preds))
            print(f"[PREDICT] preds={preds} argmax={idx} class={CLASS_NAMES[idx]}")
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
    finally:
        gc.collect()

@app.route("/predict/batch", methods=["POST"])
def predict_batch():
    files = request.files.getlist("files")
    if not files:
        return jsonify({"error": "No files provided"}), 400
    results = []
    for f in files:
        try:
            if interpreter is None:
                r = mock_predict()
            else:
                arr   = preprocess(f.read())
                preds = run_inference(arr)
                idx   = int(np.argmax(preds))
                r = {
                    "prediction": CLASS_NAMES[idx],
                    "confidence": round(float(preds[idx]), 4),
                    "scores": {n: round(float(p), 4) for n, p in zip(CLASS_NAMES, preds)},
                }
            results.append({"filename": f.filename, **r})
        except Exception as e:
            results.append({"filename": f.filename, "error": str(e)})
    gc.collect()
    return jsonify({"results": results})

@app.route("/features/extract", methods=["POST"])
def extract_features():
    """Deprecated: CNN features disabled (TFLite outputs 3-dim softmax, not visual features)."""
    return jsonify({"features": None, "feature_dim": 0, "disabled": True}), 200

@app.route("/features/similarity", methods=["POST"])
def feature_similarity():
    """Compare two images using output vector cosine similarity."""
    files = request.files.getlist("files")
    if len(files) != 2:
        return jsonify({"error": "Exactly 2 image files required"}), 400
    try:
        features = []
        for f in files:
            if interpreter is None:
                feat = np.random.rand(3).astype(np.float32)
            else:
                arr  = preprocess(f.read())
                feat = run_inference(arr).flatten().astype(np.float32)
            features.append(feat)

        cos_sim   = np.dot(features[0], features[1]) / (
            np.linalg.norm(features[0]) * np.linalg.norm(features[1]) + 1e-8
        )
        euclidean = float(np.linalg.norm(features[0] - features[1]))

        return jsonify({
            "cosine_similarity":  round(float(cos_sim), 6),
            "euclidean_distance": round(euclidean, 6),
            "is_similar":         bool(cos_sim > 0.85),
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        gc.collect()

if __name__ == "__main__":
    load_model()
    port = int(os.getenv("PORT", 8000))
    print(f"EcoSort AI Service starting on port {port}")
    app.run(host="0.0.0.0", port=port, debug=False)
else:
    # Called by gunicorn — load model at import time
    load_model()
