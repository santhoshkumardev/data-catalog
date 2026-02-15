"""
Sample data seeder — loads metadata for 6 realistic databases (~100+ tables).
Uses the ingest API + indexes to Meilisearch.
"""
import os
import httpx

API_URL = os.environ.get("API_URL", "http://localhost:8000")
API_KEY = "dev-ingest-key"
HEADERS = {"X-API-Key": API_KEY, "Content-Type": "application/json"}

DATABASES = [
    # ── 1. E-Commerce ─────────────────────────────────────────────────────────
    {
        "database": {"name": "ecommerce_db", "db_type": "postgres"},
        "schemas": [
            {
                "name": "storefront",
                "tables": [
                    {"name": "customers", "row_count": 84230, "columns": [
                        {"name": "customer_id", "data_type": "bigint", "is_primary_key": True, "is_nullable": False},
                        {"name": "email", "data_type": "varchar(255)", "is_nullable": False},
                        {"name": "first_name", "data_type": "varchar(100)", "is_nullable": False},
                        {"name": "last_name", "data_type": "varchar(100)", "is_nullable": False},
                        {"name": "phone", "data_type": "varchar(20)"},
                        {"name": "date_of_birth", "data_type": "date"},
                        {"name": "country", "data_type": "varchar(50)"},
                        {"name": "loyalty_tier", "data_type": "varchar(20)"},
                        {"name": "created_at", "data_type": "timestamp", "is_nullable": False},
                    ]},
                    {"name": "orders", "row_count": 312890, "columns": [
                        {"name": "order_id", "data_type": "bigint", "is_primary_key": True, "is_nullable": False},
                        {"name": "customer_id", "data_type": "bigint", "is_nullable": False},
                        {"name": "order_date", "data_type": "timestamp", "is_nullable": False},
                        {"name": "status", "data_type": "varchar(50)", "is_nullable": False},
                        {"name": "total_amount", "data_type": "numeric(12,2)", "is_nullable": False},
                        {"name": "currency", "data_type": "varchar(3)", "is_nullable": False},
                        {"name": "shipping_address", "data_type": "text"},
                        {"name": "payment_method", "data_type": "varchar(50)"},
                        {"name": "promo_code", "data_type": "varchar(50)"},
                    ]},
                    {"name": "order_items", "row_count": 891430, "columns": [
                        {"name": "item_id", "data_type": "bigint", "is_primary_key": True, "is_nullable": False},
                        {"name": "order_id", "data_type": "bigint", "is_nullable": False},
                        {"name": "product_id", "data_type": "bigint", "is_nullable": False},
                        {"name": "quantity", "data_type": "integer", "is_nullable": False},
                        {"name": "unit_price", "data_type": "numeric(10,2)", "is_nullable": False},
                        {"name": "discount", "data_type": "numeric(5,2)"},
                    ]},
                    {"name": "products", "row_count": 5420, "columns": [
                        {"name": "product_id", "data_type": "bigint", "is_primary_key": True, "is_nullable": False},
                        {"name": "sku", "data_type": "varchar(100)", "is_nullable": False},
                        {"name": "name", "data_type": "varchar(255)", "is_nullable": False},
                        {"name": "description", "data_type": "text"},
                        {"name": "category", "data_type": "varchar(100)"},
                        {"name": "brand", "data_type": "varchar(100)"},
                        {"name": "price", "data_type": "numeric(10,2)", "is_nullable": False},
                        {"name": "stock_quantity", "data_type": "integer", "is_nullable": False},
                        {"name": "weight_kg", "data_type": "numeric(6,3)"},
                        {"name": "is_active", "data_type": "boolean", "is_nullable": False},
                    ]},
                    {"name": "product_categories", "row_count": 182, "columns": [
                        {"name": "category_id", "data_type": "integer", "is_primary_key": True, "is_nullable": False},
                        {"name": "name", "data_type": "varchar(100)", "is_nullable": False},
                        {"name": "parent_category_id", "data_type": "integer"},
                        {"name": "slug", "data_type": "varchar(100)"},
                    ]},
                    {"name": "reviews", "row_count": 45780, "columns": [
                        {"name": "review_id", "data_type": "bigint", "is_primary_key": True, "is_nullable": False},
                        {"name": "product_id", "data_type": "bigint", "is_nullable": False},
                        {"name": "customer_id", "data_type": "bigint", "is_nullable": False},
                        {"name": "rating", "data_type": "smallint", "is_nullable": False},
                        {"name": "review_text", "data_type": "text"},
                        {"name": "helpful_votes", "data_type": "integer"},
                        {"name": "created_at", "data_type": "timestamp", "is_nullable": False},
                    ]},
                    {"name": "coupons", "row_count": 3200, "columns": [
                        {"name": "coupon_id", "data_type": "integer", "is_primary_key": True, "is_nullable": False},
                        {"name": "code", "data_type": "varchar(50)", "is_nullable": False},
                        {"name": "discount_type", "data_type": "varchar(20)", "is_nullable": False},
                        {"name": "discount_value", "data_type": "numeric(8,2)", "is_nullable": False},
                        {"name": "min_order_amount", "data_type": "numeric(10,2)"},
                        {"name": "valid_from", "data_type": "date"},
                        {"name": "valid_to", "data_type": "date"},
                        {"name": "usage_limit", "data_type": "integer"},
                        {"name": "used_count", "data_type": "integer"},
                        {"name": "is_active", "data_type": "boolean"},
                    ]},
                    {"name": "wishlists", "row_count": 22400, "columns": [
                        {"name": "wishlist_id", "data_type": "bigint", "is_primary_key": True, "is_nullable": False},
                        {"name": "customer_id", "data_type": "bigint", "is_nullable": False},
                        {"name": "product_id", "data_type": "bigint", "is_nullable": False},
                        {"name": "added_at", "data_type": "timestamp", "is_nullable": False},
                    ]},
                ],
            },
            {
                "name": "inventory",
                "tables": [
                    {"name": "warehouses", "row_count": 12, "columns": [
                        {"name": "warehouse_id", "data_type": "integer", "is_primary_key": True, "is_nullable": False},
                        {"name": "name", "data_type": "varchar(100)", "is_nullable": False},
                        {"name": "address", "data_type": "text"},
                        {"name": "city", "data_type": "varchar(100)"},
                        {"name": "country", "data_type": "varchar(50)"},
                        {"name": "capacity_units", "data_type": "integer"},
                    ]},
                    {"name": "stock_levels", "row_count": 65040, "columns": [
                        {"name": "stock_id", "data_type": "bigint", "is_primary_key": True, "is_nullable": False},
                        {"name": "product_id", "data_type": "bigint", "is_nullable": False},
                        {"name": "warehouse_id", "data_type": "integer", "is_nullable": False},
                        {"name": "quantity_on_hand", "data_type": "integer", "is_nullable": False},
                        {"name": "quantity_reserved", "data_type": "integer"},
                        {"name": "reorder_level", "data_type": "integer"},
                        {"name": "last_counted_at", "data_type": "timestamp"},
                    ]},
                    {"name": "purchase_orders", "row_count": 8900, "columns": [
                        {"name": "po_id", "data_type": "bigint", "is_primary_key": True, "is_nullable": False},
                        {"name": "supplier_id", "data_type": "integer", "is_nullable": False},
                        {"name": "warehouse_id", "data_type": "integer", "is_nullable": False},
                        {"name": "status", "data_type": "varchar(30)", "is_nullable": False},
                        {"name": "total_cost", "data_type": "numeric(14,2)"},
                        {"name": "expected_delivery", "data_type": "date"},
                        {"name": "created_at", "data_type": "timestamp"},
                    ]},
                    {"name": "suppliers", "row_count": 340, "columns": [
                        {"name": "supplier_id", "data_type": "integer", "is_primary_key": True, "is_nullable": False},
                        {"name": "name", "data_type": "varchar(200)", "is_nullable": False},
                        {"name": "contact_email", "data_type": "varchar(255)"},
                        {"name": "country", "data_type": "varchar(50)"},
                        {"name": "lead_time_days", "data_type": "integer"},
                        {"name": "rating", "data_type": "numeric(3,1)"},
                    ]},
                    {"name": "shipments", "row_count": 298000, "columns": [
                        {"name": "shipment_id", "data_type": "bigint", "is_primary_key": True, "is_nullable": False},
                        {"name": "order_id", "data_type": "bigint", "is_nullable": False},
                        {"name": "carrier", "data_type": "varchar(100)"},
                        {"name": "tracking_number", "data_type": "varchar(100)"},
                        {"name": "status", "data_type": "varchar(30)"},
                        {"name": "shipped_at", "data_type": "timestamp"},
                        {"name": "delivered_at", "data_type": "timestamp"},
                    ]},
                ],
            },
        ],
    },

    # ── 2. HR ──────────────────────────────────────────────────────────────────
    {
        "database": {"name": "hr_database", "db_type": "mysql"},
        "schemas": [
            {
                "name": "hr",
                "tables": [
                    {"name": "employees", "row_count": 1230, "columns": [
                        {"name": "employee_id", "data_type": "int", "is_primary_key": True, "is_nullable": False},
                        {"name": "first_name", "data_type": "varchar(50)", "is_nullable": False},
                        {"name": "last_name", "data_type": "varchar(50)", "is_nullable": False},
                        {"name": "email", "data_type": "varchar(100)", "is_nullable": False},
                        {"name": "department_id", "data_type": "int"},
                        {"name": "job_title", "data_type": "varchar(100)"},
                        {"name": "hire_date", "data_type": "date", "is_nullable": False},
                        {"name": "salary", "data_type": "decimal(10,2)"},
                        {"name": "manager_id", "data_type": "int"},
                        {"name": "employment_type", "data_type": "varchar(20)"},
                        {"name": "is_active", "data_type": "boolean", "is_nullable": False},
                    ]},
                    {"name": "departments", "row_count": 24, "columns": [
                        {"name": "department_id", "data_type": "int", "is_primary_key": True, "is_nullable": False},
                        {"name": "department_name", "data_type": "varchar(100)", "is_nullable": False},
                        {"name": "location", "data_type": "varchar(100)"},
                        {"name": "budget", "data_type": "decimal(15,2)"},
                        {"name": "head_count", "data_type": "int"},
                    ]},
                    {"name": "job_postings", "row_count": 180, "columns": [
                        {"name": "posting_id", "data_type": "int", "is_primary_key": True, "is_nullable": False},
                        {"name": "title", "data_type": "varchar(200)", "is_nullable": False},
                        {"name": "department_id", "data_type": "int"},
                        {"name": "location", "data_type": "varchar(100)"},
                        {"name": "salary_min", "data_type": "decimal(10,2)"},
                        {"name": "salary_max", "data_type": "decimal(10,2)"},
                        {"name": "status", "data_type": "varchar(20)"},
                        {"name": "posted_at", "data_type": "datetime"},
                        {"name": "closes_at", "data_type": "datetime"},
                    ]},
                    {"name": "candidates", "row_count": 4820, "columns": [
                        {"name": "candidate_id", "data_type": "int", "is_primary_key": True, "is_nullable": False},
                        {"name": "first_name", "data_type": "varchar(50)", "is_nullable": False},
                        {"name": "last_name", "data_type": "varchar(50)", "is_nullable": False},
                        {"name": "email", "data_type": "varchar(100)"},
                        {"name": "phone", "data_type": "varchar(20)"},
                        {"name": "resume_url", "data_type": "text"},
                        {"name": "source", "data_type": "varchar(50)"},
                        {"name": "applied_at", "data_type": "datetime"},
                    ]},
                    {"name": "interviews", "row_count": 2140, "columns": [
                        {"name": "interview_id", "data_type": "int", "is_primary_key": True, "is_nullable": False},
                        {"name": "candidate_id", "data_type": "int", "is_nullable": False},
                        {"name": "posting_id", "data_type": "int"},
                        {"name": "interviewer_id", "data_type": "int"},
                        {"name": "interview_type", "data_type": "varchar(50)"},
                        {"name": "scheduled_at", "data_type": "datetime"},
                        {"name": "outcome", "data_type": "varchar(30)"},
                        {"name": "feedback", "data_type": "text"},
                    ]},
                    {"name": "leave_requests", "row_count": 8940, "columns": [
                        {"name": "request_id", "data_type": "int", "is_primary_key": True, "is_nullable": False},
                        {"name": "employee_id", "data_type": "int", "is_nullable": False},
                        {"name": "leave_type", "data_type": "varchar(50)", "is_nullable": False},
                        {"name": "start_date", "data_type": "date", "is_nullable": False},
                        {"name": "end_date", "data_type": "date", "is_nullable": False},
                        {"name": "status", "data_type": "varchar(20)", "is_nullable": False},
                        {"name": "approved_by", "data_type": "int"},
                        {"name": "notes", "data_type": "text"},
                    ]},
                    {"name": "performance_reviews", "row_count": 3680, "columns": [
                        {"name": "review_id", "data_type": "int", "is_primary_key": True, "is_nullable": False},
                        {"name": "employee_id", "data_type": "int", "is_nullable": False},
                        {"name": "reviewer_id", "data_type": "int", "is_nullable": False},
                        {"name": "review_period", "data_type": "varchar(20)", "is_nullable": False},
                        {"name": "overall_score", "data_type": "decimal(3,1)"},
                        {"name": "goals_met", "data_type": "boolean"},
                        {"name": "comments", "data_type": "text"},
                        {"name": "review_date", "data_type": "date", "is_nullable": False},
                    ]},
                    {"name": "training_programs", "row_count": 95, "columns": [
                        {"name": "program_id", "data_type": "int", "is_primary_key": True, "is_nullable": False},
                        {"name": "name", "data_type": "varchar(200)", "is_nullable": False},
                        {"name": "category", "data_type": "varchar(100)"},
                        {"name": "provider", "data_type": "varchar(100)"},
                        {"name": "duration_hours", "data_type": "decimal(5,1)"},
                        {"name": "is_mandatory", "data_type": "boolean"},
                    ]},
                    {"name": "training_completions", "row_count": 6230, "columns": [
                        {"name": "completion_id", "data_type": "int", "is_primary_key": True, "is_nullable": False},
                        {"name": "employee_id", "data_type": "int", "is_nullable": False},
                        {"name": "program_id", "data_type": "int", "is_nullable": False},
                        {"name": "completed_at", "data_type": "date"},
                        {"name": "score", "data_type": "decimal(5,2)"},
                        {"name": "certificate_url", "data_type": "text"},
                    ]},
                ],
            },
            {
                "name": "payroll",
                "tables": [
                    {"name": "salary_history", "row_count": 4520, "columns": [
                        {"name": "history_id", "data_type": "int", "is_primary_key": True, "is_nullable": False},
                        {"name": "employee_id", "data_type": "int", "is_nullable": False},
                        {"name": "salary_amount", "data_type": "decimal(10,2)", "is_nullable": False},
                        {"name": "effective_date", "data_type": "date", "is_nullable": False},
                        {"name": "change_reason", "data_type": "varchar(100)"},
                        {"name": "approved_by", "data_type": "int"},
                    ]},
                    {"name": "payslips", "row_count": 14760, "columns": [
                        {"name": "payslip_id", "data_type": "int", "is_primary_key": True, "is_nullable": False},
                        {"name": "employee_id", "data_type": "int", "is_nullable": False},
                        {"name": "pay_period", "data_type": "varchar(20)", "is_nullable": False},
                        {"name": "gross_pay", "data_type": "decimal(10,2)", "is_nullable": False},
                        {"name": "net_pay", "data_type": "decimal(10,2)", "is_nullable": False},
                        {"name": "tax_deduction", "data_type": "decimal(10,2)", "is_nullable": False},
                        {"name": "pension_deduction", "data_type": "decimal(10,2)"},
                        {"name": "paid_on", "data_type": "date", "is_nullable": False},
                    ]},
                    {"name": "expense_claims", "row_count": 9800, "columns": [
                        {"name": "claim_id", "data_type": "int", "is_primary_key": True, "is_nullable": False},
                        {"name": "employee_id", "data_type": "int", "is_nullable": False},
                        {"name": "category", "data_type": "varchar(50)"},
                        {"name": "amount", "data_type": "decimal(10,2)", "is_nullable": False},
                        {"name": "currency", "data_type": "varchar(3)"},
                        {"name": "description", "data_type": "text"},
                        {"name": "status", "data_type": "varchar(20)"},
                        {"name": "submitted_at", "data_type": "datetime"},
                        {"name": "approved_by", "data_type": "int"},
                    ]},
                    {"name": "benefits", "row_count": 3690, "columns": [
                        {"name": "benefit_id", "data_type": "int", "is_primary_key": True, "is_nullable": False},
                        {"name": "employee_id", "data_type": "int", "is_nullable": False},
                        {"name": "benefit_type", "data_type": "varchar(50)"},
                        {"name": "provider", "data_type": "varchar(100)"},
                        {"name": "monthly_cost", "data_type": "decimal(8,2)"},
                        {"name": "start_date", "data_type": "date"},
                        {"name": "end_date", "data_type": "date"},
                    ]},
                ],
            },
        ],
    },

    # ── 3. Analytics Warehouse ────────────────────────────────────────────────
    {
        "database": {"name": "analytics_warehouse", "db_type": "snowflake"},
        "schemas": [
            {
                "name": "raw",
                "tables": [
                    {"name": "web_events", "row_count": 52400000, "columns": [
                        {"name": "event_id", "data_type": "varchar(36)", "is_primary_key": True, "is_nullable": False},
                        {"name": "session_id", "data_type": "varchar(36)"},
                        {"name": "user_id", "data_type": "varchar(36)"},
                        {"name": "event_type", "data_type": "varchar(100)", "is_nullable": False},
                        {"name": "page_url", "data_type": "text"},
                        {"name": "referrer", "data_type": "text"},
                        {"name": "device_type", "data_type": "varchar(50)"},
                        {"name": "browser", "data_type": "varchar(50)"},
                        {"name": "country", "data_type": "varchar(50)"},
                        {"name": "occurred_at", "data_type": "timestamp_tz", "is_nullable": False},
                    ]},
                    {"name": "app_logs", "row_count": 180000000, "columns": [
                        {"name": "log_id", "data_type": "bigint", "is_primary_key": True, "is_nullable": False},
                        {"name": "service_name", "data_type": "varchar(100)", "is_nullable": False},
                        {"name": "log_level", "data_type": "varchar(10)", "is_nullable": False},
                        {"name": "message", "data_type": "text"},
                        {"name": "trace_id", "data_type": "varchar(36)"},
                        {"name": "error_code", "data_type": "varchar(20)"},
                        {"name": "logged_at", "data_type": "timestamp_tz", "is_nullable": False},
                    ]},
                    {"name": "mobile_events", "row_count": 31200000, "columns": [
                        {"name": "event_id", "data_type": "varchar(36)", "is_primary_key": True, "is_nullable": False},
                        {"name": "device_id", "data_type": "varchar(36)"},
                        {"name": "user_id", "data_type": "varchar(36)"},
                        {"name": "platform", "data_type": "varchar(20)"},
                        {"name": "app_version", "data_type": "varchar(20)"},
                        {"name": "event_name", "data_type": "varchar(100)"},
                        {"name": "properties", "data_type": "variant"},
                        {"name": "occurred_at", "data_type": "timestamp_tz"},
                    ]},
                    {"name": "ad_impressions", "row_count": 890000000, "columns": [
                        {"name": "impression_id", "data_type": "varchar(36)", "is_primary_key": True, "is_nullable": False},
                        {"name": "campaign_id", "data_type": "varchar(36)"},
                        {"name": "ad_id", "data_type": "varchar(36)"},
                        {"name": "user_id", "data_type": "varchar(36)"},
                        {"name": "placement", "data_type": "varchar(50)"},
                        {"name": "cost_usd", "data_type": "numeric(10,6)"},
                        {"name": "was_clicked", "data_type": "boolean"},
                        {"name": "occurred_at", "data_type": "timestamp_tz"},
                    ]},
                ],
            },
            {
                "name": "marts",
                "tables": [
                    {"name": "dim_customers", "row_count": 84230, "columns": [
                        {"name": "customer_key", "data_type": "bigint", "is_primary_key": True, "is_nullable": False},
                        {"name": "customer_id", "data_type": "bigint", "is_nullable": False},
                        {"name": "full_name", "data_type": "varchar(200)"},
                        {"name": "email", "data_type": "varchar(255)"},
                        {"name": "country", "data_type": "varchar(50)"},
                        {"name": "segment", "data_type": "varchar(50)"},
                        {"name": "lifetime_value", "data_type": "numeric(14,2)"},
                        {"name": "is_current", "data_type": "boolean", "is_nullable": False},
                    ]},
                    {"name": "dim_products", "row_count": 5420, "columns": [
                        {"name": "product_key", "data_type": "bigint", "is_primary_key": True, "is_nullable": False},
                        {"name": "product_id", "data_type": "bigint"},
                        {"name": "sku", "data_type": "varchar(100)"},
                        {"name": "name", "data_type": "varchar(255)"},
                        {"name": "category", "data_type": "varchar(100)"},
                        {"name": "brand", "data_type": "varchar(100)"},
                        {"name": "unit_cost", "data_type": "numeric(10,2)"},
                        {"name": "is_current", "data_type": "boolean"},
                    ]},
                    {"name": "fct_orders", "row_count": 312890, "columns": [
                        {"name": "order_key", "data_type": "bigint", "is_primary_key": True, "is_nullable": False},
                        {"name": "order_id", "data_type": "bigint", "is_nullable": False},
                        {"name": "customer_key", "data_type": "bigint", "is_nullable": False},
                        {"name": "order_date_key", "data_type": "integer", "is_nullable": False},
                        {"name": "total_amount", "data_type": "numeric(12,2)", "is_nullable": False},
                        {"name": "item_count", "data_type": "integer", "is_nullable": False},
                        {"name": "discount_amount", "data_type": "numeric(10,2)"},
                        {"name": "is_returned", "data_type": "boolean", "is_nullable": False},
                    ]},
                    {"name": "fct_web_sessions", "row_count": 18700000, "columns": [
                        {"name": "session_key", "data_type": "bigint", "is_primary_key": True, "is_nullable": False},
                        {"name": "session_id", "data_type": "varchar(36)"},
                        {"name": "customer_key", "data_type": "bigint"},
                        {"name": "session_date_key", "data_type": "integer"},
                        {"name": "duration_seconds", "data_type": "integer"},
                        {"name": "page_views", "data_type": "integer"},
                        {"name": "bounced", "data_type": "boolean"},
                        {"name": "converted", "data_type": "boolean"},
                    ]},
                    {"name": "dim_date", "row_count": 3652, "columns": [
                        {"name": "date_key", "data_type": "integer", "is_primary_key": True, "is_nullable": False},
                        {"name": "full_date", "data_type": "date", "is_nullable": False},
                        {"name": "year", "data_type": "smallint", "is_nullable": False},
                        {"name": "quarter", "data_type": "smallint", "is_nullable": False},
                        {"name": "month", "data_type": "smallint", "is_nullable": False},
                        {"name": "month_name", "data_type": "varchar(20)", "is_nullable": False},
                        {"name": "week_of_year", "data_type": "smallint", "is_nullable": False},
                        {"name": "day_of_week", "data_type": "smallint", "is_nullable": False},
                        {"name": "is_weekend", "data_type": "boolean", "is_nullable": False},
                        {"name": "is_holiday", "data_type": "boolean", "is_nullable": False},
                    ]},
                    {"name": "agg_daily_revenue", "row_count": 3652, "columns": [
                        {"name": "date_key", "data_type": "integer", "is_primary_key": True, "is_nullable": False},
                        {"name": "total_orders", "data_type": "integer"},
                        {"name": "total_revenue", "data_type": "numeric(14,2)"},
                        {"name": "avg_order_value", "data_type": "numeric(10,2)"},
                        {"name": "new_customers", "data_type": "integer"},
                        {"name": "returning_customers", "data_type": "integer"},
                    ]},
                ],
            },
            {
                "name": "ml_features",
                "tables": [
                    {"name": "customer_features", "row_count": 84230, "columns": [
                        {"name": "customer_id", "data_type": "bigint", "is_primary_key": True, "is_nullable": False},
                        {"name": "days_since_last_order", "data_type": "integer"},
                        {"name": "total_orders_90d", "data_type": "integer"},
                        {"name": "avg_order_value_90d", "data_type": "numeric(10,2)"},
                        {"name": "churn_score", "data_type": "numeric(4,3)"},
                        {"name": "ltv_prediction", "data_type": "numeric(12,2)"},
                        {"name": "segment_label", "data_type": "varchar(50)"},
                        {"name": "computed_at", "data_type": "timestamp_tz"},
                    ]},
                    {"name": "product_recommendations", "row_count": 2100000, "columns": [
                        {"name": "rec_id", "data_type": "bigint", "is_primary_key": True, "is_nullable": False},
                        {"name": "customer_id", "data_type": "bigint"},
                        {"name": "product_id", "data_type": "bigint"},
                        {"name": "score", "data_type": "numeric(5,4)"},
                        {"name": "model_version", "data_type": "varchar(20)"},
                        {"name": "generated_at", "data_type": "timestamp_tz"},
                    ]},
                    {"name": "model_predictions", "row_count": 450000, "columns": [
                        {"name": "prediction_id", "data_type": "bigint", "is_primary_key": True, "is_nullable": False},
                        {"name": "model_name", "data_type": "varchar(100)"},
                        {"name": "entity_id", "data_type": "varchar(100)"},
                        {"name": "prediction_value", "data_type": "numeric(10,6)"},
                        {"name": "confidence", "data_type": "numeric(5,4)"},
                        {"name": "predicted_at", "data_type": "timestamp_tz"},
                    ]},
                ],
            },
        ],
    },

    # ── 4. CRM ────────────────────────────────────────────────────────────────
    {
        "database": {"name": "crm_database", "db_type": "postgres"},
        "schemas": [
            {
                "name": "sales",
                "tables": [
                    {"name": "accounts", "row_count": 12400, "columns": [
                        {"name": "account_id", "data_type": "bigint", "is_primary_key": True, "is_nullable": False},
                        {"name": "name", "data_type": "varchar(200)", "is_nullable": False},
                        {"name": "industry", "data_type": "varchar(100)"},
                        {"name": "annual_revenue", "data_type": "numeric(16,2)"},
                        {"name": "employee_count", "data_type": "integer"},
                        {"name": "country", "data_type": "varchar(50)"},
                        {"name": "website", "data_type": "varchar(255)"},
                        {"name": "owner_id", "data_type": "integer"},
                        {"name": "created_at", "data_type": "timestamp"},
                    ]},
                    {"name": "contacts", "row_count": 48000, "columns": [
                        {"name": "contact_id", "data_type": "bigint", "is_primary_key": True, "is_nullable": False},
                        {"name": "account_id", "data_type": "bigint"},
                        {"name": "first_name", "data_type": "varchar(50)"},
                        {"name": "last_name", "data_type": "varchar(50)"},
                        {"name": "email", "data_type": "varchar(255)"},
                        {"name": "phone", "data_type": "varchar(30)"},
                        {"name": "job_title", "data_type": "varchar(100)"},
                        {"name": "department", "data_type": "varchar(100)"},
                        {"name": "is_primary", "data_type": "boolean"},
                    ]},
                    {"name": "leads", "row_count": 92000, "columns": [
                        {"name": "lead_id", "data_type": "bigint", "is_primary_key": True, "is_nullable": False},
                        {"name": "first_name", "data_type": "varchar(50)"},
                        {"name": "last_name", "data_type": "varchar(50)"},
                        {"name": "email", "data_type": "varchar(255)"},
                        {"name": "company", "data_type": "varchar(200)"},
                        {"name": "source", "data_type": "varchar(50)"},
                        {"name": "status", "data_type": "varchar(30)"},
                        {"name": "score", "data_type": "integer"},
                        {"name": "owner_id", "data_type": "integer"},
                        {"name": "created_at", "data_type": "timestamp"},
                    ]},
                    {"name": "opportunities", "row_count": 18600, "columns": [
                        {"name": "opportunity_id", "data_type": "bigint", "is_primary_key": True, "is_nullable": False},
                        {"name": "account_id", "data_type": "bigint", "is_nullable": False},
                        {"name": "name", "data_type": "varchar(200)", "is_nullable": False},
                        {"name": "stage", "data_type": "varchar(50)"},
                        {"name": "amount", "data_type": "numeric(14,2)"},
                        {"name": "probability", "data_type": "integer"},
                        {"name": "close_date", "data_type": "date"},
                        {"name": "owner_id", "data_type": "integer"},
                        {"name": "lost_reason", "data_type": "text"},
                    ]},
                    {"name": "activities", "row_count": 280000, "columns": [
                        {"name": "activity_id", "data_type": "bigint", "is_primary_key": True, "is_nullable": False},
                        {"name": "type", "data_type": "varchar(30)"},
                        {"name": "subject", "data_type": "varchar(255)"},
                        {"name": "related_to_type", "data_type": "varchar(30)"},
                        {"name": "related_to_id", "data_type": "bigint"},
                        {"name": "owner_id", "data_type": "integer"},
                        {"name": "due_date", "data_type": "timestamp"},
                        {"name": "completed_at", "data_type": "timestamp"},
                        {"name": "outcome", "data_type": "text"},
                    ]},
                    {"name": "deals_pipeline", "row_count": 18600, "columns": [
                        {"name": "pipeline_id", "data_type": "bigint", "is_primary_key": True, "is_nullable": False},
                        {"name": "opportunity_id", "data_type": "bigint", "is_nullable": False},
                        {"name": "from_stage", "data_type": "varchar(50)"},
                        {"name": "to_stage", "data_type": "varchar(50)"},
                        {"name": "moved_at", "data_type": "timestamp"},
                        {"name": "moved_by", "data_type": "integer"},
                        {"name": "days_in_stage", "data_type": "integer"},
                    ]},
                ],
            },
            {
                "name": "support",
                "tables": [
                    {"name": "tickets", "row_count": 145000, "columns": [
                        {"name": "ticket_id", "data_type": "bigint", "is_primary_key": True, "is_nullable": False},
                        {"name": "account_id", "data_type": "bigint"},
                        {"name": "contact_id", "data_type": "bigint"},
                        {"name": "subject", "data_type": "varchar(300)"},
                        {"name": "description", "data_type": "text"},
                        {"name": "priority", "data_type": "varchar(20)"},
                        {"name": "status", "data_type": "varchar(30)"},
                        {"name": "assigned_to", "data_type": "integer"},
                        {"name": "created_at", "data_type": "timestamp"},
                        {"name": "resolved_at", "data_type": "timestamp"},
                    ]},
                    {"name": "ticket_comments", "row_count": 620000, "columns": [
                        {"name": "comment_id", "data_type": "bigint", "is_primary_key": True, "is_nullable": False},
                        {"name": "ticket_id", "data_type": "bigint", "is_nullable": False},
                        {"name": "author_id", "data_type": "integer"},
                        {"name": "body", "data_type": "text"},
                        {"name": "is_public", "data_type": "boolean"},
                        {"name": "created_at", "data_type": "timestamp"},
                    ]},
                    {"name": "sla_policies", "row_count": 18, "columns": [
                        {"name": "policy_id", "data_type": "integer", "is_primary_key": True, "is_nullable": False},
                        {"name": "name", "data_type": "varchar(100)"},
                        {"name": "priority", "data_type": "varchar(20)"},
                        {"name": "first_response_hours", "data_type": "integer"},
                        {"name": "resolution_hours", "data_type": "integer"},
                        {"name": "is_active", "data_type": "boolean"},
                    ]},
                    {"name": "csat_responses", "row_count": 34200, "columns": [
                        {"name": "response_id", "data_type": "bigint", "is_primary_key": True, "is_nullable": False},
                        {"name": "ticket_id", "data_type": "bigint"},
                        {"name": "rating", "data_type": "smallint"},
                        {"name": "comment", "data_type": "text"},
                        {"name": "submitted_at", "data_type": "timestamp"},
                    ]},
                ],
            },
        ],
    },

    # ── 5. Finance ────────────────────────────────────────────────────────────
    {
        "database": {"name": "finance_db", "db_type": "mssql"},
        "schemas": [
            {
                "name": "accounting",
                "tables": [
                    {"name": "chart_of_accounts", "row_count": 420, "columns": [
                        {"name": "account_id", "data_type": "int", "is_primary_key": True, "is_nullable": False},
                        {"name": "account_code", "data_type": "varchar(20)", "is_nullable": False},
                        {"name": "account_name", "data_type": "varchar(200)", "is_nullable": False},
                        {"name": "account_type", "data_type": "varchar(50)"},
                        {"name": "parent_account_id", "data_type": "int"},
                        {"name": "is_active", "data_type": "bit"},
                    ]},
                    {"name": "journal_entries", "row_count": 1240000, "columns": [
                        {"name": "entry_id", "data_type": "bigint", "is_primary_key": True, "is_nullable": False},
                        {"name": "entry_date", "data_type": "date", "is_nullable": False},
                        {"name": "description", "data_type": "nvarchar(500)"},
                        {"name": "reference", "data_type": "varchar(100)"},
                        {"name": "posted_by", "data_type": "int"},
                        {"name": "posted_at", "data_type": "datetime2"},
                        {"name": "is_reversed", "data_type": "bit"},
                    ]},
                    {"name": "journal_lines", "row_count": 3720000, "columns": [
                        {"name": "line_id", "data_type": "bigint", "is_primary_key": True, "is_nullable": False},
                        {"name": "entry_id", "data_type": "bigint", "is_nullable": False},
                        {"name": "account_id", "data_type": "int", "is_nullable": False},
                        {"name": "debit_amount", "data_type": "decimal(18,2)"},
                        {"name": "credit_amount", "data_type": "decimal(18,2)"},
                        {"name": "currency", "data_type": "varchar(3)"},
                        {"name": "cost_center", "data_type": "varchar(20)"},
                    ]},
                    {"name": "invoices", "row_count": 380000, "columns": [
                        {"name": "invoice_id", "data_type": "bigint", "is_primary_key": True, "is_nullable": False},
                        {"name": "invoice_number", "data_type": "varchar(50)", "is_nullable": False},
                        {"name": "customer_id", "data_type": "bigint"},
                        {"name": "invoice_date", "data_type": "date"},
                        {"name": "due_date", "data_type": "date"},
                        {"name": "subtotal", "data_type": "decimal(14,2)"},
                        {"name": "tax_amount", "data_type": "decimal(12,2)"},
                        {"name": "total_amount", "data_type": "decimal(14,2)"},
                        {"name": "status", "data_type": "varchar(20)"},
                        {"name": "paid_at", "data_type": "datetime2"},
                    ]},
                    {"name": "payments", "row_count": 310000, "columns": [
                        {"name": "payment_id", "data_type": "bigint", "is_primary_key": True, "is_nullable": False},
                        {"name": "invoice_id", "data_type": "bigint"},
                        {"name": "amount", "data_type": "decimal(14,2)", "is_nullable": False},
                        {"name": "payment_method", "data_type": "varchar(50)"},
                        {"name": "reference", "data_type": "varchar(100)"},
                        {"name": "payment_date", "data_type": "date"},
                        {"name": "bank_account", "data_type": "varchar(30)"},
                    ]},
                    {"name": "budgets", "row_count": 8400, "columns": [
                        {"name": "budget_id", "data_type": "int", "is_primary_key": True, "is_nullable": False},
                        {"name": "account_id", "data_type": "int", "is_nullable": False},
                        {"name": "fiscal_year", "data_type": "int"},
                        {"name": "period", "data_type": "varchar(10)"},
                        {"name": "budgeted_amount", "data_type": "decimal(14,2)"},
                        {"name": "actual_amount", "data_type": "decimal(14,2)"},
                        {"name": "variance", "data_type": "decimal(14,2)"},
                    ]},
                    {"name": "cost_centers", "row_count": 85, "columns": [
                        {"name": "cc_id", "data_type": "int", "is_primary_key": True, "is_nullable": False},
                        {"name": "code", "data_type": "varchar(20)", "is_nullable": False},
                        {"name": "name", "data_type": "varchar(100)", "is_nullable": False},
                        {"name": "department_id", "data_type": "int"},
                        {"name": "manager_id", "data_type": "int"},
                        {"name": "is_active", "data_type": "bit"},
                    ]},
                ],
            },
            {
                "name": "reporting",
                "tables": [
                    {"name": "financial_statements", "row_count": 480, "columns": [
                        {"name": "statement_id", "data_type": "int", "is_primary_key": True, "is_nullable": False},
                        {"name": "statement_type", "data_type": "varchar(30)"},
                        {"name": "period", "data_type": "varchar(10)"},
                        {"name": "fiscal_year", "data_type": "int"},
                        {"name": "generated_at", "data_type": "datetime2"},
                        {"name": "file_url", "data_type": "nvarchar(500)"},
                    ]},
                    {"name": "kpi_metrics", "row_count": 14600, "columns": [
                        {"name": "metric_id", "data_type": "bigint", "is_primary_key": True, "is_nullable": False},
                        {"name": "metric_name", "data_type": "varchar(100)"},
                        {"name": "metric_date", "data_type": "date"},
                        {"name": "value", "data_type": "decimal(18,4)"},
                        {"name": "unit", "data_type": "varchar(20)"},
                        {"name": "target_value", "data_type": "decimal(18,4)"},
                    ]},
                    {"name": "tax_filings", "row_count": 240, "columns": [
                        {"name": "filing_id", "data_type": "int", "is_primary_key": True, "is_nullable": False},
                        {"name": "tax_type", "data_type": "varchar(50)"},
                        {"name": "jurisdiction", "data_type": "varchar(50)"},
                        {"name": "period", "data_type": "varchar(20)"},
                        {"name": "amount_due", "data_type": "decimal(14,2)"},
                        {"name": "amount_paid", "data_type": "decimal(14,2)"},
                        {"name": "due_date", "data_type": "date"},
                        {"name": "filed_at", "data_type": "datetime2"},
                        {"name": "status", "data_type": "varchar(20)"},
                    ]},
                ],
            },
        ],
    },

    # ── 6. Operations / Logistics ─────────────────────────────────────────────
    {
        "database": {"name": "operations_db", "db_type": "postgres"},
        "schemas": [
            {
                "name": "logistics",
                "tables": [
                    {"name": "delivery_routes", "row_count": 3200, "columns": [
                        {"name": "route_id", "data_type": "integer", "is_primary_key": True, "is_nullable": False},
                        {"name": "origin_city", "data_type": "varchar(100)"},
                        {"name": "destination_city", "data_type": "varchar(100)"},
                        {"name": "distance_km", "data_type": "numeric(8,2)"},
                        {"name": "avg_transit_days", "data_type": "integer"},
                        {"name": "carrier_id", "data_type": "integer"},
                        {"name": "is_active", "data_type": "boolean"},
                    ]},
                    {"name": "fleet_vehicles", "row_count": 580, "columns": [
                        {"name": "vehicle_id", "data_type": "integer", "is_primary_key": True, "is_nullable": False},
                        {"name": "registration", "data_type": "varchar(20)"},
                        {"name": "type", "data_type": "varchar(50)"},
                        {"name": "capacity_kg", "data_type": "numeric(8,2)"},
                        {"name": "depot_id", "data_type": "integer"},
                        {"name": "status", "data_type": "varchar(20)"},
                        {"name": "last_service_date", "data_type": "date"},
                    ]},
                    {"name": "deliveries", "row_count": 820000, "columns": [
                        {"name": "delivery_id", "data_type": "bigint", "is_primary_key": True, "is_nullable": False},
                        {"name": "shipment_id", "data_type": "bigint"},
                        {"name": "vehicle_id", "data_type": "integer"},
                        {"name": "route_id", "data_type": "integer"},
                        {"name": "driver_id", "data_type": "integer"},
                        {"name": "scheduled_date", "data_type": "date"},
                        {"name": "actual_date", "data_type": "date"},
                        {"name": "status", "data_type": "varchar(30)"},
                        {"name": "proof_of_delivery_url", "data_type": "text"},
                    ]},
                    {"name": "incidents", "row_count": 4200, "columns": [
                        {"name": "incident_id", "data_type": "integer", "is_primary_key": True, "is_nullable": False},
                        {"name": "delivery_id", "data_type": "bigint"},
                        {"name": "type", "data_type": "varchar(50)"},
                        {"name": "description", "data_type": "text"},
                        {"name": "severity", "data_type": "varchar(20)"},
                        {"name": "reported_at", "data_type": "timestamp"},
                        {"name": "resolved_at", "data_type": "timestamp"},
                    ]},
                    {"name": "depots", "row_count": 28, "columns": [
                        {"name": "depot_id", "data_type": "integer", "is_primary_key": True, "is_nullable": False},
                        {"name": "name", "data_type": "varchar(100)"},
                        {"name": "address", "data_type": "text"},
                        {"name": "city", "data_type": "varchar(100)"},
                        {"name": "country", "data_type": "varchar(50)"},
                        {"name": "capacity_units", "data_type": "integer"},
                        {"name": "manager_id", "data_type": "integer"},
                    ]},
                ],
            },
            {
                "name": "quality",
                "tables": [
                    {"name": "quality_checks", "row_count": 120000, "columns": [
                        {"name": "check_id", "data_type": "bigint", "is_primary_key": True, "is_nullable": False},
                        {"name": "product_id", "data_type": "bigint"},
                        {"name": "batch_number", "data_type": "varchar(50)"},
                        {"name": "inspector_id", "data_type": "integer"},
                        {"name": "check_date", "data_type": "date"},
                        {"name": "result", "data_type": "varchar(20)"},
                        {"name": "defect_count", "data_type": "integer"},
                        {"name": "notes", "data_type": "text"},
                    ]},
                    {"name": "returns", "row_count": 28000, "columns": [
                        {"name": "return_id", "data_type": "bigint", "is_primary_key": True, "is_nullable": False},
                        {"name": "order_id", "data_type": "bigint"},
                        {"name": "product_id", "data_type": "bigint"},
                        {"name": "reason", "data_type": "varchar(100)"},
                        {"name": "condition", "data_type": "varchar(30)"},
                        {"name": "refund_amount", "data_type": "numeric(10,2)"},
                        {"name": "requested_at", "data_type": "timestamp"},
                        {"name": "processed_at", "data_type": "timestamp"},
                        {"name": "status", "data_type": "varchar(20)"},
                    ]},
                    {"name": "supplier_audits", "row_count": 680, "columns": [
                        {"name": "audit_id", "data_type": "integer", "is_primary_key": True, "is_nullable": False},
                        {"name": "supplier_id", "data_type": "integer"},
                        {"name": "audit_date", "data_type": "date"},
                        {"name": "auditor_id", "data_type": "integer"},
                        {"name": "score", "data_type": "integer"},
                        {"name": "findings", "data_type": "text"},
                        {"name": "corrective_actions", "data_type": "text"},
                        {"name": "next_audit_date", "data_type": "date"},
                    ]},
                    {"name": "compliance_logs", "row_count": 45000, "columns": [
                        {"name": "log_id", "data_type": "bigint", "is_primary_key": True, "is_nullable": False},
                        {"name": "regulation", "data_type": "varchar(50)"},
                        {"name": "entity_type", "data_type": "varchar(30)"},
                        {"name": "entity_id", "data_type": "bigint"},
                        {"name": "check_result", "data_type": "varchar(20)"},
                        {"name": "details", "data_type": "text"},
                        {"name": "checked_at", "data_type": "timestamp"},
                    ]},
                ],
            },
        ],
    },
]


def main():
    print("Connecting to Data Catalog API...")
    try:
        resp = httpx.get(f"{API_URL}/health", timeout=5)
        resp.raise_for_status()
        print("API is up.\n")
    except Exception:
        print("ERROR: Cannot reach the API at", API_URL)
        print("Make sure the app is running (docker compose up).")
        return

    total_tables = 0
    for payload in DATABASES:
        db_name = payload["database"]["name"]
        print(f"Ingesting: {db_name} ...", end=" ", flush=True)
        try:
            resp = httpx.post(
                f"{API_URL}/api/v1/ingest/batch",
                headers=HEADERS,
                json=payload,
                timeout=30,
            )
            resp.raise_for_status()
            result = resp.json()
            total_tables += result["tables_upserted"]
            print(
                f"Done — {result['schemas_upserted']} schemas, "
                f"{result['tables_upserted']} tables, "
                f"{result['columns_upserted']} columns"
            )
        except Exception as e:
            print(f"FAILED: {e}")

    print(f"\nAll done! {total_tables} tables loaded across {len(DATABASES)} databases.")
    print("Open http://localhost:3001 in your browser.")


if __name__ == "__main__":
    main()
