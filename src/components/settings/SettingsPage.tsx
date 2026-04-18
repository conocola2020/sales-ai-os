'use client'

import { useState, useCallback } from 'react'
import {
  Settings, Save, CheckCircle2, Plus, Trash2, Package,
  Building2, User, FileText, Loader2, Users,
} from 'lucide-react'
import clsx from 'clsx'
import { upsertSettings } from '@/app/dashboard/settings/actions'
import type { UserSettings, Product, MessageTemplate } from '@/types/settings'
import { DEFAULT_USER_SETTINGS } from '@/types/settings'
import OrganizationSettings from '@/components/settings/OrganizationSettings'

interface SettingsPageProps {
  initialSettings: UserSettings | null
  templates: MessageTemplate[]
  currentUserId?: string | null
  currentRole?: string | null
}

export default function SettingsPage({ initialSettings, templates, currentUserId, currentRole }: SettingsPageProps) {
  const [tab, setTab] = useState<'profile' | 'organization'>('profile')
  // フォーム state — 初回はDB値 or デフォルト値
  const defaults = initialSettings ?? { ...DEFAULT_USER_SETTINGS } as unknown as UserSettings
  const [companyName, setCompanyName] = useState(defaults.company_name)
  const [representative, setRepresentative] = useState(defaults.representative)
  const [representativeTitle, setRepresentativeTitle] = useState(defaults.representative_title)
  const [companyEmail, setCompanyEmail] = useState(defaults.company_email)
  const [companyPhone, setCompanyPhone] = useState(defaults.company_phone)
  const [companyWebsite, setCompanyWebsite] = useState(defaults.company_website)
  const [companyLocation, setCompanyLocation] = useState(defaults.company_location)
  const [companyDescription, setCompanyDescription] = useState(defaults.company_description)
  const [products, setProducts] = useState<Product[]>(
    Array.isArray(defaults.products) && defaults.products.length > 0
      ? defaults.products
      : DEFAULT_USER_SETTINGS.products
  )
  const [valuePropositions, setValuePropositions] = useState<string[]>(
    Array.isArray(defaults.value_propositions) && defaults.value_propositions.length > 0
      ? defaults.value_propositions
      : DEFAULT_USER_SETTINGS.value_propositions
  )
  const [socialProof, setSocialProof] = useState(defaults.social_proof)
  const [ctaText, setCtaText] = useState(defaults.cta_text || DEFAULT_USER_SETTINGS.cta_text)

  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  // ------- Product helpers -------
  const addProduct = () =>
    setProducts(prev => [...prev, { name: '', description: '', benefits: '' }])

  const removeProduct = (idx: number) =>
    setProducts(prev => prev.filter((_, i) => i !== idx))

  const updateProduct = (idx: number, field: keyof Product, value: string) =>
    setProducts(prev => prev.map((p, i) => (i === idx ? { ...p, [field]: value } : p)))

  // ------- Value proposition helpers -------
  const addProposition = () => setValuePropositions(prev => [...prev, ''])
  const removeProposition = (idx: number) =>
    setValuePropositions(prev => prev.filter((_, i) => i !== idx))
  const updateProposition = (idx: number, value: string) =>
    setValuePropositions(prev => prev.map((v, i) => (i === idx ? value : v)))

  // ------- Save -------
  const handleSave = useCallback(async () => {
    setSaving(true)
    setError('')
    const { error: err } = await upsertSettings({
      company_name: companyName,
      representative,
      representative_title: representativeTitle,
      company_email: companyEmail,
      company_phone: companyPhone,
      company_website: companyWebsite,
      company_location: companyLocation,
      company_description: companyDescription,
      products: products.filter(p => p.name.trim()),
      value_propositions: valuePropositions.filter(v => v.trim()),
      social_proof: socialProof,
      cta_text: ctaText,
    })
    setSaving(false)
    if (err) {
      setError(err)
    } else {
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    }
  }, [companyName, representative, representativeTitle, companyEmail, companyPhone, companyWebsite, companyLocation, companyDescription, products, valuePropositions, socialProof, ctaText])

  // ------- Field component -------
  const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <div>
      <label className="block text-xs font-medium text-gray-400 mb-1.5">{label}</label>
      {children}
    </div>
  )

  const inputCls =
    'w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-all'

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Header */}
      <div className="px-6 py-5 border-b border-gray-800 shrink-0 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-white flex items-center gap-2">
            <Settings className="w-5 h-5 text-gray-400" />
            弊社情報・設定
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            文面生成AIに反映される弊社プロフィールとテンプレートの管理
          </p>
        </div>
        {tab === 'profile' && (
          <button
            onClick={handleSave}
            disabled={saving}
            className={clsx(
              'flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold transition-all',
              saved
                ? 'bg-emerald-600 text-white'
                : 'bg-violet-600 hover:bg-violet-500 text-white disabled:opacity-50'
            )}
          >
            {saving ? (
              <><Loader2 className="w-4 h-4 animate-spin" />保存中...</>
            ) : saved ? (
              <><CheckCircle2 className="w-4 h-4" />保存しました</>
            ) : (
              <><Save className="w-4 h-4" />設定を保存</>
            )}
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="px-6 pt-4 shrink-0">
        <div className="flex gap-1 border-b border-gray-800">
          <button
            onClick={() => setTab('profile')}
            className={clsx(
              'px-4 py-2.5 text-sm font-medium transition-colors',
              tab === 'profile'
                ? 'border-b-2 border-violet-500 text-white'
                : 'text-gray-400 hover:text-gray-300'
            )}
          >
            <span className="flex items-center gap-2">
              <User className="w-4 h-4" />
              プロフィール設定
            </span>
          </button>
          <button
            onClick={() => setTab('organization')}
            className={clsx(
              'px-4 py-2.5 text-sm font-medium transition-colors',
              tab === 'organization'
                ? 'border-b-2 border-violet-500 text-white'
                : 'text-gray-400 hover:text-gray-300'
            )}
          >
            <span className="flex items-center gap-2">
              <Users className="w-4 h-4" />
              組織管理
            </span>
          </button>
        </div>
      </div>

      {error && (
        <div className="mx-6 mt-4 px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-xl text-xs text-red-400">
          {error}
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {tab === 'organization' ? (
          <OrganizationSettings
            currentUserId={currentUserId ?? null}
            currentRole={currentRole ?? null}
          />
        ) : (
        <div className="max-w-4xl mx-auto p-6 space-y-8">

          {/* ========== 会社基本情報 ========== */}
          <section className="bg-gray-900 border border-gray-800 rounded-xl p-6">
            <h3 className="text-sm font-semibold text-white mb-5 flex items-center gap-2">
              <Building2 className="w-4 h-4 text-violet-400" />
              会社基本情報
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <Field label="会社名">
                <input
                  type="text"
                  value={companyName}
                  onChange={e => setCompanyName(e.target.value)}
                  placeholder="CONOCOLA"
                  className={inputCls}
                />
              </Field>
              <Field label="Webサイト">
                <input
                  type="url"
                  value={companyWebsite}
                  onChange={e => setCompanyWebsite(e.target.value)}
                  placeholder="https://conocola.com"
                  className={inputCls}
                />
              </Field>
              <div className="col-span-2">
                <Field label="会社説明">
                  <textarea
                    rows={3}
                    value={companyDescription}
                    onChange={e => setCompanyDescription(e.target.value)}
                    placeholder="貴社の事業内容を簡潔に記載してください"
                    className={inputCls + ' resize-none'}
                  />
                </Field>
              </div>
              <Field label="所在地">
                <input
                  type="text"
                  value={companyLocation}
                  onChange={e => setCompanyLocation(e.target.value)}
                  placeholder="東京都渋谷区..."
                  className={inputCls}
                />
              </Field>
              <Field label="電話番号">
                <input
                  type="tel"
                  value={companyPhone}
                  onChange={e => setCompanyPhone(e.target.value)}
                  placeholder="03-xxxx-xxxx"
                  className={inputCls}
                />
              </Field>
            </div>
          </section>

          {/* ========== 担当者情報 ========== */}
          <section className="bg-gray-900 border border-gray-800 rounded-xl p-6">
            <h3 className="text-sm font-semibold text-white mb-5 flex items-center gap-2">
              <User className="w-4 h-4 text-violet-400" />
              担当者情報
            </h3>
            <div className="grid grid-cols-3 gap-4">
              <Field label="担当者名">
                <input
                  type="text"
                  value={representative}
                  onChange={e => setRepresentative(e.target.value)}
                  placeholder="田中太郎"
                  className={inputCls}
                />
              </Field>
              <Field label="役職">
                <input
                  type="text"
                  value={representativeTitle}
                  onChange={e => setRepresentativeTitle(e.target.value)}
                  placeholder="営業部長"
                  className={inputCls}
                />
              </Field>
              <Field label="メールアドレス">
                <input
                  type="email"
                  value={companyEmail}
                  onChange={e => setCompanyEmail(e.target.value)}
                  placeholder="sales@conocola.com"
                  className={inputCls}
                />
              </Field>
            </div>
          </section>

          {/* ========== 商品・サービス ========== */}
          <section className="bg-gray-900 border border-gray-800 rounded-xl p-6">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <Package className="w-4 h-4 text-violet-400" />
                商品・サービス
              </h3>
              <button
                onClick={addProduct}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-xs text-gray-300 hover:border-violet-500 hover:text-white transition-all"
              >
                <Plus className="w-3.5 h-3.5" />
                追加
              </button>
            </div>
            <div className="space-y-4">
              {products.map((product, idx) => (
                <div key={idx} className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-4 space-y-3 relative group">
                  <button
                    onClick={() => removeProduct(idx)}
                    className="absolute top-3 right-3 p-1.5 text-gray-600 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                  <Field label={`商品名 ${idx + 1}`}>
                    <input
                      type="text"
                      value={product.name}
                      onChange={e => updateProduct(idx, 'name', e.target.value)}
                      placeholder="サウナー専用コーラ"
                      className={inputCls}
                    />
                  </Field>
                  <Field label="商品説明">
                    <textarea
                      rows={2}
                      value={product.description}
                      onChange={e => updateProduct(idx, 'description', e.target.value)}
                      placeholder="商品の特徴や内容"
                      className={inputCls + ' resize-none'}
                    />
                  </Field>
                  <Field label="相手へのメリット">
                    <textarea
                      rows={2}
                      value={product.benefits}
                      onChange={e => updateProduct(idx, 'benefits', e.target.value)}
                      placeholder="導入先にとってのメリットを記載"
                      className={inputCls + ' resize-none'}
                    />
                  </Field>
                </div>
              ))}
              {products.length === 0 && (
                <p className="text-xs text-gray-600 text-center py-4">
                  「追加」ボタンで商品を登録してください
                </p>
              )}
            </div>
          </section>

          {/* ========== 営業の強み ========== */}
          <section className="bg-gray-900 border border-gray-800 rounded-xl p-6">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <FileText className="w-4 h-4 text-violet-400" />
                営業の強み・バリュープロポジション
              </h3>
              <button
                onClick={addProposition}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-xs text-gray-300 hover:border-violet-500 hover:text-white transition-all"
              >
                <Plus className="w-3.5 h-3.5" />
                追加
              </button>
            </div>
            <div className="space-y-2">
              {valuePropositions.map((vp, idx) => (
                <div key={idx} className="flex items-center gap-2 group">
                  <span className="text-xs text-gray-600 w-5 text-right shrink-0">{idx + 1}.</span>
                  <input
                    type="text"
                    value={vp}
                    onChange={e => updateProposition(idx, e.target.value)}
                    placeholder="例: サウナ施設に特化した商品ラインナップ"
                    className={inputCls + ' flex-1'}
                  />
                  <button
                    onClick={() => removeProposition(idx)}
                    className="p-1.5 text-gray-600 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </section>

          {/* ========== 実績 & CTA ========== */}
          <section className="bg-gray-900 border border-gray-800 rounded-xl p-6 space-y-4">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <FileText className="w-4 h-4 text-violet-400" />
              実績・CTA
            </h3>
            <Field label="導入実績・社会的証明">
              <textarea
                rows={2}
                value={socialProof}
                onChange={e => setSocialProof(e.target.value)}
                placeholder="例: 全国50施設以上に導入済み、リピート率95%"
                className={inputCls + ' resize-none'}
              />
            </Field>
            <Field label="デフォルトCTA（行動喚起）">
              <textarea
                rows={2}
                value={ctaText}
                onChange={e => setCtaText(e.target.value)}
                placeholder="例: まずはサンプルをお送りさせていただければと思います。"
                className={inputCls + ' resize-none'}
              />
            </Field>
          </section>

          {/* ========== テンプレート一覧（読み取りのみ） ========== */}
          <section className="bg-gray-900 border border-gray-800 rounded-xl p-6">
            <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
              <FileText className="w-4 h-4 text-emerald-400" />
              メッセージテンプレート
            </h3>
            <p className="text-xs text-gray-500 mb-4">文面生成時に使用するテンプレート構成。テンプレートは文面生成画面で選択できます。</p>
            <div className="space-y-3">
              {templates.length > 0 ? (
                templates.map(t => (
                  <div
                    key={t.id}
                    className="flex items-start gap-3 bg-gray-800/50 border border-gray-700/50 rounded-xl p-4"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-white">{t.name}</span>
                        {t.is_default && (
                          <span className="px-2 py-0.5 bg-violet-500/10 border border-violet-500/20 rounded text-[10px] text-violet-400 font-medium">
                            デフォルト
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 mt-1">{t.description}</p>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-xs text-gray-600 text-center py-4">
                  テンプレートは初回の文面生成時に自動作成されます
                </p>
              )}
            </div>
          </section>

          {/* 下部余白 */}
          <div className="h-8" />
        </div>
        )}
      </div>
    </div>
  )
}
