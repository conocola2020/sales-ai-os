"""
sauna_with_food.csv → sauna_leads.csv
営業AI OSのリードCSVインポート形式に変換
"""

import csv

INPUT = "sauna_with_food.csv"
OUTPUT = "sauna_leads.csv"

# 営業AI OSのリードCSVカラム
FIELDNAMES = ["会社名", "担当者名", "メールアドレス", "電話番号", "URL", "業種", "ステータス", "メモ"]


def main():
    rows = []

    with open(INPUT, encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        for row in reader:
            rows.append({
                "会社名": row.get("施設名", ""),
                "担当者名": "",
                "メールアドレス": "",
                "電話番号": row.get("電話番号", ""),
                "URL": row.get("URL", ""),
                "業種": "サウナ・温浴施設",
                "ステータス": "未着手",
                "メモ": row.get("都道府県", ""),
            })

    with open(OUTPUT, "w", newline="", encoding="utf-8-sig") as f:
        writer = csv.DictWriter(f, fieldnames=FIELDNAMES)
        writer.writeheader()
        writer.writerows(rows)

    print(f"変換完了: {len(rows)}件 → {OUTPUT}")


if __name__ == "__main__":
    main()
