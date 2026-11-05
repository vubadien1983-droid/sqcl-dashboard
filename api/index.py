from http.server import BaseHTTPRequestHandler
import json
import os
import sys
import re
import urllib.request
import tempfile

current_dir = os.path.dirname(os.path.abspath(__file__))
parent_dir = os.path.dirname(current_dir)
for p in [current_dir, parent_dir]:
    if p not in sys.path:
        sys.path.insert(0, p)

try:
    from parse_data import parse_excel_workbook, ONEDRIVE_SHARE_URL
except ImportError:
    from api.parse_data import parse_excel_workbook, ONEDRIVE_SHARE_URL

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
    def send_cors(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS, PATCH")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_cors()
        self.end_headers()

    def do_GET(self):
        path = self.path.split('?')[0].rstrip('/')
        if path == "/api/data" or path == "/api" or path == "":
            for candidate in [
                os.path.join(current_dir, "sqcl_data.json"),
                os.path.join(parent_dir, "sqcl_data.json")
            ]:
                if os.path.exists(candidate):
                    with open(candidate, "r", encoding="utf-8") as f:
                        data = f.read()
                    self.send_response(200)
                    self.send_cors()
                    self.send_header("Content-Type", "application/json; charset=utf-8")
                    self.end_headers()
                    self.wfile.write(data.encode('utf-8'))
                    return
            self.send_response(404)
            self.send_cors()
            self.end_headers()
            return
        elif path == "/api/sync":
            return self.do_POST()
        
        self.send_response(200)
        self.send_cors()
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.end_headers()
        self.wfile.write(json.dumps({"status": "ok", "service": "SQCL Cloud API"}).encode('utf-8'))

    def do_POST(self):
        path = self.path.split('?')[0].rstrip('/')
        content_len = int(self.headers.get('Content-Length', 0))
        body = self.rfile.read(content_len) if content_len > 0 else b'{}'
        req_json = {}
        try:
            req_json = json.loads(body.decode('utf-8') or '{}')
        except Exception:
            pass

        if path == "/api/sync" or path == "/api" or path == "":
            try:
                target_url = req_json.get('url') or ONEDRIVE_SHARE_URL
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
                resp = json.dumps({"status": "ok", "message": "Synced from OneDrive successfully!", "data": data}, ensure_ascii=False).encode('utf-8')
                self.send_response(200)
                self.send_cors()
                self.send_header("Content-Type", "application/json; charset=utf-8")
                self.end_headers()
                self.wfile.write(resp)
            except Exception as e:
                err = json.dumps({"status": "error", "message": str(e)}, ensure_ascii=False).encode('utf-8')
                self.send_response(500)
                self.send_cors()
                self.send_header("Content-Type", "application/json; charset=utf-8")
                self.end_headers()
                self.wfile.write(err)
            return

        if path == "/api/update_cell":
            unit = req_json.get('unit', 'GTG#1')
            row_num = int(req_json.get('row_num', 0))
            field = req_json.get('field', 'site_markup')
            col_letter = 'R' if field == 'site_markup' else 'T'
            resp = json.dumps({"status": "ok", "message": f"Received cell update {col_letter}{row_num}"}, ensure_ascii=False).encode('utf-8')
            self.send_response(200)
            self.send_cors()
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.end_headers()
            self.wfile.write(resp)
            return

        self.send_response(404)
        self.send_cors()
        self.end_headers()

app = handler
application = handler
