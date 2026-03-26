"""
サウナイキタイから飲食サービスのあるサウナ施設をスクレイピング
- 検索フィルタ「食事処あり」(conditions[]=facility#has_foodspace) を使用
- 全国の都道府県別にページネーションして全施設を取得
- 検索ページ内の __MAP_DATA JSON から施設情報を抽出
- 結果を sauna_with_food.csv に保存
"""

from __future__ import annotations

import time
import random
import csv
import re
import json
import sys
from urllib.parse import urlencode

import requests

BASE_URL = "https://sauna-ikitai.com"

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                  "AppleWebKit/537.36 (KHTML, like Gecko) "
                  "Chrome/124.0.0.0 Safari/537.36",
    "Accept-Language": "ja,en;q=0.9",
}

# 都道府県スラッグ一覧
PREFECTURES = [
    "hokkaido", "aomori", "iwate", "miyagi", "akita", "yamagata", "fukushima",
    "ibaraki", "tochigi", "gunma", "saitama", "chiba", "tokyo", "kanagawa",
    "niigata", "toyama", "ishikawa", "fukui", "yamanashi", "nagano",
    "gifu", "shizuoka", "aichi", "mie",
    "shiga", "kyoto", "osaka", "hyogo", "nara", "wakayama",
    "tottori", "shimane", "okayama", "hiroshima", "yamaguchi",
    "tokushima", "kagawa", "ehime", "kochi",
    "fukuoka", "saga", "nagasaki", "kumamoto", "oita", "miyazaki", "kagoshima", "okinawa",
]

PREF_NAMES = {
    "hokkaido": "北海道", "aomori": "青森県", "iwate": "岩手県", "miyagi": "宮城県",
    "akita": "秋田県", "yamagata": "山形県", "fukushima": "福島県",
    "ibaraki": "茨城県", "tochigi": "栃木県", "gunma": "群馬県",
    "saitama": "埼玉県", "chiba": "千葉県", "tokyo": "東京都", "kanagawa": "神奈川県",
    "niigata": "新潟県", "toyama": "富山県", "ishikawa": "石川県", "fukui": "福井県",
    "yamanashi": "山梨県", "nagano": "長野県",
    "gifu": "岐阜県", "shizuoka": "静岡県", "aichi": "愛知県", "mie": "三重県",
    "shiga": "滋賀県", "kyoto": "京都府", "osaka": "大阪府", "hyogo": "兵庫県",
    "nara": "奈良県", "wakayama": "和歌山県",
    "tottori": "鳥取県", "shimane": "島根県", "okayama": "岡山県",
    "hiroshima": "広島県", "yamaguchi": "山口県",
    "tokushima": "徳島県", "kagawa": "香川県", "ehime": "愛媛県", "kochi": "高知県",
    "fukuoka": "福岡県", "saga": "佐賀県", "nagasaki": "長崎県", "kumamoto": "熊本県",
    "oita": "大分県", "miyazaki": "宮崎県", "kagoshima": "鹿児島県", "okinawa": "沖縄県",
}


def polite_sleep():
    """1〜2秒のランダムな待機"""
    time.sleep(1.0 + random.random())


def fetch_search_page(pref_slug: str, page: int) -> tuple[list[dict], int]:
    """
    検索ページを取得し、__MAP_DATA JSONから施設リストを抽出。
    returns: (施設リスト, 最大ページ番号)
    """
    params = {
        "page": page,
        "prefecture[0]": pref_slug,
        "conditions[]": "facility#has_foodspace",
    }
    url = f"{BASE_URL}/search?{urlencode(params, doseq=True)}"

    try:
        resp = requests.get(url, headers=HEADERS, timeout=30)
        resp.raise_for_status()
    except requests.RequestException as e:
        print(f"  [ERROR] page {page}: {e}", flush=True)
        return [], 0

    text = resp.text

    # __MAP_DATA JSON を抽出
    match = re.search(r"window\.__MAP_DATA\s*=\s*(\[.*?\]);", text)
    facilities = []
    if match:
        try:
            facilities = json.loads(match.group(1))
        except json.JSONDecodeError:
            pass

    # 最大ページ番号を取得
    page_numbers = [int(p) for p in re.findall(r"page=(\d+)", text)]
    max_page = max(page_numbers) if page_numbers else page

    return facilities, max_page


def build_row(item: dict, pref_name: str) -> dict:
    """__MAP_DATA の1アイテムからCSV行を作成"""
    address_parts = [
        item.get("prefecture", pref_name),
        item.get("address1", ""),
        item.get("address2", ""),
        item.get("address3", ""),
    ]
    address = " ".join(p for p in address_parts if p).strip()

    return {
        "施設名": item.get("name", "不明"),
        "都道府県": item.get("prefecture", pref_name),
        "住所": address,
        "電話番号": "",  # 検索APIでは提供されない（施設ページで確認可能）
        "URL": f"{BASE_URL}/saunas/{item['id']}",
    }


def save_csv(path: str, rows: list[dict]):
    """結果をCSVに保存"""
    if not rows:
        return
    fieldnames = ["施設名", "都道府県", "住所", "電話番号", "URL"]
    with open(path, "w", newline="", encoding="utf-8-sig") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)


def main():
    output_file = "sauna_with_food.csv"
    results = []
    seen_ids = set()

    print("=" * 60, flush=True)
    print("サウナイキタイ スクレイピング開始", flush=True)
    print("フィルタ: 食事処あり (conditions[]=facility#has_foodspace)", flush=True)
    print("=" * 60, flush=True)

    for pref_slug in PREFECTURES:
        pref_name = PREF_NAMES[pref_slug]
        print(f"\n▶ {pref_name} ...", end="", flush=True)

        page = 1
        max_page = 1
        pref_count = 0

        while page <= max_page:
            facilities, discovered_max = fetch_search_page(pref_slug, page)
            if discovered_max > max_page:
                max_page = discovered_max

            for item in facilities:
                sid = item.get("id")
                if sid and sid not in seen_ids:
                    seen_ids.add(sid)
                    results.append(build_row(item, pref_name))
                    pref_count += 1

            if not facilities:
                break

            page += 1
            if page <= max_page:
                polite_sleep()

        print(f" {pref_count}件", flush=True)

        # 途中経過を保存
        if results:
            save_csv(output_file, results)

    save_csv(output_file, results)

    print("\n" + "=" * 60, flush=True)
    print(f"スクレイピング完了!", flush=True)
    print(f"  食事処ありの施設: {len(results)}件", flush=True)
    print(f"  保存先: {output_file}", flush=True)
    print("=" * 60, flush=True)


if __name__ == "__main__":
    main()
