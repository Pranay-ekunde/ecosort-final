"""
Run this ONCE locally to convert best_model.keras → best_model.tflite
Usage:  cd ai-service && python convert_model.py
"""
import tensorflow as tf

print("Loading Keras model...")
model = tf.keras.models.load_model("models/best_model.keras", compile=False)

print("Converting to TFLite with Flex ops support...")
converter = tf.lite.TFLiteConverter.from_keras_model(model)
# Enable SELECT_TF_OPS so Relu / other non-native ops are handled
converter.target_spec.supported_ops = [
    tf.lite.OpsSet.TFLITE_BUILTINS,
    tf.lite.OpsSet.SELECT_TF_OPS,
]
converter._experimental_lower_tensor_list_ops = False

tflite_model = converter.convert()

out = "models/best_model.tflite"
with open(out, "wb") as f:
    f.write(tflite_model)

kb = len(tflite_model) / 1024
print(f"Done! Saved to {out} ({kb:.0f} KB)")
