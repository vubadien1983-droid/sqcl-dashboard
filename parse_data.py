import openpyxl
import json
import datetime
import re

ONEDRIVE_SHARE_URL = 'https://onedrive.live.com/:x:/g/personal/c22ad84bae02db35/IQC76AfwUxvyTbNOO9XK8XXwAV0qpYaWifkMEgRnOrqdC5M?rtime=EnbCOy0630g&redeem=aHR0cHM6Ly8xZHJ2Lm1zL3gvYy9jMjJhZDg0YmFlMDJkYjM1L0lRQzc2QWZ3VXh2eVRiTk9POVhLOFhYd0FWMHFwWWFXaWZrTUVnUm5PcnFkQzVNP2U9YmVkQ1Jp'

def clean_str(val):
    if val is None:
        return ""
    if isinstance(val, datetime.datetime):
        return val.strftime("%Y-%m-%d")
    if isinstance(val, datetime.date):
        return val.strftime("%Y-%m-%d")
    s = str(val).replace('\xa0', ' ').strip()
    return s

def normalize_discipline(raw_remarks):
    s = clean_str(raw_remarks)
    if not s:
        return "Unassigned"
    sl = s.lower()
    if "piping" in sl:
        return "Piping"
    if "electrical" in sl or "instrument" in sl or "e&i" in sl:
        return "Electrical & Instruments"
    if "mech" in sl:
        return "Mechanical"
    if "pre/com" in sl or "precom" in sl or "commissioning" in sl:
        return "Pre-Commissioning"
    if "struct" in sl:
        return "Structural"
    if "material" in sl:
        return "Material"
    return s

def normalize_status(raw_status):
    s = clean_str(raw_status)
    sl = s.lower()
    if sl == "done":
        return "Done"
    if sl == "ongoing":
        return "Ongoing"
    if sl == "not yet":
        return "Not yet"
    if sl in ("n/a", "na"):
        return "N/A"
    return "Not yet" if not s else s

def parse_sig(raw_sig):
    s = clean_str(raw_sig)
    sl = s.lower()
    if not s:
        return {"signed": False, "label": "Pending", "raw": ""}
    if "signed" in sl or "done" in sl or "ok" in sl or re.match(r'^\d{4}-\d{2}-\d{2}', s):
        return {"signed": True, "label": "Signed", "raw": s}
    return {"signed": False, "label": s, "raw": s}

def parse_schedule_cell(raw_str):
    s = clean_str(raw_str)
    if not s or s == "?":
        return []
    parts = [p.strip() for p in re.split(r',\s*(?=[A-Za-z])', s) if p.strip()]
    items = []
    for p in parts:
        pl = p.lower()
        if 'mech' in pl:
            disc = 'Mechanical'
        elif 'e&i' in pl or 'elect' in pl or 'inst' in pl:
            disc = 'Electrical & Instruments'
        elif 'pip' in pl:
            disc = 'Piping'
        else:
            disc = p
        has1 = '1' in p
        has2 = '2' in p
        if has1 and not has2:
            units = ['GTG#1']
        elif has2 and not has1:
            units = ['GTG#2']
        else:
            units = ['GTG#1', 'GTG#2']
        items.append({
            "raw": p,
            "discipline": disc,
            "units": units
        })
    return items

