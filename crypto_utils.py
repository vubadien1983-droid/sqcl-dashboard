"""
SQCL Dashboard Encryption & Security Utility
Encrypts and decrypts proprietary SQCL JSON data payloads using multi-layer XOR + Base64 scrambling.
Prevents plain-text data inspection, web scraping, and automated AI reverse-engineering.
"""
import os
import json
import base64

SECRET_KEY = "SQCL_BLOCK_B_MEC002_OFFSHORE_2026_SECURITY_TOKEN"
KEY_BYTES = SECRET_KEY.encode("utf-8")
KEY_LEN = len(KEY_BYTES)

def encrypt_payload(obj):
    """
    Serializes a Python object to JSON, scrambles with XOR stream cipher, and encodes in Base64.
    """
    raw_json = json.dumps(obj, ensure_ascii=False)
    raw_bytes = raw_json.encode("utf-8")
    scrambled = bytearray(len(raw_bytes))
    for i in range(len(raw_bytes)):
        scrambled[i] = raw_bytes[i] ^ KEY_BYTES[i % KEY_LEN]
    return base64.b64encode(scrambled).decode("ascii")

def decrypt_payload(b64_str):
    """
    Decodes Base64 and unscrambles XOR to recover original Python object.
    """
    scrambled = base64.b64decode(b64_str.encode("ascii"))
    raw_bytes = bytearray(len(scrambled))
    for i in range(len(scrambled)):
        raw_bytes[i] = scrambled[i] ^ KEY_BYTES[i % KEY_LEN]
    raw_json = raw_bytes.decode("utf-8")
    return json.loads(raw_json)

def generate_encrypted_bundles(data_path="sqcl_data.json", ledger_path="sqcl_closing_ledger.json"):
    """
    Reads sqcl_data.json and sqcl_closing_ledger.json, and writes encrypted bundles.
    """
    current_dir = os.path.dirname(os.path.abspath(__file__))
    data_file = os.path.join(current_dir, data_path)
    ledger_file = os.path.join(current_dir, ledger_path)

    data_bundle = os.path.join(current_dir, "sqcl_data_bundle.js")
    ledger_bundle = os.path.join(current_dir, "sqcl_closing_ledger_bundle.js")

    if os.path.exists(data_file):
        with open(data_file, "r", encoding="utf-8") as f:
            data = json.load(f)
        b64_data = encrypt_payload(data)
        with open(data_bundle, "w", encoding="utf-8") as f:
            f.write(f'window.__SQCL_DATA_ENC__ = "{b64_data}";\n')
        print(f"Generated encrypted {data_bundle} ({len(b64_data):,} encrypted chars).")

    if os.path.exists(ledger_file):
        with open(ledger_file, "r", encoding="utf-8") as f:
            ledger = json.load(f)
        b64_ledger = encrypt_payload(ledger)
        with open(ledger_bundle, "w", encoding="utf-8") as f:
            f.write(f'window.__SQCL_LEDGER_ENC__ = "{b64_ledger}";\n')
        print(f"Generated encrypted {ledger_bundle} ({len(b64_ledger):,} encrypted chars).")

if __name__ == "__main__":
    generate_encrypted_bundles()
