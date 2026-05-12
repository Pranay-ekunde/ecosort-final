/**
 * Perceptual Image Hash (pHash) — DCT-based, 64-bit
 * Uses Python PIL for reliable cross-platform image decoding.
 * Writes a temp .py file instead of using -c to avoid shell quoting issues on Windows.
 */

const fs            = require("fs");
const path          = require("path");
const os            = require("os");
const { execSync }  = require("child_process");
const crypto        = require("crypto");

const PYTHON_SCRIPT = `
import sys, math
from PIL import Image

SIZE  = 32
DCT_N = 8
img_path = sys.argv[1]

try:
    img    = Image.open(img_path).convert("L").resize((SIZE, SIZE), Image.LANCZOS)
    pixels = list(img.getdata())

    dct = []
    for u in range(SIZE):
        row = []
        for v in range(SIZE):
            s = 0.0
            for x in range(SIZE):
                for y in range(SIZE):
                    s += pixels[x*SIZE+y] * math.cos((2*x+1)*u*math.pi/(2*SIZE)) * math.cos((2*y+1)*v*math.pi/(2*SIZE))
            cu = (1/math.sqrt(2)) if u == 0 else 1.0
            cv = (1/math.sqrt(2)) if v == 0 else 1.0
            row.append((2/SIZE) * cu * cv * s)
        dct.append(row)

    vals = []
    for u in range(DCT_N):
        for v in range(DCT_N):
            if u == 0 and v == 0:
                continue
            vals.append(dct[u][v])

    mean = sum(vals) / len(vals)
    bits = [1 if v >= mean else 0 for v in vals]
    bits = bits[:64] + [0]*(64-len(bits))
    num  = int(''.join(str(b) for b in bits), 2)
    print('%016x' % num)

except Exception as e:
    print('ERROR:' + str(e), file=sys.stderr)
    sys.exit(1)
`;

// Write the Python script to a temp file once at startup
const SCRIPT_PATH = path.join(os.tmpdir(), "ecosort_phash.py");
fs.writeFileSync(SCRIPT_PATH, PYTHON_SCRIPT, "utf8");

/**
 * Compute pHash of an image file.
 * Returns 16-char hex string. Falls back to SHA-256 on failure.
 */
function computeHash(imagePath) {
  const absPath = path.resolve(imagePath);

  // Try python3 first, then python
  const pythonCmds = ["python3", "python"];
  for (const cmd of pythonCmds) {
    try {
      const result = execSync(
        `${cmd} "${SCRIPT_PATH}" "${absPath}"`,
        { timeout: 15000, encoding: "utf8" }
      ).trim();

      if (result && result.length === 16 && /^[0-9a-f]+$/.test(result)) {
        return result;
      }
    } catch { /* try next */ }
  }

  // Fallback: SHA-256 of file bytes (not perceptual but prevents exact duplicates)
  console.warn("[pHash] Python unavailable — using SHA-256 fallback");
  const buf = fs.readFileSync(absPath);
  return crypto.createHash("sha256").update(buf).digest("hex").slice(0, 16);
}

/**
 * Hamming distance between two 16-char hex hashes.
 * Returns 0–64 (0 = identical).
 */
function hammingDistance(h1, h2) {
  if (!h1 || !h2 || h1.length !== h2.length) return 64;
  let dist = 0;
  for (let i = 0; i < h1.length; i++) {
    let xor = parseInt(h1[i], 16) ^ parseInt(h2[i], 16);
    while (xor) { dist += xor & 1; xor >>= 1; }
  }
  return dist;
}

/**
 * Returns true if two images are visually similar.
 * threshold=10 allows JPEG recompression, minor resize.
 */
function isSimilar(h1, h2, threshold = 10) {
  return hammingDistance(h1, h2) <= threshold;
}

module.exports = { computeHash, hammingDistance, isSimilar };
