"""
EcoSort Model Tester — Run ONNX Inference on Local Images
Verifies classification mapping, scaling, and confidence on sample images.

Usage:
  python test_model.py                      # tests files inside 'testpic' directory
  python test_model.py path/to/image.jpg    # tests a specific image file
"""

import os
import sys
import numpy as np
from PIL import Image
import onnxruntime as ort

MODEL_PATH = "models/best_model.onnx"
TEST_DIR = "testpic"
CLASS_NAMES = ["hazardous", "non_recyclable", "recyclable"]
IMG_SIZE = 224

print("=" * 60)
print("EcoSort ONNX Model Prediction Tester")
print("=" * 60)

# Check model file
if not os.path.exists(MODEL_PATH):
    print(f"ERROR: Model file not found at '{MODEL_PATH}'")
    print("Please make sure you have downloaded the best_model.onnx file from Kaggle and placed it in the 'models/' folder.")
    sys.exit(1)

print(f"Loading ONNX Model from: {MODEL_PATH}...")
try:
    session = ort.InferenceSession(MODEL_PATH, providers=['CPUExecutionProvider'])
    input_name = session.get_inputs()[0].name
    print("Model loaded successfully!")
    print(f"Input Name : {input_name}")
    print(f"Class Order: {CLASS_NAMES}")
except Exception as e:
    print(f"ERROR loading model: {e}")
    sys.exit(1)

def test_image(img_path):
    """Preprocess image and execute inference session."""
    if not os.path.exists(img_path):
        print(f"File not found: {img_path}")
        return

    # Load and preprocess
    img = Image.open(img_path).convert("RGB")
    img_resized = img.resize((IMG_SIZE, IMG_SIZE), Image.BILINEAR)
    arr = np.array(img_resized, dtype=np.float32)
    
    # Model contains internal Rescaling(1./255), so we feed raw [0, 255] float arrays
    arr_input = np.expand_dims(arr, axis=0)
    
    # Inference
    preds = session.run(None, {input_name: arr_input})[0][0]
    
    pred_idx = int(np.argmax(preds))
    predicted_class = CLASS_NAMES[pred_idx]
    confidence = preds[pred_idx]
    
    print(f"\n--- Results for: {os.path.basename(img_path)} ---")
    print(f"  Predicted Category: {predicted_class.upper()} (Confidence: {confidence:.4f})")
    print("  Detailed Scores:")
    for name, score in zip(CLASS_NAMES, preds):
        marker = " <-- HIGHEST" if name == predicted_class else ""
        print(f"    - {name:15s}: {score:.4f}{marker}")
        
    return predicted_class, confidence

# Main flow
if len(sys.argv) > 1:
    # Test specific file
    target = sys.argv[1]
    test_image(target)
else:
    # Test directory
    print(f"\nScanning test directory: '{TEST_DIR}'...")
    if not os.path.exists(TEST_DIR):
        print(f"Directory '{TEST_DIR}' not found.")
        sys.exit(0)
        
    files = [os.path.join(TEST_DIR, f) for f in os.listdir(TEST_DIR) 
             if f.lower().endswith(('.jpg', '.jpeg', '.png', '.webp'))]
    
    if not files:
        print(f"No image files found in '{TEST_DIR}'.")
        sys.exit(0)
        
    print(f"Found {len(files)} test images. Testing first 5 images...")
    for f in files[:5]:
        try:
            test_image(f)
        except Exception as e:
            print(f"  Error testing {os.path.basename(f)}: {e}")

print("\n" + "=" * 60)
print("Testing completed!")
print("=" * 60)