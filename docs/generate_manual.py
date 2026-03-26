#!/usr/bin/env python3
"""Sales AI OS 運用マニュアル PDF生成スクリプト"""

from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.colors import HexColor
from reportlab.lib.units import mm
from reportlab.lib.enums import TA_LEFT, TA_CENTER
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, PageBreak,
    Table, TableStyle, ListFlowable, ListItem, KeepTogether
)
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.cidfonts import UnicodeCIDFont
import os

# Register Japanese font
pdfmetrics.registerFont(UnicodeCIDFont('HeiseiMin-W3'))
pdfmetrics.registerFont(UnicodeCIDFont('HeiseiKakuGo-W5'))

FONT_MINCHO = 'HeiseiMin-W3'
FONT_GOTHIC = 'HeiseiKakuGo-W5'

# Colors
VIOLET = HexColor('#7c3aed')
DARK_BG = HexColor('#1a1a2e')
LIGHT_GRAY = HexColor('#f3f4f6')
DARK_TEXT = HexColor('#1f2937')
MEDIUM_TEXT = HexColor('#374151')
ACCENT_GREEN = HexColor('#10b981')
ACCENT_BLUE = HexColor('#3b82f6')
BORDER_GRAY = HexColor('#d1d5db')

output_path = os.path.join(os.path.dirname(__file__), 'sales-ai-os-manual.pdf')

doc = SimpleDocTemplate(
    output_path,
    pagesize=A4,
    rightMargin=20*mm,
    leftMargin=20*mm,
    topMargin=20*mm,
    bottomMargin=20*mm,
)

styles = getSampleStyleSheet()

# Custom styles
styles.add(ParagraphStyle(
    'JTitle',
    fontName=FONT_GOTHIC,
    fontSize=24,
    leading=32,
    textColor=VIOLET,
    alignment=TA_CENTER,
    spaceAfter=6*mm,
))
styles.add(ParagraphStyle(
    'JSubtitle',
    fontName=FONT_GOTHIC,
    fontSize=12,
    leading=18,
    textColor=MEDIUM_TEXT,
    alignment=TA_CENTER,
    spaceAfter=10*mm,
))
styles.add(ParagraphStyle(
    'JHeading1',
    fontName=FONT_GOTHIC,
    fontSize=16,
    leading=24,
    textColor=VIOLET,
    spaceBefore=8*mm,
    spaceAfter=4*mm,
    borderWidth=0,
    borderPadding=0,
))
styles.add(ParagraphStyle(
    'JHeading2',
    fontName=FONT_GOTHIC,
    fontSize=13,
    leading=20,
    textColor=DARK_TEXT,
    spaceBefore=5*mm,
    spaceAfter=3*mm,
))
styles.add(ParagraphStyle(
    'JHeading3',
    fontName=FONT_GOTHIC,
    fontSize=11,
    leading=17,
    textColor=MEDIUM_TEXT,
    spaceBefore=3*mm,
    spaceAfter=2*mm,
))
styles.add(ParagraphStyle(
    'JBody',
    fontName=FONT_MINCHO,
    fontSize=10,
    leading=16,
    textColor=DARK_TEXT,
    spaceAfter=2*mm,
))
styles.add(ParagraphStyle(
    'JBodyBold',
    fontName=FONT_GOTHIC,
    fontSize=10,
    leading=16,
    textColor=DARK_TEXT,
    spaceAfter=2*mm,
))
styles.add(ParagraphStyle(
    'JStep',
    fontName=FONT_MINCHO,
    fontSize=10,
    leading=16,
    textColor=DARK_TEXT,
    leftIndent=5*mm,
    spaceAfter=1*mm,
))
styles.add(ParagraphStyle(
    'JUrl',
    fontName='Courier',
    fontSize=9,
    leading=14,
    textColor=ACCENT_BLUE,
    leftIndent=5*mm,
    spaceAfter=2*mm,
))
styles.add(ParagraphStyle(
    'JCheckItem',
    fontName=FONT_MINCHO,
    fontSize=10,
    leading=18,
    textColor=DARK_TEXT,
    leftIndent=5*mm,
    spaceAfter=1*mm,
))
styles.add(ParagraphStyle(
    'JNote',
    fontName=FONT_MINCHO,
    fontSize=9,
    leading=14,
    textColor=HexColor('#6b7280'),
    leftIndent=5*mm,
    spaceAfter=2*mm,
    borderWidth=0.5,
    borderColor=BORDER_GRAY,
    borderPadding=4,
    backColor=LIGHT_GRAY,
))
styles.add(ParagraphStyle(
    'JTableCell',
    fontName=FONT_MINCHO,
    fontSize=9,
    leading=14,
    textColor=DARK_TEXT,
))
styles.add(ParagraphStyle(
    'JTableHeader',
    fontName=FONT_GOTHIC,
    fontSize=9,
    leading=14,
    textColor=HexColor('#ffffff'),
))

