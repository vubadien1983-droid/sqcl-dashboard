from http.server import BaseHTTPRequestHandler
import json

class handler(BaseHTTPRequestHandler):
    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
        self.end_headers()

    def do_POST(self):
        content_len = int(self.headers.get('Content-Length', 0))
        body = self.rfile.read(content_len) if content_len > 0 else b'{}'
        
        try:
            payload = json.loads(body.decode('utf-8') or '{}')
            unit = payload.get('unit', 'GTG#1')
            row_num = int(payload.get('row_num', 0))
            field = str(payload.get('field', 'site_markup')).lower()
            new_value = payload.get('value', '')
            field_map = {
                "note": (13, "M"),
                "pic_pmc": (14, "N"),
                "pic_pq": (15, "O"),
                "status": (16, "P"),
                "remarks_raw": (17, "Q"),
                "remarks": (17, "Q"),
                "discipline": (17, "Q"),
                "site_markup": (18, "R"),
                "pdf_sheet": (19, "S"),
                "status_update": (20, "T")
            }
            col_idx, col_letter = field_map.get(field, (18, "R"))
            sheet_name = 'SQCL Check Sheet GTC#1' if unit == 'GTG#1' else 'SQCL Check Sheet GTC#2'

            self.send_response(200)
            self.send_header('Access-Control-Allow-Origin', '*')
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.end_headers()
            self.wfile.write(json.dumps({
                'status': 'ok',
                'message': f'Received cell update {col_letter}{row_num} for {sheet_name}',
                'cell': f'{col_letter}{row_num}',
                'sheet': sheet_name,
                'value': new_value
            }, ensure_ascii=False).encode('utf-8'))
        except Exception as e:
            self.send_response(500)
            self.send_header('Access-Control-Allow-Origin', '*')
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.end_headers()
            self.wfile.write(json.dumps({'status': 'error', 'message': str(e)}).encode('utf-8'))
