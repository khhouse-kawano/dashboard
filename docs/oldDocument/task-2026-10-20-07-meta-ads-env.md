# v2.2.203 Meta 広告 API の準備：開発環境でトークンと ID を読めるようにする（2026-10-20）

## 依頼
- 広告用の API（graph.facebook.com の /{id}/ads）を使って、SNS バナーごとのパフォーマンスを調べられないか → 方針（Insights API ＋ 着地の utm_content＝広告ID ＋ CV）を提案。
- 対象の ID（ブランドごと）：かえるホーム・PG ハウス・国分ハウジング・なごみ工務店・デイジャストハウス（18桁。キャンペーンの ID と思われる）
- 「まずは開発環境を進めるため、トークンを入れるための .env の設定が必要であれば指示して」「調べたらわかるけど一応 ID も .env に入れる」

## 分かったこと
- ローカルの ② は .env 系のファイルを読んでいない（docker-compose.yml の environment だけ。dotenv も使っていない）。`backend-express/.env` はあるが読まれていない（中身は見ていない）。
- 実データの Meta 広告からの着地には、`utm_content`＝広告ID・`utm_term`＝広告セットID・`utm_campaign`＝キャンペーン名が入っている → 広告ごとに着地と CV を突き合わせられる。
- ⚠️ 貼り付けられた API の結果の `paging.next` にアクセストークンが含まれていた → 無効化と再発行をお願いした。

## 変えたもの
| ディレクトリ | ファイル | 内容 |
|---|---|---|
| （ルート） | **docker-compose.yml** | express-api に `env_file: ./backend-express/.env.local`（`required: false`）を追加 |
| frontend/src/utils | **version.ts** | `2.2.203` |
| backend/scripts/sql | **2026-10-20_update_log_2.2.203.sql**（新規） | update_log 1行（内容は作業が進んだら直す）。ローカル DB に流した（no=302） |

```yaml
    env_file:
      # Meta 広告 API のトークンと対象の ID（v2.2.203。META_ACCESS_TOKEN・META_AD_ACCOUNTS）。
      #
      # ⚠️ 開発で使う秘密の値だけを書くファイル。.gitignore の **/.env.* で Git には入らない。
      # ⚠️ 無くても起動する（required: false）。
      # ⚠️ backend-express/.env は読ませない（中身が本番向きだと、開発中の操作が本番へ向かうおそれがある）。
      # ⚠️ 上の environment と同じ名前を書いても environment が勝つ。
      - path: ./backend-express/.env.local
        required: false
```

## 利用者にお願いしたこと
`backend-express/.env.local` を作り、次の2行だけを書く（⚠️ Claude は .env 系のファイルを読み書きしない）。
```
META_ACCESS_TOKEN=（システムユーザーのトークン。権限 ads_read）
META_AD_ACCOUNTS=khf:ID,pg:ID,kh:ID,nagomi:ID,djh:ID
```
- ID は広告アカウント（act_…）でもキャンペーンの ID でも受ける作りにする予定。
- 書いたら `docker compose up -d express-api` で ② を作り直す。

## 確認
- `docker compose config --quiet` → OK（構文に誤りなし。ファイルが無くても通る）
- `git check-ignore` → `backend-express/.env.local` は `.gitignore:61 **/.env.*` で Git の対象外
