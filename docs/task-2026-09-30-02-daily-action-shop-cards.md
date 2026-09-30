# 2026-09-30 要確認モーダルに但し書きと店舗別カードを追加（v2.2.154）

## ⚠️ 依頼

⚠️ `frontend/src/components/DailyAction.tsx` の改修。

| # | |
|---|---|
| 1 | ⚠️ `対応が必要な顧客と、本日の予定です` に加えて ⚠️⚠️ **「本日の反響については未同期数に含みません」を追加。** ⚠️ **boldで少し視認性をよく** |
| 2 | ⚠️⚠️ **未同期テーブルの上に、未同期のある店舗とその数を小さなカードで表示。** ⚠️ **未同期数の多い店舗から** |

---

## ⚠️ 変えたもの

| ディレクトリ | ファイル | |
|---|---|---|
| `frontend/src/components/` | ⚠️ **DailyAction.tsx** | ⚠️ 但し書き・店舗カード・スタイル |

⚠️⚠️ **フロントだけ。** ⚠️ ⚠️ **①② のどちらも変えていない**（⚠️ **店舗名はもともと行に入っている**）。
⚠️ ⚠️ **DBも変えていない。**

---

## ⚠️ 追加した関数（そのまま）

```tsx
/**
 * ⚠️⚠️ **未同期の表の見出し。**
 *   ⚠️ サーバー（features/dailyAction.ts）が付けている名前と同じにすること。
 *   ⚠️ ⚠️ **店舗別カードはこの表の上にだけ出す。**
 */
const UNSYNC_LABEL = '未同期';

/**
 * 未同期の行を店舗ごとに数える（2026-09-30 追加）。
 *
 * ⚠️⚠️ **件数の多い店舗から並べる**（指示）。
 *   ⚠️ 同数のときは ⚠️ **店舗名の順**にする（⚠️ **並びが毎回変わるのを防ぐため**）。
 *
 * ⚠️ ⚠️ **数えているのは「画面に出ている行」である。**
 *   ⚠️⚠️ **上限（200行）で切られているときは実際より少ない。**
 *     ⚠️ そのことは `truncated` の注意書きで伝えている。
 */
const countByShop = (rows: Row[]): { shop: string; count: number }[] => {
    const counts = new Map<string, number>();
    for (const row of rows) {
        const shop = orUnset(row.shop);
        counts.set(shop, (counts.get(shop) ?? 0) + 1);
    }
    return [...counts.entries()]
        .map(([shop, count]) => ({ shop, count }))
        .sort((a, b) => (b.count - a.count) || a.shop.localeCompare(b.shop, 'ja'));
};
```

⚠️⚠️ **同数のときに店舗名で並べている理由**: ⚠️ `Map` の順は挿入順なので、⚠️ **データが少し変わるたびにカードの位置が入れ替わって読みにくい。**

---

## ⚠️ 但し書き（1つめ）

```tsx
                {/* ⚠️ 但し書きが増えたので折り返す。⚠️ **狭い画面ではみ出さないように** */}
                <div className='d-flex align-items-baseline flex-wrap' style={{ gap: '10px' }}>
                    <span className='da_title'>要確認</span>
                    <span className='da_note'>対応が必要な顧客と、本日の予定です</span>
                    {/* ⚠️⚠️ **本日ぶんを数えていないことを明示する**（2026-09-30 の指示） */}
                    <span className='da_note_strong'>本日の反響については未同期数に含みません</span>
                </div>
```

⚠️ ⚠️ **`flex-wrap` を足した。** ⚠️ 足さないと ⚠️⚠️ **狭い画面で「確認しました」ボタンまで押し出される。**

---

## ⚠️ 店舗カード（2つめ）

```tsx
                        {/*
                          ⚠️⚠️ **未同期の表の上にだけ、店舗ごとの件数を出す**（2026-09-30 の指示）。
                            ⚠️ ⚠️ **多い店舗から並べる。**
                            ⚠️ 他の表（来場日未入力・本日の予定）には出さない。
                        */}
                        {section.label === UNSYNC_LABEL && (
                            <div className='da_shops'>
                                {countByShop(section.rows).map((item) => (
                                    <span className='da_shop_card' key={item.shop}>
                                        {item.shop}
                                        <span className='da_shop_count'>{item.count.toLocaleString()}</span>
                                    </span>
                                ))}
                            </div>
                        )}
```

