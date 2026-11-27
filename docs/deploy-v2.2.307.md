# デプロイ手順 v2.2.307　媒介獲得台帳の物件の画面に「物件の状況」（基本情報・PV・地図・報告書作成・買い反響の歩留まり）

| # | 何が変わるか | どこ |
|---|---|---|
| 1 | 更新履歴1行・業務ガイド「反響から商談案件へのつながり（不動産企画係）」（物件の状況の段） | ① DB `backend/scripts/sql/2026-11-27_update_log_2.2.307.sql` |
| 2 | 媒介獲得台帳で、いえらぶと連携済み（保存済みの `property_db_id` あり）の台帳の「編集」に「物件の状況」「台帳の編集」のタブ。物件の状況＝基本情報・PVサマリ（物件DB と同じ式。数字を押すと掲載サマリ）・地図・報告書作成・買い反響（ledgerId がこの台帳のもの）の6段の歩留まり（押すと md の顧客一覧 → 編集で買い反響の顧客画面）。物件の詳細の SUUMO の PV を累計（pv_total）にそろえた | Dashboard（frontend の build） |

- ⚠️ v2.2.306 を先に済ませてください。② VPS・① PHP・表の変更はありません（物件は今ある `property_detail`（GET）、買い反響は今ある `planner:records` で読む）。
- 新しい部品：`database/LedgerPropertyStatus.tsx`（物件の状況）・`database/propertyParts.tsx`（基本情報・PVサマリ・地図・PV の式。物件の詳細から切り出した）・`database/PortalDetailModal.tsx`（掲載サマリ。物件DB の中にあったものをそのまま移した）。

## 順序
```
1. GitHub で v2.2.307 を production へマージ（PR）
2. ① SQL：2026-11-27_update_log_2.2.307.sql   ← ⚠️ 1回だけ
3. Dashboard の画面を build してアップロード
```

### 手順2　【① SQL】
```bash
mysql < 2026-11-27_update_log_2.2.307.sql
```
```sql
SELECT no, version, date FROM update_log ORDER BY no DESC LIMIT 3;
```

### 手順3　【Dashboard の画面】
いつもどおり build して、アップロードします。
- 変えたファイル：
  - `src/components/database/LedgerPropertyStatus.tsx`（新規）
  - `src/components/database/propertyParts.tsx`（新規）
  - `src/components/database/PortalDetailModal.tsx`（新規）
  - `src/components/database/PropertyRegister.tsx`（タブ）
  - `src/components/database/DatabaseBroker.tsx`（保存済みのいえらぶ番号・報告書作成）
  - `src/components/database/PropertySummary.tsx`（部品を使う・SUUMO の PV を累計に・報告書の編集から開く）
  - `src/components/database/DatabaseProperty.tsx`（掲載サマリを部品に）
  - `src/utils/version.ts`

## 終わったら（動作確認）
1. 不動産企画係の「媒介獲得台帳」で、ポータル連携（いえらぶ）が「No.〇〇〇〇〇〇」の台帳の「編集」を押す。「物件の状況」「台帳の編集」のタブが出て、物件の状況が開く。
2. 基本情報・PVサマリ・地図・買い反響の歩留まりが出る。PVサマリの数字を押すと掲載サマリが開く。PV は「掲載物件一覧」の同じ物件と同じ値。
3. 歩留まりの数字を押すと顧客一覧が開き、「編集」で買い反響の顧客画面が開く。保存すると買い反響の一覧にも入る。
4. 「報告書作成」で台帳の画面が閉じ、物件の詳細が報告書の編集から開く。PDF の作成も今までどおり。
5. 「台帳の編集」タブで、今までどおり直して保存できる。いえらぶ未連携の台帳はタブが出ない。
6. 「掲載物件一覧」（物件DB）で PV の数字を押すと、掲載サマリが今までどおり開く。

## 切り戻し
- 画面：前の build に戻す（データは変わっていません）。
