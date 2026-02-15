"""Seed 10 sample articles via the API."""
import os
import sys
import requests

API_URL = os.environ.get("API_URL", "http://localhost:8000")
AUTH_URL = f"{API_URL}/auth/login"
ARTICLES_URL = f"{API_URL}/api/v1/articles"

# Login as steward
resp = requests.post(AUTH_URL, json={"email": "steward@demo.com", "password": "steward123"})
if resp.status_code != 200:
    print("Login failed:", resp.text)
    sys.exit(1)

token = resp.json()["access_token"]
headers = {"Authorization": f"Bearer {token}"}

ARTICLES = [
    {
        "title": "Data Ingestion Pipeline — ecommerce_db",
        "description": "Overview of the end-to-end ingestion pipeline for the ecommerce database, including schedule, failure handling, and monitoring.",
        "sme_name": "Alice Johnson",
        "sme_email": "alice@company.com",
        "tags": ["ingestion", "ecommerce", "pipeline"],
        "body": """<h3>Overview</h3>
<p>The ecommerce_db ingestion pipeline runs every 15 minutes via Airflow and pulls incremental data from the transactional PostgreSQL instance into the analytics warehouse. The pipeline covers the <code>storefront</code>, <code>inventory</code>, and <code>payments</code> schemas.</p>

<h3>Pipeline Stages</h3>
<ul>
  <li><strong>Extract:</strong> CDC via Debezium reads binlog events and publishes to Kafka topics.</li>
  <li><strong>Transform:</strong> Spark Structured Streaming deduplicates, casts types, and applies schema evolution rules.</li>
  <li><strong>Load:</strong> Delta Lake MERGE INTO handles upserts on the warehouse side.</li>
</ul>

<h3>Failure Handling</h3>
<p>Each stage emits metrics to Prometheus. If lag exceeds 30 minutes, PagerDuty fires a P2 alert. Stale data is tracked via the <code>pipeline_health</code> dashboard in Grafana.</p>

<h3>Runbook</h3>
<p>If the pipeline is stuck, check the Airflow DAG <em>ecommerce_cdc_pipeline</em> first. Common causes include Kafka consumer lag and schema mismatches after a DDL change in production.</p>""",
    },
    {
        "title": "Monthly Revenue Reporting Process",
        "description": "Step-by-step guide for producing the monthly revenue report, including data validation, sign-off, and distribution.",
        "sme_name": "Alice Johnson",
        "sme_email": "alice@company.com",
        "tags": ["finance", "reporting", "revenue"],
        "body": """<h3>Purpose</h3>
<p>This document describes the monthly close process for the Revenue report delivered to Finance leadership on the 3rd business day of each month.</p>

<h3>Data Sources</h3>
<ul>
  <li><code>ecommerce_db.storefront.orders</code> — primary order records</li>
  <li><code>finance_db.accounting.journal_entries</code> — reconciled revenue entries</li>
  <li><code>crm_database.sales.deals</code> — enterprise deal bookings</li>
</ul>

<h3>Process Steps</h3>
<ol>
  <li>Run the <em>Monthly Revenue Summary</em> query in the Query Library and export to CSV.</li>
  <li>Reconcile against the GL entries in finance_db — variance must be &lt; 0.1%.</li>
  <li>Submit for Controller sign-off via the Finance approval workflow in Jira.</li>
  <li>Distribute the approved report to the exec mailing list.</li>
</ol>

<h3>Known Caveats</h3>
<p>Refunds booked after the 25th of the month are deferred to the following period due to system cutoff rules. This creates a small timing difference vs. the bank statement.</p>""",
    },
    {
        "title": "Customer 360 Data Model",
        "description": "Architecture and entity relationships of the Customer 360 model, covering CRM, ecommerce, and support data.",
        "sme_name": "Emma Wilson",
        "sme_email": "emma@company.com",
        "tags": ["data-model", "customer", "crm"],
        "body": """<h3>Overview</h3>
<p>The Customer 360 model unifies customer identities across three source systems: the ecommerce storefront, the CRM platform, and the support desk. The canonical entity is <code>dim_customers</code> in the analytics warehouse.</p>

<h3>Identity Resolution</h3>
<p>Matching is performed deterministically on email and then probabilistically on name + phone using a Jaro-Winkler similarity threshold of 0.92. Conflicts are routed to a manual review queue.</p>

<h3>Key Tables</h3>
<ul>
  <li><code>ecommerce_db.storefront.customers</code> — transactional identity</li>
  <li><code>crm_database.sales.contacts</code> — sales-qualified leads and accounts</li>
  <li><code>analytics_warehouse.marts.dim_customers</code> — golden record</li>
</ul>

<h3>Refresh Cadence</h3>
<p>The model is rebuilt nightly at 02:00 UTC via the <em>customer_360_rebuild</em> dbt job. Incremental updates from the CRM are applied hourly.</p>

<h3>Governance</h3>
<p>PII fields (name, email, phone) are masked for non-steward roles using row-level security in the warehouse. Access requests require approval from the Data Privacy team.</p>""",
    },
    {
        "title": "HR Payroll Processing Workflow",
        "description": "End-to-end description of the bi-weekly payroll run, from timesheet approval to payslip generation.",
        "sme_name": "Carol Davis",
        "sme_email": "carol@company.com",
        "tags": ["hr", "payroll", "workflow"],
        "body": """<h3>Schedule</h3>
<p>Payroll runs bi-weekly, processing on Thursday for payment on the following Friday. The cutoff for timesheet submissions is Wednesday at 17:00 local time.</p>

<h3>Data Flow</h3>
<ul>
  <li>Timesheets are submitted in Workday and synced to <code>hr_database.payroll.timesheets</code> via the Workday API connector.</li>
  <li>The payroll engine reads approved timesheets, applies salary rates from <code>payroll.salaries</code>, and calculates gross pay, tax withholdings, and deductions.</li>
  <li>Payslips are written to <code>payroll.payslips</code> and distributed via encrypted email.</li>
</ul>

<h3>Exception Handling</h3>
<p>If an employee's timesheet is missing at cutoff, payroll is processed based on their standard contracted hours. A correction can be submitted in the next cycle.</p>

<h3>Audit Trail</h3>
<p>All payroll runs are logged in <code>payroll.run_log</code> with a checksum of input records. Any post-run amendments require sign-off from the CFO and are tracked as journal entries in finance_db.</p>""",
    },
    {
        "title": "CRM-to-Warehouse Sync Process",
        "description": "Technical documentation for the nightly sync from the CRM platform to the analytics warehouse.",
        "sme_name": "Frank Miller",
        "sme_email": "frank@company.com",
        "tags": ["crm", "sync", "warehouse"],
        "body": """<h3>Overview</h3>
<p>The CRM sync extracts contacts, accounts, deals, and activities from the CRM platform and loads them into the <code>crm_database</code> schema in the analytics warehouse. The sync runs nightly at 01:00 UTC.</p>

<h3>Extraction Method</h3>
<p>We use the CRM's REST API with incremental extraction based on the <code>updated_at</code> timestamp. The connector is managed via Fivetran with a 1-hour lookback window to handle delayed webhooks.</p>

<h3>Target Tables</h3>
<ul>
  <li><code>crm_database.sales.contacts</code></li>
  <li><code>crm_database.sales.accounts</code></li>
  <li><code>crm_database.sales.deals</code></li>
  <li><code>crm_database.support.tickets</code></li>
</ul>

<h3>Data Quality Checks</h3>
<p>After each sync, dbt tests verify: no duplicate contact IDs, all deal amounts are non-negative, and the row count delta is within 10% of the 7-day average. Failures block the downstream Customer 360 rebuild.</p>""",
    },
    {
        "title": "ML Feature Pipeline Documentation",
        "description": "Architecture of the machine learning feature pipeline, from raw events to the feature store.",
        "sme_name": "Emma Wilson",
        "sme_email": "emma@company.com",
        "tags": ["ml", "features", "pipeline"],
        "body": """<h3>Overview</h3>
<p>The ML feature pipeline transforms raw behavioral events and transactional records into a curated feature store consumed by recommendation and churn prediction models.</p>

<h3>Feature Groups</h3>
<ul>
  <li><strong>Customer Behavior:</strong> Session frequency, recency, average session duration (from <code>raw.events</code>)</li>
  <li><strong>Purchase History:</strong> LTV, category affinity, return rate (from <code>storefront.orders</code>)</li>
  <li><strong>Engagement:</strong> Email open rate, support ticket count (from CRM)</li>
</ul>

<h3>Pipeline Architecture</h3>
<p>Features are computed using Apache Spark jobs orchestrated by Airflow. Point-in-time correct feature retrieval is handled by Feast, which serves features to both batch scoring and real-time inference endpoints.</p>

<h3>Training vs. Serving</h3>
<p>Batch features are recomputed nightly. Online features (e.g., last-session recency) are updated in Redis every 5 minutes via a streaming job. The feature registry in <code>analytics_warehouse.marts.customer_features</code> serves as the source of truth for model training.</p>""",
    },
    {
        "title": "Finance Month-End Close Checklist",
        "description": "Checklist for the finance team's month-end close process, including journal entries, reconciliations, and report sign-offs.",
        "sme_name": "Henry Brown",
        "sme_email": "henry@company.com",
        "tags": ["finance", "close", "checklist"],
        "body": """<h3>Overview</h3>
<p>This checklist governs the month-end close process and must be completed by the 3rd business day of the following month.</p>

<h3>Pre-Close (Last 3 Business Days of Month)</h3>
<ul>
  <li>Confirm all invoices issued during the month are posted in <code>accounting.invoices</code>.</li>
  <li>Run the Accounts Receivable Aging query and escalate any 90+ day items to the AR manager.</li>
  <li>Validate that all inter-company transfers have matching journal entries on both sides.</li>
</ul>

<h3>Close Day</h3>
<ul>
  <li>Post final accruals and prepayments in the GL system (syncs to <code>accounting.journal_entries</code>).</li>
  <li>Run the Monthly P&amp;L Summary query and compare to the prior month for anomalies &gt; 15%.</li>
  <li>Lock the accounting period in the ERP to prevent backdated postings.</li>
</ul>

<h3>Post-Close Reporting</h3>
<p>Distribute the approved P&amp;L, Balance Sheet, and Cash Flow statements to the CFO and Board reporting package no later than 10:00 on business day 3.</p>""",
    },
    {
        "title": "Data Quality Check Framework",
        "description": "Description of the data quality framework used across all warehouse datasets, including check types, thresholds, and alerting.",
        "sme_name": "Alice Johnson",
        "sme_email": "alice@company.com",
        "tags": ["data-quality", "dbt", "monitoring"],
        "body": """<h3>Overview</h3>
<p>All datasets in the analytics warehouse are subject to automated data quality checks run after each ingestion or transformation job. Checks are implemented as dbt tests and custom SQL assertions.</p>

<h3>Check Categories</h3>
<ul>
  <li><strong>Freshness:</strong> Ensures source tables have been updated within their expected SLA window.</li>
  <li><strong>Completeness:</strong> Null rate on critical fields must not exceed configured thresholds.</li>
  <li><strong>Uniqueness:</strong> Primary key uniqueness on all dimension and fact tables.</li>
  <li><strong>Referential Integrity:</strong> All foreign keys resolve to valid parent records.</li>
  <li><strong>Distribution:</strong> Statistical checks flag anomalous row count deltas or value distribution shifts.</li>
</ul>

<h3>Alerting</h3>
<p>Failed checks are published to the <code>#data-quality-alerts</code> Slack channel and logged in <code>analytics_warehouse.monitoring.dq_results</code>. Critical failures block downstream pipeline steps.</p>

<h3>Ownership</h3>
<p>Each dataset has an assigned steward responsible for triaging failures within 4 business hours. The DQ dashboard is available in Metabase for all users.</p>""",
    },
    {
        "title": "Incident Response — Data Outages",
        "description": "Runbook for responding to data pipeline outages, including triage steps, escalation paths, and post-mortem requirements.",
        "sme_name": "Iris Chen",
        "sme_email": "iris@company.com",
        "tags": ["incident", "runbook", "ops"],
        "body": """<h3>Severity Classification</h3>
<ul>
  <li><strong>P1:</strong> Production dashboards are stale by more than 2 hours or data is incorrect in a live customer-facing feature.</li>
  <li><strong>P2:</strong> Internal analytics data delayed by 2-6 hours; no customer impact.</li>
  <li><strong>P3:</strong> Minor data delay or non-critical dataset failure; workaround available.</li>
</ul>

<h3>Initial Triage (First 15 Minutes)</h3>
<ol>
  <li>Check the Airflow DAG status for the affected pipeline.</li>
  <li>Inspect the <code>pipeline_health</code> Grafana dashboard for lag and error spikes.</li>
  <li>Review the last 50 lines of the failing task's log for the root cause.</li>
  <li>Check the data quality results table for upstream failures that may be cascading.</li>
</ol>

<h3>Escalation</h3>
<p>P1 incidents require immediate Slack notification to <code>#data-incidents</code> and paging the on-call data engineer via PagerDuty. P2 incidents require notification within 30 minutes.</p>

<h3>Post-Mortem</h3>
<p>All P1 and P2 incidents require a post-mortem document submitted to Confluence within 5 business days. The post-mortem must include root cause, timeline, impact assessment, and action items with owners and due dates.</p>""",
    },
    {
        "title": "Onboarding Guide for New Data Analysts",
        "description": "Getting-started guide for new data analysts joining the team, covering tool access, key datasets, and best practices.",
        "sme_name": "David Lee",
        "sme_email": "david@company.com",
        "tags": ["onboarding", "analyst", "guide"],
        "body": """<h3>Welcome</h3>
<p>Welcome to the Data team! This guide will help you get set up with the tools and datasets you'll use every day. If you get stuck, ping <strong>#data-help</strong> on Slack.</p>

<h3>Access Checklist</h3>
<ul>
  <li>Request warehouse read access via the IT portal (approval takes 1 business day).</li>
  <li>Get added to the <em>Analysts</em> group in Metabase for pre-built dashboards.</li>
  <li>Request GitHub access to the <code>data-platform</code> repo for dbt models.</li>
  <li>Join <code>#data-team</code>, <code>#data-help</code>, and <code>#data-quality-alerts</code> on Slack.</li>
</ul>

<h3>Key Datasets to Know</h3>
<ul>
  <li><code>analytics_warehouse.marts.*</code> — curated, analyst-ready fact and dimension tables. Start here.</li>
  <li><code>analytics_warehouse.raw.*</code> — raw event streams. Use with caution; always filter by date.</li>
  <li><code>ecommerce_db.storefront.*</code> — live transactional data. Do not run heavy queries during peak hours (09:00-18:00 UTC).</li>
</ul>

<h3>Best Practices</h3>
<p>Always use the Query Library for common metrics to ensure consistency. Add a <code>LIMIT</code> clause when exploring large tables. Document your ad-hoc queries and consider promoting reusable ones to the Query Library.</p>""",
    },
]


def run():
    created = 0
    for article in ARTICLES:
        payload = {
            "title": article["title"],
            "description": article["description"],
            "sme_name": article["sme_name"],
            "sme_email": article["sme_email"],
            "body": article["body"],
            "tags": article["tags"],
        }
        r = requests.post(ARTICLES_URL, json=payload, headers=headers)
        if r.status_code == 201:
            print(f"  Created: {article['title']}")
            created += 1
        else:
            print(f"  FAILED: {article['title']}: {r.status_code} {r.text}")

    print(f"\nDone — {created} articles created.")


run()
