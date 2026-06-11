-- Reply-by-email for supplier messaging.
-- Outbound supplier notifications set reply_to to reply+<reply_token>@<inbound domain>;
-- Resend receives the reply, webhooks us, and we route it into the thread by token.
-- These columns keep the email conversation threaded (same subject + In-Reply-To)
-- and make inbound ingestion idempotent.

alter table message_threads add column if not exists email_subject text;
alter table message_threads add column if not exists last_email_message_id text;

-- Message-ID of the inbound email a thread_messages row came from (dedup on redelivery).
alter table thread_messages add column if not exists email_message_id text;
create index if not exists thread_messages_email_mid_idx on thread_messages(email_message_id) where email_message_id is not null;
