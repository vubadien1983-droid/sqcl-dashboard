from http.server import BaseHTTPRequestHandler
import json
import urllib.request
import re
import os
import io

ONEDRIVE_SHARE_URL = "https://onedrive.live.com/:x:/g/personal/c22ad84bae02db35/IQC76AfwUxvyTbNOO9XK8XXwAV0qpYaWifkMEgRnOrqdC5M?rtime=EnbCOy0630g&redeem=aHR0cHM6Ly8xZHJ2Lm1zL3gvYy9jMjJhZDg0YmFlMDJkYjM1L0lRQzc2QWZ3VXh2eVRiTk9POVhLOFhYd0FWMHFwWWFXaWZrTUVnUm5PcnFkQzVNP2U9YmVkQ1Jp"

def download_onedrive_bytes(share_url=ONEDRIVE_SHARE_URL):
    opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor())
    opener.addheaders = [
        ('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'),
        ('Accept', 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8')
    ]
    with opener.open(share_url, timeout=40) as response:
        content = response.read().decode('utf-8', errors='ignore')

    match = re.search(r'["\'](https://[^"\']*my\.microsoftpersonalcontent\.com/[^"\']*)["\']', content)
    if not match:
        match = re.search(r'["\'](https://[^"\']*download\.aspx[^"\']*)["\']', content)
        if not match:
            match = re.search(r'FileGetUrl["\']\s*:\s*["\'](https://[^"\']+)["\']', content)
            if not match:
                raise Exception("Could not find direct download URL in OneDrive landing page.")
    direct_url = match.group(1).replace(r'\u0026', '&').replace('&amp;', '&')
    if 'my.microsoftpersonalcontent.com' in direct_url:
        direct_url = direct_url.replace('https://my.microsoftpersonalcontent.com', 'https://onedrive.live.com')

    with opener.open(direct_url, timeout=60) as resp:
        file_bytes = resp.read()

    if not file_bytes.startswith(b'PK\x03\x04'):
        raise Exception("Downloaded content is not a valid zip/xlsx archive.")
    return file_bytes

class handler(BaseHTTPRequestHandler):
    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "POST, GET, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def do_POST(self):
        try:
            content_length = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(content_length) if content_length > 0 else b'{}'
            req_json = json.loads(body.decode('utf-8') or '{}')
            target_url = req_json.get('url') or ONEDRIVE_SHARE_URL

            # Import parse logic from root
            import sys
            root_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
            if root_dir not in sys.path:
                sys.path.insert(0, root_dir)
            from parse_data import parse_excel_workbook

            import tempfile
            xlsx_bytes = download_onedrive_bytes(target_url)
            
            with tempfile.NamedTemporaryFile(suffix=".xlsx", delete=False) as tf:
                tf.write(xlsx_bytes)
                tmp_path = tf.name

            try:
                data = parse_excel_workbook(tmp_path)
            finally:
                if os.path.exists(tmp_path):
                    try:
                        os.unlink(tmp_path)
                    except Exception:
                        pass

            resp_data = json.dumps({"status": "ok", "message": "Synced from OneDrive successfully!", "data": data}, ensure_ascii=False).encode('utf-8')
            self.send_response(200)
            self.send_header("Access-Control-Allow-Origin", "*")
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.end_headers()
            self.wfile.write(resp_data)
        except Exception as e:
            err_data = json.dumps({"status": "error", "message": str(e)}, ensure_ascii=False).encode('utf-8')
            self.send_response(500)
            self.send_header("Access-Control-Allow-Origin", "*")
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.end_headers()
            self.wfile.write(err_data)
