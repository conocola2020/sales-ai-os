-- ============================================
-- マルチテナントRLSポリシー
-- SaaS化 Phase 1: 組織ベースのアクセス制御
-- 前提: 20260417100000, 20260417100001 が適用済み
-- ============================================

-- ============================================
-- 1. ヘルパー関数
-- ============================================

-- ユーザーの所属組織IDを返す
create or replace function auth.user_org_id()
returns uuid as $$
  select org_id from public.org_members where user_id = auth.uid() limit 1;
$$ language sql security definer stable;

-- ユーザーの組織内ロールを返す
create or replace function auth.user_org_role()
returns text as $$
  select role from public.org_members where user_id = auth.uid() limit 1;
$$ language sql security definer stable;

-- ============================================
-- 2. 既存の user_id ベースRLSポリシーを削除
--    （各テーブル作成時や001_rls_policies.sqlで作成されたもの）
-- ============================================

-- leads
drop policy if exists "Users can view own leads" on public.leads;
drop policy if exists "Users can insert own leads" on public.leads;
drop policy if exists "Users can update own leads" on public.leads;
drop policy if exists "Users can delete own leads" on public.leads;
drop policy if exists "leads_select" on public.leads;
drop policy if exists "leads_insert" on public.leads;
drop policy if exists "leads_update" on public.leads;
drop policy if exists "leads_delete" on public.leads;

-- send_queue
drop policy if exists "Users can view own queue" on public.send_queue;
drop policy if exists "Users can insert own queue" on public.send_queue;
drop policy if exists "Users can update own queue" on public.send_queue;
drop policy if exists "Users can delete own queue" on public.send_queue;
drop policy if exists "users can manage own send_queue" on public.send_queue;

-- messages
drop policy if exists "Users can view own messages" on public.messages;
drop policy if exists "Users can insert own messages" on public.messages;
drop policy if exists "Users can update own messages" on public.messages;
drop policy if exists "Users can delete own messages" on public.messages;
drop policy if exists "users can manage own messages" on public.messages;

-- replies
drop policy if exists "Users can view own replies" on public.replies;
drop policy if exists "Users can insert own replies" on public.replies;
drop policy if exists "Users can update own replies" on public.replies;
drop policy if exists "Users can delete own replies" on public.replies;
drop policy if exists "users can manage own replies" on public.replies;

-- deals
drop policy if exists "Users can view own deals" on public.deals;
drop policy if exists "Users can insert own deals" on public.deals;
drop policy if exists "Users can update own deals" on public.deals;
drop policy if exists "Users can delete own deals" on public.deals;
drop policy if exists "users can manage own deals" on public.deals;

-- user_settings
drop policy if exists "Users can view own settings" on public.user_settings;
drop policy if exists "Users can insert own settings" on public.user_settings;
drop policy if exists "Users can update own settings" on public.user_settings;
drop policy if exists "Users can delete own settings" on public.user_settings;

-- company_analyses
drop policy if exists "Users can view own analyses" on public.company_analyses;
drop policy if exists "Users can insert own analyses" on public.company_analyses;
drop policy if exists "Users can update own analyses" on public.company_analyses;
drop policy if exists "Users can delete own analyses" on public.company_analyses;

-- ============================================
-- 3. 新テーブルにRLSを有効化
-- ============================================

alter table public.organizations enable row level security;
alter table public.org_members enable row level security;
alter table public.org_invitations enable row level security;

-- ============================================
-- 4. organizations テーブルのポリシー
-- ============================================

-- 参照: 自分が所属する組織のみ
create policy organizations_select_member
  on public.organizations for select
  using (
    exists (
      select 1 from public.org_members
      where org_members.org_id = organizations.id
        and org_members.user_id = auth.uid()
    )
  );

-- 作成: 認証済みユーザーなら誰でも組織を作成可能
create policy organizations_insert_authenticated
  on public.organizations for insert
  with check (auth.uid() is not null);

-- 更新: owner または admin のみ
create policy organizations_update_admin
  on public.organizations for update
  using (
    exists (
      select 1 from public.org_members
      where org_members.org_id = organizations.id
        and org_members.user_id = auth.uid()
        and org_members.role in ('owner', 'admin')
    )
  )
  with check (
    exists (
      select 1 from public.org_members
      where org_members.org_id = organizations.id
        and org_members.user_id = auth.uid()
        and org_members.role in ('owner', 'admin')
    )
  );

-- 削除: owner のみ
create policy organizations_delete_owner
  on public.organizations for delete
  using (
    exists (
      select 1 from public.org_members
      where org_members.org_id = organizations.id
        and org_members.user_id = auth.uid()
        and org_members.role = 'owner'
    )
  );

-- ============================================
-- 5. org_members テーブルのポリシー
-- ============================================

-- 参照: 同じ組織のメンバー一覧を参照可能
create policy org_members_select_same_org
  on public.org_members for select
  using (
    org_id = auth.user_org_id()
  );

-- 追加: owner/admin のみメンバー追加可能
create policy org_members_insert_admin
  on public.org_members for insert
  with check (
    exists (
      select 1 from public.org_members as existing
      where existing.org_id = org_members.org_id
        and existing.user_id = auth.uid()
        and existing.role in ('owner', 'admin')
    )
  );

-- 更新: owner/admin のみロール変更可能
create policy org_members_update_admin
  on public.org_members for update
  using (
    exists (
      select 1 from public.org_members as existing
      where existing.org_id = org_members.org_id
        and existing.user_id = auth.uid()
        and existing.role in ('owner', 'admin')
    )
  )
  with check (
    exists (
      select 1 from public.org_members as existing
      where existing.org_id = org_members.org_id
        and existing.user_id = auth.uid()
        and existing.role in ('owner', 'admin')
    )
  );

