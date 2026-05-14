"""
Backfill position_buckets in gsc_daily_summary for all active clients.
Fetches GSC query data per client per day and computes top3/5/10/11-20/20/50/total.
"""
import os, json, math, time, requests
from datetime import datetime, timezone, timedelta
from google.oauth2 import service_account
from google.auth.transport.requests import Request

SUPABASE_URL = os.environ["SUPABASE_URL"].rstrip("/")
SUPABASE_KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
CLIENT_EMAIL = os.environ["GOOGLE_CLIENT_EMAIL"]
import base64
_raw_key = os.environ["GOOGLE_PRIVATE_KEY"]
# Secret stored as base64 (GOOGLE_PRIVATE_KEY_B64) to avoid newline escaping issues
try:
    PRIVATE_KEY = base64.b64decode(_raw_key).decode("utf-8")
except Exception:
    PRIVATE_KEY = _raw_key.replace("\\n", "\n")
DAYS         = int(os.environ.get("DAYS", "90"))

HEADERS = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json",
}

def get_gsc_token():
    creds = service_account.Credentials.from_service_account_info(
        {
            "type": "service_account",
            "client_email": CLIENT_EMAIL,
            "private_key": PRIVATE_KEY,
            "token_uri": "https://oauth2.googleapis.com/token",
        },
        scopes=["https://www.googleapis.com/auth/webmasters.readonly"],
    )
    creds.refresh(Request())
    return creds.token

def fetch_gsc_queries(token, site_url, date):
    encoded = requests.utils.quote(site_url, safe="")
    url = f"https://www.googleapis.com/webmasters/v3/sites/{encoded}/searchAnalytics/query"
    resp = requests.post(url, headers={"Authorization": f"Bearer {token}"}, json={
        "startDate": date, "endDate": date,
        "dimensions": ["query"], "rowLimit": 5000,
    }, timeout=20)
    if resp.status_code == 403 or resp.status_code == 404:
        return []
    resp.raise_for_status()
    rows = resp.json().get("rows", [])
    return [{"query": r["keys"][0], "position": r.get("position", 999)} for r in rows]

def compute_buckets(rows):
    def p(q): return math.floor(q["position"] + 0.5)  # round
    return {
        "top3":    sum(1 for q in rows if p(q) <= 3),
        "top5":    sum(1 for q in rows if p(q) <= 5),
        "top10":   sum(1 for q in rows if p(q) <= 10),
        "top11_20": sum(1 for q in rows if 10 < p(q) <= 20),
        "top20":   sum(1 for q in rows if p(q) <= 20),
        "top50":   sum(1 for q in rows if p(q) <= 50),
        "total":   len(rows),
    }

# Fetch clients with GSC config
r = requests.get(
    f"{SUPABASE_URL}/rest/v1/clients?is_active=eq.true&select=id,name,slug,service_configs(gsc_site_url)",
    headers=HEADERS, timeout=15,
)
r.raise_for_status()
clients_raw = r.json()

clients = []
for c in clients_raw:
    configs = c.get("service_configs") or []
    if isinstance(configs, dict): configs = [configs]
    site_url = next((x.get("gsc_site_url") for x in configs if x.get("gsc_site_url")), None)
    if site_url:
        clients.append({"id": c["id"], "name": c["name"], "slug": c["slug"], "site_url": site_url})

print(f"Found {len(clients)} clients with GSC config")

# Build date list (skip last 2 days — GSC delay)
now = datetime.now(timezone.utc)
dates = [(now - timedelta(days=i)).strftime("%Y-%m-%d") for i in range(3, DAYS + 1)]
print(f"Backfilling {len(dates)} dates ({dates[-1]} → {dates[0]})")

token = get_gsc_token()
token_refreshed_at = time.time()

updated = 0
skipped = 0
errors = []

for client in clients:
    print(f"\n→ {client['name']} ({client['slug']})")
    client_updated = 0

    for date in dates:
        # Refresh token every 45 min
        if time.time() - token_refreshed_at > 2700:
            token = get_gsc_token()
            token_refreshed_at = time.time()

        try:
            rows = fetch_gsc_queries(token, client["site_url"], date)
            if not rows:
                skipped += 1
                continue

            pb = compute_buckets(rows)

            # Update existing row (only if row exists — don't create)
            upd = requests.patch(
                f"{SUPABASE_URL}/rest/v1/gsc_daily_summary?client_id=eq.{client['id']}&date=eq.{date}",
                headers={**HEADERS, "Prefer": "return=minimal"},
                json={
                    "position_buckets": pb,
                    "top5_keywords_count": pb["top5"],
                    "top11to20_keywords_count": pb["top11_20"],
                },
                timeout=10,
            )
            if upd.status_code in (200, 204):
                updated += 1
                client_updated += 1
            else:
                errors.append(f"{client['slug']} {date}: HTTP {upd.status_code}")

        except Exception as e:
            errors.append(f"{client['slug']} {date}: {e}")

        time.sleep(0.05)  # gentle rate limit

    print(f"  ✓ {client_updated} days updated")

print(f"\n✅ Done. Updated: {updated}, Skipped (no GSC data): {skipped}, Errors: {len(errors)}")
if errors:
    print("Errors (first 20):")
    for e in errors[:20]:
        print(f"  {e}")
