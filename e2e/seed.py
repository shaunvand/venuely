import json, urllib.request, urllib.error, hashlib, uuid, os, sys

# Supabase Management API token from env (never commit secrets — this repo is public).
SBP = os.environ.get("SUPABASE_ACCESS_TOKEN")
if not SBP:
    sys.exit("Set SUPABASE_ACCESS_TOKEN (Supabase Management API token) before running.")
REF = "njhlmucwdsmzlswjlhmf"
TUID = os.environ.get("E2E_TEST_UID", "")  # confirmed venue_admin auth user id

env = {}
for line in open(".env.local"):
    line = line.strip()
    if "=" in line and not line.startswith("#"):
        k, v = line.split("=", 1); env[k] = v.strip().strip('"')
URL, SKEY = env["NEXT_PUBLIC_SUPABASE_URL"], env["SUPABASE_SECRET_KEY"]

def admin(method, path, body=None):
    req = urllib.request.Request(URL + path, method=method, headers={"apikey": SKEY, "Authorization": f"Bearer {SKEY}", "Content-Type": "application/json"})
    if body: req.data = json.dumps(body).encode()
    try: return urllib.request.urlopen(req).read().decode()
    except urllib.error.HTTPError as e: return e.read().decode()

def sql(q):
    # Browser UA — the Management API is Cloudflare-fronted and 1010-blocks the
    # default python-urllib UA.
    req = urllib.request.Request(f"https://api.supabase.com/v1/projects/{REF}/database/query", method="POST",
        headers={"Authorization": f"Bearer {SBP}", "Content-Type": "application/json", "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"}, data=json.dumps({"query": q}).encode())
    try: return urllib.request.urlopen(req).read().decode()
    except urllib.error.HTTPError as e: return e.read().decode()

print("pwreset:", admin("PUT", f"/auth/v1/admin/users/{TUID}", {"password": "E2eTestPass12345"})[:60])

# Clean any prior test venue, then reseed fresh.
sql("delete from weddings where slug='TestAndPartnerWedding'; delete from venues where slug='e2e-test-venue';")
vid, wid = str(uuid.uuid4()), str(uuid.uuid4())
chash = hashlib.sha256(b"venuely-portal-v1::couplepass123").hexdigest()
seed = f"""
insert into venues (id, slug, name, region, address, contact_email, branding_primary) values ('{vid}','e2e-test-venue','E2E Test Venue','Western Cape','1 Test Rd, Cape Town, 7220','e2e+venue@venuely.test','#0A4A3A');
insert into venue_members (venue_id, user_id) values ('{vid}','{TUID}');
insert into catalogue_items (venue_id, category, name, cost_treatment, price, price_unit) values
 ('{vid}','Menu','3-Course Plated Dinner','extra',650,'per_person'),
 ('{vid}','Menu','Welcome Drinks','included',0,'fixed'),
 ('{vid}','Menu','Kitchen Fee for more than 90 pax','extra',1500,'fixed');
insert into rental_items (venue_id, category, name, cost_treatment, price, stock_total) values
 ('{vid}','Furniture','Chiavari Chair','extra',45,200),
 ('{vid}','Furniture','Wooden Table','included',0,30);
insert into accommodation_rooms (venue_id, name, room_type, sleeps, price_per_night, cost_treatment) values
 ('{vid}','Garden Cottage','cottage',4,1200,'extra'),
 ('{vid}','Bridal Suite','suite',2,0,'included');
insert into venue_areas (venue_id, name, slug, area_kind, active) values
 ('{vid}','Oak Lawn','oak-lawn','main',true),
 ('{vid}','Vineyard Deck','vineyard-deck','extra',true);
insert into vendor_partners (venue_id, vendor_type, name, description, price_from, contact_email, contact_phone, active) values
 ('{vid}','photographer','E2E Photography','Test recommended photographer',8000,'photog@venuely.test','+27821234567',true);
insert into weddings (id, venue_id, slug, couple_names, guest_count, wedding_date, status, portal_password_hash) values
 ('{wid}','{vid}','TestAndPartnerWedding','Test & Partner',80,(now()+interval '200 days')::date,'booked','{chash}');
"""
print("seed:", sql(seed)[:160])
open("e2e/.ids.txt", "w").write(f"VID={vid}\nWID={wid}\n")
print("VID", vid, "WID", wid)
