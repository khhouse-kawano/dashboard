# デプロイ手順 v2.2.295　反響の取り込みの販促媒体（建売・中古）・中古の会員登録メールの読み取り（GS）

| # | 何が変わるか | どこ |
|---|---|---|
| 1 | 反響一覧から顧客DBに取り込むとき、媒体が空なら建売は「Web検索」、中古は「ネット検索」を入れる。検索の言い方（Web検索・ネット検索など）は、その事業の媒体の表の名前にそろえる。それ以外は反響の値のまま | Dashboard（frontend の build） |
| 2 | 中古住宅専門店の会員登録メールの GS（runMemberResale）：「当サイトをどこでお知りになりましたか？」を媒体として読む。郵便番号・ご希望条件（第一〜第三希望エリアなど）を備考に入れる。携帯の電話番号は携帯として送る | Google Apps Script（`backend/scripts/gas/runMemberResale.gs`） |
| 3 | 更新履歴1行・業務ガイド「反響一覧（建売営業）」「反響一覧（中古リノベ）」 | ① DB `backend/scripts/sql/2026-11-24_update_log_2.2.295.sql` |

- ⚠️ v2.2.294 までを先に済ませてください。表の変更はありません。
- ② VPS・① PHP の変更はありません（GS の送り先 `member_resale_update` は今までどおり ① の PHP）。

## 順序
```
1. GitHub で v2.2.295 を production へマージ（PR）
2. ① SQL：2026-11-24_update_log_2.2.295.sql   ← ⚠️ 1回だけ
3. Dashboard の画面を build してアップロード
4. Google Apps Script の runMemberResale を差し替え
```

### 手順2　【① SQL】
```bash
mysql < 2026-11-24_update_log_2.2.295.sql
```

### 手順3　【Dashboard の画面】
いつもどおり build して、アップロードします。
- 変えたファイル：
  - `src/components/list/listUtils.ts`
  - `src/components/list/ListKaeru.tsx`
  - `src/components/list/ListResale.tsx`
  - `src/utils/version.ts`

### 手順4　【Google Apps Script】
1. 中古住宅専門店の会員登録を取り込んでいるプロジェクトを開き、`runMemberResale` があるファイルの中身を、`backend/scripts/gas/runMemberResale.gs` の中身で**まるごと**置き換えて保存します。
2. 関数名・トリガー（`runMemberResale`）・送り先・検索の条件は今までと同じです。トリガーの設定は変えません。
3. エディタで `runMemberResale` を1回実行し、実行ログを確かめます。
   - 1日以内に会員登録のメールがあれば「抽出データ: …」に `"source":"Web検索"` などの媒体と、`remarks` の中に「郵便番号：」「第一希望エリア：」が出ていればよいです。
   - 同じメールアドレスの会員は上書きされるだけなので、何度実行しても二重になりません。

## 終わったら（動作確認）
- 反響一覧（中古）で、媒体が空・「Web検索」の会員登録の反響を取り込むと、顧客DBの販促媒体が「ネット検索」になる。
- 反響一覧（建売）で、媒体が空の反響を取り込むと、顧客DBの販促媒体が「Web検索」になる。
- 次に会員登録があったあと、反響一覧（中古）のその反響に媒体が入り、備考（虫めがね）に郵便番号・ご希望条件が出る。

## 切り戻し
- 画面：前の build に戻せば、媒体は今までどおり反響の値（空なら空）で入ります。
- GS：前の中身に戻せば、今までどおりです（媒体・郵便番号・ご希望条件は読まれません）。
