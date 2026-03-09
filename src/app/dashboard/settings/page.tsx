'use client'

import { useState } from 'react'
import {
  Settings, Mail, Key, Database, Shield, ExternalLink, Save,
  CheckCircle2, AlertCircle,
} from 'lucide-react'
import clsx from 'clsx'

type Tab = 'general' | 'email' | 'api' | 'security'

const TABS: { label: string; value: Tab; icon: React.ElementType }[] = [
  { label: '一般', value: 'general', icon: Settings },
  { label: 'メール送信', value: 'email', icon: Mail },
  { label: 'API連携', value: 'api', icon: Key },
  { label: 'セキュリティ', value: 'security', icon: Shield },
]

function StatusIndicator({ configured, label }: { configured: boolean; label: string }) {
  return (
    <div className={clsx(
      'flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-medium',
      configured
        ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
        : 'bg-amber-500/10 border-amber-500/20 text-amber-400'
    )}>
      {configured ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
      {label}
    </div>
  )
}

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<Tab>('general')
  const [saved, setSaved] = useState(false)

  const handleSave = () => {
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="px-6 py-5 border-b border-gray-800 shrink-0">
        <h1 className="text-xl font-semibold text-white flex items-center gap-2">
          <Settings className="w-5 h-5 text-gray-400" />
          設定
        </h1>
        <p className="text-sm text-gray-500 mt-1">システム設定とAPI連携の管理</p>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto p-6">
          {/* Tabs */}
          <div className="flex gap-1 bg-gray-900 border border-gray-800 rounded-xl p-1 mb-6">
            {TABS.map(tab => (
              <button
                key={tab.value}
                onClick={() => setActiveTab(tab.value)}
                className={clsx(
                  'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all flex-1 justify-center',
                  activeTab === tab.value
                    ? 'bg-violet-600 text-white shadow'
                    : 'text-gray-500 hover:text-gray-300 hover:bg-gray-800'
                )}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </button>
            ))}
          </div>

          {activeTab === 'general' && (
            <div className="space-y-6">
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
                <h3 className="text-sm font-semibold text-white mb-4">基本設定</h3>
                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-medium text-gray-400 mb-1.5 block">会社名</label>
                    <input type="text" placeholder="株式会社〇〇" className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-violet-500" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-400 mb-1.5 block">担当者名</label>
                    <input type="text" placeholder="田中太郎" className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-violet-500" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-400 mb-1.5 block">通知設定</label>
                    <div className="space-y-2">
                      {['メール通知', '返信通知', '送信失敗通知'].map(item => (
                        <label key={item} className="flex items-center gap-3 p-3 bg-gray-800/50 rounded-lg cursor-pointer hover:bg-gray-800 transition-colors">
                          <input type="checkbox" defaultChecked className="rounded border-gray-600 text-violet-600 focus:ring-violet-500 bg-gray-700" />
                          <span className="text-sm text-gray-300">{item}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'email' && (
            <div className="space-y-6">
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold text-white">Resend メール設定</h3>
                  <StatusIndicator configured={false} label="未設定" />
                </div>
                <p className="text-xs text-gray-500 mb-4">
                  Resendを使用してメールを直接送信できます。APIキーは
                  <a href="https://resend.com" target="_blank" rel="noopener noreferrer" className="text-violet-400 hover:text-violet-300 ml-1">
                    resend.com <ExternalLink className="w-3 h-3 inline" />
                  </a>
                  から取得してください。
                </p>
                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-medium text-gray-400 mb-1.5 block">Resend API Key</label>
                    <input type="password" placeholder="re_xxxxxxxxxx" className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-violet-500" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-400 mb-1.5 block">送信元メールアドレス</label>
                    <input type="email" placeholder="noreply@yourdomain.com" className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-violet-500" />
                    <p className="text-xs text-gray-600 mt-1">Resendで認証済みのドメインのアドレスを使用</p>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-400 mb-1.5 block">1日の送信上限</label>
                    <input type="number" defaultValue={50} className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-violet-500" />
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'api' && (
            <div className="space-y-6">
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold text-white">Anthropic (Claude AI)</h3>
                  <StatusIndicator configured={true} label="接続済み" />
                </div>
                <p className="text-xs text-gray-500 mb-4">文面生成・企業分析・返信分類に使用</p>
                <div>
                  <label className="text-xs font-medium text-gray-400 mb-1.5 block">API Key</label>
                  <input type="password" placeholder="sk-ant-..." defaultValue="sk-ant-***" className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-violet-500" />
                </div>
              </div>
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold text-white">Supabase</h3>
                  <StatusIndicator configured={true} label="接続済み" />
                </div>
                <p className="text-xs text-gray-500 mb-4">データベース・認証基盤</p>
                <div>
                  <label className="text-xs font-medium text-gray-400 mb-1.5 block">Project URL</label>
                  <input type="text" defaultValue="https://kaqh***.supabase.co" readOnly className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-violet-500 opacity-60" />
                </div>
              </div>
            </div>
          )}

          {activeTab === 'security' && (
            <div className="space-y-6">
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
                <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
                  <Shield className="w-4 h-4 text-emerald-400" />
                  Row Level Security (RLS)
                </h3>
                <p className="text-xs text-gray-500 mb-4">各ユーザーは自分のデータにのみアクセス可能</p>
                <div className="space-y-2">
                  {['leads', 'send_queue', 'replies', 'deals', 'instagram_targets', 'company_analyses', 'messages'].map(table => (
                    <div key={table} className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg">
                      <div className="flex items-center gap-2">
                        <Database className="w-3.5 h-3.5 text-gray-500" />
                        <span className="text-sm text-gray-300">{table}</span>
                      </div>
                      <StatusIndicator configured={true} label="RLS有効" />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Save */}
          <div className="mt-6 flex justify-end">
            <button
              onClick={handleSave}
              className={clsx(
                'flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold transition-all',
                saved ? 'bg-emerald-600 text-white' : 'bg-violet-600 hover:bg-violet-500 text-white'
              )}
            >
              {saved ? <><CheckCircle2 className="w-4 h-4" />保存しました</> : <><Save className="w-4 h-4" />設定を保存</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
