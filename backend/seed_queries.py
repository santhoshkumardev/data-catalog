"""Seed 15 sample SQL queries across all 6 databases."""
import os
import sys
import requests

API_URL = os.environ.get("API_URL", "http://localhost:8000")
AUTH_URL = f"{API_URL}/auth/login"
QUERIES_URL = f"{API_URL}/api/v1/queries"
DATABASES_URL = f"{API_URL}/api/v1/databases"

# Login as steward
resp = requests.post(AUTH_URL, json={"email": "steward@demo.com", "password": "steward123"})
if resp.status_code != 200:
    print("Login failed:", resp.text)
    sys.exit(1)

token = resp.json()["access_token"]
headers = {"Authorization": f"Bearer {token}"}

# Fetch databases to get their IDs
dbs_resp = requests.get(f"{DATABASES_URL}?size=50", headers=headers)
dbs = {d["name"]: d["id"] for d in dbs_resp.json()["items"]}
print("Found databases:", list(dbs.keys()))

QUERIES = [
    {
        "name": "Monthly Revenue Summary",
        "description": "<p>Aggregates gross revenue, number of orders, and average order value by calendar month. Used by the Finance team for monthly reporting dashboards.</p>",
        "database": "ecommerce_db",
        "sme_name": "Alice Johnson",
        "sme_email": "alice@company.com",
        "sql_text": """\
SELECT
    DATE_TRUNC('month', o.created_at)  AS month,
    COUNT(o.id)                        AS total_orders,
    SUM(o.total_amount)                AS gross_revenue,
    ROUND(AVG(o.total_amount), 2)      AS avg_order_value
FROM storefront.orders o
WHERE o.status NOT IN ('cancelled', 'refunded')
GROUP BY 1
ORDER BY 1 DESC;""",
    },
    {
        "name": "Top 10 Customers by Lifetime Value",
        "description": "<p>Ranks customers by total spend. Useful for identifying VIP accounts eligible for loyalty programs.</p>",
        "database": "ecommerce_db",
        "sme_name": "Alice Johnson",
        "sme_email": "alice@company.com",
        "sql_text": """\
SELECT
    c.id,
    c.first_name || ' ' || c.last_name AS customer_name,
    c.email,
    COUNT(o.id)          AS order_count,
    SUM(o.total_amount)  AS lifetime_value
FROM storefront.customers c
JOIN storefront.orders o ON o.customer_id = c.id
WHERE o.status = 'completed'
GROUP BY c.id, c.first_name, c.last_name, c.email
ORDER BY lifetime_value DESC
LIMIT 10;""",
    },
    {
        "name": "Low Stock Alert",
        "description": "<p>Returns all SKUs where current inventory is below the reorder threshold. Run daily and alert the procurement team.</p>",
        "database": "ecommerce_db",
        "sme_name": "Bob Smith",
        "sme_email": "bob@company.com",
        "sql_text": """\
SELECT
    p.sku,
    p.name             AS product_name,
    i.quantity_on_hand,
    i.reorder_level,
    i.quantity_on_hand - i.reorder_level AS shortage
FROM inventory.products p
JOIN inventory.stock_levels i ON i.product_id = p.id
WHERE i.quantity_on_hand <= i.reorder_level
ORDER BY shortage ASC;""",
    },
    {
        "name": "Product Category Sales Breakdown",
        "description": "<p>Shows revenue share by product category for the current fiscal year. Used in quarterly business reviews.</p>",
        "database": "ecommerce_db",
        "sme_name": "Alice Johnson",
        "sme_email": "alice@company.com",
        "sql_text": """\
SELECT
    p.category,
    COUNT(DISTINCT o.id)             AS orders,
    SUM(oi.quantity)                 AS units_sold,
    SUM(oi.quantity * oi.unit_price) AS revenue,
    ROUND(
        SUM(oi.quantity * oi.unit_price) * 100.0
        / SUM(SUM(oi.quantity * oi.unit_price)) OVER (), 2
    ) AS revenue_pct
FROM storefront.order_items oi
JOIN storefront.orders o      ON o.id = oi.order_id
JOIN inventory.products p     ON p.id = oi.product_id
WHERE DATE_PART('year', o.created_at) = DATE_PART('year', CURRENT_DATE)
  AND o.status = 'completed'
GROUP BY p.category
ORDER BY revenue DESC;""",
    },
    {
        "name": "Headcount by Department",
        "description": "<p>Current active headcount grouped by department and employment type. Refreshed weekly for HR reporting.</p>",
        "database": "hr_database",
        "sme_name": "Carol Davis",
        "sme_email": "carol@company.com",
        "sql_text": """\
SELECT
    d.name            AS department,
    e.employment_type,
    COUNT(e.id)       AS headcount
FROM hr.employees e
JOIN hr.departments d ON d.id = e.department_id
WHERE e.status = 'active'
GROUP BY d.name, e.employment_type
ORDER BY d.name, e.employment_type;""",
    },
    {
        "name": "Average Salary by Department and Level",
        "description": "<p>Salary benchmarking query. Used by HR during annual compensation reviews. Restricted to stewards only.</p>",
        "database": "hr_database",
        "sme_name": "Carol Davis",
        "sme_email": "carol@company.com",
        "sql_text": """\
SELECT
    d.name         AS department,
    e.job_level,
    COUNT(e.id)    AS employee_count,
    ROUND(AVG(s.base_salary), 0)  AS avg_base_salary,
    MIN(s.base_salary)            AS min_salary,
    MAX(s.base_salary)            AS max_salary
FROM hr.employees e
JOIN hr.departments d   ON d.id = e.department_id
JOIN payroll.salaries s ON s.employee_id = e.id
WHERE e.status = 'active'
  AND s.effective_date = (
        SELECT MAX(s2.effective_date)
        FROM payroll.salaries s2
        WHERE s2.employee_id = e.id
      )
GROUP BY d.name, e.job_level
ORDER BY d.name, e.job_level;""",
    },
    {
        "name": "New Hires Last 90 Days",
        "description": "<p>Lists employees hired in the last 90 days along with their department and manager. Used in onboarding tracking reports.</p>",
        "database": "hr_database",
        "sme_name": "Carol Davis",
        "sme_email": "carol@company.com",
        "sql_text": """\
SELECT
    e.employee_number,
    e.first_name || ' ' || e.last_name  AS full_name,
    e.email,
    d.name                              AS department,
    m.first_name || ' ' || m.last_name  AS manager,
    e.hire_date
FROM hr.employees e
JOIN hr.departments d          ON d.id = e.department_id
LEFT JOIN hr.employees m       ON m.id = e.manager_id
WHERE e.hire_date >= CURRENT_DATE - INTERVAL '90 days'
ORDER BY e.hire_date DESC;""",
    },
    {
        "name": "Daily Active Users (7-Day Rolling)",
        "description": "<p>Computes DAU over the last 7 days from the event stream. Feeds into the product analytics dashboard.</p>",
        "database": "analytics_warehouse",
        "sme_name": "David Lee",
        "sme_email": "david@company.com",
        "sql_text": """\
SELECT
    event_date,
    COUNT(DISTINCT user_id) AS dau
FROM raw.events
WHERE event_date >= CURRENT_DATE - INTERVAL '7 days'
  AND event_type = 'session_start'
GROUP BY event_date
ORDER BY event_date DESC;""",
    },
    {
        "name": "Acquisition Funnel Conversion Rates",
        "description": "<p>Measures drop-off at each step of the sign-up funnel: landing - signup - onboarding - first purchase.</p>",
        "database": "analytics_warehouse",
        "sme_name": "David Lee",
        "sme_email": "david@company.com",
        "sql_text": """\
WITH funnel AS (
    SELECT
        user_id,
        MAX(CASE WHEN event_type = 'landing_view'    THEN 1 ELSE 0 END) AS step1,
        MAX(CASE WHEN event_type = 'signup_complete' THEN 1 ELSE 0 END) AS step2,
        MAX(CASE WHEN event_type = 'onboarding_done' THEN 1 ELSE 0 END) AS step3,
        MAX(CASE WHEN event_type = 'first_purchase'  THEN 1 ELSE 0 END) AS step4
    FROM raw.events
    WHERE event_date >= CURRENT_DATE - INTERVAL '30 days'
    GROUP BY user_id
)
SELECT
    SUM(step1)  AS landing_views,
    SUM(step2)  AS signups,
    SUM(step3)  AS onboarded,
    SUM(step4)  AS converted,
    ROUND(SUM(step2) * 100.0 / NULLIF(SUM(step1), 0), 2) AS signup_rate_pct,
    ROUND(SUM(step4) * 100.0 / NULLIF(SUM(step2), 0), 2) AS purchase_rate_pct
FROM funnel;""",
    },
    {
        "name": "Customer Lifetime Value by Cohort",
        "description": "<p>Groups customers by acquisition month and tracks their cumulative revenue over time. Used for cohort-based LTV modelling.</p>",
        "database": "analytics_warehouse",
        "sme_name": "Emma Wilson",
        "sme_email": "emma@company.com",
        "sql_text": """\
SELECT
    cohort_month,
    months_since_acquisition,
    COUNT(DISTINCT user_id)  AS cohort_size,
    SUM(revenue)             AS cumulative_revenue,
    ROUND(SUM(revenue) / NULLIF(COUNT(DISTINCT user_id), 0), 2) AS ltv_per_user
FROM marts.customer_ltv
GROUP BY cohort_month, months_since_acquisition
ORDER BY cohort_month, months_since_acquisition;""",
    },
    {
        "name": "Open Pipeline by Sales Rep",
        "description": "<p>Shows each rep's open deals, total pipeline value, and weighted forecast. Refreshed daily for the sales leadership review.</p>",
        "database": "crm_database",
        "sme_name": "Frank Miller",
        "sme_email": "frank@company.com",
        "sql_text": """\
SELECT
    u.full_name                            AS sales_rep,
    COUNT(d.id)                            AS open_deals,
    SUM(d.deal_value)                      AS total_pipeline,
    SUM(d.deal_value * d.probability / 100) AS weighted_forecast,
    AVG(d.probability)                     AS avg_probability
FROM sales.deals d
JOIN sales.users u ON u.id = d.owner_id
WHERE d.stage NOT IN ('closed_won', 'closed_lost')
GROUP BY u.full_name
ORDER BY total_pipeline DESC;""",
    },
    {
        "name": "Support Ticket SLA Compliance",
        "description": "<p>Calculates the percentage of support tickets resolved within SLA by priority tier. Used in weekly support ops review.</p>",
        "database": "crm_database",
        "sme_name": "Grace Kim",
        "sme_email": "grace@company.com",
        "sql_text": """\
SELECT
    t.priority,
    COUNT(t.id)                            AS total_tickets,
    SUM(CASE WHEN t.resolved_at <= t.sla_due_at THEN 1 ELSE 0 END) AS within_sla,
    ROUND(
        SUM(CASE WHEN t.resolved_at <= t.sla_due_at THEN 1 ELSE 0 END) * 100.0
        / COUNT(t.id), 2
    ) AS sla_compliance_pct,
    ROUND(AVG(
        EXTRACT(EPOCH FROM (t.resolved_at - t.created_at)) / 3600
    ), 1) AS avg_resolution_hours
FROM support.tickets t
WHERE t.resolved_at IS NOT NULL
  AND t.created_at >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY t.priority
ORDER BY t.priority;""",
    },
    {
        "name": "Monthly P&L Summary",
        "description": "<p>High-level Profit and Loss statement by month: total revenue, COGS, gross profit, operating expenses, and EBITDA.</p>",
        "database": "finance_db",
        "sme_name": "Henry Brown",
        "sme_email": "henry@company.com",
        "sql_text": """\
SELECT
    DATE_TRUNC('month', je.posting_date)          AS period,
    SUM(CASE WHEN ac.account_type = 'revenue'
             THEN je.amount ELSE 0 END)            AS revenue,
    SUM(CASE WHEN ac.account_type = 'cogs'
             THEN je.amount ELSE 0 END)            AS cogs,
    SUM(CASE WHEN ac.account_type = 'revenue'
             THEN je.amount ELSE 0 END)
    - SUM(CASE WHEN ac.account_type = 'cogs'
               THEN je.amount ELSE 0 END)          AS gross_profit,
    SUM(CASE WHEN ac.account_type = 'opex'
             THEN je.amount ELSE 0 END)            AS operating_expenses
FROM accounting.journal_entries je
JOIN accounting.accounts ac ON ac.id = je.account_id
WHERE je.posting_date >= DATE_TRUNC('year', CURRENT_DATE)
GROUP BY 1
ORDER BY 1;""",
    },
    {
        "name": "Accounts Receivable Aging",
        "description": "<p>Buckets outstanding invoices into aging bands (0-30, 31-60, 61-90, 90+ days). Used by AR team for collections prioritisation.</p>",
        "database": "finance_db",
        "sme_name": "Henry Brown",
        "sme_email": "henry@company.com",
        "sql_text": """\
SELECT
    i.customer_name,
    COUNT(i.id)  AS open_invoices,
    SUM(CASE WHEN age_days BETWEEN 0  AND 30  THEN i.outstanding_amount ELSE 0 END) AS "0-30_days",
    SUM(CASE WHEN age_days BETWEEN 31 AND 60  THEN i.outstanding_amount ELSE 0 END) AS "31-60_days",
    SUM(CASE WHEN age_days BETWEEN 61 AND 90  THEN i.outstanding_amount ELSE 0 END) AS "61-90_days",
    SUM(CASE WHEN age_days > 90              THEN i.outstanding_amount ELSE 0 END) AS "90plus_days",
    SUM(i.outstanding_amount)                                                       AS total_outstanding
FROM (
    SELECT *,
        CURRENT_DATE - due_date AS age_days
    FROM accounting.invoices
    WHERE status IN ('open', 'overdue')
) i
GROUP BY i.customer_name
ORDER BY total_outstanding DESC;""",
    },
    {
        "name": "Logistics Fulfillment SLA",
        "description": "<p>Measures on-time delivery rate per shipping carrier and region. Triggers alerts when carrier SLA drops below 95%.</p>",
        "database": "operations_db",
        "sme_name": "Iris Chen",
        "sme_email": "iris@company.com",
        "sql_text": """\
SELECT
    s.carrier,
    s.destination_region,
    COUNT(s.id)                          AS total_shipments,
    SUM(CASE WHEN s.delivered_at <= s.promised_delivery_date
             THEN 1 ELSE 0 END)          AS on_time,
    ROUND(
        SUM(CASE WHEN s.delivered_at <= s.promised_delivery_date
                 THEN 1 ELSE 0 END) * 100.0 / COUNT(s.id), 2
    )                                    AS on_time_pct,
    ROUND(AVG(
        s.delivered_at - s.shipped_at
    ), 1)                                AS avg_transit_days
FROM logistics.shipments s
WHERE s.delivered_at IS NOT NULL
  AND s.shipped_at >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY s.carrier, s.destination_region
ORDER BY on_time_pct ASC;""",
    },
]


def run():
    created = 0
    for q in QUERIES:
        db_id = dbs.get(q["database"])
        if not db_id:
            print(f"  WARNING: database '{q['database']}' not found, skipping '{q['name']}'")
            continue

        payload = {
            "name": q["name"],
            "description": q["description"],
            "connection_id": db_id,
            "sme_name": q["sme_name"],
            "sme_email": q["sme_email"],
            "sql_text": q["sql_text"],
        }
        r = requests.post(QUERIES_URL, json=payload, headers=headers)
        if r.status_code == 201:
            print(f"  Created: {q['name']} [{q['database']}]")
            created += 1
        else:
            print(f"  FAILED: {q['name']}: {r.status_code} {r.text}")

    print(f"\nDone — {created} queries created.")


run()
