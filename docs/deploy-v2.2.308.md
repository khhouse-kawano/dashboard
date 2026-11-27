# デプロイ手順 v2.2.308　媒介獲得台帳の「編集」で初めに「台帳の編集」のタブを開く

| # | 何が変わるか | どこ |
|---|---|---|
| 1 | 更新履歴1行・業務ガイド「反響から商談案件へのつながり（不動産企画係）」（初めに開くタブの文） | ① DB `backend/scripts/sql/2026-11-27_update_log_2.2.308.sql` |
| 2 | いえらぶと連携済みの台帳の「編集」で、初めに「台帳の編集」のタブを開く（v2.2.307 は「物件の状況」から）。物件の状況はタブを押したときに読み込む | Dashboard（frontend の build） |

- ⚠️ v2.2.307 を先に済ませてください。② VPS・① PHP・表の変更はありません。

## 順序
```
1. GitHub で v2.2.308 を production へマージ（PR）
2. ① SQL：2026-11-27_update_log_2.2.308.sql   ← ⚠️ 1回だけ
3. Dashboard の画面を build してアップロード
```

### 手順2　【① SQL】
```bash
mysql < 2026-11-27_update_log_2.2.308.sql
```
```sql
SELECT no, version, date FROM update_log ORDER BY no DESC LIMIT 3;
```

### 手順3　【Dashboard の画面】
いつもどおり build して、アップロードします。
- 変えたファイル：
  - `src/components/database/PropertyRegister.tsx`
  - `src/utils/version.ts`

## 終わったら（動作確認）
1. 媒介獲得台帳で、いえらぶと連携済みの台帳の「編集」を押す。「台帳の編集」のタブが選ばれた状態で開く。
2. 「物件の状況」を押すと、物件の状況が出る。閉じて開き直すと、また「台帳の編集」から開く。

## 切り戻し
- 画面：前の build に戻す（データは変わっていません）。
