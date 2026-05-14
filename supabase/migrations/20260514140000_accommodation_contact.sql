-- Contact + address fields on accommodation (for external third-party lodges/cottages
-- the venue refers couples to). Vendor_partners already has these.
alter table accommodation_rooms add column if not exists contact_name  text;
alter table accommodation_rooms add column if not exists contact_phone text;
alter table accommodation_rooms add column if not exists contact_email text;
alter table accommodation_rooms add column if not exists website_url   text;
alter table accommodation_rooms add column if not exists address       text;
