"""Standalone Google Sheets → CRM mission_events sync.
No GWOS dependency — reads sheet CSV, upserts directly to CRM Supabase.
Run: python .github/scripts/sync_sheets.py
Env: CRM_SUPABASE_URL, CRM_SUPABASE_SERVICE_ROLE_KEY
"""
import csv, io, os, re, sys, unicodedata
from datetime import datetime, timezone, timedelta
from urllib.parse import urlparse
import requests

CRM_URL = os.environ["CRM_SUPABASE_URL"].rstrip("/")
CRM_KEY = os.environ["CRM_SUPABASE_SERVICE_ROLE_KEY"]
SHEET_ID = "19YEfrv6XjBDkJF1DBr2sBiG4rxLLC_FX1syjOB34-MY"
EXPORT_URL = f"https://docs.google.com/spreadsheets/d/{SHEET_ID}/export?format=csv&gid=0"

SHEET_NAME_TO_SLUG = {
    "BACK IN MOTION": "back-in-motion",
    "DECARLO CHIROPRACITC": "decarlo-chiro",
    "DECARLO CHIROPRACTIC": "decarlo-chiro",
    "SCOLIOSIS CENTER OF UTAH": "scoliosis-center-of-utah",
    "SPINEWORKS": "spineworks",
    "CHIROSOLUTIONS CENTER": "chirosolutions-center",
    "COREPOSTURE": "coreposture",
    "ZEN CARE PHYSICAL MEDICINE": "zencare",
    "WHOLE BODY WELLNESS": "whole-body-wellness",
    "TAILS ANIMAL CHIROPRACTIC CARE": "tails-animal-chiropractic",
    "NEWPORT CENTER FAMILY CHIROPRACTIC": "dr-digrado",
    "GRAPHICWISE": "graphicwise",
    "MYCHIROPRACTICE": "mychiropractice",
    "RESTORATION DENTAL": "restoration-dental",
    "CHIROPRACTIC CARE CENTRE": "chiropractic-care-centre",
    "CHIROPRACTIC HEALTH CLUB": "chiropractic-health-club",
    "CHIROPRACTIC FIRST": "chiropractic-first",
    "SOUTHPORT CHIROPRACTIC": "southport-chiropractic",
    "HAVEN HEALING CENTER": "haven-chiropractic",
    "IHURT.DOC - NORTH ALABAMA": "north-alabama-spine-rehab",
    "CBP - CHIROPRACTIC BIOPHYSICS": "cbp-chiropractic-biophysics",
    "WHOLE FAMILY CHIROPRACTIC": "whole-family-chiropractic",
    "TINKER FAMILY CHIRO": "tinker-family-chiro",
    "HOOD CHIROPRACTIC": "hood-chiropractic",
    "RAY CHIROPRACTIC": "ray-chiropractic",
}

def slugify(text):
    text = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode()
    text = re.sub(r"[^\w\s-]", "", text.lower())
    return re.sub(r"[\s_-]+", "-", text).strip("-")[:80]

def domain(url):
    try: return urlparse(url).netloc or url
    except: return url

def resolve_slug(name):
    key = re.sub(r"\s+", " ", name.strip().upper())
    if key in SHEET_NAME_TO_SLUG:
        return SHEET_NAME_TO_SLUG[key]
    for k, v in SHEET_NAME_TO_SLUG.items():
        if key.startswith(k) or k.startswith(key):
            return v
    return None

# Fetch sheet
r = requests.get(EXPORT_URL, timeout=20)
r.raise_for_status()
raw = r.content.decode("utf-8-sig", errors="replace")
rows = list(csv.DictReader(io.StringIO(raw)))

# Normalise headers (strip control chars)
clean_rows = []
for row in rows:
    clean_rows.append({re.sub(r"[\x00-\x1f\x7f]", "", k).strip(): v.strip() for k, v in row.items()})

now = datetime.now(timezone.utc)
events = []
last_client = ""
last_website = ""

for i, row in enumerate(clean_rows):
    if not row.get("N0.", "").strip().isdigit():
        continue

    client_name = row.get("Clients", "").strip() or last_client
    if client_name: last_client = client_name
    website = row.get("Website", "").strip() or last_website
    if website: last_website = website

    if row.get("Update", "").strip().lower() != "publish":
        continue
    blog_url = row.get("Blogs - Links Website (Posted)", "").strip()
    if not blog_url:
        continue

    slug = resolve_slug(client_name)
    if not slug:
        print(f"  SKIP no slug: {client_name!r}")
        continue

    # Title from URL slug
    path = urlparse(blog_url).path.strip("/")
    last_seg = path.rsplit("/", 1)[-1] if "/" in path else path
    title = last_seg.replace("-", " ").replace("_", " ").title() if last_seg else blog_url
    site = domain(website) if website else domain(blog_url)

    events.append({
        "client_slug": slug,
        "event_type": "wordpress_post_published",
        "category": "content",
        "severity": "success",
        "title": f"📝 Hermes recorded new blog post: '{title}'",
        "description": f"Published on {site} · {blog_url} · logged for team analysis",
        "actor": "Hermes",
        "source": "sheets_sync",
        "occurred_at": (now + timedelta(microseconds=(i + 1) * 1000)).isoformat(),
        "data": {"post_title": title, "post_url": blog_url, "site_url": website},
    })

if not events:
    print("No published rows found in sheet.")
    sys.exit(0)

print(f"Found {len(events)} published posts. Upserting to CRM...")

# Upsert to CRM — delete old sheets_sync rows first, then insert fresh
headers = {
    "apikey": CRM_KEY,
    "Authorization": f"Bearer {CRM_KEY}",
    "Content-Type": "application/json",
    "Prefer": "return=minimal",
}

# Delete old sheets_sync events
del_r = requests.delete(
    f"{CRM_URL}/rest/v1/mission_events?source=eq.sheets_sync",
    headers=headers, timeout=15,
)
print(f"Deleted old events: HTTP {del_r.status_code}")

# Insert fresh
ins_r = requests.post(
    f"{CRM_URL}/rest/v1/mission_events",
    headers=headers, json=events, timeout=30,
)
ins_r.raise_for_status()
print(f"Inserted {len(events)} events: HTTP {ins_r.status_code}")
print("Done.")
