# デプロイ手順 v2.2.303　ランクの翌月・翌々月が「2026/13」になる不具合を直す

| # | 何が変わるか | どこ |
|---|---|---|
| 1 | 更新履歴1行・**保存済みの対象月「YYYY/13」「YYYY/14」を翌年の「01」「02」に直す**（本番では注文の 36人が「2026/13」） | ① DB `backend/scripts/sql/2026-11-26_update_log_2.2.303.sql` |
| 2 | ランク（店舗・担当別反響）の表の見出しと、顧客ごとの対象月の選択肢が、12月の次を「2027/01」と出す（3事業とも） | Dashboard（frontend の build） |

- ⚠️ v2.2.302 を先に済ませてください。表の列の変更はありません（テーブル定義書の SQL もありません）。
- ② VPS・① PHP は変わりません。
- ⚠️ 手順1と2は続けて行ってください。SQL だけ先に流すと、古い画面の「2026/13」の列が空になります（件数は前から「2027/01」で数えているので、数字そのものは変わりません）。画面だけ先に上げると、36人が「2027/01」の列に入らないままです。

## 先に（夜間モードの解除）
この版の後半は夜間モードで進めました（push は済んでいます）。朝に解除してください。
1. `C:\Users\shinji-kawano\.claude\settings.json` から次の2つを手で消す（ほかの設定は残す。前の行の最後のカンマも消す）
   ```json
     "permissions": {
       "denyInsteadOfPrompting": true
     },
     "autoContinueAtUsageLimit": true
   ```
2. VS Code を再読み込みする（コマンドパレット →「ウィンドウの再読み込み」）

## 順序
```
1. GitHub で v2.2.303 を production へマージ（PR）
2. ① SQL：2026-11-26_update_log_2.2.303.sql   ← ⚠️ 1回だけ
3. Dashboard の画面を build してアップロード
```

### 手順2　【① SQL】
```bash
mysql < 2026-11-26_update_log_2.2.303.sql
```
- 流す前に件数を見ておくと、直ったかを確かめられます（本番の 11/26 朝のバックアップでは master_data に「2026/13」が 36件）。
  ```sql
  SELECT rank_period, COUNT(*) FROM master_data WHERE rank_period REGEXP '^[0-9]{4}/1[34]$' GROUP BY rank_period;
  ```
- 流したあとは、上の SELECT が 0行になればよいです。
  ```sql
  SELECT no, version, date FROM update_log ORDER BY no DESC LIMIT 3;
  ```

### 手順3　【Dashboard の画面】
いつもどおり build して、アップロードします。
- 変えたファイル：
  - `src/utils/addMonths.ts`（新規）
  - `src/components/rank/RankOrder.tsx`
  - `src/components/rank/RankKaeru.tsx`
  - `src/components/rank/RankResale.tsx`
  - `src/utils/version.ts`

## 終わったら（動作確認）
1. 注文の「店舗・担当別反響」を開く。表の2段目の見出しが「2026/11・2026/12・2027/01」になっている（「2026/13」が無い）。
2. 「2027/01」の列の数字が、以前の「2026/13」の列のときより増えている（36人のうち見込みの人が入る）。
3. 数字を押して顧客の一覧を開き、対象月の選択肢が「2026/11・2026/12・2027/01」になっている。
4. 建売・中古の同じ画面でも 1 と 3 が同じ。

## 切り戻し
- 画面：前の build に戻す。⚠️ その場合、「2027/01」に直した対象月は前の画面の選択肢（2026/13）に無いので、選択肢の表示が空になります。12月になって見出しが変わるまでは、画面だけ戻しても数字は変わりません。
- SQL：戻さない（「2026/13」は誤った値のため）。