-- 削除: owner/admin のみ（ただし自分自身は削除不可）
create policy org_members_delete_admin
  on public.org_members for delete
  using (
    org_members.user_id != auth.uid()
    and exists (
      select 1 from public.org_members as existing
      where existing.org_id = org_members.org_id
        and existing.user_id = auth.uid()
        and existing.role in ('owner', 'admin')
    )
  );

-- ============================================
-- 6. org_invitations テーブルのポリシー
-- ============================================

-- 参照: 同じ組織のadmin以上 または 招待されたメール本人
create policy org_invitations_select_admin_or_invitee
  on public.org_invitations for select
  using (
    -- admin以上が組織の招待を閲覧
    exists (
      select 1 from public.org_members
      where org_members.org_id = org_invitations.org_id
        and org_members.user_id = auth.uid()
        and org_members.role in ('owner', 'admin')
    )
    or
    -- 招待されたメールアドレス本人（auth.emailで照合）
    org_invitations.email = auth.email()
  );

-- 作成: admin以上のみ
create policy org_invitations_insert_admin
  on public.org_invitations for insert
  with check (
    exists (
      select 1 from public.org_members
      where org_members.org_id = org_invitations.org_id
        and org_members.user_id = auth.uid()
        and org_members.role in ('owner', 'admin')
    )
  );

-- 削除: admin以上のみ
create policy org_invitations_delete_admin
  on public.org_invitations for delete
  using (
    exists (
      select 1 from public.org_members
      where org_members.org_id = org_invitations.org_id
        and org_members.user_id = auth.uid()
        and org_members.role in ('owner', 'admin')
    )
  );

-- ============================================
-- 7. 既存テーブルの組織ベースRLSポリシー
--    leads, send_queue, messages, replies, deals, user_settings
-- ============================================

-- ------------------------------------------
-- leads
-- ------------------------------------------
create policy leads_select_org
  on public.leads for select
  using (org_id = auth.user_org_id());

create policy leads_insert_org
  on public.leads for insert
  with check (org_id = auth.user_org_id());

create policy leads_update_org
  on public.leads for update
  using (org_id = auth.user_org_id())
  with check (org_id = auth.user_org_id());

-- 削除: admin以上のみ
create policy leads_delete_admin
  on public.leads for delete
  using (
    org_id = auth.user_org_id()
    and auth.user_org_role() in ('owner', 'admin')
  );

-- ------------------------------------------
-- send_queue
-- ------------------------------------------
create policy send_queue_select_org
  on public.send_queue for select
  using (org_id = auth.user_org_id());

create policy send_queue_insert_org
  on public.send_queue for insert
  with check (org_id = auth.user_org_id());

create policy send_queue_update_org
  on public.send_queue for update
  using (org_id = auth.user_org_id())
  with check (org_id = auth.user_org_id());

create policy send_queue_delete_admin
  on public.send_queue for delete
  using (
    org_id = auth.user_org_id()
    and auth.user_org_role() in ('owner', 'admin')
  );

-- ------------------------------------------
-- messages
-- ------------------------------------------
create policy messages_select_org
  on public.messages for select
  using (org_id = auth.user_org_id());

create policy messages_insert_org
  on public.messages for insert
  with check (org_id = auth.user_org_id());

create policy messages_update_org
  on public.messages for update
  using (org_id = auth.user_org_id())
  with check (org_id = auth.user_org_id());

create policy messages_delete_admin
  on public.messages for delete
  using (
    org_id = auth.user_org_id()
    and auth.user_org_role() in ('owner', 'admin')
  );

-- ------------------------------------------
-- replies
-- ------------------------------------------
create policy replies_select_org
  on public.replies for select
  using (org_id = auth.user_org_id());

create policy replies_insert_org
  on public.replies for insert
  with check (org_id = auth.user_org_id());

create policy replies_update_org
  on public.replies for update
  using (org_id = auth.user_org_id())
  with check (org_id = auth.user_org_id());

create policy replies_delete_admin
  on public.replies for delete
  using (
    org_id = auth.user_org_id()
    and auth.user_org_role() in ('owner', 'admin')
  );

-- ------------------------------------------
-- deals
-- ------------------------------------------
create policy deals_select_org
  on public.deals for select
  using (org_id = auth.user_org_id());

create policy deals_insert_org
  on public.deals for insert
  with check (org_id = auth.user_org_id());

create policy deals_update_org
  on public.deals for update
  using (org_id = auth.user_org_id())
  with check (org_id = auth.user_org_id());

create policy deals_delete_admin
  on public.deals for delete
  using (
    org_id = auth.user_org_id()
    and auth.user_org_role() in ('owner', 'admin')
  );

-- ------------------------------------------
-- user_settings
-- ------------------------------------------
create policy user_settings_select_org
  on public.user_settings for select
  using (org_id = auth.user_org_id());

create policy user_settings_insert_org
  on public.user_settings for insert
  with check (org_id = auth.user_org_id());

create policy user_settings_update_org
  on public.user_settings for update
  using (org_id = auth.user_org_id())
  with check (org_id = auth.user_org_id());

create policy user_settings_delete_admin
  on public.user_settings for delete
  using (
    org_id = auth.user_org_id()
    and auth.user_org_role() in ('owner', 'admin')
  );

-- ============================================
-- 8. org_members テーブルのパフォーマンス改善
--    ヘルパー関数が高頻度でアクセスするため
-- ============================================
create index if not exists org_members_user_id_org_id_role_idx
  on public.org_members (user_id, org_id, role);
