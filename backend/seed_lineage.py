"""
Seed comprehensive lineage edges — 4-level deep chains across all 6 databases.
Run with: docker compose exec backend python seed_lineage.py
"""
import os
import httpx

API_URL = os.environ.get("API_URL", "http://localhost:8000")
API_KEY = "dev-ingest-key"
HEADERS = {"X-API-Key": API_KEY, "Content-Type": "application/json"}

# Format: (source_db, source_table, target_db, target_table)
EDGES = [
    # ── Chain A: E-commerce order pipeline → Operations → Analytics (4 hops) ──
    ("ecommerce_db",        "orders",           "ecommerce_db",        "order_items"),
    ("ecommerce_db",        "order_items",      "ecommerce_db",        "shipments"),
    ("ecommerce_db",        "shipments",        "operations_db",       "deliveries"),
    ("operations_db",       "deliveries",       "analytics_warehouse", "fct_orders"),

    # ── Chain B: CRM funnel → Finance → Analytics (4 hops) ────────────────────
    ("crm_database",        "leads",            "crm_database",        "opportunities"),
    ("crm_database",        "opportunities",    "crm_database",        "deals_pipeline"),
    ("crm_database",        "deals_pipeline",   "finance_db",          "invoices"),
    ("finance_db",          "invoices",         "analytics_warehouse", "agg_daily_revenue"),

    # ── Chain C: HR payroll → Finance → Analytics (4 hops) ────────────────────
    ("hr_database",         "employees",        "hr_database",         "payslips"),
    ("hr_database",         "payslips",         "finance_db",          "journal_entries"),
    ("finance_db",          "journal_entries",  "finance_db",          "financial_statements"),
    ("finance_db",          "financial_statements", "analytics_warehouse", "agg_daily_revenue"),

    # ── Chain D: Product → Reviews → Dim → Recommendations → ML (4 hops) ──────
    ("ecommerce_db",        "products",         "ecommerce_db",        "reviews"),
    ("ecommerce_db",        "reviews",          "analytics_warehouse", "dim_products"),
    ("analytics_warehouse", "dim_products",     "analytics_warehouse", "product_recommendations"),
    ("analytics_warehouse", "product_recommendations", "analytics_warehouse", "model_predictions"),

    # ── Chain E: Supply chain → Stock → Quality → Customer features (4 hops) ──
    ("ecommerce_db",        "suppliers",        "ecommerce_db",        "purchase_orders"),
    ("ecommerce_db",        "purchase_orders",  "ecommerce_db",        "stock_levels"),
    ("ecommerce_db",        "stock_levels",     "operations_db",       "quality_checks"),
    ("operations_db",       "quality_checks",   "analytics_warehouse", "customer_features"),

    # ── Chain F: Web events → Sessions → Features → ML → Recommendations (4 hops)
    ("analytics_warehouse", "web_events",       "analytics_warehouse", "fct_web_sessions"),
    ("analytics_warehouse", "fct_web_sessions", "analytics_warehouse", "customer_features"),
    ("analytics_warehouse", "customer_features","analytics_warehouse", "model_predictions"),

    # ── Chain G: Finance reporting pipeline (3 hops) ───────────────────────────
    ("finance_db",          "journal_lines",    "finance_db",          "journal_entries"),
    ("finance_db",          "financial_statements", "finance_db",      "kpi_metrics"),

    # ── Chain H: CRM support → Ops compliance (3 hops) ────────────────────────
    ("crm_database",        "ticket_comments",  "crm_database",        "tickets"),
    ("crm_database",        "tickets",          "crm_database",        "sla_policies"),
    ("crm_database",        "sla_policies",     "operations_db",       "compliance_logs"),

    # ── Chain I: HR recruiting pipeline (3 hops) ──────────────────────────────
    ("hr_database",         "job_postings",     "hr_database",         "candidates"),
    ("hr_database",         "candidates",       "hr_database",         "interviews"),
    ("hr_database",         "interviews",       "hr_database",         "performance_reviews"),

    # ── Chain J: Customer → CRM → Analytics dim → Feature store (4 hops) ──────
    ("ecommerce_db",        "customers",        "crm_database",        "contacts"),
    ("crm_database",        "contacts",         "crm_database",        "accounts"),
    ("crm_database",        "accounts",         "analytics_warehouse", "dim_customers"),
    ("analytics_warehouse", "dim_customers",    "analytics_warehouse", "customer_features"),

    # ── Extra cross-db joins to enrich the graph ──────────────────────────────
    ("ecommerce_db",        "customers",        "analytics_warehouse", "dim_customers"),
    ("ecommerce_db",        "orders",           "finance_db",          "invoices"),
    ("operations_db",       "deliveries",       "operations_db",       "delivery_routes"),
    ("operations_db",       "delivery_routes",  "operations_db",       "depots"),
    ("hr_database",         "employees",        "finance_db",          "cost_centers"),
    ("finance_db",          "cost_centers",     "finance_db",          "budgets"),
    ("analytics_warehouse", "app_logs",         "analytics_warehouse", "mobile_events"),
    ("analytics_warehouse", "mobile_events",    "analytics_warehouse", "fct_web_sessions"),
    ("ecommerce_db",        "products",         "analytics_warehouse", "dim_products"),
    ("ecommerce_db",        "coupons",          "analytics_warehouse", "agg_daily_revenue"),
    ("operations_db",       "returns",          "ecommerce_db",        "order_items"),
    ("crm_database",        "csat_responses",   "analytics_warehouse", "customer_features"),
    ("hr_database",         "training_programs","hr_database",         "training_completions"),
    ("hr_database",         "training_completions","analytics_warehouse","customer_features"),
    ("operations_db",       "incidents",        "operations_db",       "compliance_logs"),
    ("operations_db",       "fleet_vehicles",   "operations_db",       "deliveries"),
    ("finance_db",          "payments",         "finance_db",          "invoices"),
    ("finance_db",          "tax_filings",      "finance_db",          "financial_statements"),
    ("ecommerce_db",        "warehouses",       "ecommerce_db",        "stock_levels"),
    ("crm_database",        "activities",       "crm_database",        "opportunities"),
]


def main():
    payload = [
        {
            "source_db_name":    src_db,
            "source_table_name": src_tbl,
            "target_db_name":    tgt_db,
            "target_table_name": tgt_tbl,
        }
        for src_db, src_tbl, tgt_db, tgt_tbl in EDGES
    ]

    resp = httpx.post(
        f"{API_URL}/api/v1/ingest/lineage",
        json=payload,
        headers=HEADERS,
        timeout=30,
    )
    resp.raise_for_status()
    data = resp.json()
    print(f"Inserted {data.get('inserted', '?')} new lineage edges ({len(EDGES)} total submitted, duplicates skipped).")


if __name__ == "__main__":
    main()