story = []

def h1(text):
    story.append(Paragraph(text, styles['JHeading1']))

def h2(text):
    story.append(Paragraph(text, styles['JHeading2']))

def h3(text):
    story.append(Paragraph(text, styles['JHeading3']))

def body(text):
    story.append(Paragraph(text, styles['JBody']))

def bold(text):
    story.append(Paragraph(text, styles['JBodyBold']))

def step(text):
    story.append(Paragraph(text, styles['JStep']))

def url(text):
    story.append(Paragraph(text, styles['JUrl']))

def note(text):
    story.append(Paragraph(text, styles['JNote']))

def check(text):
    story.append(Paragraph(text, styles['JCheckItem']))

def spacer(h=3):
    story.append(Spacer(1, h*mm))

def make_table(headers, rows, col_widths=None):
    data = [headers] + rows
    style_cmds = [
        ('BACKGROUND', (0, 0), (-1, 0), VIOLET),
        ('TEXTCOLOR', (0, 0), (-1, 0), HexColor('#ffffff')),
        ('FONTNAME', (0, 0), (-1, 0), FONT_GOTHIC),
        ('FONTSIZE', (0, 0), (-1, 0), 9),
        ('FONTNAME', (0, 1), (-1, -1), FONT_MINCHO),
        ('FONTSIZE', (0, 1), (-1, -1), 9),
        ('LEADING', (0, 0), (-1, -1), 14),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('GRID', (0, 0), (-1, -1), 0.5, BORDER_GRAY),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [HexColor('#ffffff'), LIGHT_GRAY]),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ('LEFTPADDING', (0, 0), (-1, -1), 6),
        ('RIGHTPADDING', (0, 0), (-1, -1), 6),
    ]
    t = Table(data, colWidths=col_widths, repeatRows=1)
    t.setStyle(TableStyle(style_cmds))
    story.append(t)
    spacer(3)

# ============================================================
# Cover page
# ============================================================
story.append(Spacer(1, 40*mm))
story.append(Paragraph('Sales AI OS', styles['JTitle']))
story.append(Paragraph('運用マニュアル', ParagraphStyle(
    'cover2', parent=styles['JTitle'], fontSize=20, leading=28, spaceAfter=10*mm
)))
story.append(Paragraph(
    '企業問い合わせフォーム半自動営業送信 + Instagram半自動化システム',
    styles['JSubtitle']
))
spacer(20)
story.append(Paragraph('Version 1.0', ParagraphStyle(
    'ver', parent=styles['JBody'], alignment=TA_CENTER, textColor=MEDIUM_TEXT
)))
story.append(Paragraph('2026年3月', ParagraphStyle(
    'date', parent=styles['JBody'], alignment=TA_CENTER, textColor=MEDIUM_TEXT
)))
story.append(PageBreak())

# ============================================================
# Table of Contents
# ============================================================
h1('目次')
toc_items = [
    ('1.', 'はじめに'),
    ('2.', '営業フロー全体像'),
    ('3.', '初期設定'),
    ('4.', 'STEP1: リード管理'),
    ('5.', 'STEP2: 企業分析'),
    ('6.', 'STEP3: 文面生成'),
    ('7.', 'STEP4: 送信管理'),
    ('8.', 'STEP5: 返信管理'),
    ('9.', 'STEP6: 商談管理'),
    ('10.', 'Instagram半自動化'),
    ('11.', 'レポート'),
    ('12.', '日次運用チェックリスト'),
    ('13.', '技術情報'),
]
for num, title in toc_items:
    story.append(Paragraph(f'{num}  {title}', ParagraphStyle(
        f'toc_{num}', parent=styles['JBody'], fontSize=11, leading=20, leftIndent=10*mm
    )))
story.append(PageBreak())

