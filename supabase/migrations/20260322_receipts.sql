-- receipts table
create table if not exists public.receipts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade,
  receipt_date date not null,
  store_name text not null,
  total_amount numeric(10, 0) not null default 0,
  category_type text not null check (category_type in ('business', 'personal')),
  image_url text,
  created_at timestamptz not null default now()
);

-- receipt_items table
create table if not exists public.receipt_items (
  id uuid primary key default gen_random_uuid(),
  receipt_id uuid not null references public.receipts on delete cascade,
  item_name text not null,
  amount numeric(10, 0) not null default 0,
  expense_category text not null default 'その他',
  created_at timestamptz not null default now()
);

-- RLS
alter table public.receipts enable row level security;
alter table public.receipt_items enable row level security;

create policy "Users can manage their own receipts"
  on public.receipts for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can manage items of their receipts"
  on public.receipt_items for all
  using (
    exists (
      select 1 from public.receipts r
      where r.id = receipt_id and r.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.receipts r
      where r.id = receipt_id and r.user_id = auth.uid()
    )
  );

-- Storage bucket for receipt images
insert into storage.buckets (id, name, public)
  values ('receipt-images', 'receipt-images', false)
  on conflict (id) do nothing;

create policy "Users can upload receipt images"
  on storage.objects for insert
  with check (bucket_id = 'receipt-images' and auth.uid() is not null);

create policy "Users can read their receipt images"
  on storage.objects for select
  using (bucket_id = 'receipt-images' and auth.uid() is not null);
