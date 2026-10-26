# デプロイ手順 v2.2.217　Claudeによる分析（Dashboard からの自由分析）・権限「マネージャー」

| # | 何が変わるか | どこ |
|---|---|---|
| 1 | 新しい表 `ai_analysis_job`（分析の実行記録と結果） | ① DB `backend/scripts/sql/2026-10-26_ai_analysis_job.sql` |
| 2 | 分析の本体（Claude を呼ぶ）・新しい request 4つ・権限 Manager | ⚠️ **② VPS（再ビルド）**。⚠️ **.env.prod に `ANTHROPIC_API_KEY` を足す** |
| 3 | ① から ② への転送・定型分析の閲覧の権限・権限の許可リスト | ① PHP 6ファイル |
| 4 | 画面（Claudeによる分析の作り直し・左上の閉じるボタン・競合分析をこの画面から分けた・権限の選択肢） | ① フロント（いつもの手順） |
| 5 | 更新履歴・業務ガイドの記事3本 | ① DB `backend/scripts/sql/2026-10-26_update_log_2.2.217.sql` |

## 順序
```
0. GitHub で v2.2.217 を main → production へマージ
1. ① SQL（新しい表）               ← ⚠️ 2 より先（② が起動時にこの表を読む）
2. ② API キーを .env.prod に入れて再ビルド
3. ① PHP（6ファイル）              ← ⚠️ 2 の後
4. ① フロント                      ← ⚠️ 2・3 の後
5. ① SQL（更新履歴・ガイド）
```

## 手順1　【① phpMyAdmin】新しい表
ファイル: `backend/scripts/sql/2026-10-26_ai_analysis_job.sql`

確認: `SHOW TABLES LIKE 'ai_analysis_job';` で1行出る。

## 手順2　【Claude Console → ② VPS】API キー・再ビルド

### 2-1. Claude Console で API キーを発行する
⚠️ 作業する人: Console の組織で **管理者（Admin）** か **開発者（Developer）** の役割を持っている人。持っていなければ、組織の管理者に招待・役割の変更を頼む。

**(1) ログインと組織の確認**
1. ブラウザで https://platform.claude.com/ を開き、クレジットを買ったアカウントでログインする
2. 左上（または右上）の組織名が、クレジットを買った組織になっていることを確かめる。違えば切り替える
   - ⚠️ 別の組織でキーを作ると、そちらのクレジットが使われる（残高が無ければ分析が「クレジット残高が不足」で失敗する）

**(2) クレジット残高の確認**
1. 左のメニューの **Settings → Billing**（請求）を開く
2. **Credit balance**（残高）が入っていることを確かめる

**(3) 使用額の上限を決める（推奨）**
1. **Settings → Limits** を開く
2. 月の使用額の上限（Spend limit）を、想定より少し多めの金額で決める
   - 目安: 1回の分析は数百円程度。1人1日5回 × 使う人数 × 営業日 で見積もる
   - ⚠️ 上限に達すると、その月は分析が失敗するようになる（Dashboard の他の機能は止まらない）
3. 必要なら、使用額のお知らせ（通知のしきい値）も決めておく

**(4) 共有用のアカウント（サービスアカウント）を用意する（推奨。初回だけ）**
- キーには「個人のキー」と「サービスアカウントのキー」がある。⚠️ **個人のキーは、作った人が組織を抜けると止まる**（分析が全部「API キーが無効です」で失敗する）
- Dashboard のように皆で使う仕組みには、サービスアカウントのキーを使う
1. 組織の管理者が **Settings → Service accounts**（`platform.claude.com/settings/service-accounts`）でサービスアカウントを作る（名前の例: `dashboard`）
2. そのサービスアカウントを、キーを使うワークスペース（ふつうは Default Workspace）に入れる（Default Workspace には最初から入っている）

**(5) API キーを作る**
1. **Settings → API keys**（`platform.claude.com/settings/keys`）を開き、**Create key** を押す
   - ⚠️ ボタンが押せないときは、権限が足りない。組織の管理者に役割の変更か、キーの作成を頼む
