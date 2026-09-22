-- FR-203: non-destructive trim — store trim points, apply at playback time.
-- Null on both means untrimmed (full recording plays).

alter table public.affirmations
  add column trim_start_ms integer,
  add column trim_end_ms integer;

alter table public.affirmations
  add constraint affirmations_trim_range_valid check (
    (trim_start_ms is null and trim_end_ms is null)
    or (
      trim_start_ms is not null
      and trim_end_ms is not null
      and trim_start_ms >= 0
      and trim_end_ms > trim_start_ms
      and trim_end_ms <= duration_ms
    )
  );
