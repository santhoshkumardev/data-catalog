"""
Ingest EDW (Enterprise Data Warehouse) metadata from EDW.json into the Data Catalog.

The JSON file contains a flat list of records with a dot-delimited `key` field
that encodes the hierarchy:
  - key=""                         -> database
  - key="schema"                   -> schema
  - key="schema.table"             -> table
  - key="schema.table.column"      -> column

This script groups the records into the batch ingest payload format and sends
them to the API in per-schema batches to avoid oversized requests.
"""
import json
import os
import re
import sys
from collections import defaultdict

import httpx

API_URL = os.environ.get("API_URL", "http://localhost:8000")
API_KEY = "dev-ingest-key"
HEADERS = {"X-API-Key": API_KEY, "Content-Type": "application/json"}

if len(sys.argv) > 1:
    EDW_FILE = os.path.join(os.getcwd(), sys.argv[1])
else:
    EDW_FILE = os.environ.get("EDW_FILE", "/app/EDW.json")


def strip_html(html: str) -> str:
    """Remove HTML tags and return plain text (best-effort)."""
    if not html:
        return ""
    text = re.sub(r"<[^>]+>", " ", html)
    text = re.sub(r"\s+", " ", text).strip()
    # Truncate long descriptions to 2000 chars
    if len(text) > 2000:
        text = text[:2000] + "..."
    return text


def load_edw(path: str):
    """Load EDW.json and organise records by hierarchy level."""
    with open(path) as f:
        data = json.load(f)

    db_record = None
    schemas = {}        # schema_name -> record
    tables = {}         # (schema_name, table_name) -> record
    columns = defaultdict(list)  # (schema_name, table_name) -> [record, ...]

    for item in data:
        key = item["key"]
        if key == "":
            db_record = item
        elif "." not in key:
            schemas[key] = item
        else:
            parts = key.split(".", 2)
            if len(parts) == 2:
                schema_name, table_name = parts
                tables[(schema_name, table_name)] = item
            elif len(parts) >= 3:
                schema_name = parts[0]
                table_name = parts[1]
                col_name = parts[2]
                # Store the column name extracted from the key
                item["_col_name"] = col_name
                columns[(schema_name, table_name)].append(item)

    return db_record, schemas, tables, columns


def build_column(item: dict) -> dict:
    """Convert a column record to ingest API format."""
    col = {"name": item["_col_name"], "data_type": "VARCHAR2"}
    title = item.get("title", "")
    desc = strip_html(item.get("description", ""))
    if title:
        col["title"] = title
    if desc:
        col["description"] = desc
    return col


def build_table(table_item: dict, table_name: str, col_items: list) -> dict:
    """Convert a table record + its columns to ingest API format."""
    tbl = {"name": table_name}
    title = table_item.get("title", "") if table_item else ""
    desc = strip_html(table_item.get("description", "")) if table_item else ""
    if title:
        tbl["title"] = title
    if desc:
        tbl["description"] = desc
    tbl["columns"] = [build_column(c) for c in col_items]
    return tbl


def main():
    print("Loading EDW.json...")
    db_record, schemas, tables, columns = load_edw(EDW_FILE)

    if not db_record:
        print("ERROR: No database-level record found in EDW.json")
        return

    db_name = "edw"
    db_title = db_record.get("title", "EDW")
    db_desc = strip_html(db_record.get("description", ""))
    print(f"Database: {db_title} ({db_name})")
    print(f"  Schemas: {len(schemas)}")
    print(f"  Tables:  {len(tables)}")
    print(f"  Columns: {sum(len(v) for v in columns.values())}")

    # Verify API is reachable
    print("\nConnecting to Data Catalog API...")
    try:
        resp = httpx.get(f"{API_URL}/health", timeout=5)
        resp.raise_for_status()
        print("API is up.\n")
    except Exception:
        print("ERROR: Cannot reach the API at", API_URL)
        print("Make sure the app is running (docker compose up).")
        return

    # Group tables by schema
    schema_tables = defaultdict(list)
    for (schema_name, table_name) in tables:
        schema_tables[schema_name].append(table_name)

    # Also include schemas that have columns but might not have table-level records
    for (schema_name, table_name) in columns:
        if table_name not in schema_tables.get(schema_name, []):
            schema_tables[schema_name].append(table_name)

    total_tables = 0
    total_columns = 0
    failed_schemas = []

    BATCH_SIZE = 500  # max tables per API call to avoid payload limits

    def send_batch(schema_name, schema_item, tbl_batch, batch_label=""):
        """Send a single batch of tables for a schema."""
        schema_desc_val = strip_html(schema_item.get("description", "")) if schema_item else ""
        schema_title_val = schema_item.get("title", "") if schema_item else ""

        schema_payload = {"name": schema_name, "tables": tbl_batch}
        if schema_desc_val:
            schema_payload["description"] = schema_desc_val
        if schema_title_val:
            schema_payload["title"] = schema_title_val

        payload = {
            "database": {
                "name": db_name,
                "db_type": "oracle",
                "description": db_desc,
            },
            "schemas": [schema_payload],
        }

        resp = httpx.post(
            f"{API_URL}/api/v1/ingest/batch",
            headers=HEADERS,
            json=payload,
            timeout=120,
        )
        resp.raise_for_status()
        return resp.json()

    # Ingest per schema, splitting large schemas into batches
    for schema_name in sorted(schema_tables.keys()):
        table_names = sorted(set(schema_tables[schema_name]))
        schema_item = schemas.get(schema_name, {})

        tbl_list = []
        schema_col_count = 0
        for tname in table_names:
            table_item = tables.get((schema_name, tname))
            col_items = columns.get((schema_name, tname), [])
            tbl = build_table(table_item, tname, col_items)
            tbl_list.append(tbl)
            schema_col_count += len(col_items)

        num_batches = (len(tbl_list) + BATCH_SIZE - 1) // BATCH_SIZE

        print(
            f"Ingesting schema: {schema_name} "
            f"({len(tbl_list)} tables, {schema_col_count} columns"
            f"{f', {num_batches} batches' if num_batches > 1 else ''}) ...",
            end=" ",
            flush=True,
        )

        schema_failed = False
        for i in range(0, len(tbl_list), BATCH_SIZE):
            batch = tbl_list[i : i + BATCH_SIZE]
            batch_num = i // BATCH_SIZE + 1
            try:
                result = send_batch(schema_name, schema_item, batch)
                total_tables += result.get("tables_upserted", 0)
                total_columns += result.get("columns_upserted", 0)
                if num_batches > 1:
                    print(f"[batch {batch_num}/{num_batches} ok]", end=" ", flush=True)
            except Exception as e:
                print(f"[batch {batch_num}/{num_batches} FAILED: {e}]", end=" ", flush=True)
                schema_failed = True

        if schema_failed:
            print("PARTIAL")
            failed_schemas.append(schema_name)
        else:
            print("Done")

    print(f"\nFinished! {total_tables} tables, {total_columns} columns ingested across {len(schema_tables)} schemas.")
    if failed_schemas:
        print(f"Failed schemas ({len(failed_schemas)}): {', '.join(failed_schemas)}")
    print("Open http://localhost:3001 in your browser.")


if __name__ == "__main__":
    main()