# ============================================================
# 1. はじめに
# ============================================================
h1('1. はじめに')
body('Sales AI OSは、企業の問い合わせフォームへの半自動営業送信とInstagram半自動化を行うシステムです。')
body('AIが企業のHP分析・営業文面生成を行い、効率的な営業活動を支援します。')
spacer(3)
bold('アプリURL:')
url('https://sales-ai-os-git-main-conocola2020s-projects.vercel.app')
spacer(3)
bold('主な特徴:')
step('- AIによる企業HP自動分析（Claude Sonnet 4.6）')
step('- 個別最適化された営業文面の自動生成')
step('- メール / 問い合わせフォーム送信の半自動化')
step('- 返信のAI感情分類（興味あり・検討中・お断り等）')
step('- 商談パイプライン管理（カンバンビュー対応）')
step('- Instagram DM半自動化')
step('- 統合レポートダッシュボード')

# ============================================================
# 2. 営業フロー全体像
# ============================================================
h1('2. 営業フロー全体像')
body('Sales AI OSでの営業活動は以下の6ステップで進みます:')
spacer(3)

flow_data = [
    ['STEP', 'ページ', '内容'],
    ['1. リード登録', '/dashboard/leads', 'CSVインポート or 手動で企業情報を登録'],
    ['2. 企業HP分析', '/dashboard/companies', 'URLを入力してAIが課題・提案ポイントを自動分析'],
    ['3. 営業文面生成', '/dashboard/compose', 'AIがリード情報に基づき個別最適化した文面を生成'],
    ['4. 送信', '/dashboard/sending', 'メール or 問い合わせフォームで半自動送信'],
    ['5. 返信管理', '/dashboard/replies', '返信をAIが感情分類、興味ありは商談へ'],
    ['6. 商談管理', '/dashboard/deals', 'パイプラインで案件進捗を追跡'],
]
make_table(flow_data[0], flow_data[1:], col_widths=[40*mm, 45*mm, 85*mm])

note('並行してInstagram半自動化（/dashboard/instagram）でSNS経由のアプローチも可能です。')

# ============================================================
# 3. 初期設定
# ============================================================
story.append(PageBreak())
h1('3. 初期設定（設定ページ）')
url('/dashboard/settings')
body('アプリを使い始める前に、まず設定ページで会社情報を登録してください。ここで設定した内容がAIの文面生成に反映されます。')

h2('3-1. 会社基本情報')
step('- 会社名')
step('- Webサイト')
step('- 会社説明（事業内容の概要）')
step('- 所在地')
step('- 電話番号')

h2('3-2. 担当者情報')
step('- 担当者名')
step('- 役職')
step('- メールアドレス')

h2('3-3. 商品・サービス（複数登録可）')
step('- 商品名')
step('- 商品説明')
step('- 相手へのメリット')
note('「+ 追加」ボタンで複数の商品・サービスを登録できます。')

h2('3-4. 営業の強み')
step('- バリュープロポジション（複数登録可）')
note('競合との差別化ポイントを具体的に記載してください。')

h2('3-5. 実績・CTA')
step('- 導入実績・社会的証明（例: 全国50施設以上に導入済み、リピート率95%）')
step('- デフォルトCTA（例: まずはサンプルをお送りさせていただければと思います）')
spacer(3)
bold('全て入力したら「設定を保存」ボタンをクリックしてください。')

# ============================================================
# 4. STEP1: リード管理
# ============================================================
story.append(PageBreak())
h1('4. STEP1: リード管理')
url('/dashboard/leads')
body('営業対象の企業情報を管理するページです。CSVインポートで一括登録、または手動で個別追加できます。')

h2('4-1. CSVインポート（一括登録）')
step('1. 「CSVインポート」ボタンをクリック')
step('2. CSVファイルを選択')
step('3. インポート実行')
spacer(2)
bold('CSVファイルの列:')
make_table(
    ['会社名', '担当者名', 'メール', '電話', 'Webサイト', '業種'],
    [['ABC株式会社', '田中太郎', 'tanaka@abc.jp', '03-1234-5678', 'https://abc.jp', 'IT']],
    col_widths=[28*mm, 25*mm, 30*mm, 28*mm, 30*mm, 22*mm]
)

h2('4-2. 手動追加')
step('1. 「リード追加」ボタンをクリック')
step('2. 会社名を入力してEnterキー')
step('3. 登録後、クリックして詳細情報を編集')

