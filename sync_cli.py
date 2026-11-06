import os
import sys
import json
import datetime
from parse_data import parse_excel_workbook, ONEDRIVE_SHARE_URL
try:
    from local_server import download_from_onedrive
except ImportError:
    from server import download_from_onedrive
from ledger_manager import sync_data_with_ledger

EXCEL_FILE = "onedrive_file.xlsx"
DATA_JSON = "sqcl_data.json"
DATA_BUNDLE = "sqcl_data_bundle.js"

def main():
    print(f"[{datetime.datetime.now()}] Starting Automated OneDrive Sync...")
    try:
        download_from_onedrive(ONEDRIVE_SHARE_URL, EXCEL_FILE)
        print("Excel file successfully downloaded from OneDrive.")
        
        data = parse_excel_workbook(EXCEL_FILE)
        print(f"Parsed successfully: {len(data['units']['GTG#1']['activities'])} GTG#1 activities, {len(data['units']['GTG#2']['activities'])} GTG#2 activities.")
        
        # Sync with Closing Ledger (07:30 AM Cut-off)
        ledger, new_closed = sync_data_with_ledger(data)
        print(f"Ledger synced: {ledger['total_closed_items']} total closed items ({new_closed} newly closed).")
        
        with open(DATA_JSON, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False)
            
        with open(DATA_BUNDLE, "w", encoding="utf-8") as f:
            f.write("window.SQCL_INITIAL_DATA = " + json.dumps(data, ensure_ascii=False) + ";")
            
        print("Data files updated successfully.")
        return 0
    except Exception as e:
        print(f"Sync error: {e}", file=sys.stderr)
        return 1

if __name__ == "__main__":
    sys.exit(main())
