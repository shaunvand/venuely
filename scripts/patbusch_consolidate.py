"""
Pat Busch venue consolidation.
- Survivor venue: b04ea97c (richest copy).
- Re-points every child table from the 9 duplicate venues onto the survivor.
- Dedupes vendor_partners / catalogue / rentals / accommodation.
- Attaches shaunvand@gmail.com + heather.mcld.17@gmail.com as members.
Runs in phases so we can backup first, then merge, then verify.
"""
import json, os, sys, urllib.request

REF = "njhlmucwdsmzlswjlhmf"
TOKEN = os.environ.get("SUPABASE_ACCESS_TOKEN", "")  # export before running; never hardcode
URL = f"https://api.supabase.com/v1/projects/{REF}/database/query"

SURVIVOR = "b04ea97c-37ff-4fb5-b23f-5e6067584a55"
ALL_VENUES = [
    "11111111-1111-1111-1111-111111111111",
    "94b98bd1-d405-4292-b8e5-91fd8f23d983",
    "e00fbeb2-d136-4afe-8bb7-66239bc931de",
    "8228cece-7607-4e3e-a69f-2a4b62145888",
    "87899555-6ffc-4b8f-8861-31ca2429d87d",
    "8db83f9d-60e1-46d5-b12d-3da717cc52c3",
    "dd998e2a-64c1-487a-be3a-ca658a019947",
    "b04ea97c-37ff-4fb5-b23f-5e6067584a55",
    "dc82424c-2cda-45a7-a19b-a65b964025cc",
    "aa992c8a-a722-466a-a618-3acdc2f58acc",
]
DUPES = [v for v in ALL_VENUES if v != SURVIVOR]
SHAUN = "eca7e6c1-049c-4a90-8074-649274a1b7f7"
HEATHER = "319db80f-97fe-4940-962e-0ca181ac9c64"

# Tables with a direct venue_id column (to re-point).
VENUE_CHILD_TABLES = [
    "accommodation_rooms", "catalogue_items", "enquiries", "media_assets",
    "payment_rules", "platform_payments", "rental_items", "reviews",
    "vendor_partners", "venue_areas", "venue_invites", "venue_tables", "weddings",
]


def sql(query):
    body = json.dumps({"query": query}).encode()
    req = urllib.request.Request(URL, data=body, method="POST", headers={
        "Authorization": f"Bearer {TOKEN}", "Content-Type": "application/json",
        "User-Agent": "curl/8.4.0", "Accept": "application/json"})
    try:
        with urllib.request.urlopen(req) as r:
            return json.loads(r.read().decode())
    except urllib.error.HTTPError as e:
        print("HTTP", e.code, e.read().decode()[:500], file=sys.stderr)
        raise


def in_list(ids):
    return ",".join(f"'{i}'" for i in ids)


def backup(path):
    parts = [f"'venues', (select coalesce(json_agg(v),'[]') from venues v where v.id in ({in_list(ALL_VENUES)}))"]
    for t in VENUE_CHILD_TABLES + ["venue_members"]:
        parts.append(f"'{t}', (select coalesce(json_agg(x),'[]') from {t} x where x.venue_id in ({in_list(ALL_VENUES)}))")
    # wedding children (linked by wedding_id, not venue_id) — back up for safety
    wfilter = f"x.wedding_id in (select id from weddings where venue_id in ({in_list(ALL_VENUES)}))"
    for t in ["guests", "payments"]:
        parts.append(f"'{t}', (select coalesce(json_agg(x),'[]') from {t} x where {wfilter})")
    q = "select json_build_object(" + ",".join(parts) + ") as backup;"
    res = sql(q)
    data = res["result"][0]["backup"] if "result" in res else res[0]["backup"]
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, default=str)
    counts = {k: len(v) for k, v in data.items()}
    print("BACKUP WRITTEN:", path)
    print(json.dumps(counts, indent=2))