h2('4-3. リード管理機能')
bold('ステータス管理:')
make_table(
    ['ステータス', '説明'],
    [
        ['未着手', 'まだアプローチしていない'],
        ['連絡中', 'メール/フォーム送信済み、返信待ち'],
        ['検討段階', '相手から前向きな反応あり'],
        ['失注', 'お断り・不成立'],
        ['商談化', '商談に進展'],
    ],
    col_widths=[35*mm, 130*mm]
)

bold('その他の機能:')
step('- 業種フィルター: ドロップダウンで業種別に絞り込み')
step('- 検索: 会社名・担当者名・メールアドレスで検索')
step('- 一括選択・削除: チェックボックスで複数選択して一括削除')
step('- エクスポート: 「エクスポート」ボタンでCSV出力')
step('- 重複排除: /dashboard/leads/deduplicate で重複リードを検出・削除')

# ============================================================
# 5. STEP2: 企業分析
# ============================================================
story.append(PageBreak())
h1('5. STEP2: 企業分析')
url('/dashboard/companies')
body('企業のWebサイトURLを入力するだけで、AIが自動的に企業情報・課題・提案ポイントを分析します。')

h2('5-1. 分析の実行')
step('1. 「企業WebサイトのURL」欄にURLを入力')
step('2. 「分析する」ボタンをクリック（またはEnterキー）')
step('3. AIが自動でページを取得・解析（10〜30秒程度）')

h2('5-2. 分析結果')
body('AIは以下の項目を自動的に抽出・生成します:')
make_table(
    ['項目', '内容'],
    [
        ['企業名', '会社の正式名称'],
        ['業種', '事業分野の分類'],
        ['企業規模', '従業員数・事業規模の推定'],
        ['ビジネスサマリー', '事業内容の要約'],
        ['課題', '企業が抱えていそうな課題のリスト'],
        ['提案ポイント', '自社サービスで解決できるポイント'],
        ['キーワード', '営業文面に使えるキーワード'],
    ],
    col_widths=[35*mm, 130*mm]
)

h2('5-3. 分析後のアクション')
step('- 「リードに保存」: 分析結果をリードとして登録')
step('- 「文面生成へ」: そのまま文面生成ページに遷移（リード情報が自動連携）')
spacer(2)
note('分析履歴は右サイドバーに保存されます。過去の分析結果をクリックで再表示可能です。')

# ============================================================
# 6. STEP3: 文面生成
# ============================================================
story.append(PageBreak())
h1('6. STEP3: 文面生成')
url('/dashboard/compose')
body('AIがリード情報と企業分析結果に基づいて、個別最適化された営業メッセージを生成します。')

h2('6-1. 単一生成モード')
step('1. リードを選択（ドロップダウン）')
step('2. テンプレートを選択（デフォルトテンプレートが自動選択）')
step('3. トーンを選択:')
spacer(1)
make_table(
    ['トーン', '特徴', '適した場面'],
    [
        ['丁寧', '敬語を多用した堅めの文体', '大企業・初回コンタクト'],
        ['カジュアル', '柔らかい文体', 'スタートアップ・ベンチャー'],
        ['ビジネス', 'バランスの取れた文体', '汎用的に使用可能'],
        ['親しみやすい', '親近感のある文体', '小規模事業者・個人店'],
    ],
    col_widths=[25*mm, 55*mm, 55*mm]
)
step('4. 追加指示を入力（任意）')
note('例: 「無料トライアルを強調して」「決裁者向けの内容にして」')
step('5. 「文面を生成」をクリック')
step('6. 生成された件名・本文を確認・必要に応じて編集')

h2('6-2. 生成後のアクション')
step('- 「保存」: メッセージ履歴に保存')
step('- 「コピー」: 件名+本文をクリップボードにコピー')
step('- 「再生成」: 新しいバージョンを生成')
step('- 「送信キューに追加」: 送信管理ページのキューに追加')

h2('6-3. 一括生成モード')
step('1. 右上の「一括生成」タブに切り替え')
step('2. 対象リードを複数選択（チェックボックス）')
step('3. テンプレート・トーンを選択')
step('4. 一括生成を実行')
note('一括生成では各リードに対して個別最適化された文面が生成されます。進捗はリアルタイムで表示されます。')

