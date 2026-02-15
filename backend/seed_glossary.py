"""Seed 10 business glossary terms via the API."""
import os
import sys
import requests

API_URL = os.environ.get("API_URL", "http://localhost:8000")
AUTH_URL = f"{API_URL}/auth/login"
GLOSSARY_URL = f"{API_URL}/api/v1/glossary"

# Login as steward
resp = requests.post(AUTH_URL, json={"email": "steward@demo.com", "password": "steward123"})
if resp.status_code != 200:
    print("Login failed:", resp.text)
    sys.exit(1)

token = resp.json()["access_token"]
headers = {"Authorization": f"Bearer {token}"}

TERMS = [
    {
        "name": "Revenue",
        "definition": "Total income generated from the sale of goods or services before any deductions. Measured as the sum of completed order amounts in the storefront.orders table, excluding cancelled and refunded orders.",
        "tags": ["finance", "kpi"],
        "status": "approved",
    },
    {
        "name": "Active User",
        "definition": "A user who has initiated at least one session (session_start event) within a given time period. DAU = distinct users per day, WAU = per week, MAU = per month. Sourced from raw.web_events and raw.mobile_events.",
        "tags": ["product", "analytics"],
        "status": "approved",
    },
    {
        "name": "Churn Rate",
        "definition": "The percentage of customers who stop purchasing over a defined period. Calculated as customers with zero orders in the last 90 days divided by total active customers at the start of the period. Feature stored in ml_features.customer_features.churn_score.",
        "tags": ["product", "ml"],
        "status": "approved",
    },
    {
        "name": "Lifetime Value (LTV)",
        "definition": "The predicted total revenue a customer will generate over their entire relationship with the company. Computed by the ML feature pipeline and stored in ml_features.customer_features.ltv_prediction. Also available as a historical aggregate in marts.dim_customers.lifetime_value.",
        "tags": ["finance", "ml"],
        "status": "approved",
    },
    {
        "name": "Gross Margin",
        "definition": "Revenue minus Cost of Goods Sold (COGS), expressed as a percentage of revenue. Sourced from accounting.journal_entries where account_type is 'revenue' or 'cogs'. Target: > 60%.",
        "tags": ["finance", "kpi"],
        "status": "approved",
    },
    {
        "name": "SLA Compliance",
        "definition": "The percentage of support tickets resolved within the time limit defined by the applicable SLA policy. Measured by comparing support.tickets.resolved_at against the SLA due time derived from support.sla_policies. Target: > 95% for P1, > 90% for P2.",
        "tags": ["operations", "support"],
        "status": "approved",
    },
    {
        "name": "Conversion Rate",
        "definition": "The ratio of users who complete a desired action (e.g., purchase) to the total number of users who entered the funnel (e.g., landing page view). Measured via the acquisition funnel query using raw.web_events.",
        "tags": ["product", "analytics"],
        "status": "approved",
    },
    {
        "name": "Net Promoter Score (NPS)",
        "definition": "A customer loyalty metric based on the question 'How likely are you to recommend us?' Scores 9-10 = Promoters, 7-8 = Passives, 0-6 = Detractors. NPS = %Promoters - %Detractors. Collected via support.csat_responses.",
        "tags": ["product", "support"],
        "status": "draft",
    },
    {
        "name": "Data Freshness",
        "definition": "The time elapsed since the most recent record was loaded into a dataset. Measured by comparing the max timestamp in the target table against the current wall clock. Freshness SLAs are defined per dataset in the data quality framework.",
        "tags": ["data-quality", "operations"],
        "status": "approved",
    },
    {
        "name": "PII (Personally Identifiable Information)",
        "definition": "Any data that can be used to identify an individual, including name, email, phone number, date of birth, and government IDs. PII fields are classified as 'confidential' or 'restricted' in the data governance framework and require masking for non-steward roles.",
        "tags": ["governance", "security"],
        "status": "approved",
    },
]


def run():
    created = 0
    for term in TERMS:
        payload = {
            "name": term["name"],
            "definition": term["definition"],
            "tags": term["tags"],
            "status": term["status"],
        }
        r = requests.post(GLOSSARY_URL, json=payload, headers=headers)
        if r.status_code == 201:
            print(f"  Created: {term['name']}")
            created += 1
        else:
            print(f"  FAILED: {term['name']}: {r.status_code} {r.text}")

    print(f"\nDone — {created} glossary terms created.")


run()
