'use client'

import { useState } from 'react'
import { X, Trash2, AlertCircle, AtSign } from 'lucide-react'
import { clsx } from 'clsx'
import type { InstagramTarget, InstagramTargetInsert, InstagramStatus } from '@/types/instagram'
import { INSTAGRAM_STATUSES, STATUS_CONFIG } from '@/types/instagram'
import { INDUSTRIES } from '@/types/leads'
import { createTarget, updateTarget, deleteTarget } from '@/app/dashboard/instagram/actions'

interface TargetFormModalProps {
  target?: InstagramTarget | null
  onClose: () => void
  onSaved: (target: InstagramTarget) => void
  onDeleted?: (id: string) => void
}

interface CheckboxRowProps {
  label: string
  checked: boolean
  onChange: (v: boolean) => void
}
function CheckboxRow({ label, checked, onChange }: CheckboxRowProps) {
  return (
    <label className="flex items-center gap-2 cursor-pointer group">
      <div
        onClick={() => onChange(!checked)}
        className={clsx(
          'w-4 h-4 rounded border flex items-center justify-center transition-colors shrink-0',
          checked
            ? 'bg-violet-600 border-violet-600'
            : 'bg-gray-800 border-gray-700 group-hover:border-gray-600'
        )}
      >
        {checked && (
          <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 12 12">
            <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </div>
      <span className="text-sm text-gray-300 select-none">{label}</span>
    </label>
  )
}

export default function TargetFormModal({
  target,
  onClose,
  onSaved,
  onDeleted,
}: TargetFormModalProps) {
  const isEdit = !!target

  const [username, setUsername] = useState(target?.username ?? '')
  const [displayName, setDisplayName] = useState(target?.display_name ?? '')
  const [bio, setBio] = useState(target?.bio ?? '')
  const [industry, setIndustry] = useState(target?.industry ?? '')
  const [followerCount, setFollowerCount] = useState(target?.follower_count?.toString() ?? '')
  const [engagementRate, setEngagementRate] = useState(target?.engagement_rate?.toString() ?? '')
  const [status, setStatus] = useState<InstagramStatus>(target?.status ?? '未対応')
  const [notes, setNotes] = useState(target?.notes ?? '')

  // Action flags
  const [liked, setLiked] = useState(target?.liked ?? false)
  const [following, setFollowing] = useState(target?.following ?? false)
  const [dmSent, setDmSent] = useState(target?.dm_sent ?? false)
  const [dmReplied, setDmReplied] = useState(target?.dm_replied ?? false)
  const [likedBack, setLikedBack] = useState(target?.liked_back ?? false)
  const [followedBack, setFollowedBack] = useState(target?.followed_back ?? false)

  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSave = async () => {
    const cleanUsername = username.replace(/^@/, '').trim()
    if (!cleanUsername) {
      setError('ユーザー名は必須です')
      return
    }
    setError(null)
    setSaving(true)

    const payload: InstagramTargetInsert = {
      username: cleanUsername,
      display_name: displayName.trim() || null,
      bio: bio.trim() || null,
      industry: industry || null,
      follower_count: followerCount ? parseInt(followerCount.replace(/,/g, ''), 10) || null : null,
      engagement_rate: engagementRate ? parseFloat(engagementRate) || null : null,
      status,
      liked,
      following,
      dm_sent: dmSent,
      dm_replied: dmReplied,
      liked_back: likedBack,
      followed_back: followedBack,
      notes: notes.trim() || null,
    }

    if (isEdit && target) {
      const { data, error: err } = await updateTarget(target.id, payload)
      setSaving(false)
      if (err || !data) { setError(err ?? '更新に失敗しました'); return }
      onSaved(data)
    } else {
      const { data, error: err } = await createTarget(payload)
      setSaving(false)
      if (err || !data) { setError(err ?? '作成に失敗しました'); return }
      onSaved(data)
    }
  }

  const handleDelete = async () => {
    if (!target) return
    setDeleting(true)
    const { error: err } = await deleteTarget(target.id)
    setDeleting(false)
    if (err) { setError(err); setConfirmDelete(false); return }
    onDeleted?.(target.id)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative z-10 w-full max-w-lg bg-gray-900 border border-gray-800 rounded-2xl shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800 shrink-0">
          <h2 className="text-lg font-semibold text-white">
            {isEdit ? 'ターゲットを編集' : 'ターゲットを追加'}
          </h2>
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-5">
          {error && (
            <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3 text-sm text-red-400">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {error}
            </div>
          )}

          {/* Username */}
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1.5">
              ユーザー名 <span className="text-red-400">*</span>
            </label>
            <div className="relative">
              <AtSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder="username"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg pl-9 pr-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-violet-500 transition-colors"
              />
            </div>
          </div>

          {/* Display name */}
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1.5">表示名</label>
            <input
              type="text"
              value={displayName}
              onChange={e => setDisplayName(e.target.value)}
              placeholder="田中 花子"
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-violet-500 transition-colors"
            />
          </div>

          {/* Bio */}
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1.5">プロフィール (bio)</label>
            <textarea
              rows={2}
              value={bio}
              onChange={e => setBio(e.target.value)}
              placeholder="カフェオーナー | 毎日の珈琲時間を発信中 ☕"
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-violet-500 transition-colors resize-none"
            />
          </div>

          {/* Industry */}
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1.5">業種</label>
            <select
              value={industry}
              onChange={e => setIndustry(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-500 transition-colors"
            >
              <option value="">選択してください</option>
              {INDUSTRIES.map(i => (
                <option key={i} value={i}>{i}</option>
              ))}
            </select>
          </div>

          {/* Follower count + Engagement rate */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">フォロワー数</label>
              <input
                type="text"
                inputMode="numeric"
                value={followerCount}
                onChange={e => setFollowerCount(e.target.value.replace(/[^0-9]/g, ''))}
                placeholder="10000"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-violet-500 transition-colors"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">エンゲージメント率 (%)</label>
              <input
                type="number"
                min="0"
                max="100"
                step="0.1"
                value={engagementRate}
                onChange={e => setEngagementRate(e.target.value)}
                placeholder="3.5"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-violet-500 transition-colors"
              />
            </div>
          </div>

          {/* Status */}
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-2">ステータス</label>
            <div className="grid grid-cols-3 gap-2">
              {INSTAGRAM_STATUSES.map(s => {
                const c = STATUS_CONFIG[s]
                const isSelected = status === s
                return (
                  <button
                    key={s}
                    onClick={() => setStatus(s)}
                    className={clsx(
                      'flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-xs font-medium border transition-all',
                      isSelected
                        ? [c.bg, c.color, c.border]
                        : 'bg-gray-800 text-gray-400 border-gray-700 hover:border-gray-600'
                    )}
                  >
                    <span>{c.emoji}</span>
                    <span>{c.label}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Action flags */}
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-3">アクション状況</label>
            <div className="grid grid-cols-2 gap-3">
              <CheckboxRow label="❤️ いいね済み" checked={liked} onChange={setLiked} />
              <CheckboxRow label="👥 フォロー済み" checked={following} onChange={setFollowing} />
              <CheckboxRow label="💬 DM送信済み" checked={dmSent} onChange={setDmSent} />
              <CheckboxRow label="💌 DM返信あり" checked={dmReplied} onChange={setDmReplied} />
              <CheckboxRow label="🤍 いいね返しあり" checked={likedBack} onChange={setLikedBack} />
              <CheckboxRow label="🔄 フォロー返しあり" checked={followedBack} onChange={setFollowedBack} />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1.5">メモ</label>
            <textarea
              rows={2}
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="特記事項..."
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-violet-500 transition-colors resize-none"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-800 shrink-0 flex items-center gap-3">
          {isEdit && onDeleted && (
            <>
              {confirmDelete ? (
                <>
                  <span className="text-xs text-red-400 mr-auto">本当に削除しますか？</span>
                  <button onClick={() => setConfirmDelete(false)} className="px-3 py-1.5 rounded-lg text-xs text-gray-400 hover:text-white transition-colors">キャンセル</button>
                  <button onClick={handleDelete} disabled={deleting} className="px-3 py-1.5 rounded-lg text-xs bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 transition-colors disabled:opacity-50">
                    {deleting ? '削除中...' : '削除する'}
                  </button>
                </>
              ) : (
                <button onClick={() => setConfirmDelete(true)} className="mr-auto p-2 rounded-lg text-gray-600 hover:text-red-400 hover:bg-red-500/10 transition-colors">
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </>
          )}
          {!confirmDelete && (
            <>
              <button onClick={onClose} className="ml-auto px-4 py-2 rounded-lg text-sm text-gray-400 hover:text-white hover:bg-gray-800 transition-colors">
                キャンセル
              </button>
              <button onClick={handleSave} disabled={saving} className="px-4 py-2 rounded-lg text-sm font-medium bg-violet-600 hover:bg-violet-500 text-white disabled:opacity-50 transition-colors">
                {saving ? '保存中...' : isEdit ? '更新する' : '追加する'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
