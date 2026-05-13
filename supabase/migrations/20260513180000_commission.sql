-- Commission columns on all marketplace tables.
-- Couples see (price + commission); venue keeps the commission as markup.

alter table catalogue_items     add column if not exists commission_value numeric(10,2) not null default 0;
alter table catalogue_items     add column if not exists commission_type  text not null default 'fixed' check (commission_type in ('fixed','percent'));

alter table rental_items        add column if not exists commission_value numeric(10,2) not null default 0;
alter table rental_items        add column if not exists commission_type  text not null default 'fixed' check (commission_type in ('fixed','percent'));

alter table accommodation_rooms add column if not exists commission_value numeric(10,2) not null default 0;
alter table accommodation_rooms add column if not exists commission_type  text not null default 'fixed' check (commission_type in ('fixed','percent'));

alter table vendor_partners     add column if not exists commission_value numeric(10,2) not null default 0;
alter table vendor_partners     add column if not exists commission_type  text not null default 'fixed' check (commission_type in ('fixed','percent'));
