-- Sales log (moving from localStorage)
create table if not exists sales_log (
  id        bigint primary key generated always as identity,
  date      date not null,
  calls     int  not null default 0,
  closes    int  not null default 0,
  created_at timestamptz default now()
);

-- Meets I'm handling (moving from localStorage)
create table if not exists my_meets (
  id        bigint primary key generated always as identity,
  name      text not null,
  date      date not null,
  time      text,
  city      text,
  created_at timestamptz default now()
);

-- Row Level Security (allow all for now — tighten with auth later)
alter table sales_log enable row level security;
alter table my_meets  enable row level security;

create policy "Allow all" on sales_log for all using (true);
create policy "Allow all" on my_meets  for all using (true);
