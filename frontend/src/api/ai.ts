export interface AiResponse {
  answer: string;
  confidence: "high" | "medium" | "low";
  suggested_queries: string[];
}

function mockAskAI(question: string): AiResponse {
  const lower = question.toLowerCase();

  if (/order|revenue/.test(lower)) {
    return {
      answer:
        "Several tables in this catalog contain order and revenue data:\n\n- orders — core transactional table with order headers\n- order_items — line-level detail for each order\n- fct_orders — fact table in the analytics warehouse (grain: one row per order)\n- agg_daily_revenue — pre-aggregated daily revenue rolled up from fct_orders\n\nStart with fct_orders for most analytics use-cases; use orders/order_items for operational queries.",
      confidence: "high",
      suggested_queries: ["orders", "fct_orders", "revenue"],
    };
  }

  if (/customer/.test(lower)) {
    return {
      answer:
        "Customer data is spread across three systems:\n\n- ecommerce_db.customers — primary customer master with email, address, created_at\n- crm_database.contacts — CRM contacts, often linked via email\n- crm_database.accounts — company-level accounts (B2B)\n- dim_customers — conformed dimension in the data warehouse, joining all of the above\n\nUse dim_customers for reporting to avoid fan-out joins.",
      confidence: "high",
      suggested_queries: ["customers", "dim_customers", "contacts"],
    };
  }

  if (/lineage|upstream|downstream|source|pipeline/.test(lower)) {
    return {
      answer:
        "The lineage for fct_orders traces back through several hops:\n\n  orders (source)\n    -> order_items (enriched with SKU details)\n      -> shipments (fulfilment events)\n        -> deliveries (last-mile tracking)\n          -> fct_orders (warehouse fact table)\n\nAll transformations are managed by dbt. You can explore the full lineage graph on the Table detail page by clicking the 'Lineage' tab.",
      confidence: "high",
      suggested_queries: ["fct_orders", "shipments", "deliveries"],
    };
  }

  if (/finance|invoice|payment|budget/.test(lower)) {
    return {
      answer:
        "Finance-related tables in this catalog:\n\n- invoices — accounts-receivable invoice records\n- journal_entries — general ledger entries (debit/credit)\n- financial_statements — monthly P&L and balance sheet snapshots\n- kpi_metrics — pre-computed finance KPIs (MRR, ARR, churn)\n- budgets — annual budget targets by cost-centre\n\nAll five live in the finance_db schema.",
      confidence: "high",
      suggested_queries: ["invoices", "journal_entries", "budgets"],
    };
  }

  if (/\bml\b|model|predict|recommendation/.test(lower)) {
    return {
      answer:
        "The ML pipeline reads from the following catalog tables:\n\n  customer_features (feature store snapshot)\n    -> model_predictions (batch inference results, refreshed nightly)\n      -> product_recommendations (final scored recommendations served to the app)\n\nFeature engineering is defined in the ml_platform schema. model_predictions stores model version, score, and inference timestamp for auditability.",
      confidence: "medium",
      suggested_queries: ["customer_features", "model_predictions", "product_recommendations"],
    };
  }

  if (/schema|database|how many|count/.test(lower)) {
    return {
      answer:
        "You can see live counts in the stats cards at the top of this page.\n\nThis catalog currently indexes 6 source databases:\n  1. ecommerce_db\n  2. crm_database\n  3. analytics_warehouse\n  4. finance_db\n  5. hr_database\n  6. operations_db\n\nEach database contains one or more schemas. Use the Databases page (sidebar) to browse the full hierarchy.",
      confidence: "high",
      suggested_queries: ["ecommerce_db", "analytics_warehouse", "schema"],
    };
  }

  if (/employee|hr|payroll/.test(lower)) {
    return {
      answer:
        "HR and people-data tables in this catalog:\n\n- employees — master employee roster (name, department, start date, status)\n- payslips — monthly payroll records per employee\n- job_postings — open and closed requisitions from the ATS\n- candidates — applicant tracking data\n- interviews — interview rounds linked to candidates and job_postings\n\nAll tables reside in the hr_database. Access is restricted to HR role.",
      confidence: "high",
      suggested_queries: ["employees", "payslips", "job_postings"],
    };
  }

  if (/glossary|term|definition/.test(lower)) {
    return {
      answer:
        "The Business Glossary contains standard definitions for key business metrics and concepts:\n\n- Revenue, Gross Margin, LTV — Finance terms\n- Active User, Churn Rate, Conversion Rate — Product metrics\n- SLA Compliance, Data Freshness — Operational metrics\n- PII — Governance classification\n\nVisit the Glossary page to browse all terms and their linked entities.",
      confidence: "high",
      suggested_queries: ["Revenue", "Active User", "Churn Rate"],
    };
  }

  return {
    answer:
      "I can help you explore this data catalog. Try asking about specific tables, databases, or data flows.\n\nFor example:\n- \"What tables have order data?\"\n- \"Where is customer data stored?\"\n- \"Show me upstream sources for fct_orders\"\n- \"What finance tables exist?\"\n- \"What glossary terms are defined?\"",
    confidence: "low",
    suggested_queries: [],
  };
}

export async function askAI(question: string): Promise<AiResponse> {
  await new Promise((resolve) => setTimeout(resolve, 600));
  return mockAskAI(question);
}
