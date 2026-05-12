"""
Test script to verify model predictions on sample images
"""
import os
import sys
import numpy as np
from PIL import Image

# Set paths
MODEL_PATH = "models/best_model.keras"
TEST_IMAGES_DIR = "test_images"

# Class names in alphabetical order (how Keras sees them)
CLASS_NAMES = ["hazardous", "non_recyclable", "recyclable"]

print("=" * 60)
print("EcoSort Model Prediction Tester")
print("=" * 60)

print("\nLoading model...")
import tensorflow as tf
tf.get_logger().setLevel("ERROR")
model = tf.keras.models.load_model(MODEL_PATH, compile=False)
print(f"Model loaded. Output shape: {model.output_shape}")
print(f"Class order: {CLASS_NAMES}")
print()

def test_image(img_path, expected_class=None):
    """Test a single image and print results"""
    print(f"\n--- Testing: {os.path.basename(img_path)} ---")

    img = Image.open(img_path).convert("RGB")
    img_resized = img.resize((224, 224), Image.BILINEAR)
    arr = np.array(img_resized, dtype=np.float32)

    # Test with [0, 1] normalization (WRONG for this model)
    arr_01 = np.expand_dims(arr / 255.0, axis=0)
    preds_01 = model.predict(arr_01, verbose=0)[0]

    # Test with raw [0, 255] - CORRECT for model with Rescaling(1./255)
    arr_raw = np.expand_dims(arr, axis=0)
    preds_raw = model.predict(arr_raw, verbose=0)[0]

    print(f"  Method [0,1] - Predictions:")
    for i, (name, pred) in enumerate(zip(CLASS_NAMES, preds_01)):
        marker = " <-- HIGHEST" if i == int(np.argmax(preds_01)) else ""
        print(f"    [{i}] {name:20s}: {pred:.4f}{marker}")

    print(f"  Method [0,255] raw - Predictions:")
    for i, (name, pred) in enumerate(zip(CLASS_NAMES, preds_raw)):
        marker = " <-- HIGHEST" if i == int(np.argmax(preds_raw)) else ""
        print(f"    [{i}] {name:20s}: {pred:.4f}{marker}")

    # Use the raw [0,255] method since model has Rescaling(1./255)
    preds = preds_raw
    method = "[0,255]"

    pred_idx = int(np.argmax(preds))
    predicted_class = CLASS_NAMES[pred_idx]
    confidence = preds[pred_idx]
    print(f"  -> Using {method}: {predicted_class} (confidence: {confidence:.4f})")

    if expected_class:
        match = "CORRECT" if predicted_class == expected_class else "WRONG"
        print(f"  -> Expected: {expected_class} -> {match}")

    return predicted_class, confidence

# Check for test images
test_images = []

if os.path.exists(TEST_IMAGES_DIR):
    for f in os.listdir(TEST_IMAGES_DIR):
        if f.lower().endswith(('.jpg', '.jpeg', '.png')):
            test_images.append(os.path.join(TEST_IMAGES_DIR, f))

# Also check backend uploads for recent images
backend_uploads = "D:/ecosort-final/backend/uploads"
if os.path.exists(backend_uploads):
    try:
        files = [f for f in os.listdir(backend_uploads) if f.lower().endswith(('.jpg', '.jpeg', '.png'))]
        # Sort by name (newer uploads have longer numeric prefixes)
        files.sort(reverse=True)
        for f in files[:5]:  # Test 5 most recent uploads
            full_path = os.path.join(backend_uploads, f)
            if os.path.exists(full_path):
                test_images.append(full_path)
    except Exception as e:
        print(f"  Could not load backend uploads: {e}")

if test_images:
    print(f"Testing {len(test_images)} images...\n")

    for img_path in test_images:
        try:
            test_image(img_path)
        except Exception as e:
            print(f"  Error testing {img_path}: {e}")
else:
    print("No test images found. Please add images to test_images folder.")

print("\n" + "=" * 60)
print("Done!")