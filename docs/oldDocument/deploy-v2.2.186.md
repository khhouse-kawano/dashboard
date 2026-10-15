# デプロイ手順 v2.2.186

⚠️ **v2.2.181〜v2.2.185 を含む**（181 → … → 186 と順に切っている）。まだ出していなければ、⚠️ **v2.2.186 の PR だけマージすればまとめて出る**。⚠️ update_log は未実施の版を **番号順に**すべて流す。

| # | 何が変わるか | どこ |
|---|---|---|
| 1 | 架電状況: ⚠️ **総架電数に SMS送信も含める**（店舗スタッフ表示・インサイドセールス表示の両方。通電数は変わらない） | ① フロント |
| 1' | （v2.2.181〜185）フェスタ画面の改修一式 | ① フロント |
| 2 | 更新履歴 | ① DB |

⚠️ **② VPS・① PHP・DB の列・LP は変更なし。**

## 順序
```
0. GitHub で v2.2.186 を main → production へマージ
1. ① フロント（build）
2. ① SQL（update_log）
```

## 手順1　【WSL】フロントを ① へアップロード
| ファイル | |
|---|---|
| ⚠️⚠️ **`static/js/main.d77bae53.js`** | ⚠️ **この版の本体** |
| `static/css/main.7c10f266.css` | ⚠️ 変更なし |
| ⚠️ `index.html` | ⚠️⚠️ **必ず差し替えること** |
```bash
deploy-dashboard
```

## 手順2　【① phpMyAdmin】更新履歴
⚠️ 未実施のものを、⚠️ この順に:
1. `backend/scripts/sql/2026-10-10_update_log_2.2.181.sql`
2. `backend/scripts/sql/2026-10-10_update_log_2.2.182.sql`
3. `backend/scripts/sql/2026-10-10_update_log_2.2.183.sql`
4. `backend/scripts/sql/2026-10-10_update_log_2.2.184.sql`
5. `backend/scripts/sql/2026-10-10_update_log_2.2.185.sql`
6. `backend/scripts/sql/2026-10-10_update_log_2.2.186.sql`
```sql
SELECT no, version, date FROM update_log ORDER BY no DESC LIMIT 3;
```
⚠️ 一番上が `2.2.186` なら完了。

## 出したあとの確認
| # | 見ること | 期待 |
|---|---|---|
| 1 | ヘッダーの版 | **2.2.186** |
| 2 | 架電状況（店舗スタッフ）で 高 裕真 の 2026/10 の総架電数 | ⚠️ 本番 SQL の 通電＋未通電＋SMS送信（2026-10-10 時点で 6＋3＋19＝28。その後の架電で増える） |
| 3 | 通電数 | 変わらない |
| 4 | インサイドセールス表示 | 総架電数が SMS送信数の分だけ増える |

## 切り戻し
| 対象 | 方法 |
|---|---|
| ① フロント | v2.2.185（`main.bdbdf425.js`）など前の版の index.html と本体に戻す |
