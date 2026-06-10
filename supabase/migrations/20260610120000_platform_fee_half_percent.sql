-- Platform fee is 0.5% (advertised rate). The 20260514100000 default of 0.0100
-- contradicted all copy and code fallbacks (0.005). Applied to prod 2026-06-10.
alter table venues alter column platform_fee_rate set default 0.005;
