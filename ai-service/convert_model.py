"""
Convert best_model.keras -> best_model.tflite (pure TFLite ops, no Flex).
Tries multiple strategies to avoid the tensorflow-cpu dependency.

Usage:  cd ai-service && python convert_model.py
"""
import os, shutil, sys
import tensorflow as tf

print(f"TF version: {tf.__version__}")
print("Loading Keras model...")
model = tf.keras.models.load_model("models/best_model.keras", compile=False)

out = "models/best_model.tflite"

def try_convert(name, converter):
    try:
        tflite = converter.convert()
        with open(out, "wb") as f:
            f.write(tflite)
        print(f"[{name}] OK -> {out} ({len(tflite)//1024} KB)")
        print(f"[{name}] requirements.txt can use: tflite-runtime==2.14.0")
        return True
    except Exception as e:
        print(f"[{name}] FAILED: {e}")
        return False

# ── Strategy 1: Keras model, pure builtins ─────────────────────────────────
conv = tf.lite.TFLiteConverter.from_keras_model(model)
conv.target_spec.supported_ops = [tf.lite.OpsSet.TFLITE_BUILTINS]
if try_convert("keras+builtins", conv):
    sys.exit(0)

# ── Strategy 2: Keras model, float16 quantization ─────────────────────────
conv = tf.lite.TFLiteConverter.from_keras_model(model)
conv.target_spec.supported_ops = [tf.lite.OpsSet.TFLITE_BUILTINS]
conv.optimizations = [tf.lite.Optimize.DEFAULT]
conv.target_spec.supported_types = [tf.float16]
if try_convert("keras+float16", conv):
    sys.exit(0)

# ── Strategy 3: Concrete function (different graph tracing) ────────────────
print("[concrete_fn] Tracing model...")
try:
    run_model = tf.function(lambda x: model(x, training=False))
    concrete = run_model.get_concrete_function(
        tf.TensorSpec(model.inputs[0].shape, model.inputs[0].dtype, name="input")
    )
    conv = tf.lite.TFLiteConverter.from_concrete_functions([concrete], model)
    conv.target_spec.supported_ops = [tf.lite.OpsSet.TFLITE_BUILTINS]
    if try_convert("concrete_fn+builtins", conv):
        sys.exit(0)
except Exception as e:
    print(f"[concrete_fn] trace failed: {e}")

# ── Strategy 4: SavedModel format ─────────────────────────────────────────
SM_PATH = "models/temp_saved_model"
print(f"[saved_model] Saving to {SM_PATH}...")
try:
    model.export(SM_PATH)
except Exception:
    model.save(SM_PATH)

conv = tf.lite.TFLiteConverter.from_saved_model(SM_PATH)
conv.target_spec.supported_ops = [tf.lite.OpsSet.TFLITE_BUILTINS]
ok = try_convert("saved_model+builtins", conv)
shutil.rmtree(SM_PATH, ignore_errors=True)
if ok:
    sys.exit(0)

# ── Strategy 5: SELECT_TF_OPS fallback (requires tensorflow-cpu at runtime) ─
print("[flex] Falling back to SELECT_TF_OPS (needs tensorflow-cpu, not tflite-runtime)...")
conv = tf.lite.TFLiteConverter.from_keras_model(model)
conv.target_spec.supported_ops = [
    tf.lite.OpsSet.TFLITE_BUILTINS,
    tf.lite.OpsSet.SELECT_TF_OPS,
]
conv._experimental_lower_tensor_list_ops = False
if try_convert("flex", conv):
    print("[flex] WARNING: requirements.txt MUST keep: tensorflow-cpu (NOT tflite-runtime)")
    sys.exit(0)

print("All strategies failed.")
sys.exit(1)
