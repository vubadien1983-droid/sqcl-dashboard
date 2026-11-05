import os
import io
import re
import json
import datetime
import urllib.request
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from urllib.parse import urlparse
import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter

from parse_data import parse_excel_workbook, ONEDRIVE_SHARE_URL

PORT = 8080
DATA_JSON_PATH = "sqcl_data.json"
EXCEL_FILE_PATH = "onedrive_file.xlsx"

def download_from_onedrive(share_url=ONEDRIVE_SHARE_URL, save_path=EXCEL_FILE_PATH):
    opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor())
    opener.addheaders = [
        ('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'),
        ('Accept', 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8')
    ]
    resp = opener.open(share_url, timeout=25)
    html = resp.read().decode('utf-8', errors='ignore')

    m = re.search(r'"FileGetUrl":"([^"]+)"', html)
    if not m:
        m = re.search(r'(https://[^"\'<>]+download\.aspx\?UniqueId=[^"\'<>\\]+)', html)
    if not m:
        raise ValueError("Could not extract direct download URL from the provided OneDrive link.")

    dl_url = m.group(1).replace(r'\u0026', '&')
    dl_url = dl_url.replace('https://my.microsoftpersonalcontent.com/', 'https://onedrive.live.com/')

    resp2 = opener.open(dl_url, timeout=30)
    content = resp2.read()
    if len(content) < 4 or content[:2] != b'PK':
        raise ValueError("Downloaded file is not a valid Excel (.xlsx) workbook.")

    with open(save_path, 'wb') as f:
        f.write(content)
    return save_path

def generate_styled_excel(payload):
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "SQCL Report"
    ws.views.sheetView[0].showGridLines = True

    # Styles
    navy_fill = PatternFill(start_color="0F172A", end_color="0F172A", fill_type="solid")
    sub_hdr_fill = PatternFill(start_color="1E293B", end_color="1E293B", fill_type="solid")
    sec_hdr_fill = PatternFill(start_color="E2E8F0", end_color="E2E8F0", fill_type="solid")
    tbl_hdr_fill = PatternFill(start_color="1E3A8A", end_color="1E3A8A", fill_type="solid")
    sys_banner_fill = PatternFill(start_color="DBEAFE", end_color="DBEAFE", fill_type="solid")
    zebra_fill = PatternFill(start_color="F8FAFC", end_color="F8FAFC", fill_type="solid")

    done_fill = PatternFill(start_color="DCFCE7", end_color="DCFCE7", fill_type="solid")
    done_font = Font(name="Calibri", size=10, bold=True, color="166534")

    ongoing_fill = PatternFill(start_color="FEF3C7", end_color="FEF3C7", fill_type="solid")
    ongoing_font = Font(name="Calibri", size=10, bold=True, color="92400E")

    notyet_fill = PatternFill(start_color="FEE2E2", end_color="FEE2E2", fill_type="solid")
    notyet_font = Font(name="Calibri", size=10, bold=False, color="991B1B")

    signed_fill = PatternFill(start_color="D1FAE5", end_color="D1FAE5", fill_type="solid")
    signed_font = Font(name="Calibri", size=10, bold=True, color="065F46")

    pending_font = Font(name="Calibri", size=10, italic=True, color="64748B")

    title_font = Font(name="Calibri", size=15, bold=True, color="FFFFFF")
    sub_font = Font(name="Calibri", size=10, bold=False, color="E2E8F0")
    sec_font = Font(name="Calibri", size=11, bold=True, color="0F172A")
    sys_banner_font = Font(name="Calibri", size=10, bold=True, color="1E3A8A")
    tbl_hdr_font = Font(name="Calibri", size=10, bold=True, color="FFFFFF")
    bold_font = Font(name="Calibri", size=10, bold=True, color="0F172A")
    reg_font = Font(name="Calibri", size=10, bold=False, color="1E293B")

    thin_side = Side(style='thin', color='CBD5E1')
    med_side = Side(style='medium', color='0F172A')
    grid_border = Border(left=thin_side, right=thin_side, top=thin_side, bottom=thin_side)
    hdr_border = Border(left=thin_side, right=thin_side, top=med_side, bottom=med_side)

    report_title = payload.get("title", "SITE QUALITY CHECK LIST (SQCL) – PROGRESS & DETAIL REPORT")
    filter_desc = payload.get("filter_desc", "All Equipment (GTG#1 & GTG#2)")
    stats = payload.get("stats", {})
    disc_list = payload.get("disciplines", [])
    sections_list = payload.get("sections", [])
    activities = payload.get("activities", [])
    now_str = datetime.datetime.now().strftime("%d-%b-%Y %H:%M")

    # 1. Banner Header (Cols A to O)
    max_col_letter = "O"
    ws.merge_cells(f"A1:{max_col_letter}1")
    ws["A1"] = f"VIETNAM BLOCK B GAS PROJECT  |  {report_title}"
    ws["A1"].font = title_font
    ws["A1"].fill = navy_fill
    ws["A1"].alignment = Alignment(horizontal="left", vertical="center", indent=1)
    ws.row_dimensions[1].height = 30

    ws.merge_cells(f"A2:{max_col_letter}2")
    ws["A2"] = f"Doc: SOI0007689 Rev. 0  •  Customer: MCDERMOTT PTSC CONSORTIUM (MPC)  •  Vendor: BAKER HUGHES  •  Exported: {now_str}"
    ws["A2"].font = sub_font
    ws["A2"].fill = sub_hdr_fill
    ws["A2"].alignment = Alignment(horizontal="left", vertical="center", indent=1)
    ws.row_dimensions[2].height = 20

    ws.merge_cells(f"A3:{max_col_letter}3")
    ws["A3"] = f"Filter Scope: {filter_desc}"
    ws["A3"].font = Font(name="Calibri", size=11, bold=True, color="1E3A8A")
    ws["A3"].fill = PatternFill(start_color="EFF6FF", end_color="EFF6FF", fill_type="solid")
    ws["A3"].alignment = Alignment(horizontal="left", vertical="center", indent=1)
    ws.row_dimensions[3].height = 22

    # 2. Summary KPI Table (Row 5 to 8)
    ws.merge_cells("A5:N5")
    ws["A5"] = "I. EXECUTIVE SUMMARY OVERVIEW (ACCEPTANCE STATUS & SIGNATURES)"
    ws["A5"].font = sec_font
    ws["A5"].fill = sec_hdr_fill
    ws["A5"].alignment = Alignment(horizontal="left", vertical="center", indent=1)
    ws.row_dimensions[5].height = 22

    kpi_headers = [
        "Total Activities",
        "Accepted (Done)",
        "In Progress (Ongoing)",
        "Pending (Not yet)",
        "% Completion",
        "BH Signed",
        "CU Signed",
        "Both Signed (BH & CU)",
        "Done (Unsigned)",
        "Unsigned"
    ]
    tot = stats.get("total", 0)
    done = stats.get("done", 0)
    ongoing = stats.get("ongoing", 0)
    not_yet = stats.get("not_yet", 0)
    pct = f"{stats.get('pct_done', 0)}%"
    bh_s = stats.get("bh_signed", 0)
    cu_s = stats.get("cu_signed", 0)
    both_s = stats.get("both_signed", 0)
    done_uns = stats.get("done_unsigned", 0)
    uns = stats.get("unsigned", max(0, tot - both_s))

    kpi_vals = [tot, done, ongoing, not_yet, pct, bh_s, cu_s, both_s, done_uns, uns]

    ws.row_dimensions[6].height = 26
    ws.row_dimensions[7].height = 24
    for idx, h_text in enumerate(kpi_headers, start=1):
        c_hdr = ws.cell(6, idx, h_text)
        c_hdr.font = tbl_hdr_font
        c_hdr.fill = tbl_hdr_fill
        c_hdr.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
        c_hdr.border = grid_border

        c_val = ws.cell(7, idx, kpi_vals[idx - 1])
        c_val.font = bold_font
        c_val.alignment = Alignment(horizontal="center", vertical="center")
        c_val.border = grid_border
        if idx == 2:
            c_val.fill = done_fill
            c_val.font = done_font
        elif idx == 3 and ongoing > 0:
            c_val.fill = ongoing_fill
            c_val.font = ongoing_font
        elif idx == 4 and not_yet > 0:
            c_val.fill = notyet_fill
            c_val.font = notyet_font
        elif idx in (6, 7, 8):
            c_val.fill = signed_fill
            c_val.font = signed_font

    current_row = 9

    # 3. Discipline Summary Table
    if disc_list:
        ws.merge_cells(f"A{current_row}:I{current_row}")
        ws[f"A{current_row}"] = "II. DISCIPLINE BREAKDOWN SUMMARY"
        ws[f"A{current_row}"].font = sec_font
        ws[f"A{current_row}"].fill = sec_hdr_fill
        ws[f"A{current_row}"].alignment = Alignment(horizontal="left", vertical="center", indent=1)
        ws.row_dimensions[current_row].height = 22
        current_row += 1

        d_headers = ["Discipline / Group", "Total", "Done", "Ongoing", "Not yet", "% Done", "BH Signed", "CU Signed", "Both Signed"]
        ws.row_dimensions[current_row].height = 24
        for idx, dh in enumerate(d_headers, start=1):
            cell = ws.cell(current_row, idx, dh)
            cell.font = tbl_hdr_font
            cell.fill = tbl_hdr_fill
            cell.alignment = Alignment(horizontal="center" if idx > 1 else "left", vertical="center", wrap_text=True)
            cell.border = grid_border
        current_row += 1

        for d_item in disc_list:
            ws.row_dimensions[current_row].height = 20
            d_vals = [
                d_item.get("discipline", ""),
                d_item.get("total", 0),
                d_item.get("done", 0),
                d_item.get("ongoing", 0),
                d_item.get("not_yet", 0),
                f"{d_item.get('pct_done', 0)}%",
                d_item.get("bh_signed", 0),
                d_item.get("cu_signed", 0),
                d_item.get("both_signed", 0)
            ]
            for idx, val in enumerate(d_vals, start=1):
                cell = ws.cell(current_row, idx, val)
                cell.font = bold_font if idx in (1, 6) else reg_font
                cell.alignment = Alignment(horizontal="center" if idx > 1 else "left", vertical="center")
                cell.border = grid_border
                if idx == 3 and val > 0:
                    cell.fill = done_fill
                    cell.font = done_font
                elif idx == 5 and val > 0:
                    cell.fill = notyet_fill
                    cell.font = notyet_font
            current_row += 1
        current_row += 1

    # 4. Detailed Activities Table (with Section Header Row at the start of every Section!)
    if activities:
        ws.merge_cells(f"A{current_row}:{max_col_letter}{current_row}")
        ws[f"A{current_row}"] = f"III. DETAILED SQCL INSPECTION CHECKLIST ({len(activities)} ACTIVITIES)"
        ws[f"A{current_row}"].font = sec_font
        ws[f"A{current_row}"].fill = sec_hdr_fill
        ws[f"A{current_row}"].alignment = Alignment(horizontal="left", vertical="center", indent=1)
        ws.row_dimensions[current_row].height = 24
        current_row += 1

        act_headers = [
            "Unit",
            "System",
            "Activity",
            "Activity Description",
            "Discipline",
            "Status",
            "BH Sig",
            "CU Sig",
            "Signature Date",
            "Role (BH/CU)",
            "PIC (PMC / PQ&BV)",
            "Ref.Doc / Procedure",
            "Acceptance Criteria / Site Markup",
            "PDF Sheet",
            "Status Update"
        ]
        header_row_idx = current_row
        ws.row_dimensions[header_row_idx].height = 26
        for idx, ah in enumerate(act_headers, start=1):
            cell = ws.cell(header_row_idx, idx, ah)
            cell.font = tbl_hdr_font
            cell.fill = tbl_hdr_fill
            cell.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
            cell.border = hdr_border
        current_row += 1

        last_sec_key = None
        for i, act in enumerate(activities):
            sec_key = f"{act.get('unit', '')}__{act.get('section', '')}"
            if sec_key != last_sec_key:
                last_sec_key = sec_key
                ws.merge_cells(f"A{current_row}:{max_col_letter}{current_row}")
                sec_banner_text = f"[{act.get('unit', '')}] SECTION {act.get('section', '')} — {act.get('section_title', '')}  (PDF Sheet: {act.get('pdf_sheet', '-')})"
                ws[f"A{current_row}"] = sec_banner_text
                ws[f"A{current_row}"].font = sys_banner_font
                ws[f"A{current_row}"].fill = sys_banner_fill
                ws[f"A{current_row}"].alignment = Alignment(horizontal="left", vertical="center", indent=1)
                for col_i in range(1, 16):
                    ws.cell(current_row, col_i).border = grid_border
                    ws.cell(current_row, col_i).fill = sys_banner_fill
                ws.row_dimensions[current_row].height = 22
                current_row += 1

            ws.row_dimensions[current_row].height = 28
            is_even = (i % 2 == 1)
            row_fill = zebra_fill if is_even else PatternFill(fill_type=None)

            status_val = act.get("status", "")
            bh_val = "Signed" if act.get("bh_signed") else "Pending"
            cu_val = "Signed" if act.get("cu_signed") else "Pending"
            roles_str = f"BH:{act.get('bh_role','-')}/CU:{act.get('cu_role','-')}"
            pic_str = " / ".join(filter(None, [act.get("pic_pmc", ""), act.get("pic_pq", "")]))
            doc_str = " | ".join(filter(None, [act.get("ref_doc", "").replace("\n", ", "), act.get("procedure", "")]))
            markup_str = " | ".join(filter(None, [act.get("acceptance", ""), act.get("site_markup", "").replace("\n", "; ")]))

            row_vals = [
                act.get("unit", ""),
                act.get("section", ""),
                act.get("activity", ""),
                act.get("description", ""),
                act.get("discipline", ""),
                status_val,
                bh_val,
                cu_val,
                act.get("sig_date", ""),
                roles_str,
                pic_str,
                doc_str,
                markup_str,
                act.get("pdf_sheet", ""),
                act.get("status_update", "")
            ]

            for idx, val in enumerate(row_vals, start=1):
                cell = ws.cell(current_row, idx, val)
                cell.font = reg_font
                cell.fill = row_fill
                cell.border = grid_border
                horiz = "center" if idx in (1, 2, 3, 6, 7, 8, 9, 10, 14) else "left"
                cell.alignment = Alignment(horizontal=horiz, vertical="center", wrap_text=True)

                if idx == 3:
                    cell.font = bold_font
                elif idx == 6:
                    if status_val == "Done":
                        cell.fill = done_fill
                        cell.font = done_font
                    elif status_val == "Ongoing":
                        cell.fill = ongoing_fill
                        cell.font = ongoing_font
                    else:
                        cell.fill = notyet_fill
                        cell.font = notyet_font
                elif idx in (7, 8):
                    if val == "Signed":
                        cell.fill = signed_fill
                        cell.font = signed_font
                    else:
                        cell.font = pending_font

            current_row += 1

    # 5. Systems Summary Sheet
    if sections_list:
        ws_sec = wb.create_sheet(title="Systems Summary")
        ws_sec.views.sheetView[0].showGridLines = True
        ws_sec.merge_cells("A1:K1")
        ws_sec["A1"] = f"SYSTEMS PROGRESS SUMMARY ({filter_desc})"
        ws_sec["A1"].font = title_font
        ws_sec["A1"].fill = navy_fill
        ws_sec["A1"].alignment = Alignment(horizontal="left", vertical="center", indent=1)
        ws_sec.row_dimensions[1].height = 28

        s_headers = ["Unit", "Section", "System Title", "PDF Sheet", "Activities", "Done", "Ongoing", "Not yet", "% Done", "BH Signed", "CU Signed"]
        ws_sec.row_dimensions[3].height = 25
        for idx, sh in enumerate(s_headers, start=1):
            c = ws_sec.cell(3, idx, sh)
            c.font = tbl_hdr_font
            c.fill = tbl_hdr_fill
            c.alignment = Alignment(horizontal="center" if idx != 3 else "left", vertical="center")
            c.border = grid_border

        r_idx = 4
        for s in sections_list:
            ws_sec.row_dimensions[r_idx].height = 20
            s_vals = [
                s.get("unit", ""),
                s.get("section", ""),
                s.get("title", ""),
                s.get("pdf_sheet", ""),
                s.get("activities_count", 0),
                s.get("done", 0),
                s.get("ongoing", 0),
                s.get("not_yet", 0),
                f"{s.get('pct_done', 0)}%",
                s.get("bh_signed", 0),
                s.get("cu_signed", 0)
            ]
            for idx, val in enumerate(s_vals, start=1):
                c = ws_sec.cell(r_idx, idx, val)
                c.font = bold_font if idx in (2, 9) else reg_font
                c.alignment = Alignment(horizontal="center" if idx != 3 else "left", vertical="center")
                c.border = grid_border
                if idx == 6 and val > 0:
                    c.fill = done_fill
                    c.font = done_font
            r_idx += 1

        sec_widths = [10, 10, 52, 10, 12, 10, 10, 10, 12, 12, 12]
        for idx, w in enumerate(sec_widths, start=1):
            ws_sec.column_dimensions[get_column_letter(idx)].width = w

    col_widths = [10, 10, 11, 48, 22, 12, 12, 12, 13, 14, 18, 28, 36, 10, 32]
    for idx, w in enumerate(col_widths, start=1):
        ws.column_dimensions[get_column_letter(idx)].width = w

    out = io.BytesIO()
    wb.save(out)
    return out.getvalue()


class SQCLRequestHandler(SimpleHTTPRequestHandler):
    def log_message(self, format, *args):
        pass

    def send_cors_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_cors_headers()
        self.end_headers()

    def do_GET(self):
        parsed = urlparse(self.path)
        path = parsed.path

        if path == "/api/data":
            try:
                if not os.path.exists(DATA_JSON_PATH):
                    data = parse_excel_workbook(EXCEL_FILE_PATH)
                    with open(DATA_JSON_PATH, "w", encoding="utf-8") as f:
                        json.dump(data, f, ensure_ascii=False)
                with open(DATA_JSON_PATH, "rb") as f:
                    raw = f.read()
                self.send_response(200)
                self.send_cors_headers()
                self.send_header("Content-Type", "application/json; charset=utf-8")
                self.send_header("Cache-Control", "no-store")
                self.end_headers()
                self.wfile.write(raw)
            except Exception as e:
                self.send_response(500)
                self.send_cors_headers()
                self.send_header("Content-Type", "application/json; charset=utf-8")
                self.end_headers()
                self.wfile.write(json.dumps({"status": "error", "message": str(e)}).encode("utf-8"))
            return

        if path == "/" or path == "/index.html" or path == "/detail":
            self.path = "/index.html"

        return super().do_GET()

    def do_POST(self):
        parsed = urlparse(self.path)
        path = parsed.path
        content_len = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(content_len) if content_len > 0 else b"{}"

        if path == "/api/sync":
            try:
                req_json = json.loads(body.decode("utf-8") or "{}")
                target_url = req_json.get("url") or ONEDRIVE_SHARE_URL
                download_from_onedrive(target_url, EXCEL_FILE_PATH)
                data = parse_excel_workbook(EXCEL_FILE_PATH)
                with open(DATA_JSON_PATH, "w", encoding="utf-8") as f:
                    json.dump(data, f, ensure_ascii=False)

                resp_bytes = json.dumps({
                    "status": "ok",
                    "message": "Synced latest data from OneDrive successfully!",
                    "data": data
                }, ensure_ascii=False).encode("utf-8")
                self.send_response(200)
                self.send_cors_headers()
                self.send_header("Content-Type", "application/json; charset=utf-8")
                self.end_headers()
                self.wfile.write(resp_bytes)
            except Exception as e:
                self.send_response(500)
                self.send_cors_headers()
                self.send_header("Content-Type", "application/json; charset=utf-8")
                self.end_headers()
                self.wfile.write(json.dumps({"status": "error", "message": str(e)}, ensure_ascii=False).encode("utf-8"))
            return

        if path == "/api/export-excel":
            try:
                payload = json.loads(body.decode("utf-8") or "{}")
                xlsx_bytes = generate_styled_excel(payload)
                self.send_response(200)
                self.send_cors_headers()
                self.send_header("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
                self.send_header("Content-Disposition", 'attachment; filename="SQCL_Report.xlsx"')
                self.end_headers()
                self.wfile.write(xlsx_bytes)
            except Exception as e:
                self.send_response(500)
                self.send_cors_headers()
                self.send_header("Content-Type", "application/json; charset=utf-8")
                self.end_headers()
                self.wfile.write(json.dumps({"status": "error", "message": str(e)}, ensure_ascii=False).encode("utf-8"))
            return

        if path == "/api/update_cell":
            try:
                payload = json.loads(body.decode("utf-8") or "{}")
                unit = payload.get("unit", "GTG#1")
                row_num = int(payload.get("row_num", 0))
                field = payload.get("field", "site_markup")
                new_value = payload.get("value", "")

                col_idx = 18 if field == "site_markup" else 20
                col_letter = "R" if field == "site_markup" else "T"
                sheet_name = "SQCL Check Sheet GTC#1" if unit == "GTG#1" else "SQCL Check Sheet GTC#2"

                # 1. Update Excel workbook on disk if it exists
                if os.path.exists(EXCEL_FILE_PATH) and row_num > 0:
                    wb = openpyxl.load_workbook(EXCEL_FILE_PATH)
                    if sheet_name in wb.sheetnames:
                        ws = wb[sheet_name]
                        ws.cell(row=row_num, column=col_idx).value = new_value
                        wb.save(EXCEL_FILE_PATH)

                # 2. Update sqcl_data.json
                if os.path.exists(DATA_JSON_PATH):
                    with open(DATA_JSON_PATH, "r", encoding="utf-8") as f:
                        data = json.load(f)
                    
                    unit_acts = data.get("units", {}).get(unit, {}).get("activities", [])
                    for act in unit_acts:
                        if act.get("row_num") == row_num:
                            act[field] = new_value
                            break
                    
                    with open(DATA_JSON_PATH, "w", encoding="utf-8") as f:
                        json.dump(data, f, ensure_ascii=False)

                self.send_response(200)
                self.send_cors_headers()
                self.send_header("Content-Type", "application/json; charset=utf-8")
                self.end_headers()
                self.wfile.write(json.dumps({
                    "status": "ok",
                    "message": f"Successfully updated cell {col_letter}{row_num} in sheet '{sheet_name}'",
                    "cell": f"{col_letter}{row_num}",
                    "sheet": sheet_name,
                    "value": new_value
                }, ensure_ascii=False).encode("utf-8"))
            except Exception as e:
                self.send_response(500)
                self.send_cors_headers()
                self.send_header("Content-Type", "application/json; charset=utf-8")
                self.end_headers()
                self.wfile.write(json.dumps({"status": "error", "message": str(e)}, ensure_ascii=False).encode("utf-8"))
            return

        self.send_response(404)
        self.end_headers()

handler = SQCLRequestHandler

if __name__ == "__main__":
    print(f"Starting SQCL Dashboard Server on http://0.0.0.0:{PORT} ...")
    server = ThreadingHTTPServer(("0.0.0.0", PORT), SQCLRequestHandler)
    server.serve_forever()