# ============================================================
# 7. STEP4: 送信管理
# ============================================================
story.append(PageBreak())
h1('7. STEP4: 送信管理')
url('/dashboard/sending')
body('生成した営業メッセージの送信キューを管理し、メールまたはフォーム経由で送信します。')

h2('7-1. キューへの追加方法')
step('方法1: 文面生成ページで「送信キューに追加」をクリック')
step('方法2: 送信管理ページの「キューに追加」ボタンからリード・メッセージを選択')

h2('7-2. 送信の実行')
step('1. 「待機中」タブから送信したいアイテムの「送信」をクリック')
step('2. 送信方法を選択:')
spacer(1)
make_table(
    ['送信方法', '説明', '送信元'],
    [
        ['メール送信', 'Resend API経由でメール送信', 'daichi@conocola.com'],
        ['フォーム送信', '企業HPの問い合わせフォームに自動入力', '企業HP経由'],
    ],
    col_widths=[30*mm, 75*mm, 50*mm]
)
step('3. 内容を確認して「送信」を実行')

h2('7-3. ステータス管理')
make_table(
    ['ステータス', '説明', 'アクション'],
    [
        ['待機中', '送信待ちの状態', '「送信」ボタンで送信実行'],
        ['確認待ち', 'レビューが必要', '内容を確認して承認'],
        ['送信済み', '正常に送信完了', '-'],
        ['失敗', 'エラーが発生', '「全てリトライ」で再送信'],
    ],
    col_widths=[28*mm, 60*mm, 60*mm]
)

# ============================================================
# 8. STEP5: 返信管理
# ============================================================
story.append(PageBreak())
h1('8. STEP5: 返信管理')
url('/dashboard/replies')
body('送信した営業メッセージへの返信を管理し、AIが感情を自動分類します。')

h2('8-1. 返信の追加')
step('1. 「返信を追加」ボタンをクリック')
step('2. リードを選択')
step('3. 感情分類を選択')
step('4. 返信テキストを貼り付け')
step('5. 「追加」をクリック')

h2('8-2. 感情分類')
make_table(
    ['分類', '意味', '推奨アクション'],
    [
        ['興味あり', '前向きな反応', '商談を作成して提案へ進む'],
        ['検討中', '判断保留', 'フォローアップメール送信'],
        ['お断り', '不要・不成立', 'リードステータスを「失注」に更新'],
        ['質問', '追加情報の問い合わせ', '質問に回答して関係構築'],
        ['その他', '上記に該当しない', '内容を確認して適切に対応'],
    ],
    col_widths=[25*mm, 40*mm, 80*mm]
)

h2('8-3. 返信から商談へ')
step('1. 「興味あり」の返信をクリック')
step('2. 詳細画面で「商談を作成」ボタンをクリック')
step('3. 商談管理ページに遷移（リード情報が自動連携）')

# ============================================================
# 9. STEP6: 商談管理
# ============================================================
story.append(PageBreak())
h1('9. STEP6: 商談管理')
url('/dashboard/deals')
body('営業案件の進捗をパイプラインで管理します。リストビューとカンバンビューの2つの表示方法があります。')

h2('9-1. 商談の追加')
step('1. 「商談を追加」ボタンをクリック')
step('2. リードを選択')
step('3. ステージを選択')
step('4. 金額・確度(%)を入力')
step('5. 次のアクション日と内容を設定')
step('6. 「保存」をクリック')

h2('9-2. パイプラインステージ')
make_table(
    ['ステージ', '説明', '確度目安'],
    [
        ['初回接触', '最初のコンタクト段階', '10%'],
        ['興味確認', '相手の興味・ニーズを確認中', '25%'],
        ['提案', '具体的な提案書を提示', '50%'],
        ['商談中', '条件交渉・詳細詰め', '75%'],
        ['成約', '契約締結', '100%'],
        ['失注', '不成立', '0%'],
    ],
    col_widths=[30*mm, 70*mm, 30*mm]
)

h2('9-3. ビュー')
bold('リストビュー: ')
body('一覧形式で表示。ステージ別タブ・検索・ソートが可能。')
bold('カンバンビュー: ')
body('ステージ別の列にカードを表示。ドラッグ&ドロップでステージ移動が可能。')

h2('9-4. 重要指標')
step('- アクティブ商談数: 進行中の案件数')
step('- パイプライン合計: 全アクティブ案件の金額合計')
step('- 加重見込み額: 金額 x 確度 の合計（実質的な売上予測）')
step('- 成約率: 成約数 / (成約数 + 失注数)')