2. 入力する
   - **Name（名前）**: `dashboard-analysis`（何に使うキーか分かる名前。あとで止めるときに見分けるため）
   - **Expiration（有効期限）**: 下の「有効期限の決め方」を見て選ぶ。⚠️ **あとから変えられない**
   - **Linked account（紐づけるアカウント）**: (4) のサービスアカウント（例: `dashboard`）。用意できないときだけ自分（個人のキー）
   - **Workspace**: ⚠️⚠️ **必ず1つのワークスペース（ふつうは Default Workspace）を選ぶ。** 選ばずに作ったキーは、毎回ワークスペースの指定が要り、② からの呼び出しが 400 で失敗する（② はワークスペースを指定していない）
   - ⚠️ ワークスペースに使用額の上限を付けている場合は、その上限も効く
3. 作成を押す

**有効期限の決め方**
- 選べるもの: **3時間・1日・7日・30日・期間を自分で決める（カスタム）・Never（期限なし）**
  - ⚠️ 組織に「最長の有効期限」の決まりがあると、それより長くは選べず、Never も選べない
- ⚠️ **あとから変えられない。** 延ばしたいときは新しいキーを作って差し替える（下の「API キーを差し替えるとき」）
- 期限が切れると、そのキーは 401 になり、分析は「API キーが無効です。管理者に API キーの設定を確認してもらってください。」で失敗する。⚠️ 切れたキーは戻せない（新しいキーを作る）
- 期限の前に、キーを**作った人**へメールが届く（期間が14日以上のキーは7日前、7日以上のキーは1日前。それより短いキーはお知らせなし）
- **推奨: カスタムで 1年（365日）**。カレンダーに「期限の2週間前に差し替え」を入れておく
  - 短いほど漏れたときの被害は小さいが、差し替えのたびに ② の作り直しが要る。30日などの短い期限は運用の負担が大きい
  - Never は差し替えを忘れても止まらないが、漏れたキーが無期限に使える。選ぶなら、定期的な差し替えを決めておくこと
- 期限は API keys の一覧の Expiration の欄で確かめられる

4. 作成を押したあとに表示されたキー（`sk-ant-` で始まる長い文字列）を **Copy** でコピーする
   - ⚠️⚠️ **キーが表示されるのはこの1回だけ。** 閉じると二度と見られない（見失ったら作り直す）
   - ⚠️ チャット・メール・メモ帳・docs・スプレッドシートに貼らない。**次の 2-2 で .env.prod に直接貼る**
   - ⚠️ 2-2 を終えるまで、この画面を閉じないでおくと安全

**(6) 作ったキーの確認**
- API keys の一覧に `dashboard-analysis` が出て、状態が有効（Active）、ワークスペースと有効期限が選んだとおりになっていること
- キーの値は一覧では一部しか出ない（それで正しい）

### 2-2. ② の .env.prod に入れる
```bash
cd ~/dashboard
nano .env.prod
```
末尾に1行足して保存する（`=` の前後に空白を入れない）。
```
ANTHROPIC_API_KEY=sk-ant-（2-1 でコピーしたキー）
```
⚠️ **このファイルは Git に入れない。** キーをリポジトリ・docs・チャットに書かない。

### 2-3. 再ビルド
```bash
cd ~/dashboard
git fetch --depth 1 origin production
git checkout FETCH_HEAD
```
```bash
ls backend-express/src/features/aiAnalysis/
```
⚠️ `index.ts job.ts prompt.ts runner.ts tools.ts` の5つが出ること。
```bash
dcp build express-api
```
⚠️ 新しいライブラリ（`@anthropic-ai/sdk`）を入れたため、**build を省略しないこと。**
```bash
dcp up -d express-api
```
確認1（キーが入ったか。⚠️ 値は表示しない）:
```bash
dcp exec express-api sh -c '[ -n "$ANTHROPIC_API_KEY" ] && echo SET || echo EMPTY'
```
⚠️ `SET` ならよい。`EMPTY` なら .env.prod の綴りと、`docker-compose.prod.yml` が新しい版か（`ANTHROPIC_API_KEY` の行があるか）を見る。

確認2（受け口ができたか。保存も課金もされない）:
```bash
curl -s -X POST https://api.khg-marketing.info/api/gateway -H 'Content-Type: application/json' -d '{"request":"ai_analysis_list"}'
```
⚠️ `認証が必要です。`（401）が返ればよい（`該当する処理がありません` なら再ビルドが反映されていない）。

