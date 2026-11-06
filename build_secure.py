"""
SQCL Dashboard Secure Production Build Engine
1. Encrypts and scrambles all proprietary SQCL data payloads into encrypted JS bundles.
2. Compiles and heavily obfuscates frontend application logic into static/app.min.js with:
   - Control flow flattening
   - Dead code injection
   - String array scrambling (Base64)
   - Anti-tampering & Self-defending
   - Anti-debugging & DevTools deterrent
"""
import os
import subprocess
import sys
from crypto_utils import generate_encrypted_bundles

CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))

def build_secure():
    print("=" * 60)
    print("  SQCL DASHBOARD: SECURE PRODUCTION BUILD")
    print("=" * 60)

    # 1. Encrypt Data Bundles
    print("\n[1/2] Encrypting and scrambling proprietary SQCL data payloads...")
    generate_encrypted_bundles()

    # 2. Obfuscate JavaScript Application Logic
    print("\n[2/2] Obfuscating JavaScript client logic (app.js -> app.min.js)...")
    app_src = os.path.join(CURRENT_DIR, "static", "app.js")
    app_dist = os.path.join(CURRENT_DIR, "static", "app.min.js")

    cmd = [
        "npx", "javascript-obfuscator", app_src,
        "--output", app_dist,
        "--compact", "true",
        "--control-flow-flattening", "true",
        "--control-flow-flattening-threshold", "0.75",
        "--dead-code-injection", "true",
        "--dead-code-injection-threshold", "0.4",
        "--numbers-to-expressions", "true",
        "--simplify", "true",
        "--string-array", "true",
        "--string-array-encoding", "base64",
        "--string-array-threshold", "0.8",
        "--split-strings", "true",
        "--self-defending", "true",
        "--debug-protection", "true",
        "--disable-console-output", "true"
    ]

    # On Windows, npx is often npx.cmd
    if sys.platform == "win32":
        cmd[0] = "npx.cmd"

    try:
        subprocess.check_call(cmd, cwd=CURRENT_DIR)
        size = os.path.getsize(app_dist)
        print(f"Successfully generated secure obfuscated bundle: static/app.min.js ({size:,} bytes).")
    except Exception as e:
        print(f"Error running javascript-obfuscator: {e}", file=sys.stderr)
        return 1

    print("\n[OK] Secure build completed successfully!")
    print("=" * 60)
    return 0

if __name__ == "__main__":
    sys.exit(build_secure())
