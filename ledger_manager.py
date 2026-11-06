"""
SQCL Closing Ledger Manager
Tracks items closed (Both BH & CU signed) by Work Date with 07:30 AM Cut-off.
Work Date convention: Items signed between Date D 07:30 AM and Date D+1 07:29 AM
are assigned to Work Date D (Label: D/M with Cut-off 07:30 D+1/M).
"""
import os
import json
import datetime

CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
LEDGER_FILE = os.path.join(CURRENT_DIR, "sqcl_closing_ledger.json")
BUNDLE_FILE = os.path.join(CURRENT_DIR, "sqcl_closing_ledger_bundle.js")

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

def sync_data_with_ledger(parsed_data, ledger_path=LEDGER_FILE, bundle_path=BUNDLE_FILE):
    """
    Compare parsed Excel data with closing ledger:
    - Maintain existing closed items and timestamps.
    - If a new item becomes both_signed, record it with current timestamp and work_date.
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

    if not ledger or "records" not in ledger:
        ledger = {
            "version": "1.0",
            "cutoff_hour": 7,
            "cutoff_minute": 30,
            "baseline_cutoff_time": "2026-11-06T12:00:00+07:00",
            "last_updated": datetime.datetime.now(datetime.timezone(datetime.timedelta(hours=7))).isoformat(),
            "total_closed_items": 0,
            "records": {},
            "daily_summary": {}
        }

    records = ledger.setdefault("records", {})
    now_vn = datetime.datetime.now(datetime.timezone(datetime.timedelta(hours=7)))
    now_iso = now_vn.isoformat()
    current_work_date = compute_work_date(now_vn)

    new_closed_count = 0
    for uid, u in parsed_data.get("units", {}).items():
        for act in u.get("activities", []):
            if act.get("both_signed"):
                act_id = act["id"]
                disc = act.get("discipline") or "Unassigned"
                if disc == "Unassigned":
                    disc = "General"

                if act_id not in records:
                    # New closed item detected!
                    records[act_id] = {
                        "id": act_id,
                        "unit": uid,
                        "activity": act.get("activity"),
                        "section": act.get("section"),
                        "section_title": act.get("section_title"),
                        "description": act.get("description"),
                        "discipline": disc,
                        "work_date": current_work_date,
                        "col_c_date": act.get("sig_date") or "",
                        "closed_timestamp": now_iso,
                        "source": "sync_detection"
                    }
                    new_closed_count += 1
                else:
                    # Existing record: preserve original work_date & closed_timestamp
                    records[act_id]["discipline"] = disc
                    records[act_id]["description"] = act.get("description")
                    records[act_id]["activity"] = act.get("activity")
                    records[act_id]["section"] = act.get("section")
                    records[act_id]["section_title"] = act.get("section_title")

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
    # Test execution
    data_path = os.path.join(CURRENT_DIR, "sqcl_data.json")
    if os.path.exists(data_path):
        with open(data_path, "r", encoding="utf-8") as f:
            test_data = json.load(f)
        led, count = sync_data_with_ledger(test_data)
        print(f"Ledger synced successfully: {led['total_closed_items']} total items ({count} new).")
        for d, s in sorted(led["daily_summary"].items()):
            print(f"  {s['label']}: {s['total']} items -> {s['by_discipline']}")
