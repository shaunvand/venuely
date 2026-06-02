-- The wedding create/edit form offers a "provisional" status, but it was missing
-- from the wedding_status enum — saving it failed (so moving an inquiry to
-- provisional, e.g. when booking a date, did not go through). Add it.
alter type wedding_status add value if not exists 'provisional';
