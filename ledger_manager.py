"""
SQCL Completion & Closing Ledger Manager
Tracks completed items based on Column Status (Column P == 'Done') by Work Date with 07:30 AM Cut-off.
Work Date convention (Option A): Items marked Done between Date D 07:30 AM and Date D+1 07:29:59 AM
are assigned to Work Date D (Label: DD/MM with Cut-off 07:30 DD+1/MM).
Ensures 100% data consistency with the Status column in OneDrive Excel and all dashboard summary tables.
"""
import os
import re
import json
import datetime

CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
LEDGER_FILE = os.path.join(CURRENT_DIR, "sqcl_closing_ledger.json")
BUNDLE_FILE = os.path.join(CURRENT_DIR, "sqcl_closing_ledger_bundle.js")

MONTH_MAP = {
    'jan': 1, 'feb': 2, 'mar': 3, 'apr': 4, 'may': 5, 'jun': 6,
    'jul': 7, 'aug': 8, 'sep': 9, 'oct': 10, 'nov': 11, 'now': 11, 'dec': 12
}

def compute_work_date(dt):
    """
    Given a datetime (UTC+7), calculate the Work Date.
    Cutoff: 07:30 AM.
    If hour < 7 or (hour == 7 and minute < 30):
        Work Date is yesterday
    Else:
        Work Date is today
    """
    cutoff_time = datetime.time(7, 30, 0)
    if dt.time() < cutoff_time:
        work_dt = dt - datetime.timedelta(days=1)
    else:
        work_dt = dt
    return work_dt.strftime("%Y-%m-%d")

def format_work_date_label(work_date_str):
    """
    Format Work Date into standard EPC reporting label:
    e.g. '2026-11-05' -> '05/11 (Cut-off 07:30 06/11)'
    """
    try:
        parts = work_date_str.split('-')
        d_obj = datetime.date(int(parts[0]), int(parts[1]), int(parts[2]))
        next_d = d_obj + datetime.timedelta(days=1)
        return f"{d_obj.strftime('%d/%m')} (Cut-off 07:30 {next_d.strftime('%d/%m')})"
    except Exception:
        return work_date_str

def extract_historical_work_date(act, fallback_date):
    """
    Extract date from Column C (sig_date) or Column R (site_markup) in Excel.
    """
    if act.get('sig_date'):
        return act['sig_date']
    sm = (act.get('site_markup') or '') + ' ' + (act.get('status_update') or '')
    m = re.search(r'(\d{1,2})[-/]([A-Za-z]{3}|\d{1,2})', sm)
    if m:
        day = int(m.group(1))
        m_str = m.group(2).lower()
        if m_str in MONTH_MAP:
            return f"2026-{MONTH_MAP[m_str]:02d}-{day:02d}"
    
    # Section specific mappings for items without inline date text
    act_id = act.get('id', '')
    if '5.6.20' in act_id:
        return '2026-10-29'
    if '5.29.' in act_id:
        return '2026-11-04'
    if '5.11.15' in act_id:
        return '2026-08-24'
    if '5.44.' in act_id:
        return '2026-10-30'
    return fallback_date