# ============================================================
# 10. Instagram
# ============================================================
story.append(PageBreak())
h1('10. Instagram半自動化')
url('/dashboard/instagram')
body('Instagramアカウントへのアプローチ（いいね・フォロー・DM）を管理します。')

h2('10-1. ターゲット追加')
step('方法1: 「ターゲット追加」ボタンで手動追加')
step('  - ユーザー名、表示名、プロフィール、業種を入力')
step('方法2: 「CSVインポート」で一括登録')
step('  - CSV列: username, display_name, bio, industry, status')

h2('10-2. アプローチ手順')
step('1. いいね候補パネルから対象の「いいね」ボタンをクリック')
step('2. フォロー候補パネルから対象の「フォロー」ボタンをクリック')
step('3. 「DM」ボタンでDMテンプレートを作成・送信マーク')
step('4. 返信があれば「返信あり」をマーク')
step('5. ステータスを更新（DM送信済み → 返信待ち → 成約 or NG）')

h2('10-3. 追跡指標')
step('- 総ターゲット数')
step('- アプローチ済み数（いいね・フォロー実施）')
step('- DM送信数')
step('- 返信数・返信率')
step('- 成約数')

# ============================================================
# 11. レポート
# ============================================================
story.append(PageBreak())
h1('11. レポート')
url('/dashboard/reports')
body('全モジュールのデータを統合したレポートページです。営業活動の全体像を俯瞰できます。')

h2('レポート項目')
make_table(
    ['カテゴリ', '指標'],
    [
        ['リード概要', '総数、ステータス別内訳'],
        ['送信統計', '送信数、待機中、確認待ち、送信済み、失敗数'],
        ['返信統計', '感情別分布（興味あり・検討中・お断り・質問・その他）'],
        ['商談パイプライン', 'アクティブ数、合計金額、加重見込み額、成約率'],
        ['Instagram', 'ターゲット数、アプローチ数、DM数、返信率、成約数'],
    ],
    col_widths=[40*mm, 125*mm]
)

# ============================================================
# 12. 日次チェックリスト
# ============================================================
h1('12. 日次運用チェックリスト')
body('毎日以下の項目を確認し、効率的な営業活動を維持しましょう。')
spacer(3)

checklist = [
    'ダッシュボードで全体状況を確認',
    '返信管理で未読返信を確認・感情分類',
    '「興味あり」の返信から商談を作成',
    '商談管理で期限切れアクションを確認・対応',
    '送信管理で失敗アイテムをリトライ',
    '新規リードがあればCSVインポート',
    '文面を生成して送信キューに追加',
    'Instagram候補にいいね・フォロー・DM',
    'レポートで全体の進捗を確認',
]
for item in checklist:
    check(f'□  {item}')

# ============================================================
# 13. 技術情報
# ============================================================
story.append(PageBreak())
h1('13. 技術情報')

make_table(
    ['項目', '詳細'],
    [
        ['アプリURL', 'https://sales-ai-os-git-main-conocola2020s-projects.vercel.app'],
        ['メール送信元', 'daichi@conocola.com（Resend経由）'],
        ['AIモデル', 'Claude Sonnet 4.6（Anthropic）'],
        ['データベース', 'Supabase（PostgreSQL + RLS）'],
        ['ホスティング', 'Vercel'],
        ['フロントエンド', 'Next.js 16 + React 19 + TypeScript'],
        ['スタイリング', 'Tailwind CSS v4'],
        ['ドメイン', 'conocola.com（DNS検証済み）'],
    ],
    col_widths=[35*mm, 130*mm]
)

h2('データベーステーブル')
make_table(
    ['テーブル名', '用途'],
    [
        ['leads', 'リード（企業・担当者情報）'],
        ['messages', '生成済みメッセージ'],
        ['company_analyses', '企業HP分析結果'],
        ['send_queue', '送信キュー'],
        ['replies', '返信データ'],
        ['deals', '商談データ'],
        ['instagram_targets', 'Instagramターゲット'],
        ['user_settings', 'ユーザー設定・会社情報'],
        ['message_templates', 'メッセージテンプレート'],
    ],
    col_widths=[40*mm, 125*mm]
)

# Build
doc.build(story)
print(f'PDF generated: {output_path}')
