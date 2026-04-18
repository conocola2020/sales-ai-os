'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Building2, Users, UserPlus, Save, Loader2, CheckCircle2,
  Trash2, X, Mail, Shield, Crown, Clock,
} from 'lucide-react'
import clsx from 'clsx'
import {
  getOrganization,
  updateOrganization,
  getMembers,
  updateMemberRole,
  removeMember,
  inviteMember,
  getInvitations,
  cancelInvitation,
  type Organization,
  type Member,
  type Invitation,
} from '@/app/dashboard/settings/org-actions'

const ROLE_BADGE: Record<string, { label: string; cls: string }> = {
  owner:  { label: 'オーナー', cls: 'bg-violet-500/10 text-violet-400 border-violet-500/20' },
  admin:  { label: '管理者',   cls: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
  member: { label: 'メンバー', cls: 'bg-gray-500/10 text-gray-400 border-gray-500/20' },
  viewer: { label: '閲覧者',   cls: 'bg-gray-500/10 text-gray-400 border-gray-500/20' },
}

const ROLE_ICON: Record<string, React.ReactNode> = {
  owner:  <Crown className="w-3 h-3" />,
  admin:  <Shield className="w-3 h-3" />,
  member: <Users className="w-3 h-3" />,
  viewer: <Users className="w-3 h-3" />,
}

interface Props {
  currentUserId: string | null
  currentRole: string | null
}

export default function OrganizationSettings({ currentUserId, currentRole }: Props) {
  const [org, setOrg] = useState<Organization | null>(null)
  const [orgName, setOrgName] = useState('')
  const [members, setMembers] = useState<Member[]>([])
  const [invitations, setInvitations] = useState<Invitation[]>([])
  const [loading, setLoading] = useState(true)

  // Org save states
  const [savingOrg, setSavingOrg] = useState(false)
  const [savedOrg, setSavedOrg] = useState(false)

  // Invite form
  const [showInvite, setShowInvite] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState('member')
  const [inviting, setInviting] = useState(false)

  const [error, setError] = useState('')
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  const canEdit = currentRole === 'owner' || currentRole === 'admin'

  const fetchAll = useCallback(async () => {
    setLoading(true)
    const [orgRes, membersRes, invRes] = await Promise.all([
      getOrganization(),
      getMembers(),
      getInvitations(),
    ])
    if (orgRes.data) {
      setOrg(orgRes.data)
      setOrgName(orgRes.data.name)
    }
    setMembers(membersRes.data)
    setInvitations(invRes.data)
    setLoading(false)
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  // ------- Org update -------
  const handleOrgSave = async () => {
    setSavingOrg(true)
    setError('')
    const res = await updateOrganization({ name: orgName })
    setSavingOrg(false)
    if (res.error) {
      setError(res.error)
    } else {
      setSavedOrg(true)
      setTimeout(() => setSavedOrg(false), 2500)
    }
  }

  // ------- Role change -------
  const handleRoleChange = async (memberId: string, role: string) => {
    setActionLoading(memberId)
    setError('')
    const res = await updateMemberRole(memberId, role)
    setActionLoading(null)
    if (res.error) {
      setError(res.error)
    } else {
      setMembers(prev => prev.map(m => m.id === memberId ? { ...m, role } : m))
    }
  }

  // ------- Remove member -------
  const handleRemove = async (memberId: string) => {
    if (!confirm('このメンバーを組織から削除しますか?')) return
    setActionLoading(memberId)
    setError('')
    const res = await removeMember(memberId)
    setActionLoading(null)
    if (res.error) {
      setError(res.error)
    } else {
      setMembers(prev => prev.filter(m => m.id !== memberId))
    }
  }

  // ------- Invite -------
  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!inviteEmail.trim()) return
    setInviting(true)
    setError('')
    const res = await inviteMember(inviteEmail.trim(), inviteRole)
    setInviting(false)
    if (res.error) {
      setError(res.error)
    } else {
      setInviteEmail('')
      setInviteRole('member')
      setShowInvite(false)
      // Refresh invitations
      const invRes = await getInvitations()
      setInvitations(invRes.data)
    }
  }

  // ------- Cancel invitation -------
  const handleCancelInvitation = async (invitationId: string) => {
    setActionLoading(invitationId)
    setError('')
    const res = await cancelInvitation(invitationId)
    setActionLoading(null)
    if (res.error) {
      setError(res.error)
    } else {
      setInvitations(prev => prev.filter(inv => inv.id !== invitationId))
    }
  }

  const inputCls =
    'w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-all'

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 text-gray-500 animate-spin" />
      </div>
    )
  }

  if (!org) {
    return (
      <div className="text-center py-20">
        <Building2 className="w-10 h-10 text-gray-600 mx-auto mb-3" />
        <p className="text-gray-500 text-sm">組織が見つかりません</p>
        <p className="text-gray-600 text-xs mt-1">オンボーディングで組織を作成してください</p>
      </div>
    )
  }

  const pendingInvitations = invitations.filter(
    inv => !inv.accepted_at && new Date(inv.expires_at) > new Date()
  )
  const expiredOrAccepted = invitations.filter(
    inv => inv.accepted_at || new Date(inv.expires_at) <= new Date()
  )

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-8">
      {error && (
        <div className="px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-xl text-xs text-red-400">
          {error}
        </div>
      )}

      {/* ========== 組織情報 ========== */}
      <section className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
        <h3 className="text-sm font-semibold text-white mb-5 flex items-center gap-2">
          <Building2 className="w-4 h-4 text-violet-400" />
          組織情報
        </h3>
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1.5">組織名</label>
            <div className="flex gap-3">
              <input
                type="text"
                value={orgName}
                onChange={e => setOrgName(e.target.value)}
                disabled={!canEdit}
                placeholder="組織名"
                className={clsx(inputCls, 'flex-1', !canEdit && 'opacity-60 cursor-not-allowed')}
              />
              {canEdit && (
                <button
                  onClick={handleOrgSave}
                  disabled={savingOrg || orgName === org.name}
                  className={clsx(
                    'flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-all whitespace-nowrap',
                    savedOrg
                      ? 'bg-emerald-600 text-white'
                      : 'bg-violet-600 hover:bg-violet-500 text-white disabled:opacity-50'
                  )}
                >
                  {savingOrg ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : savedOrg ? (
                    <><CheckCircle2 className="w-4 h-4" />保存済み</>
                  ) : (
                    <><Save className="w-4 h-4" />保存</>
                  )}
                </button>
              )}
            </div>
          </div>
          <div className="flex gap-6">
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">プラン</label>
              <span className="inline-flex items-center px-2.5 py-1 bg-violet-500/10 border border-violet-500/20 rounded-full text-xs font-medium text-violet-400">
                {org.plan || 'free'}
              </span>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">Slug</label>
              <span className="text-sm text-gray-300">{org.slug}</span>
            </div>
          </div>
        </div>
      </section>

      {/* ========== メンバー一覧 ========== */}
      <section className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <Users className="w-4 h-4 text-violet-400" />
            メンバー
            <span className="text-xs text-gray-500 font-normal ml-1">({members.length})</span>
          </h3>
          {canEdit && (
            <button
              onClick={() => setShowInvite(!showInvite)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-600 hover:bg-violet-500 rounded-lg text-xs font-medium text-white transition-all"
            >
              <UserPlus className="w-3.5 h-3.5" />
              メンバーを招待
            </button>
          )}
        </div>

        {/* Invite inline form */}
        {showInvite && (
          <form
            onSubmit={handleInvite}
            className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-4 mb-5 space-y-3"
          >
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="block text-xs font-medium text-gray-400 mb-1.5">メールアドレス</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                  <input
                    type="email"
                    value={inviteEmail}
                    onChange={e => setInviteEmail(e.target.value)}
                    required
                    placeholder="user@example.com"
                    className={clsx(inputCls, 'pl-10')}
                  />
                </div>
              </div>
              <div className="w-36">
                <label className="block text-xs font-medium text-gray-400 mb-1.5">ロール</label>
                <select
                  value={inviteRole}
                  onChange={e => setInviteRole(e.target.value)}
                  className={inputCls}
                >
                  <option value="member">メンバー</option>
                  <option value="admin">管理者</option>
                </select>
              </div>
            </div>
            <div className="flex items-center gap-2 justify-end">
              <button
                type="button"
                onClick={() => setShowInvite(false)}
                className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors"
              >
                キャンセル
              </button>
              <button
                type="submit"
                disabled={inviting}
                className="flex items-center gap-2 px-5 py-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 rounded-lg text-sm font-semibold text-white transition-all"
              >
                {inviting ? (
                  <><Loader2 className="w-4 h-4 animate-spin" />送信中...</>
                ) : (
                  <><UserPlus className="w-4 h-4" />招待を送信</>
                )}
              </button>
            </div>
          </form>
        )}

        {/* Members table */}
        <div className="divide-y divide-gray-800">
          {members.map(member => {
            const badge = ROLE_BADGE[member.role] || ROLE_BADGE.member
            const isOwner = member.role === 'owner'
            const isSelf = member.user_id === currentUserId
            const isProcessing = actionLoading === member.id

            return (
              <div key={member.id} className="flex items-center gap-4 py-3 first:pt-0 last:pb-0">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-white truncate">{member.email}</span>
                    {isSelf && (
                      <span className="text-[10px] text-gray-500">(あなた)</span>
                    )}
                  </div>
                  <span className="text-xs text-gray-600">
                    {new Date(member.created_at).toLocaleDateString('ja-JP')} 参加
                  </span>
                </div>

                <div className="flex items-center gap-3">
                  {canEdit && !isOwner && !isSelf ? (
                    <select
                      value={member.role}
                      onChange={e => handleRoleChange(member.id, e.target.value)}
                      disabled={isProcessing}
                      className="bg-gray-800 border border-gray-700 rounded-lg px-2 py-1 text-xs text-gray-300 focus:outline-none focus:ring-1 focus:ring-violet-500"
                    >
                      <option value="member">メンバー</option>
                      <option value="admin">管理者</option>
                      <option value="viewer">閲覧者</option>
                    </select>
                  ) : (
                    <span className={clsx(
                      'inline-flex items-center gap-1 px-2 py-0.5 border rounded-full text-xs font-medium',
                      badge.cls
                    )}>
                      {ROLE_ICON[member.role]}
                      {badge.label}
                    </span>
                  )}

                  {canEdit && !isOwner && !isSelf && (
                    <button
                      onClick={() => handleRemove(member.id)}
                      disabled={isProcessing}
                      className="p-1.5 text-gray-600 hover:text-red-400 transition-colors disabled:opacity-50"
                      title="メンバーを削除"
                    >
                      {isProcessing ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="w-3.5 h-3.5" />
                      )}
                    </button>
                  )}
                </div>
              </div>
            )
          })}
          {members.length === 0 && (
            <p className="text-xs text-gray-600 text-center py-4">メンバーはいません</p>
          )}
        </div>
      </section>

      {/* ========== 招待一覧 ========== */}
      {(pendingInvitations.length > 0 || expiredOrAccepted.length > 0) && (
        <section className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
          <h3 className="text-sm font-semibold text-white mb-5 flex items-center gap-2">
            <Mail className="w-4 h-4 text-violet-400" />
            招待
          </h3>

          {pendingInvitations.length > 0 && (
            <div className="mb-4">
              <p className="text-xs text-gray-500 mb-3">未承認の招待</p>
              <div className="divide-y divide-gray-800">
                {pendingInvitations.map(inv => {
                  const badge = ROLE_BADGE[inv.role] || ROLE_BADGE.member
                  const isProcessing = actionLoading === inv.id
                  return (
                    <div key={inv.id} className="flex items-center gap-4 py-3 first:pt-0 last:pb-0">
                      <div className="flex-1 min-w-0">
                        <span className="text-sm text-gray-300 truncate block">{inv.email}</span>
                        <span className="text-xs text-gray-600 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {new Date(inv.expires_at).toLocaleDateString('ja-JP')} まで有効
                        </span>
                      </div>
                      <span className={clsx(
                        'inline-flex items-center px-2 py-0.5 border rounded-full text-xs font-medium',
                        badge.cls
                      )}>
                        {badge.label}
                      </span>
                      {canEdit && (
                        <button
                          onClick={() => handleCancelInvitation(inv.id)}
                          disabled={isProcessing}
                          className="p-1.5 text-gray-600 hover:text-red-400 transition-colors disabled:opacity-50"
                          title="招待をキャンセル"
                        >
                          {isProcessing ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <X className="w-3.5 h-3.5" />
                          )}
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {expiredOrAccepted.length > 0 && (
            <div>
              <p className="text-xs text-gray-500 mb-3">過去の招待</p>
              <div className="divide-y divide-gray-800">
                {expiredOrAccepted.map(inv => (
                  <div key={inv.id} className="flex items-center gap-4 py-3 first:pt-0 last:pb-0 opacity-50">
                    <div className="flex-1 min-w-0">
                      <span className="text-sm text-gray-400 truncate block">{inv.email}</span>
                    </div>
                    <span className={clsx(
                      'text-xs',
                      inv.accepted_at ? 'text-emerald-500' : 'text-gray-600'
                    )}>
                      {inv.accepted_at ? '承認済み' : '期限切れ'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      {/* 下部余白 */}
      <div className="h-8" />
    </div>
  )
}
