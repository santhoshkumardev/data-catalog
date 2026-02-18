"""Load articles from 'Data Catalog Articles.csv' into the Data Catalog via the API."""
import csv
import os
import sys

import requests

API_URL = os.environ.get("API_URL", "http://localhost:8000")
AUTH_URL = f"{API_URL}/auth/login"
ARTICLES_URL = f"{API_URL}/api/v1/articles"
CSV_PATH = os.environ.get("CSV_PATH", os.path.join(os.path.dirname(__file__), "..", "Data Catalog Articles.csv"))

# --- Authenticate as steward ---
resp = requests.post(AUTH_URL, json={"email": "steward@demo.com", "password": "steward123"})
if resp.status_code != 200:
    print("Login failed:", resp.text)
    sys.exit(1)

token = resp.json()["access_token"]
headers = {"Authorization": f"Bearer {token}"}


def load_articles():
    with open(CSV_PATH, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        created = 0
        skipped = 0

        for row in reader:
            title = (row.get("title") or "").strip()
            if not title:
                skipped += 1
                continue

            # Skip soft-deleted rows
            if (row.get("deleted") or "").strip().upper() == "TRUE":
                skipped += 1
                continue

            body = (row.get("article_text") or "").strip() or None

            payload = {
                "title": title,
                "description": None,
                "sme_name": None,
                "sme_email": None,
                "body": body,
                "tags": None,
            }

            r = requests.post(ARTICLES_URL, json=payload, headers=headers)
            if r.status_code == 201:
                print(f"  Created: {title}")
                created += 1
            else:
                print(f"  FAILED: {title}: {r.status_code} {r.text}")

        print(f"\nDone — {created} articles created, {skipped} rows skipped.")


load_articles()