def parse_excel_workbook(filepath):
    wb = openpyxl.load_workbook(filepath, data_only=True)
    
    units_config = [
        {
            "id": "GTG#1",
            "code": "CPPT-PK-1101",
            "name": "GTG#1 (CPPT-PK-1101)",
            "full_desc": "CPPT-PK-1101 (BH Job 1604149-1104073, GT G14537 / Comp. C20987)",
            "summary_sheet": "Summary GTC#1",
            "check_sheet": "SQCL Check Sheet GTC#1"
        },
        {
            "id": "GTG#2",
            "code": "CPPT-PK-2101",
            "name": "GTG#2 (CPPT-PK-2101)",
            "full_desc": "CPPT-PK-2101 (BH Job 1604150-1104074, GT G14538 / Comp. C20988)",
            "summary_sheet": "Summary GTC#2",
            "check_sheet": "SQCL Check Sheet GTC#2"
        }
    ]
    
    result = {
        "project_info": {
            "doc_title": "SITE QUALITY CHECK LIST (SQCL) – Doc. SOI0007689 Rev. 0",
            "customer": "MCDERMOTT PTSC CONSORTIUM (MPC)",
            "location": "BLOCK B FIELD (VIETNAM, OFFSHORE)",
            "plant": "VIETNAM BLOCK B GAS PROJECT",
            "driver": "LM2500+ G4 SAC SINGLE GAS G.T.",
            "driven": "G.B. + 2BCL456/A CENTRIFUGAL COMPRESSOR",
            "source_file": "SOI0007689 SQCL Check List PK-1101 (updated 17Oct26).xlsx",
            "onedrive_url": ONEDRIVE_SHARE_URL,
            "last_synced": datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        },
        "schedule_dates": [],
        "units": {}
    }
    
    all_sched_dates = []
    
    for ucfg in units_config:
        uid = ucfg["id"]
        ws_sum = wb[ucfg["summary_sheet"]]
        ws_chk = wb[ucfg["check_sheet"]]
        
        date_cols = {}
        for c in range(12, ws_sum.max_column + 1):
            hdr = clean_str(ws_sum.cell(3, c).value)
            if hdr:
                date_cols[c] = hdr
                if hdr not in all_sched_dates:
                    all_sched_dates.append(hdr)
                
        sections_map = {}
        sections_list = []
        for r in range(4, ws_sum.max_row + 1):
            sec_raw = ws_sum.cell(r, 1).value
            title_raw = clean_str(ws_sum.cell(r, 2).value)
            if title_raw.upper() == "TOTAL" or not title_raw:
                continue
            if sec_raw is None:
                continue
            sec_idx = r - 3
            sec_code = f"5.{sec_idx}"
            
            pdf_sheet = clean_str(ws_sum.cell(r, 3).value)
            status_review = clean_str(ws_sum.cell(r, 11).value)
            if status_review == "?":
                status_review = ""
                
            schedule_notes = []
            for c, d_str in date_cols.items():
                val = clean_str(ws_sum.cell(r, c).value)
                if val:
                    parsed_items = parse_schedule_cell(val)
                    schedule_notes.append({
                        "date": d_str,
                        "note": val,
                        "items": parsed_items
                    })
                    
            sec_obj = {
                "section": sec_code,
                "title": title_raw,
                "pdf_sheet": pdf_sheet,
                "status_review": status_review,
                "schedule": schedule_notes,
                "activities_count": 0,
                "done": 0,
                "ongoing": 0,
                "not_yet": 0,
                "na": 0,
                "bh_signed": 0,
                "cu_signed": 0,
                "both_signed": 0,
                "done_unsigned": 0,
                "pct_done": 0.0
            }
            sections_map[sec_code] = sec_obj
            sections_list.append(sec_obj)
            
        current_sec_code = "5.1"
        current_sec_title = ""
        sec_counter = 0
        activities = []
        
        for r in range(9, ws_chk.max_row + 1):
            c1 = clean_str(ws_chk.cell(r, 1).value)
            c2 = clean_str(ws_chk.cell(r, 2).value)
            if not c1 and not c2:
                continue
                
            if c1 and not c2:
                sec_counter += 1
                m = re.match(r'^(\d+\.\d+)\s+(.*)$', c1)
                if m:
                    current_sec_code = m.group(1)
                    current_sec_title = m.group(2).strip()
                else:
                    current_sec_code = f"5.{sec_counter}"
                    current_sec_title = c1
                continue
                
            act_code = c1
            parts = act_code.split('.')
            if len(parts) >= 2 and parts[0].isdigit() and parts[1].isdigit():
                derived_sec = f"{parts[0]}.{parts[1]}"
                if derived_sec in sections_map:
                    current_sec_code = derived_sec
                    
            sec_info = sections_map.get(current_sec_code, {"section": current_sec_code, "title": current_sec_title})
            
            sig_date = clean_str(ws_chk.cell(r, 3).value)
            bh_sig_info = parse_sig(ws_chk.cell(r, 4).value)
            cu_sig_info = parse_sig(ws_chk.cell(r, 5).value)
            bh_role = clean_str(ws_chk.cell(r, 6).value)
            cu_role = clean_str(ws_chk.cell(r, 7).value)
            ref_doc = clean_str(ws_chk.cell(r, 8).value)
            procedure = clean_str(ws_chk.cell(r, 9).value)
            acceptance = clean_str(ws_chk.cell(r, 10).value)
            check_type = clean_str(ws_chk.cell(r, 11).value)
            service_report = clean_str(ws_chk.cell(r, 12).value)
            note = clean_str(ws_chk.cell(r, 13).value)
            pic_pmc = clean_str(ws_chk.cell(r, 14).value)
            pic_pq = clean_str(ws_chk.cell(r, 15).value)
            status = normalize_status(ws_chk.cell(r, 16).value)
            raw_remarks = clean_str(ws_chk.cell(r, 17).value)
            discipline = normalize_discipline(raw_remarks)
            site_markup = clean_str(ws_chk.cell(r, 18).value)
            pdf_sheet = clean_str(ws_chk.cell(r, 19).value)
            
            if not sig_date and re.match(r'^\d{4}-\d{2}-\d{2}', cu_sig_info["raw"]):
                sig_date = cu_sig_info["raw"]
                
            bh_signed = bh_sig_info["signed"]
            cu_signed = cu_sig_info["signed"]
            both_signed = bh_signed and cu_signed
            
            if both_signed:
                sig_status = "Both Signed"
            elif bh_signed and not cu_signed:
                sig_status = "BH Signed Only"
            elif cu_signed and not bh_signed:
                sig_status = "CU Signed Only"
            else:
                sig_status = "Unsigned"
                
            done_unsigned = (status == "Done") and (not both_signed)
            
            act_item = {
                "id": f"{uid}-{act_code}",
                "row_num": r,
                "unit": uid,
                "unit_code": ucfg["code"],
                "section": current_sec_code,
                "section_title": sec_info.get("title", current_sec_title),
                "activity": act_code,
                "description": c2,
                "sig_date": sig_date,
                "bh_sig": bh_sig_info["label"],
                "bh_signed": bh_signed,
                "cu_sig": cu_sig_info["label"],
                "cu_signed": cu_signed,
                "both_signed": both_signed,
                "sig_status": sig_status,
                "done_unsigned": done_unsigned,
                "bh_role": bh_role,
                "cu_role": cu_role,
                "ref_doc": ref_doc,
                "procedure": procedure,
                "acceptance": acceptance,
                "check_type": check_type,
                "service_report": service_report,
                "note": note,
                "pic_pmc": pic_pmc,
                "pic_pq": pic_pq,
                "status": status,
                "discipline": discipline,
                "remarks_raw": raw_remarks,
                "site_markup": site_markup,
                "pdf_sheet": pdf_sheet
            }
            activities.append(act_item)
            
            if current_sec_code in sections_map:
                s_obj = sections_map[current_sec_code]
                s_obj["activities_count"] += 1
                if status == "Done":
                    s_obj["done"] += 1
                elif status == "Ongoing":
                    s_obj["ongoing"] += 1
                elif status == "N/A":
                    s_obj["na"] += 1
                else:
                    s_obj["not_yet"] += 1
                if bh_signed:
                    s_obj["bh_signed"] += 1
                if cu_signed:
                    s_obj["cu_signed"] += 1
                if both_signed:
                    s_obj["both_signed"] += 1
                if done_unsigned:
                    s_obj["done_unsigned"] += 1
                    
        for s_obj in sections_list:
            denom = s_obj["activities_count"] - s_obj["na"]
            s_obj["pct_done"] = round((s_obj["done"] / denom) * 100, 1) if denom > 0 else 0.0
            
        result["units"][uid] = {
            "info": ucfg,
            "sections": sections_list,
            "activities": activities
        }
        
    result["schedule_dates"] = all_sched_dates
    
    with open("sqcl_data_bundle.js", "w", encoding="utf-8") as jf:
        jf.write("window.SQCL_INITIAL_DATA = ")
        json.dump(result, jf, ensure_ascii=False)
        jf.write(";\n")
        
    return result

if __name__ == "__main__":
    data = parse_excel_workbook("onedrive_file.xlsx")
    with open("sqcl_data.json", "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    print("Saved sqcl_data.json and sqcl_data_bundle.js successfully!")