## 手順3　【① FTP】PHP
アップロード（`/dashboard/api/gateway/` の下）:
- `core/express_proxy.php`（新しい request 4つを転送の許可リストと「② だけ」のリストに足した）
- `core/authz.php`（`requireKpiAnalyst()` を足した）
- `handlers/kpi_filter_master.php`・`handlers/kpi_analysis_list.php`・`handlers/kpi_analysis_get.php`（Master だけ → 3つの権限）
- `handlers/header_auth_insert.php`（許可する権限に Manager を足した）

確認（トークン無し。① を通して ② まで届くか）:
```bash
curl -s -X POST https://khg-marketing.info/dashboard/api/gateway/ -H 'Content-Type: application/json' -d '{"request":"ai_analysis_list"}'
```
⚠️ `認証が必要です。`（401）。⚠️ `該当する処理がありません`（404）なら express_proxy.php が古い。

## 手順4　【① フロント】いつもの手順

## 手順5　【① phpMyAdmin】更新履歴・業務ガイド
ファイル: `backend/scripts/sql/2026-10-26_update_log_2.2.217.sql`（更新履歴1行と、記事「Claudeによる分析」「営業別契約率」「業務ガイドの書き方（編集できる人向け）」の上書き）

## 終わったら（動作確認）
1. Master でログインし、ヘッダー左上の「Claudeによる分析」を開く（全画面で、左に条件、右に説明が出る）
2. 事業部・期間を選び、短い依頼（例: 「直近半年の契約の動きを教えて」）で1回だけ実行する
   - ⚠️ **本物の Claude を呼ぶので費用がかかる**（1回 数百円程度の見込み。依頼の深さで変わる）
   - 5〜15分で一覧に「完了」が出て、右にレポートが出る。数字をもとの画面（店舗・担当別反響／販促媒体別広告費）と見比べる
3. 一般の権限の人には「Claudeによる分析」のボタンが出ないこと、ヘッダーの「他社動向」に「（Claudeのロゴ）による競合分析」があることを確かめる
4. 使ってほしい人の権限を「権限編集」で **マネージャー** に変える（ブランド管理者は今までどおり使える）

## API キーを差し替えるとき（あとから）
⚠️ **有効期限が近づいたとき**（作った人に7日前のメールが届く）も、この手順で差し替える。期限が切れてからだと、差し替えるまで分析が全部失敗する。
1. Claude Console で新しいキーを作る（2-1 の (5) と同じ。ワークスペースは必ず選ぶ）
2. ⚠️ **実行中の分析が無いときに行う**（② を作り直すと、実行中の分析は「中断」で失敗になる）。① の phpMyAdmin で確かめる:
   ```sql
   SELECT id, staff_name, status FROM ai_analysis_job WHERE status IN ('queued','running') AND deleted_at IS NULL;
   ```
   0行ならよい。
3. ② の `.env.prod` の `ANTHROPIC_API_KEY=` の行を新しいキーに書き換える
4. `dcp up -d express-api`（⚠️ キーの差し替えだけなら build は不要。環境変数は作り直しで読み直される）
5. 確認1（`SET`）を流す
6. 1回分析を流して完了することを確かめてから、Claude Console で古いキーを止める
   - **Disable**（無効にする）は元に戻せる。**Delete**（削除）は戻せない。期限切れのキーは削除しかできない
7. カレンダーの「差し替え」の予定を、新しいキーの期限に合わせて入れ直す

> 注意：v2.2.216 までの定型分析（① の `kpi_analyze`）が使っていたキーは、① の DB（api_credential）に入っている。v2.2.217 で画面から定型分析を外したため、もう使われない。不要なら Claude Console でそのキーを無効にしてよい。

## 費用と上限（② のコードで決めている値）
- モデル: Claude Opus 5.5（思考の深さ high）。1回の分析でデータを取りに行くのは最大40往復
- 1人1日5回まで（失敗・削除した分も数える）。自分の分析が実行中のあいだは次を始められない。全体で同時3件まで
- 1回の費用の目安は、一覧で完了した分析を開くと右上に出る（`約 $`）
