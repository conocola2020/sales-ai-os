/**
 * conocola.com の問い合わせフォームにテスト送信するスクリプト
 * 送信はせず、入力のみ確認する
 *
 * Usage: npx tsx scripts/test-form-conocola.ts
 */

import { chromium } from 'playwright'

const NAVIGATION_TIMEOUT = 15000
const CONTACT_PATHS = ['/contact', '/contact/', '/inquiry', '/inquiry/', '/お問い合わせ', '/contact-us', '/contactus', '/form', '/toiawase']

async function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function main() {
  console.log('🚀 conocola.com フォーム送信テスト開始\n')

  const browser = await chromium.launch({ headless: false })
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
    viewport: { width: 1280, height: 800 },
    locale: 'ja-JP',
  })
  const page = await context.newPage()

  try {
    // 1. HPにアクセス
    console.log('📄 conocola.com にアクセス...')
    await page.goto('https://conocola.com', { waitUntil: 'domcontentloaded', timeout: NAVIGATION_TIMEOUT })
    await delay(2000)

    // 2. 問い合わせページを探す
    console.log('🔍 問い合わせページを探索中...')
    const contactLink = await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('a[href]'))
      const keywords = ['問い合わせ', 'お問い合わせ', 'contact', 'inquiry']
      for (const link of links) {
        const href = (link as HTMLAnchorElement).href
        const text = link.textContent?.trim() ?? ''
        for (const kw of keywords) {
          if (href.toLowerCase().includes(kw) || text.toLowerCase().includes(kw)) return href
        }
      }
      return null
    })

    let contactUrl = contactLink
    if (!contactUrl) {
      for (const path of CONTACT_PATHS) {
        const url = `https://conocola.com${path}`
        try {
          const resp = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: NAVIGATION_TIMEOUT })
          if (resp && resp.status() < 400) {
            const hasForm = await page.evaluate(() => document.querySelectorAll('form').length > 0)
            if (hasForm) { contactUrl = url; break }
          }
        } catch {}
      }
    }

    if (!contactUrl) {
      console.log('❌ 問い合わせページが見つかりません')
      await delay(30000)
      return
    }

    console.log(`✅ 問い合わせページ: ${contactUrl}`)
    if (page.url() !== contactUrl) {
      await page.goto(contactUrl, { waitUntil: 'domcontentloaded', timeout: NAVIGATION_TIMEOUT })
      await delay(2000)
    }

    // 3. テストデータで全フィールド入力
    console.log('\n✏️ テストデータを入力中...\n')

    const testData = {
      company: '株式会社CONOCOLA',
      name: '河野大地',
      furigana: 'コウノダイチ',
      email: 'conocola2020@gmail.com',
      phone: '052-228-4945',
      body: 'お忙しいところ失礼いたします。\n\n株式会社CONOCOLAの河野と申します。\n\nこれはテスト送信です。',
    }

    // ─── まずラジオボタン（条件付きフィールドが表示される場合がある） ───
    console.log('  ラジオボタンを選択中...')
    const radioSelected = await page.evaluate(() => {
      const radios = Array.from(document.querySelectorAll('input[type="radio"]'))
      // 「その他」を探す
      for (const radio of radios) {
        const name = radio.getAttribute('name') || ''
        const value = radio.getAttribute('value') || ''
        const parent = radio.closest('label')
        const labelText = parent?.textContent || ''
        if (value.includes('その他') || labelText.includes('その他')) {
          (radio as HTMLInputElement).click()
          return `${name}: ${value || labelText.trim()}`
        }
      }
      // なければ最後のラジオグループの最後を選択
      if (radios.length > 0) {
        const last = radios[radios.length - 1] as HTMLInputElement
        last.click()
        return `${last.name}: ${last.value}`
      }
      return null
    })
    if (radioSelected) {
      console.log(`  ✅ ラジオボタン: ${radioSelected}`)
    } else {
      console.log('  ⚠️ ラジオボタン: なし')
    }
    await delay(500)

    // ─── 名前（フリガナでない方） ───
    const nameSelectors = [
      'input[name="お名前"]:not([name*="フリガナ"])',
      'input[name="氏名"]',
      'input[name*="name" i]:not([name*="company" i]):not([name*="mail" i]):not([name*="kana" i]):not([name*="フリガナ" i]):not([type="email"])',
    ]
    await fillFirst(page, nameSelectors, testData.name, '名前')

    // ─── フリガナ ───
    const furiganaSelectors = [
      'input[name*="フリガナ" i]', 'input[name*="ふりがな" i]',
      'input[name*="kana" i]', 'input[placeholder*="フリガナ" i]',
    ]
    await fillFirst(page, furiganaSelectors, testData.furigana, 'フリガナ')

    // ─── 電話番号 ───
    const phoneSelectors = [
      'input[name="電話番号"]', 'input[type="tel"]',
      'input[name*="phone" i]', 'input[name*="tel" i]', 'input[name*="電話" i]',
    ]
    await fillFirst(page, phoneSelectors, testData.phone, '電話番号')

    // ─── メールアドレス（確認用でない方） ───
    const emailSelectors = [
      'input[name="メールアドレス"]',
      'input[type="email"]:not([name*="確認" i])',
      'input[name*="mail" i]:not([name*="確認" i]):not([name*="confirm" i])',
    ]
    await fillFirst(page, emailSelectors, testData.email, 'メールアドレス')

    // ─── メールアドレス（確認用） ───
    const emailConfirmSelectors = [
      'input[name*="メールアドレス(確認" i]',
      'input[name*="メールアドレス（確認" i]',
      'input[name*="confirm" i][name*="mail" i]',
      'input[name*="確認" i][name*="メール" i]',
    ]
    await fillFirst(page, emailConfirmSelectors, testData.email, 'メール(確認用)')

    // ─── 会社名（ラジオボタン選択後に表示される場合がある） ───
    const companySelectors = [
      'input[name="会社名または店舗名"]', 'input[name="会社名"]',
      'input[name*="会社名" i]', 'input[name*="会社" i]',
      'input[name*="店舗名" i]', 'input[name*="店舗" i]',
      'input[name*="company" i]', 'input[placeholder*="会社" i]',
    ]
    await fillFirst(page, companySelectors, testData.company, '会社名')

    // ─── お問い合わせ内容 ───
    const bodySelectors = [
      'textarea[name*="内容" i]', 'textarea[name*="message" i]',
      'textarea[name*="body" i]', 'textarea',
    ]
    await fillFirst(page, bodySelectors, testData.body, 'お問い合わせ内容')

    // ─── 同意チェックボックス ───
    console.log('  チェックボックスを確認中...')
    const checkedCount = await page.evaluate(() => {
      const checkboxes = Array.from(document.querySelectorAll('input[type="checkbox"]'))
      let count = 0
      for (const cb of checkboxes) {
        const checkbox = cb as HTMLInputElement
        if (checkbox.checked) continue
        const name = checkbox.getAttribute('name') || ''
        const parent = checkbox.closest('div, p, li, label')
        const text = (name + (parent?.textContent || '')).toLowerCase()
        if (text.includes('同意') || text.includes('個人情報') || text.includes('プライバシー') || text.includes('agree') || text.includes('privacy')) {
          checkbox.click()
          count++
        }
      }
      return count
    })
    if (checkedCount > 0) {
      console.log(`  ✅ チェックボックス: ${checkedCount}件チェック`)
    } else {
      console.log('  ⚠️ チェックボックス: 該当なし')
    }

    // 4. 入力完了スクリーンショット
    await delay(1000)
    await page.screenshot({ path: '/tmp/conocola-form-before-submit.png', fullPage: true })
    console.log('\n📸 入力完了スクリーンショット: /tmp/conocola-form-before-submit.png')

    // 5. 送信ボタンをクリック
    console.log('\n🚀 送信ボタンをクリック...')
    const submitSelectors = [
      'button[type="submit"]',
      'input[type="submit"]',
      'button:has-text("確認")',
      'button:has-text("送信")',
      'input[value*="確認"]',
      'input[value*="送信"]',
    ]

    let submitted = false
    for (const sel of submitSelectors) {
      try {
        const el = await page.$(sel)
        if (el && await el.isVisible()) {
          await el.scrollIntoViewIfNeeded()
          await delay(300)
          const btnText = await el.textContent() || await el.getAttribute('value') || sel
          console.log(`  ✅ ボタンクリック: "${btnText.trim()}"`)
          await el.click()
          submitted = true
          break
        }
      } catch {}
    }

    if (!submitted) {
      console.log('  ❌ 送信ボタンが見つかりませんでした')
      await delay(30000)
      return
    }

    // 6. ページ遷移を待つ
    await delay(3000)
    await page.screenshot({ path: '/tmp/conocola-form-after-submit.png', fullPage: true })
    console.log(`📸 送信後スクリーンショット: /tmp/conocola-form-after-submit.png`)
    console.log(`  現在のURL: ${page.url()}`)

    // 7. 確認画面がある場合 → もう一度送信ボタンをクリック
    const pageText = await page.evaluate(() => document.body.innerText.substring(0, 500))
    console.log(`  ページテキスト（先頭）: ${pageText.substring(0, 200)}`)

    if (pageText.includes('確認') || pageText.includes('内容をご確認')) {
      console.log('\n📝 確認画面を検出。最終送信ボタンをクリック...')
      const confirmSelectors = [
        'button:has-text("送信")',
        'input[type="submit"]',
        'input[value*="送信"]',
        'button:has-text("この内容で送信")',
        'button:has-text("上記内容で送信")',
      ]

      for (const sel of confirmSelectors) {
        try {
          const el = await page.$(sel)
          if (el && await el.isVisible()) {
            const btnText = await el.textContent() || await el.getAttribute('value') || sel
            console.log(`  ✅ 最終送信ボタンクリック: "${btnText.trim()}"`)
            await el.click()
            break
          }
        } catch {}
      }

      await delay(3000)
      await page.screenshot({ path: '/tmp/conocola-form-final.png', fullPage: true })
      console.log(`📸 最終スクリーンショット: /tmp/conocola-form-final.png`)
      console.log(`  現在のURL: ${page.url()}`)
    }

    // 8. 完了確認
    const finalText = await page.evaluate(() => document.body.innerText.substring(0, 300))
    if (finalText.includes('ありがとう') || finalText.includes('送信完了') || finalText.includes('受け付け')) {
      console.log('\n🎉 送信成功！')
    } else {
      console.log('\n⚠️ 送信結果を確認してください')
    }
    console.log(`  ページ内容: ${finalText.substring(0, 200)}`)

    await delay(10000)

  } catch (err) {
    console.error('❌ エラー:', err)
    await delay(30000)
  } finally {
    await context.close()
    await browser.close()
    console.log('\n🏁 テスト終了')
  }
}