# Tables re-pointed onto the survivor (payment_rules excluded: unique per venue).
REPOINT = [
    "accommodation_rooms", "catalogue_items", "enquiries", "media_assets",
    "platform_payments", "rental_items", "reviews", "vendor_partners",
    "venue_areas", "venue_invites", "venue_tables", "weddings",
]
# Dedupe keys per table (run AFTER everything is on the survivor).
DEDUPE = {
    "vendor_partners": "vendor_type, lower(btrim(name))",
    "catalogue_items": "lower(btrim(name)), coalesce(category,'')",
    "rental_items": "lower(btrim(name)), coalesce(category,'')",
    "accommodation_rooms": "lower(btrim(name))",
}
RANK = "(image_url is not null) desc, (description is not null) desc, created_at asc, id asc"


def merge():
    stmts = []
    # 1. Re-point all child rows from the duplicates onto the survivor.
    for t in REPOINT:
        stmts.append(f"update {t} set venue_id='{SURVIVOR}' where venue_id in ({in_list(DUPES)})")
    # 2. payment_rules is unique per venue → drop the duplicates' rules, keep survivor's.
    stmts.append(f"delete from payment_rules where venue_id in ({in_list(DUPES)})")
    # 3. Memberships: clear the two users everywhere, then attach both to the survivor.
    stmts.append(f"delete from venue_members where user_id in ('{SHAUN}','{HEATHER}')")
    stmts.append(
        "insert into venue_members (venue_id, user_id, is_primary) values "
        f"('{SURVIVOR}','{SHAUN}',true),('{SURVIVOR}','{HEATHER}',true) "
        "on conflict (venue_id, user_id) do nothing")
    # 4. Dedupe each merged table on the survivor (keep the most complete row).
    for t, key in DEDUPE.items():
        stmts.append(
            f"with ranked as (select id, row_number() over (partition by {key} order by {RANK}) rn "
            f"from {t} where venue_id='{SURVIVOR}') "
            f"delete from {t} where id in (select id from ranked where rn>1)")
    sql(";\n".join(stmts) + ";")
    print("MERGE COMPLETE")


def verify():
    q = (f"select '{SURVIVOR}' as survivor, "
         "(select count(*) from vendor_partners where venue_id=v) vendors, "
         "(select count(*) from catalogue_items where venue_id=v) catalogue, "
         "(select count(*) from rental_items where venue_id=v) rentals, "
         "(select count(*) from accommodation_rooms where venue_id=v) rooms, "
         "(select count(*) from venue_areas where venue_id=v) areas, "
         "(select count(*) from weddings where venue_id=v) weddings, "
         "(select count(*) from media_assets where venue_id=v) media "
         f"from (select '{SURVIVOR}'::uuid v) s;")
    print("SURVIVOR TOTALS:", json.dumps(sql(q), default=str))
    m = sql(f"select u.email, count(*) from venue_members vm join auth.users u on u.id=vm.user_id where vm.user_id in ('{SHAUN}','{HEATHER}') group by u.email;")
    print("TARGET MEMBERSHIPS:", json.dumps(m, default=str))
    left = sql(f"select count(*) from vendor_partners where venue_id in ({in_list(DUPES)});")
    print("VENDORS LEFT ON DUPLICATES (should be 0):", json.dumps(left, default=str))


if __name__ == "__main__":
    phase = sys.argv[1] if len(sys.argv) > 1 else "backup"
    if phase == "backup":
        backup(sys.argv[2] if len(sys.argv) > 2 else "patbusch_backup.json")
    elif phase == "merge":
        merge()
    elif phase == "verify":
        verify()
    elif phase == "delete_dupes":
        # Safety: only delete duplicates that are completely empty of inventory/weddings.
        guard = " and ".join(
            f"not exists (select 1 from {t} where {t}.venue_id=venues.id)"
            for t in ["catalogue_items", "rental_items", "accommodation_rooms",
                      "vendor_partners", "venue_areas", "weddings", "media_assets"])
        res = sql(f"delete from venues where id in ({in_list(DUPES)}) and {guard} returning slug;")
        print("DELETED:", json.dumps(res, default=str))
        left = sql("select count(*) from venues where name ilike 'pat busch%';")
        print("PAT BUSCH VENUES REMAINING:", json.dumps(left, default=str))