---

## ⚠️ 追加したスタイル

```css
                /*
                 * ⚠️ 見落とされると困る但し書き（2026-09-30 の指示）。
                 *   ⚠️⚠️ **太字にして、少しだけ目立たせる。**
                 *   ⚠️ ⚠️ **赤にはしない。** ⚠️ 放置日数の赤と意味が混ざる。
                 */
                .da_note_strong { font-size: 11px; font-weight: 700; color: #b45309;
                                  background: #fffbeb; border: 1px solid #fde68a;
                                  border-radius: 999px; padding: 1px 9px; white-space: nowrap; }

                /*
                 * ⚠️ 未同期のある店舗のカード（2026-09-30 の指示）。
                 *   ⚠️⚠️ **未同期の表の上にだけ出す。** ⚠️ 他の表には出さない。
                 *   ⚠️ 上のまとめ（da_kpi_card）より一回り小さくする。
                 */
                .da_shops { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 8px; }
                .da_shop_card { display: inline-flex; align-items: baseline; gap: 6px;
                                background: #fef2f2; border: 1px solid #fecaca;
                                border-radius: 999px; padding: 3px 10px; font-size: 11px;
                                color: #7f1d1d; white-space: nowrap; }
                .da_shop_count { font-weight: 700; color: #b91c1c;
                                 font-variant-numeric: tabular-nums; }
```

⚠️ 色の使い分け

| | |
|---|---|
| ⚠️ 但し書き | ⚠️⚠️ **黄色**（⚠️ 情報） |
| ⚠️ 店舗カード | ⚠️⚠️ **赤**（⚠️ 未同期＝放置。⚠️ 上のまとめカードの `is_alert` と同じ系統） |

⚠️ ⚠️ **但し書きを赤にしなかったのは、放置日数の赤と意味が混ざるため。**

---

## ⚠️ ローカルでの確認（実施済み）

⚠️ ⚠️ **実データ（`runDailyAction`）で、画面と同じ集計を再現して確かめた。**

| # | 見たこと | 結果 |
|---|---|---|
| 1 | ⚠️ 未同期の行数 | ⚠️ ✅ **64件** |
| 2 | ⚠️⚠️ **カードの合計＝表の行数** | ⚠️ ✅ **64 = 64** |
| 3 | ⚠️⚠️ **件数の多い順に並ぶ** | ⚠️ ✅ |
| 4 | ⚠️ 店舗数 | ⚠️ ✅ **14店舗** |
| 5 | ⚠️ 店舗名が空の行 | ⚠️ ✅ **`(未設定)` にまとまる**（⚠️ 既存の `orUnset`） |
| 6 | ⚠️ 他の表にカードが出ない | ⚠️ ✅ **未同期だけ** |
| 7 | ⚠️⚠️ **`<style>` の中にバッククォートが無い** | ⚠️ ✅ **自動で確認**（⚠️ この案件で何度も壊している） |
| 8 | ⚠️ フロントのビルド | ⚠️ ✅ `main.a9db4117.js`（⚠️ +455B） |

⚠️ 実データの上位（参考）

```
 1. KH店舗未設定  18
 2. KH宮崎店       7
 3. KH大分店       6
 4. PGH宮崎店      6
 5. DJH店舗未設定  5
```

⚠️ ⚠️ **検証スクリプトは削除済み。** ⚠️ DBには何も書いていない。

---

## ⚠️ 申し送り

| # | 内容 |
|---|---|
| 1 | ⚠️⚠️ **フロントだけの改修。** ⚠️ ②の再ビルドも ①のPHPも不要 |
| 2 | ⚠️⚠️ **カードの数は「画面に出ている行」の数。** ⚠️ 上限200行で切られると実際より少ない（⚠️ そのときは既存の注意書きが出る） |
| 3 | ⚠️ ⚠️ **「本日の反響を含まない」のは元からの仕様。** ⚠️ **数え方は変えていない**（⚠️ 表示で明示しただけ） |
| 4 | ⚠️ ⚠️ **`(未設定)` と `◯◯店舗未設定` は別物。** ⚠️ 後者はサーバーが付けるブランド名付きの名前 |
| 5 | ⚠️ ブラウザでの表示は ⚠️⚠️ **未確認**（ヘッドレスブラウザが無い）。⚠️ **集計は実データで確認済み** |
