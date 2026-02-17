"""Load queries from 'alation_queries_export.xlsx' into the Data Catalog via the API."""
import os
import sys

import requests

try:
    import openpyxl
except ImportError:
    print("openpyxl is required: pip install openpyxl")
    sys.exit(1)

API_URL = os.environ.get("API_URL", "http://localhost:8000")
AUTH_URL = f"{API_URL}/auth/login"
QUERIES_URL = f"{API_URL}/api/v1/queries"
XLSX_PATH = os.environ.get(
    "XLSX_PATH",
    os.path.join(os.path.dirname(__file__), "alation_queries_export.xlsx"),
)

# --- Authenticate as steward ---
resp = requests.post(AUTH_URL, json={"email": "steward@demo.com", "password": "steward123"})
if resp.status_code != 200:
    print("Login failed:", resp.text)
    sys.exit(1)

token = resp.json()["access_token"]
headers = {"Authorization": f"Bearer {token}"}


def load_queries():
    wb = openpyxl.load_workbook(XLSX_PATH, read_only=True)
    ws = wb.active
    rows = list(ws.iter_rows(values_only=True))
    wb.close()

    header = rows[0]
    col = {name: idx for idx, name in enumerate(header)}

    created = 0
    skipped = 0

    for row in rows[1:]:
        sql_text = (row[col["query_text"]] or "").strip()
        if not sql_text:
            skipped += 1
            continue

        title = (row[col["title"]] or "").strip() if "title" in col else ""
        query_id = row[col["query_id"]] if "query_id" in col else None
        datasource = (row[col["datasource_title"]] or "").strip() if "datasource_title" in col else ""

        # Build a name: use title if available, else datasource + query_id
        if title:
            name = title
        elif datasource and query_id:
            name = f"{datasource} — Query #{query_id}"
        elif query_id:
            name = f"Query #{query_id}"
        else:
            name = f"Imported Query (row {rows.index(row)})"

        # Use description_html if present, fall back to description_text
        description = None
        if "description_html" in col and row[col["description_html"]]:
            description = row[col["description_html"]].strip()
        elif "description_text" in col and row[col["description_text"]]:
            description = row[col["description_text"]].strip()

        payload = {
            "name": name,
            "sql_text": sql_text,
            "description": description or None,
            "connection_id": None,
            "sme_name": None,
            "sme_email": None,
        }

        r = requests.post(QUERIES_URL, json=payload, headers=headers)
        if r.status_code == 201:
            print(f"  Created: {name}")
            created += 1
        else:
            print(f"  FAILED: {name}: {r.status_code} {r.text}")

    print(f"\nDone — {created} queries created, {skipped} rows skipped.")


load_queries()
