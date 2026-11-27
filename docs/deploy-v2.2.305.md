# デプロイ手順 v2.2.305　ランク・SUUMO掲載順位・重複反響サマリーを GET で必要な分だけ／SUUMO掲載順位をページに／鍵のアイコン

| # | 何が変わるか | どこ |
|---|---|---|
| 1 | 更新履歴1行・業務ガイド6本（物件DB・重複反響サマリー・ヘッダーのメニュー・店舗・担当別反響×3） | ① DB `backend/scripts/sql/2026-11-26_update_log_2.2.305.sql` |
| 2 | 新しい request `rank_list`（GET。対象の月 `period` に関係する顧客とランクで数える顧客だけ）。`property_suumo_latest` が `pref`（県）を受けて、その県の市町村の行だけを返す（`pref` 無しは今までどおり全部） | ② VPS（features/rank/index.ts・gateway/registry.ts・features/propertyGet.ts） |
| 3 | GET の許可リストに `duplicate_summary`・`rank_list`。② へ送るリスト2つに `rank_list` | ① PHP `backend/src/core/db.php`・`backend/src/core/express_proxy.php` |
| 4 | ランク3画面が月ごとに GET（`?period=` を URL に）。SUUMO掲載順位を `/suumoRanking` のページに（物件DB の建売のボタンからだけ。県を変えると GET。`?date=` `?pref=`）。重複反響サマリーを GET・既定は直近6か月（`?startMonth=` `?endMonth=` `?area=`）。アクセス解析の注意書きの枠を削除。左のメニューの「管理者専用」とヘッダーのメニューの見られる人を限った項目に鍵のアイコン | Dashboard（frontend の build） |

- ⚠️ v2.2.304 を先に済ませてください。表の変更はありません（テーブル定義書の SQL もありません）。
- 送る量（ローカルの 11/26 朝の写しで測定。開いたとき＝今月）：ランク 注文 約7.2MB → 約1.7MB／建売 約2.8MB → 約2.6MB（建売はランクの付いた顧客が多いため）／中古 約1.1MB → 約0.3MB。SUUMO 掲載順位 約4,000行 → 鹿児島県 約840行。
  - ⚠️ ランクの読み込みの時間は、ローカルでは今までと同じ（注文 約5秒）。② が事業の顧客を全部読んでから月で絞っているため（送る量だけが減る）。DB を読む段階で月を絞ると速くなる見込み（次の版の候補）。
- ⚠️ ① PHP（手順4）は ② のあとに上げてください。先に上げると ② に無い `rank_list` を転送して 502 になります（画面は今までの POST＝全件に切り替わるので開けます）。
- ⚠️ 画面（手順5）を ① PHP より先に上げると、重複反響サマリーが「集計を取得できませんでした」になります（`duplicate_summary` の GET を ① が受けないため）。必ず ① PHP のあとに上げてください。

## 順序
```
1. GitHub で v2.2.305 を production へマージ（PR）
2. ① SQL：2026-11-26_update_log_2.2.305.sql   ← ⚠️ 1回だけ
3. ② VPS
4. ① PHP：db.php・express_proxy.php をアップロード
5. Dashboard の画面を build してアップロード
```

### 手順2　【① SQL】
```bash
mysql < 2026-11-26_update_log_2.2.305.sql
```
```sql
SELECT no, version, date FROM update_log ORDER BY no DESC LIMIT 3;
```

### 手順3　【② VPS】
```bash
cd ~/dashboard
git fetch --depth 1 origin production
git checkout FETCH_HEAD
git log -1 --oneline
```
```bash
dcp build express-api
```
```bash
dcp up -d express-api
dcp ps express-api
```
- `git log` が v2.2.305 のマージのコミットならよいです。`STATUS` が `Up` のまま続けばよいです（`Restarting` なら `dcp logs --tail 60 express-api`）。
- ⚠️ `git pull` は使わない。⚠️ `dcp` を使う。

### 手順4　【① PHP】
`backend/src/core/db.php`・`backend/src/core/express_proxy.php` をアップロードします。

確認（トークン無しで 401 なら ② まで届いています。400 なら db.php、404 なら express_proxy.php が古いままです）：
```bash
curl -s -o /dev/null -w '%{http_code}\n' 'https://khg-marketing.info/dashboard/api/gateway/?request=rank_list&category=order&period=2026/11'
curl -s -o /dev/null -w '%{http_code}\n' 'https://khg-marketing.info/dashboard/api/gateway/?request=duplicate_summary'
```

### 手順5　【Dashboard の画面】
いつもどおり build して、アップロードします。
- 変えたファイル：
  - `src/components/rank/RankOrder.tsx`・`RankKaeru.tsx`・`RankResale.tsx`
  - `src/components/rank/rankLoad.ts`（新規）
  - `src/components/database/SuumoPropertySummary.tsx`（ページにした）
  - `src/components/database/DatabaseProperty.tsx`（SUUMO掲載順位のボタン。建売だけ）
  - `src/App.tsx`（`/suumoRanking`）
  - `src/components/header/inquiry/DuplicateInquirySummary.tsx`
  - `src/components/header/inquiry/TrackingSettings.tsx`
  - `src/components/Menu.tsx`・`src/components/header/Header.tsx`
  - `src/utils/version.ts`

## 終わったら（動作確認）
1. 注文の「店舗・担当別反響」を開く。数字が今までと同じ。開発者ツールで `request=rank_list&category=order&period=2026/11` の GET が1回出て、`rank` の POST が出ない。対象の月を変えると GET が出て、アドレスに `?period=` が付く。建売・中古でも同じ。
2. 数字を押して出る一覧でランクを直すと、表の数字が直したとおりに変わる（その月を読み直す）。
3. 建売の「物件DB」で「SUUMO掲載順位」を押すと `/suumoRanking` のページに移る。県を変えると表がその県になり、アドレスに `?pref=` が付く。「物件DBへ戻る」で戻る。中古の「掲載物件一覧」にはボタンが無い。
4. 「反響管理 → 重複反響サマリー」を開くと、開始月・終了月が直近6か月になっている。期間を変えると数え直し、アドレスに条件が出る。
5. 「反響管理 → アクセス解析」で、黄色の注意書きの枠が無い。
6. 左のメニューの管理者専用の項目と、ヘッダーのメニューの見られる人を限った項目（セキュリティログ・アクセス解析など）に鍵の印が出る。

## 切り戻し
- 画面：前の build に戻せば、ランクは全件 POST、SUUMO掲載順位は物件DB のモーダル、重複反響サマリーは POST に戻ります（② の `pref` 無し・`rank` の POST は変わっていないため）。
- ① PHP：許可リストに足しただけなので、戻さなくても前の画面に影響はありません。