def sync_data_with_ledger(parsed_data, ledger_path=LEDGER_FILE, bundle_path=BUNDLE_FILE):
    """
    Compare parsed Excel data with completion ledger:
    - Target: items with status == 'Done' (Column P in Excel).
    - Maintain existing completed items and timestamps.
    - If an item's status is no longer 'Done', remove it from records.
    - If a new item becomes 'Done', record it with current timestamp and work_date.
    - Recompute daily_summary breakdown by discipline and unit.
    - Write to JSON and JS bundle.
    """
    ledger = {}
    if os.path.exists(ledger_path):
        try:
            with open(ledger_path, "r", encoding="utf-8") as f:
                ledger = json.load(f)
        except Exception:
            pass

    now_vn = datetime.datetime.now(datetime.timezone(datetime.timedelta(hours=7)))
    now_iso = now_vn.isoformat()
    current_work_date = compute_work_date(now_vn)

    if not ledger or "records" not in ledger:
        ledger = {
            "version": "2.0",
            "metric": "status_done",
            "cutoff_hour": 7,
            "cutoff_minute": 30,
            "baseline_cutoff_time": "2026-11-06T12:00:00+07:00",
            "last_updated": now_iso,
            "total_closed_items": 0,
            "records": {},
            "daily_summary": {}
        }

    records = ledger.setdefault("records", {})
    existing_records = dict(records)
    records.clear()

    new_closed_count = 0
    for uid, u in parsed_data.get("units", {}).items():
        for act in u.get("activities", []):
            if act.get("status") == "Done":
                act_id = act["id"]
                disc = act.get("discipline") or "General"
                if disc in ("Unassigned", "NA", "N/A", "none", "-") or not disc:
                    disc = "General"

                if act_id in existing_records:
                    rec = existing_records[act_id]
                    rec["discipline"] = disc
                    rec["description"] = act.get("description")
                    rec["activity"] = act.get("activity")
                    rec["section"] = act.get("section")
                    rec["section_title"] = act.get("section_title")
                    records[act_id] = rec
                else:
                    w_date = extract_historical_work_date(act, fallback_date=current_work_date)
                    records[act_id] = {
                        "id": act_id,
                        "unit": uid,
                        "activity": act.get("activity"),
                        "section": act.get("section"),
                        "section_title": act.get("section_title"),
                        "description": act.get("description"),
                        "discipline": disc,
                        "work_date": w_date,
                        "status": "Done",
                        "col_c_date": act.get("sig_date") or "",
                        "closed_timestamp": now_iso,
                        "source": "status_column_p"
                    }
                    new_closed_count += 1

    # Rebuild daily_summary from all records
    daily_summary = {}
    for r_id, r in records.items():
        w_date = r.get("work_date") or "2026-08-24"
        disc = r.get("discipline") or "General"
        uid = r.get("unit") or "GTG#1"
        if w_date not in daily_summary:
            daily_summary[w_date] = {
                "date": w_date,
                "label": format_work_date_label(w_date),
                "total": 0,
                "by_discipline": {},
                "by_unit": {}
            }
        daily_summary[w_date]["total"] += 1
        daily_summary[w_date]["by_discipline"][disc] = daily_summary[w_date]["by_discipline"].get(disc, 0) + 1
        daily_summary[w_date]["by_unit"][uid] = daily_summary[w_date]["by_unit"].get(uid, 0) + 1

    ledger["last_updated"] = now_iso
    ledger["total_closed_items"] = len(records)
    ledger["records"] = records
    ledger["daily_summary"] = daily_summary

    # Save JSON and Bundle JS
    try:
        with open(ledger_path, "w", encoding="utf-8") as f:
            json.dump(ledger, f, ensure_ascii=False, indent=2)

        with open(bundle_path, "w", encoding="utf-8") as f:
            f.write('window.SQCL_CLOSING_LEDGER = ' + json.dumps(ledger, ensure_ascii=False) + ';\n')
    except Exception as e:
        print(f"Error saving ledger files: {e}")

    # Embed ledger summary directly into parsed_data
    parsed_data["closing_ledger"] = {
        "last_updated": ledger["last_updated"],
        "total_closed_items": ledger["total_closed_items"],
        "daily_summary": ledger["daily_summary"]
    }

    return ledger, new_closed_count

if __name__ == "__main__":
    data_path = os.path.join(CURRENT_DIR, "sqcl_data.json")
    bundle_path = os.path.join(CURRENT_DIR, "sqcl_data_bundle.js")
    if os.path.exists(data_path):
        with open(data_path, "r", encoding="utf-8") as f:
            test_data = json.load(f)
        led, count = sync_data_with_ledger(test_data)
        print(f"Ledger synced successfully based on Status Done: {led['total_closed_items']} total items ({count} new).")
        for d, s in sorted(led["daily_summary"].items()):
            print(f"  {s['label']}: {s['total']} items -> {s['by_discipline']}")

        with open(data_path, "w", encoding="utf-8") as f:
            json.dump(test_data, f, ensure_ascii=False)
        with open(bundle_path, "w", encoding="utf-8") as f:
            f.write("window.SQCL_INITIAL_DATA = " + json.dumps(test_data, ensure_ascii=False) + ";\n")
        print("Updated sqcl_data.json and sqcl_data_bundle.js.")