async function fillFirst(page: Awaited<ReturnType<typeof chromium.launch>>extends never ? never : any, selectors: string[], value: string, label: string): Promise<boolean> {
  for (const selector of selectors) {
    try {
      const el = await page.$(selector)
      if (!el) continue

      const inputType = await el.getAttribute('type')
      if (inputType === 'hidden') continue

      // まずvisibleチェック
      let visible = await el.isVisible()

      // 非表示でもスクロールして再チェック
      if (!visible) {
        try {
          await el.scrollIntoViewIfNeeded()
          await delay(300)
          visible = await el.isVisible()
        } catch {}
      }

      // それでも非表示なら、JS経由で強制的にdisplayを変更して入力を試みる
      if (!visible) {
        try {
          await page.evaluate((sel: string) => {
            const el = document.querySelector(sel) as HTMLInputElement
            if (el) {
              el.style.display = 'block'
              el.style.visibility = 'visible'
              el.style.opacity = '1'
            }
          }, selector)
          await delay(200)
          visible = await el.isVisible()
        } catch {}
      }

      if (visible) {
        await el.click()
        await delay(100)
        await el.fill(value)
        console.log(`  ✅ ${label}: 入力完了 (${selector})`)
        return true
      }

      // 最終手段: evaluate で直接値をセット
      const set = await page.evaluate((sel: string, val: string) => {
        const el = document.querySelector(sel) as HTMLInputElement
        if (el) {
          el.value = val
          el.dispatchEvent(new Event('input', { bubbles: true }))
          el.dispatchEvent(new Event('change', { bubbles: true }))
          return true
        }
        return false
      }, selector, value)

      if (set) {
        console.log(`  ✅ ${label}: JS直接入力完了 (${selector})`)
        return true
      }
    } catch {}
  }
  console.log(`  ⚠️ ${label}: フィールドが見つかりませんでした`)
  return false
}

main()
