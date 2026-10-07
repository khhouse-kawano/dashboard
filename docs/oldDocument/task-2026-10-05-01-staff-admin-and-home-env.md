# 2026-10-05-01　スタッフ管理の改修・Express化／自宅開発環境（v2.2.163）

## 依頼（ReadMeClaude.md）

> v2.2.161はビルド＆デプロイ済み
> 新たにv2.2.162にて作業
>
> ## 要件１
> - EditStaff.tsx及びEditAuthの改修
>   まずはUXが悪いためuseRefで文字入力の快適性を向上させる
>   * EditAuth.tsx => staffテーブルのname,brand,shop,mail,passwordを修正できるようフロント側の改修
>     brand = {開発者権限: Master, マネージャー: BrandAdmin, 一般: ordinary, コンサル: Consulting}
>     shop = {注文: order, 建売: spec, 中古: used}
>     name,mail,passwordは手入力 / brand,shopはセレクトタグ
>   * EditStaff.tsx => 入力した値に加えて shop: KH霧島店 section 鹿児島営業1課 category rank multi等のtinyint 0
>     で保存されることが多い、これらは初期値の設定なので保存ロジックに問題があるかも
>
> ### 要件２
> - 自宅の作業環境を構築中（Ubuntu）。必要なライブラリや言語をインストールするコマンドを書いて
> - 自宅では個人情報をマスクして使う。顧客名、メールアドレス、電話番号をアスタリスクにUPDATEする処理をつくって

作業中の追加指示: ⚠️ **「ではExpress化も」**

### ⚠️ 確認して決めたこと（2026-10-05）

| 質問 | ⚠️ 回答 |
|---|---|
| ⚠️ 版（v2.2.162 は余白調整で使用済み） | ⚠️⚠️ **v2.2.163 を新しく切る** |
| ⚠️ 事業区分に `all`（29名）を入れるか | ⚠️⚠️ **「全事業: all」も選べるようにする** |
| ⚠️ パスワードの扱い | ⚠️⚠️ **書き込み専用＋ハッシュ化** |
| ⚠️ header_edit_auth の情報漏れ | ⚠️⚠️ **今回の版でまとめて塞ぐ** |

---

## ⚠️⚠️⚠️ 見つかった重大な問題

### 1. ⚠️ 権限編集の一覧が、認証なしで全員の `api_token` と `password` を返していた

⚠️ `header_edit_auth.php` が `SELECT * FROM staff` をそのまま返していた。

| | |
|---|---|
| ⚠️ `api_token` | ⚠️⚠️ **ログイン状態そのもの。** ⚠️ 取得した人は Master を含む誰にでもなりすませた |
| ⚠️ `password` | ⚠️ 230行中210行が ⚠️ **平文**（bcrypt形式は0件） |
| ⚠️ 認証 | ⚠️⚠️ **ハンドラにも ① の入口にも無かった。** ⚠️ ログインしていなくても返った |
| ⚠️ `log` | ⚠️ 合計 **221MB**（485万件）。⚠️ ローカルでは ⚠️ **PHP のメモリ上限で落ちて画面が開けなかった** |

⚠️ ② では列を明示し、⚠️ ① の PHP も同じ版で列を絞って認証を付けた。⚠️ **本番では未検証**（⚠️ トークンを表示したくないため叩いていない）。

### 2. ⚠️ 権限編集で作ったアカウントは、事業区分が必ず空だった

⚠️ `header_auth_insert.php` が `name, brand, mail` の3列しか INSERT しない。
⚠️⚠️ **`shop`（事業区分）が空になり、Category.tsx の入場判定で全事業から弾かれる。**
⚠️ 2026-10-05 に ⚠️ 舟木さんが注文営業に入れなかった原因がこれ。

### 3. ⚠️ スタッフ追加で「入力していない課・店舗」が保存されていた

| 原因 | |
|---|---|
| ⚠️ 新規行の課・店舗に ⚠️ **マスタの先頭（鹿児島営業1課・KH霧島店）が最初から選ばれていた** | ⚠️ 触らずに登録するとそれが保存される。⚠️ **選んだように見えるので気づけない** |
| ⚠️ 一般（ordinary）は課・店舗・各スイッチが ⚠️ **無効化されていた** | ⚠️⚠️ **一般が登録すると必ず初期値になる** |

⚠️ ⚠️ **保存ロジック（PHP）自体は受け取った値を正しく入れていた。** ⚠️ 問題は画面側。

### 4. ⚠️⚠️ マスク用SQLの安全装置が、最初の形では止まらなかった（⚠️ 実行前に検証して発覚）

⚠️ 安全装置を UPDATE の前に置く形で書いたところ、⚠️ **「STOP」と表示したのに後続の文が実行された。**
⚠️ `source` で読み込んだファイルはエラーが出ても次の文へ進むため。
⚠️⚠️ **UPDATE を差し替えた無害な SELECT で試したので、データは何も変わっていない。**
⚠️ すべての UPDATE を ⚠️ **1つのブロック（`BEGIN NOT ATOMIC … END`）の中**に入れて解決した。

---

## 版を上げる3点（⚠️ 着手時点でそろえた）

| # | 何を | 結果 |
|---|---|---|
| 1 | ブランチ | `v2.2.163` |
| 2 | `frontend/src/utils/version.ts` | `'2.2.162'` → ⚠️ `'2.2.163'` |
| 3 | `backend/scripts/sql/2026-10-05_update_log_2.2.163.sql` | 新規 |
| 4 | ⚠️⚠️ **ローカルDBへ流した** | ⚠️ `no=259` で確認済み |

---

## 変更したファイル

| ディレクトリ | ファイル | 区分 |
|---|---|---|
| `backend-express/src/features/` | ⚠️⚠️ **staffAdmin.ts** | ⚠️ **新規** |
| `backend-express/src/gateway/` | **registry.ts** | 7 request を登録 |
| `backend-express/` | **package.json / package-lock.json** | ⚠️ `bcryptjs` を追加 |
| `backend/src/core/` | **express_proxy.php** | ⚠️ 転送リストに追加 |
| `backend/src/handlers/` | ⚠️⚠️ **header_edit_auth.php** | ⚠️ 列を絞り、認証を付けた |
| `frontend/src/components/header/` | ⚠️⚠️ **EditAuth.tsx** | ⚠️ 作り直し |
| `frontend/src/components/header/` | **EditStaff.tsx** | ⚠️ 課・店舗を必須に、ID欄を非制御に |
| `frontend/src/utils/` | **version.ts** | 版 |
| `backend/scripts/sql/` | **2026-10-05_update_log_2.2.163.sql** | 新規 |
| `backend/scripts/sql/dev/` | ⚠️⚠️ **mask_personal_info.sql** | ⚠️ **新規**（⚠️ 自宅用。本番で流さない） |
| `docs/` | **deploy-v2.2.163.md** / ⚠️ **home-ubuntu-setup.md** | 新規 |

### ② に追加した request と権限

| request | 権限 | ① へのフォールバック |
|---|---|---|
| `header_edit_auth` | ⚠️ Master / BrandAdmin | する（⚠️ ① も列を絞った） |
| ⚠️ `header_auth_access_time` | ⚠️ Master / BrandAdmin | ⚠️⚠️ **しない**（⚠️ ① に無い） |
| `header_auth_insert` | ⚠️⚠️ **Master のみ** | ⚠️ **しない**（二重登録防止） |
| `header_auth_update` | ⚠️⚠️ **Master のみ** | ⚠️⚠️ **しない**（⚠️ ① は brand しか扱えず、⚠️ **空で上書きして権限が消える**） |
| `header_staff_edit` | ログイン済み | する |
| `header_staff_insert` | ログイン済み | ⚠️ **しない**（二重登録防止） |
| `header_staff_update` | ログイン済み | する |

### ⚠️ 追加した関数（features/staffAdmin.ts）

| 関数 | |
|---|---|
| `runAuthList()` | ⚠️ ログイン権限の一覧（⚠️ password / api_token / log を返さない） |
| ⚠️ `runAuthAccessTimes()` | ⚠️ 総アクセス時間（秒）。⚠️ `heartbeat` が変わった人だけ計算し直す |
| `totalAccessSeconds()` | ⚠️ 元の `calculateTotalAccessTime()` と同じ結果を出す計算 |
| `runAuthInsert()` | ⚠️ アカウント作成（⚠️ 全列を埋める・事業区分必須・メール重複不可・パスワードはハッシュ） |
| `runAuthUpdate()` | ⚠️ 1項目更新（⚠️ 旧い画面の `{id, brand}` も受ける） |
| `runStaffEdit()` | 人事マスタの一覧 |
| `runStaffInsert()` | ⚠️ 人事マスタ登録（⚠️ 課・店舗・年度は必須） |
| `runStaffUpdate()` | 人事マスタの1項目更新 |
| `hashPassword()` / `mailTaken()` / `toLog()` / `emptyReasons()` ほか | 内部用 |

---

## 動作確認（ローカル）

### ⚠️ API（① 経由で、権限ごとに）

| 確認 | 結果 |
|---|---|
| ⚠️ 一覧・トークンなし | ⚠️ **401** |
| ⚠️ 一覧・一般 | ⚠️ **403** |
| ⚠️ 一覧・Master | ⚠️ 200 / 215行 / ⚠️ **30KB**。⚠️⚠️ **password / api_token / log を含む行 0** |
| ⚠️ 総アクセス時間 | ⚠️ 初回 **12.8秒** → ⚠️⚠️ **2回目 64ミリ秒** |
| ⚠️⚠️ 総アクセス時間の正しさ | ⚠️⚠️ **215人全員、元の画面の計算と1秒単位で一致** |
| アカウント作成・BrandAdmin | ⚠️ 403 |
| アカウント作成・事業区分なし | ⚠️ 400「事業区分を選択してください」 |
| アカウント作成・知らない権限 | ⚠️ 400 |
| アカウント作成・正常 | ⚠️ 200。⚠️ `shop=order` / ⚠️ **パスワード `$2b$`（60文字）** / flag=1 |
| アカウント作成・同じメール | ⚠️ 400 |
| 更新（氏名 / 事業区分 all / パスワード） | ⚠️ 200 |
| 更新（事業区分 planner / 他人のメール / api_token） | ⚠️ 400 |
| ⚠️ 更新（旧い画面 `{id, brand}`） | ⚠️ 200 |
| 人事マスタ・課なし / 店舗なし | ⚠️ 400 |
| 人事マスタ・正常 | ⚠️ 200。⚠️ 送った課・店舗・スイッチがそのまま保存 |
| ⚠️ テストで作った行 | ⚠️⚠️ **すべて削除済み**（staff 2行・staff_list 1行） |

### ⚠️ ② を止めた状態（① だけで動く場合）

| 確認 | 結果 |
|---|---|
| ⚠️ 一覧・トークンなし／一般／Master | ⚠️ **401 / 403 / 200（32KB）** |
| ⚠️ 総アクセス時間・権限更新 | ⚠️⚠️ **502**（⚠️ ① の古い処理に流れない） |

### ⚠️ 動作確認中に踏んだもの

| | |
|---|---|
| ⚠️⚠️ **人事マスタの登録が 502（ループ検知）** | ⚠️ `staff_list` に **`category` という列**があり、⚠️ 画面が `category: '1'` を送る。⚠️ ゲートウェイの振り分けキーに入ってしまい、⚠️ `header_staff_insert::1` が見つからなかった。⚠️ **値ごと（空・0・1）に登録**して解決 |
| ⚠️ 総アクセス時間のキャッシュが効かない | ⚠️ 目印に `LENGTH(log)` を使っていたが、⚠️ **長さを測るだけで221MBを読み3秒以上**かかった。⚠️ `heartbeat` に変えた（⚠️ heartbeat.php が log と同じ UPDATE で書くため） |
| ⚠️ SQL で総アクセス時間を出す案 | ⚠️ 230人全員一致したが ⚠️ **47秒**。⚠️ 採用しなかった |
| ⚠️ テストの日本語が化けて 400 | ⚠️ Git Bash の引数に日本語を書いたため。⚠️ node から送り直した |

### ビルド

```bash
cd backend-express && npx tsc --noEmit   # -> エラーなし
cd frontend && npx react-scripts build   # -> Compiled with warnings
```

⚠️ EditStaff.tsx の警告（`thisYear` が依存配列に無い）は ⚠️ **変更前からあるもの**（行番号がずれただけ）。⚠️ EditAuth.tsx は警告なし。

| 成果物 | |
|---|---|
| ⚠️⚠️ **`static/js/main.23d08f0e.js`** | ⚠️ この版の本体 |
| `static/css/main.7c10f266.css` | 変更なし |

---

## ⚠️ 要件2：マスク用SQL

### 対象の決め方

1. ⚠️ 列名で候補を拾った（⚠️ 約80表）
2. ⚠️ ⚠️ **スタッフ名と一致する割合**で、顧客名かスタッフ名かを判定（⚠️ **値は画面に出さずに件数だけ**）
3. ⚠️ 数値型・一意制約・エンジンを確認

| 判定 | |
|---|---|
| ⚠️ `call_achievement.name` | ⚠️ **98件すべてスタッフ名** → 対象外 |
| ⚠️ `company_achievement.name` | ⚠️ 3割がスタッフ名 → 対象外 |
| ⚠️ `funding_plan.x_tel` | ⚠️ ⚠️ **電話番号ではなく家計の通信費（decimal）** → 対象外 |
| ⚠️ `catalog_kaeru` ほか4表の `email` | ⚠️ ⚠️ **一意制約あり** → ⚠️ `********<no>@****.***` にして重複を避けた |
| 対象の表 | ⚠️ **すべて InnoDB**（⚠️ ロールバックが効く） |

⚠️ 最終: ⚠️⚠️ **64表・261列**（⚠️ 書き換わる値 約64万件）。

### ⚠️⚠️ 安全装置の検証（⚠️ データは書き換えていない）

| ケース | 期待 | 結果 |
|---|---|---|
| local_db・確認なし | 止まる | ⚠️ STOP |
| local_db・確認=no | 止まる | ⚠️ STOP |
| 別のDB・確認=YES | 止まる | ⚠️ STOP |
| local_db・確認=YES | 通る | ⚠️ 通る |
| 途中で失敗 | 止まって戻る | ⚠️ 止まる |
| ⚠️⚠️ **本物のファイルを `mysql` DB に** | 止まる＋構文が正しい | ⚠️⚠️ **ERROR 1644（STOP）。⚠️ 構文エラー 1064 は出ず** |
| ⚠️ ローカルDB | 無傷 | ⚠️ 電話に数字が残る行 18,959件のまま |

⚠️ 一意制約の4表は、伏せた後の値が ⚠️ **55/55・6/6・96/96・12/12 で重複なし**。

### ⚠️ 本番ダンプは git に入っていない

⚠️ `docker/mariadb/init/01_xs200571_kawano.sql`（1.29GB）は ⚠️ `.gitignore` 済みで、⚠️ **履歴に入ったこともない**（2026-10-05 確認）。

---

## ⚠️ 申し送り

| # | 内容 |
|---|---|
| 1 | ⚠️⚠️ **本番でこれまでに `api_token` が漏れていた可能性は否定できない。** ⚠️ 全員のトークンを空にすると全員再ログインになるが安全 |
| 2 | ⚠️ 既存の210名分のパスワードは ⚠️ **平文のまま**（⚠️ 一括変換していない） |
| 3 | ⚠️ 権限 `insideSales`・`BrandAdimn`・空は ⚠️ **「現在の値」として表示するだけ**。⚠️ `insideSales` はこの画面から付与できない |
| 4 | ⚠️ ⚠️ **Master が自分の権限を下げると、自分も入れなくなる**（⚠️ 止める仕組みは無い） |
| 5 | ⚠️ 一般が新規登録するとき、⚠️ 各スイッチ（全社報告フォーマットなど）は従来どおり変更できず ⚠️ **0 で登録される**（⚠️ 権限の設計どおり） |
| 6 | ⚠️ マスクは ⚠️ **住所と自由記述（remarks / note / 商談ログ）を伏せない** |
| 7 | ⚠️ 判定できず対象外にした列: `introductory.name` / `spreadSheet.name` / `registered_estate.name` / `hotlead_db.client_user_name` |
| 8 | ⚠️ ブラウザでの表示は ⚠️⚠️ **未確認**（⚠️ API・ビルドは確認済み） |
| 9 | ⚠️ ⚠️ **コミット・push はしていない**（⚠️ 指示があれば行う） |

---

## 付録：コード全文・差分

### ⚠️ `backend-express/src/features/staffAdmin.ts`（新規・全文）

```ts
import bcrypt from 'bcryptjs';
import type { RowDataPacket } from 'mysql2/promise';
import { execute, query } from '../db/pool';
import { logger } from '../utils/logger';

/**
 * スタッフ管理（ヘッダー → スタッフ管理）。
 *
 * ─────────────────────────────────────────────
 * ⚠️ 画面:
 *   header/EditAuth.tsx  … ログイン権限（`staff` テーブル）
 *   header/EditStaff.tsx … 人事マスタ（`staff_list` テーブル）
 *
 * ⚠️⚠️ **2つのテーブルは連携していない。** ⚠️ 片方を登録してももう片方には入らない。
 *
 * 移植元（2026-10-05 / v2.2.163）:
 *   header_edit_auth.php / header_auth_insert.php / header_auth_update.php
 *   header_staff_edit.php / header_staff_insert.php / header_staff_update.php
 *
 * ─────────────────────────────────────────────
 * ⚠️⚠️ **移植元の header_edit_auth.php は `SELECT * FROM staff` を返していた。**
 *
 *   ⚠️ ⚠️ **全スタッフの `api_token` と `password` がブラウザへ送られていた。**
 *     ⚠️ `api_token` はログイン状態そのもので、取得した人は
 *       ⚠️⚠️ **Master を含む誰にでもなりすませた。**
 *     ⚠️ しかも ① の入口にもハンドラにも ⚠️ **認証チェックが無かった。**
 *   ⚠️ `log` 列（合計221MB・485万件）も丸ごと返しており、
 *     ⚠️ ローカルでは ⚠️ **PHP のメモリ上限で落ちて画面が開けなかった。**
 *
 *   ⚠️⚠️ **ここでは返す列を必ず明示する。** ⚠️ `SELECT *` を書かないこと。
 *     ⚠️ `password` / `api_token` / `log` は ⚠️⚠️ **どの関数からも返さない。**
 * ─────────────────────────────────────────────
 */

// ===========================================================================
// 選択肢
// ===========================================================================

/**
 * 権限（`staff.brand`）として保存してよい値。⚠️ 画面の選択肢もこの順。
 *
 * ⚠️⚠️ **ここに無い値は保存させない。**
 *   ⚠️ リクエストの値をそのまま入れると、画面のどの選択肢にも一致しない権限が残る。
 *   ⚠️ 実データには ⚠️ `insideSales`（1名）/ `BrandAdimn`（綴り違い・1名）/ 空（12名）がある。
 *     ⚠️ ⚠️ **それらは「現在の値」として表示だけし、勝手に書き換えない**（画面側）。
 *
 * ⚠️ `insideSales` は Menu.tsx の「ISカレンダー」の判定に使われている。
 *   ⚠️ 選択肢に無いので**この画面からは付与できない**（2026-10-05 時点の指示どおり）。
 */
export const AUTH_BRANDS = ['Master', 'BrandAdmin', 'ordinary', 'Consulting'] as const;

/**
 * 事業区分（`staff.shop`）として保存してよい値。⚠️ 画面の選択肢もこの順。
 *
 * ⚠️⚠️ **`staff.shop` は店舗名ではない。** ⚠️ 事業区分である。
 *   ⚠️ Category.tsx が「選んだ事業区分と一致するか、`all` か」で入場を判定している。
 *   ⚠️ ⚠️ **空だとどの事業区分にも入れない**（2026-10-05 に実際に起きた）。
 *
 * ⚠️ `all` は指示書には無かったが、⚠️ **Master / BrandAdmin の多くが `all`**（29名）。
 *   ⚠️ 選択肢から外すと、⚠️⚠️ **全事業を見られる人をこの画面で作れなくなる**ため加えた
 *   （2026-10-05 に利用者と確認済み）。
 */
export const AUTH_SHOPS = ['order', 'spec', 'used', 'all'] as const;

const isAuthBrand = (value: string): boolean => (AUTH_BRANDS as readonly string[]).includes(value);
const isAuthShop = (value: string): boolean => (AUTH_SHOPS as readonly string[]).includes(value);

/** ⚠️ login.php と同じ判定（`filter_var(FILTER_VALIDATE_EMAIL)` に近いもの） */
const isMail = (value: string): boolean => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

const text = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

/**
 * パスワードのハッシュ化。
 *
 * ⚠️⚠️ **ログインは Google 認証に移行済みで、`staff.password` を読む処理は無い**（2026-10-05 時点）。
 *   ⚠️ それでも平文で持つ理由は無いので、⚠️ **書き込むときは必ずハッシュにする**（利用者と確認済み）。
 *   ⚠️ 既存の210名分は平文のまま残っている。⚠️ ⚠️ **ここでは一括変換していない。**
 *
 * ⚠️ `bcryptjs` は `$2b$` 形式。⚠️ PHP の `password_verify()` でも照合できる。
 */
const hashPassword = (plain: string): Promise<string> => bcrypt.hash(plain, 10);

// ===========================================================================
// ログイン権限（staff）
// ===========================================================================

interface AuthRow extends RowDataPacket {
  id: number;
  name: string;
  brand: string;
  shop: string;
  mail: string;
  heartbeat: string;
  /** ⚠️ パスワードの**有無だけ**。⚠️⚠️ 値そのものは返さない */
  has_password: number;
}

/**
 * ログイン権限の一覧。
 *
 * ⚠️⚠️ **返す列を明示している。** ⚠️ `password` / `api_token` / `log` は返さない。
 *
 * ⚠️ 総アクセス時間は ⚠️ **ここでは返さない。** ⚠️ `runAuthAccessTimes()` で別に取る。
 *   ⚠️ 計算に `log`（485万件）を読む必要があり、一覧と一緒に出すと
 *   ⚠️ ⚠️ **画面がそのぶん待たされる。** ⚠️ 一覧を先に出し、時間は後から埋める。
 *
 * ⚠️ 移植元の画面は `mail` が空の行を出していなかった。⚠️ 同じ条件をここで掛ける。
 */
export const runAuthList = async (): Promise<{ staff: AuthRow[] }> => {
  const staff = await query<AuthRow>(
    `SELECT id, name, brand, shop, mail, heartbeat,
            (password <> '') AS has_password
       FROM staff
      WHERE mail <> ''
      ORDER BY id`
  );
  return { staff };
};

// ---------------------------------------------------------------------------
// 総アクセス時間
// ---------------------------------------------------------------------------

/** ログ1件。⚠️ `time` は `2026-04-08 11:04:59` の形 */
interface LogEntry {
  time?: string;
}

/**
 * ログを配列として取り出す。
 * ⚠️ mysql2 がパース済みで返す場合と文字列で返す場合の両方に備える
 *   （interview_log で文字列前提にして全件壊した前例がある）。
 */
const toLog = (value: unknown): LogEntry[] => {
  if (Array.isArray(value)) return value as LogEntry[];
  if (value === null || value === undefined || value === '') return [];
  try {
    const parsed: unknown = JSON.parse(String(value));
    return Array.isArray(parsed) ? (parsed as LogEntry[]) : [];
  } catch {
    return [];
  }
};

/**
 * 総アクセス時間（秒）。
 *
 * ⚠️⚠️ **EditAuth.tsx の `calculateTotalAccessTime()` と同じ結果になること。**
 *   ⚠️ 元の考え方: 間隔が60秒**未満**の間は同じセッションとみなし、
 *     セッションの長さ（最後 − 最初）を合算する。
 *   ⚠️ ⚠️ **これは「60秒未満の間隔だけを全部足す」と同じ**なので、そう書いている。
 *
 * ⚠️ 実測（2026-10-05 / ローカル）: ⚠️⚠️ **230人全員、元の計算と1秒単位で一致した。**
 *
 * ⚠️ 日付は元と同じく `-` を `/` に置き換えてから `new Date()` に渡す
 *   （⚠️ `2026-04-08 11:04:59` をそのまま渡すと環境によって読めない）。
 */
export const totalAccessSeconds = (log: unknown): number => {
  const times = toLog(log)
    .map((entry) => new Date(String(entry.time ?? '').replace(/-/g, '/')).getTime())
    .filter((t) => !Number.isNaN(t))
    .sort((a, b) => a - b);

  let total = 0;
  for (let i = 1; i < times.length; i += 1) {
    const gap = (times[i] - times[i - 1]) / 1000;
    if (gap < 60) total += gap;
  }
  return Math.floor(total);
};

/**
 * 計算済みの総アクセス時間。⚠️ キーは staff.id。
 *
 * ⚠️⚠️ **`heartbeat`（最終アクセス日時）が前回と同じなら計算し直さない。**
 *   ⚠️ `log` を書いているのは ① の heartbeat.php だけで、
 *     ⚠️⚠️ **`heartbeat` と `log` を必ず同じ UPDATE 文で書いている。**
 *     ⚠️ `heartbeat` が同じなら `log` も同じとみなせる。
 *   ⚠️ ⚠️ **`LENGTH(log)` を目印にしないこと。** ⚠️ 長さを測るだけで221MBを読み、
 *     ⚠️ 実測で ⚠️ **毎回3秒以上**かかってキャッシュの意味が無くなった。
 *   ⚠️ ⚠️ **heartbeat.php 以外で log を書くようにしたら、この前提が崩れる。**
 *
 * ⚠️ 実測（2026-10-05 / ローカル）: ⚠️ 全員を毎回計算すると ⚠️⚠️ **約4〜19秒**かかる。
 *   ⚠️ SQL（JSON_TABLE + LAG）で計算すると ⚠️ **約47秒**で、さらに遅かった。
 *
 * ⚠️ プロセスのメモリに持つだけなので、⚠️ **② を再起動すると最初の1回は遅い。**
 */
const accessTimeCache = new Map<number, { heartbeat: string; seconds: number }>();

interface HeartbeatRow extends RowDataPacket {
  id: number;
  heartbeat: string;
}

interface LogRow extends RowDataPacket {
  log: unknown;
}

export const runAuthAccessTimes = async (): Promise<{ status: 'ok'; times: Record<number, number> }> => {
  const marks = await query<HeartbeatRow>("SELECT id, heartbeat FROM staff WHERE mail <> ''");

  const times: Record<number, number> = {};
  let recalculated = 0;

  for (const row of marks) {
    const heartbeat = String(row.heartbeat ?? '');
    const cached = accessTimeCache.get(row.id);
    if (cached !== undefined && cached.heartbeat === heartbeat) {
      times[row.id] = cached.seconds;
      continue;
    }

    /**
     * ⚠️⚠️ **1人ずつ取る。** ⚠️ 全員まとめて取ると221MBを一度にメモリへ載せる
     *   （⚠️ 最大の人は1人で8.2MB）。
     */
    const [logRow] = await query<LogRow>('SELECT log FROM staff WHERE id = ? LIMIT 1', [row.id]);
    const seconds = totalAccessSeconds(logRow?.log);
    accessTimeCache.set(row.id, { heartbeat, seconds });
    times[row.id] = seconds;
    recalculated += 1;
  }

  if (recalculated > 0) {
    logger.info(`header_auth_access_time: ${recalculated}人分を計算し直しました（全${marks.length}人）`);
  }
  return { status: 'ok', times };
};

// ---------------------------------------------------------------------------
// 新規作成
// ---------------------------------------------------------------------------

interface CountRow extends RowDataPacket {
  c: number;
}

export interface WriteResult {
  httpStatus: number;
  body: Record<string, unknown>;
}

const fail = (message: string, httpStatus = 400): WriteResult => ({
  httpStatus,
  body: { status: 'error', message },
});

/** 同じメールアドレスの人がいるか。⚠️ `exceptId` は自分自身を除くため */
const mailTaken = async (mail: string, exceptId: number | null): Promise<boolean> => {
  const rows = exceptId === null
    ? await query<CountRow>('SELECT COUNT(*) AS c FROM staff WHERE mail = ?', [mail])
    : await query<CountRow>('SELECT COUNT(*) AS c FROM staff WHERE mail = ? AND id <> ?', [mail, exceptId]);
  return Number(rows[0]?.c ?? 0) > 0;
};

/**
 * ログイン用アカウントを作る。
 *
 * ⚠️⚠️ **移植元は `name, brand, mail` の3列しか INSERT していなかった。**
 *   ⚠️ ⚠️ **`shop`（事業区分）が必ず空になり、作った人は注文営業の画面に入れなかった**
 *     （2026-10-05 に舟木さんで実際に起きた）。
 *   ⚠️ `staff` は ⚠️ **既定値なしの NOT NULL 列が9つある。**
 *     ⚠️ STRICT モードなら INSERT ごと失敗する（⚠️ 本番はモードが緩く空文字で通っていた）。
 *   ⚠️ ⚠️ **ここでは全部埋める。**
 *
 * ⚠️⚠️ **メールアドレスの重複は登録させない。**
 *   ⚠️ login.php がメールアドレスだけで本人を特定するため、
 *   ⚠️ 重複すると後から登録した人がログインできなくなる。
 */
export const runAuthInsert = async (body: Record<string, unknown>): Promise<WriteResult> => {
  const name = text(body.name);
  const mail = text(body.mail);
  const brand = text(body.brand) === '' ? 'ordinary' : text(body.brand);
  const shop = text(body.shop);
  const password = typeof body.password === 'string' ? body.password : '';

  if (name === '') return fail('氏名を入力してください。');
  if (!isMail(mail)) return fail('有効なメールアドレスを入力してください。');
  if (!isAuthBrand(brand)) return fail('許可されていない権限です。');
  // ⚠️⚠️ **事業区分は必須。** ⚠️ 空で作ると、その人はどの画面にも入れない
  if (!isAuthShop(shop)) return fail('事業区分を選択してください。');

  if (await mailTaken(mail, null)) return fail('このメールアドレスは既に登録されています。');

  const hashed = password === '' ? '' : await hashPassword(password);

  const result = await execute(
    `INSERT INTO staff (name, brand, shop, mail, password, api_token, timestamp, url, heartbeat, flag)
     VALUES (?, ?, ?, ?, ?, '', '', '', '', 1)`,
    [name, brand, shop, mail, hashed]
  );

  return {
    httpStatus: 200,
    body: { status: 'success', message: 'ログイン用アカウントを作成しました。', id: result.insertId },
  };
};

// ---------------------------------------------------------------------------
// 更新
// ---------------------------------------------------------------------------

/** 更新してよい列。⚠️ 画面の入力欄と1対1 */
const AUTH_FIELDS = ['name', 'brand', 'shop', 'mail', 'password'] as const;
type AuthField = (typeof AUTH_FIELDS)[number];

/**
 * ログイン権限を1項目だけ更新する。
 *
 * 受け取る形: `{ id, field, value }`
 *
 * ⚠️⚠️ **旧い画面の形 `{ id, brand }` も受ける。**
 *   ⚠️ デプロイ直後は、⚠️ **古い main.js を開いたままの利用者がいる。**
 *   ⚠️ 受けないと、その人が権限を変えたときに何も起きなくなる。
 *
 * ⚠️⚠️ **① の header_auth_update.php は `brand` しか扱えない。**
 *   ⚠️ 新しい形を ① へ流すと ⚠️ **`brand` が空で上書きされ、その人の権限が消える。**
 *   ⚠️ ⚠️ **そのため expressProxyExclusive() に入れ、① へはフォールバックさせない。**
 */
export const runAuthUpdate = async (body: Record<string, unknown>): Promise<WriteResult> => {
  const id = Number(body.id);
  if (!Number.isInteger(id) || id <= 0) return fail('対象が見つかりません。');

  let field = text(body.field) as AuthField;
  let raw: unknown = body.value;

  // ⚠️ 旧い画面（`{ id, brand }`）
  if (field === ('' as AuthField) && typeof body.brand === 'string') {
    field = 'brand';
    raw = body.brand;
  }

  if (!(AUTH_FIELDS as readonly string[]).includes(field)) return fail('変更できない項目です。');

  // ⚠️ パスワードだけは前後の空白を削らない（⚠️ 空白も文字として扱う）
  const value = field === 'password' ? (typeof raw === 'string' ? raw : '') : text(raw);

  switch (field) {
    case 'name':
      if (value === '') return fail('氏名を入力してください。');
      break;
    case 'brand':
      if (!isAuthBrand(value)) return fail('許可されていない権限です。');
      break;
    case 'shop':
      if (!isAuthShop(value)) return fail('許可されていない事業区分です。');
      break;
    case 'mail':
      if (!isMail(value)) return fail('有効なメールアドレスを入力してください。');
      if (await mailTaken(value, id)) return fail('このメールアドレスは既に登録されています。');
      break;
    case 'password':
      // ⚠️ 空で上書きさせない（⚠️ 消したいという操作はこの画面に無い）
      if (value === '') return fail('パスワードを入力してください。');
      break;
  }

  const stored = field === 'password' ? await hashPassword(value) : value;

  // ⚠️ 列名は上の許可リストを通ったものだけ。⚠️ リクエストの文字列を直接埋めていない
  const result = await execute(`UPDATE staff SET \`${field}\` = ? WHERE id = ?`, [stored, id]);
  if (result.affectedRows === 0) return fail('対象が見つかりません。', 404);

  return { httpStatus: 200, body: { status: 'success' } };
};

// ===========================================================================
// 人事マスタ（staff_list）
// ===========================================================================

/**
 * 人事マスタの一覧と、選択肢のマスタ。
 *
 * ⚠️ 移植元は `SELECT * FROM staff_list` から `mail` を落として返していた。
 *   ⚠️ ⚠️ **ここでは返す列を明示する**（⚠️ 列が増えても勝手に流れないように）。
 *
 * ⚠️ `auth_names` は新規登録時の氏名サジェスト用（⚠️ `staff` の氏名だけ）。
 */
export const runStaffEdit = async (): Promise<Record<string, unknown>> => {
  const [staff, section, shop, authNames] = await Promise.all([
    query<RowDataPacket>(
      `SELECT id, name, pg_id, shop, section, robo_id, status, category, \`rank\`, multi,
              khg_id, sort, report, estate, memo, period, position, inside
         FROM staff_list`
    ),
    query<RowDataPacket>('SELECT * FROM section_list'),
    query<RowDataPacket>('SELECT * FROM shop_list'),
    query<RowDataPacket>("SELECT DISTINCT `name` FROM `staff` WHERE `name` <> '' ORDER BY `name`"),
  ]);

  return {
    staff,
    section,
    shop,
    auth_names: authNames.map((r) => String(r.name)),
  };
};

/** スイッチ（0/1）の列。⚠️ `1` 以外はすべて `0` として保存する */
const FLAG_COLUMNS = ['category', 'rank', 'report', 'multi', 'estate', 'inside'] as const;

const flag = (value: unknown): number => (String(value ?? '') === '1' ? 1 : 0);

/**
 * 人事マスタへ1人登録する。
 *
 * ⚠️⚠️ **課と店舗は必須にした**（2026-10-05）。
 *   ⚠️ 移植元の画面は、新規行の課と店舗に ⚠️ **マスタの先頭（鹿児島営業1課・KH霧島店）が
 *     最初から選ばれた状態**で表示していた。
 *   ⚠️ ⚠️ **触らずに登録するとそれが保存され、選んだように見えるので気づけなかった。**
 *   ⚠️ 画面側は空から始めるように変えたが、⚠️ **古い画面からも来るのでここでも弾く。**
 *
 * ⚠️ `staff_list` は ⚠️ **id と inside を除く全列が NOT NULL・既定値なし。**
 *   ⚠️ この画面で扱わない列（pg_id / robo_id / mail / memo / sort）も必ず埋める。
 */
export const runStaffInsert = async (body: Record<string, unknown>): Promise<WriteResult> => {
  const name = text(body.name);
  const section = text(body.section);
  const shop = text(body.shop);
  const period = text(body.period);

  if (name === '') return fail('氏名を入力してください。');
  if (section === '') return fail('所属（課）を選択してください。');
  if (shop === '') return fail('店舗を選択してください。');
  if (period === '') return fail('年度を選択してください。');

  const result = await execute(
    `INSERT INTO staff_list (
        khg_id, pg_id, robo_id, name, position, mail, memo, sort,
        status, section, shop,
        category, \`rank\`, report, multi, estate, inside, period
     ) VALUES (?, '', '', ?, ?, '', '', 0, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      text(body.khg_id),
      name,
      text(body.position) === '' ? '一般' : text(body.position),
      text(body.status) === '' ? '在籍' : text(body.status),
      section,
      shop,
      ...FLAG_COLUMNS.map((column) => flag(body[column])),
      period,
    ]
  );

  return {
    httpStatus: 200,
    body: { status: 'success', message: 'スタッフを新規登録しました。', id: result.insertId },
  };
};

/** 1項目ずつ更新してよい列。⚠️ 移植元と同じ */
const STAFF_COLUMNS = [
  'status', 'section', 'shop', 'category', 'rank', 'report', 'estate', 'multi', 'inside', 'period', 'position',
] as const;

/**
 * 人事マスタを1項目だけ更新する。
 *
 * 受け取る形: `{ id, <列名>: 値 }`（⚠️ 移植元と同じ）
 *
 * ⚠️ 移植元は「`id` 以外で最初に出てきたキー」を列名にしていた。
 *   ⚠️ キーの順番に依存していて、`request` が先に来ると壊れる。
 *   ⚠️ ⚠️ **ここでは許可リストにある列を探す。**
 */
export const runStaffUpdate = async (body: Record<string, unknown>): Promise<WriteResult> => {
  const id = Number(body.id);
  if (!Number.isInteger(id) || id <= 0) return fail('対象が見つかりません。');

  const column = STAFF_COLUMNS.find((c) => Object.prototype.hasOwnProperty.call(body, c));
  if (column === undefined) return fail('更新対象のキーが見つかりません。');

  const isFlag = (FLAG_COLUMNS as readonly string[]).includes(column);
  const value = isFlag ? flag(body[column]) : text(body[column]);

  // ⚠️ 課・店舗・年度は空にさせない（⚠️ 空にすると集計から消える）
  if (!isFlag && value === '' && ['section', 'shop', 'period'].includes(column)) {
    return fail('空にはできません。');
  }

  await execute(`UPDATE staff_list SET \`${column}\` = ? WHERE id = ?`, [value, id]);
  return { httpStatus: 200, body: { status: 'success', message: 'アップデートに成功しました。' } };
};
```

### `backend-express/src/gateway/registry.ts`（差分）

```diff
diff --git a/backend-express/src/gateway/registry.ts b/backend-express/src/gateway/registry.ts
index d6fe9553..a3052e04 100644
--- a/backend-express/src/gateway/registry.ts
+++ b/backend-express/src/gateway/registry.ts
@@ -9,6 +9,15 @@ import {
 import { runAmbassadorInquiry } from '../features/ambassador/inquiry';
 import { runAmbassadorKpi } from '../features/ambassador/kpi';
 import { runStaffContract } from '../features/staffContract';
+import {
+  runAuthAccessTimes,
+  runAuthInsert,
+  runAuthList,
+  runAuthUpdate,
+  runStaffEdit,
+  runStaffInsert,
+  runStaffUpdate,
+} from '../features/staffAdmin';
 import { runAmbassadorMaster } from '../features/ambassador/master';
 import {
   runInquiryIntroductoryList,
@@ -2398,3 +2407,119 @@ register({
     return result.body;
   },
 });
+
+// ---------------------------------------------------------------------------
+// スタッフ管理（2026-10-05 移植 / v2.2.163）
+//
+// ⚠️⚠️ **移植元の header_edit_auth.php は、認証なしで全スタッフの
+//   `api_token` と `password` を返していた。** ⚠️ 詳細は features/staffAdmin.ts。
+//
+// ⚠️ 権限:
+//   ログイン権限の閲覧 … Master / BrandAdmin（⚠️ BrandAdmin は画面上も読み取り専用）
+//   ログイン権限の作成・変更 … ⚠️⚠️ **Master のみ**（`auth: 'master'`）
+//   人事マスタ … ログインしていれば可（⚠️ 移植元の画面と同じ。一般は一部の欄が無効）
+//
+// ⚠️⚠️ **`BrandAdimn`（綴り違い）は通さない。** ⚠️ 完全一致で判定している。
+// ---------------------------------------------------------------------------
+const AUTH_VIEW_AUTHORITY = ['Master', 'BrandAdmin'];
+
+const forbidden = (ctx: { res: { status: (code: number) => unknown } }) => {
+  ctx.res.status(403);
+  return { status: 'error', message: 'この操作を行う権限がありません。' };
+};
+
+register({
+  request: 'header_edit_auth',
+  summary: 'ログイン権限の一覧（⚠️ password / api_token / log は返さない）',
+  phpSource: 'header_edit_auth.php',
+  auth: 'staff',
+  handler: async (ctx) => {
+    if (!AUTH_VIEW_AUTHORITY.includes(ctx.staff?.brand ?? '')) return forbidden(ctx);
+    return runAuthList();
+  },
+});
+
+register({
+  request: 'header_auth_access_time',
+  summary: 'ログイン権限の総アクセス時間（秒）。⚠️ 一覧とは別に後から取る',
+  phpSource: '（新規。PHP版なし）',
+  auth: 'staff',
+  handler: async (ctx) => {
+    if (!AUTH_VIEW_AUTHORITY.includes(ctx.staff?.brand ?? '')) return forbidden(ctx);
+    return runAuthAccessTimes();
+  },
+});
+
+register({
+  request: 'header_auth_insert',
+  summary: 'ログイン用アカウントの作成（Master のみ）',
+  phpSource: 'header_auth_insert.php',
+  auth: 'master',
+  handler: async (ctx) => {
+    const result = await runAuthInsert(ctx.body);
+    if (result.httpStatus !== 200) ctx.res.status(result.httpStatus);
+    return result.body;
+  },
+});
+
+register({
+  request: 'header_auth_update',
+  summary: 'ログイン権限の1項目更新（Master のみ）',
+  phpSource: 'header_auth_update.php',
+  auth: 'master',
+  handler: async (ctx) => {
+    const result = await runAuthUpdate(ctx.body);
+    if (result.httpStatus !== 200) ctx.res.status(result.httpStatus);
+    return result.body;
+  },
+});
+
+register({
+  request: 'header_staff_edit',
+  summary: '人事マスタの一覧と、課・店舗のマスタ',
+  phpSource: 'header_staff_edit.php',
+  auth: 'staff',
+  handler: async () => runStaffEdit(),
+});
+
+/**
+ * ⚠️⚠️ **人事マスタの登録・更新は `category` の値ごとに登録する。**
+ *
+ *   ⚠️ `staff_list` には **`category` という列**（全社報告フォーマットのスイッチ・0/1）がある。
+ *   ⚠️ ⚠️ **画面はそれを `category: '1'` のように送ってくるため、
+ *     ゲートウェイの振り分けキー `request:roll:category` に入ってしまう。**
+ *   ⚠️ 1件だけの登録だと ⚠️ `header_staff_insert::1` が見つからず、
+ *     ⚠️⚠️ **「ループ検知」で 502 になる**（2026-10-05 の動作確認で踏んだ）。
+ *
+ *   ⚠️ 来るのは `''`（送らない／他の列を更新）・`'0'`・`'1'` の3通り。
+ *   ⚠️ ⚠️ **ハンドラは同じ。** ⚠️ `category` は列の値として本文から読む。
+ */
+const STAFF_LIST_CATEGORY_VALUES = ['', '0', '1'];
+
+for (const category of STAFF_LIST_CATEGORY_VALUES) {
+  register({
+    request: 'header_staff_insert',
+    category,
+    summary: '人事マスタへの登録（⚠️ 課と店舗は必須）',
+    phpSource: 'header_staff_insert.php',
+    auth: 'staff',
+    handler: async (ctx) => {
+      const result = await runStaffInsert(ctx.body);
+      if (result.httpStatus !== 200) ctx.res.status(result.httpStatus);
+      return result.body;
+    },
+  });
+
+  register({
+    request: 'header_staff_update',
+    category,
+    summary: '人事マスタの1項目更新',
+    phpSource: 'header_staff_update.php',
+    auth: 'staff',
+    handler: async (ctx) => {
+      const result = await runStaffUpdate(ctx.body);
+      if (result.httpStatus !== 200) ctx.res.status(result.httpStatus);
+      return result.body;
+    },
+  });
+}
```

### `backend/src/core/express_proxy.php`（差分）

```diff
diff --git a/backend/src/core/express_proxy.php b/backend/src/core/express_proxy.php
index 64b78d5b..d187ee5b 100644
--- a/backend/src/core/express_proxy.php
+++ b/backend/src/core/express_proxy.php
@@ -141,6 +141,26 @@ function expressProxyRequests(): array
         //   ⚠️⚠️ **① に PHP ハンドラは無い。** ⚠️ expressProxyExclusive() にも入れてある。
         'staff_contract',
 
+        // -----------------------------------------------------------------
+        // 2026-10-05 移植（v2.2.163）。スタッフ管理（EditAuth / EditStaff）。
+        //
+        // ⚠️⚠️ **header_edit_auth.php は全スタッフの api_token と password を
+        //   認証なしで返していた。** ⚠️ ② では列を明示し、権限も確認する。
+        //   ⚠️ ① の PHP も同じ版で列を絞った（⚠️ フォールバック時に漏れないように）。
+        //
+        // ⚠️ 書き込み系（insert / auth_update）と②専用（access_time）は
+        //   ⚠️⚠️ **expressProxyExclusive() にも入れてある。**
+        //   ⚠️ 特に header_auth_update は ⚠️⚠️ **① へ流すと brand が空で上書きされ、
+        //     その人の権限が消える**（① は `brand` しか扱えないため）。
+        // -----------------------------------------------------------------
+        'header_edit_auth',
+        'header_auth_access_time',
+        'header_auth_insert',
+        'header_auth_update',
+        'header_staff_edit',
+        'header_staff_insert',
+        'header_staff_update',
+
         // ⚠️ 2026-10-01 追加（v2.2.157）。台帳のKPI（歩留まり）。
         //
         // ⚠️⚠️ **入れ忘れていて、画面の歩留まりが出ていなかった。**
@@ -677,6 +697,23 @@ function expressProxyExclusive(): array
         // -----------------------------------------------------------------
         'staff_contract',
 
+        // -----------------------------------------------------------------
+        // 2026-10-05 移植（v2.2.163）。スタッフ管理。
+        //
+        // header_auth_access_time … ⚠️ **① に PHP ハンドラは無い**（②で新設）。
+        // header_auth_insert / header_staff_insert … ⚠️ 二重登録を防ぐ。
+        // header_auth_update … ⚠️⚠️ **① の PHP は `brand` しか扱えない。**
+        //   ⚠️ 新しい画面は `{ id, field, value }` で送るため、① へ流れると
+        //   ⚠️⚠️ **`brand = ''` で上書きされ、その人の権限が消える。**
+        //
+        // ⚠️ 一覧（header_edit_auth / header_staff_edit）と header_staff_update は入れない。
+        //   ⚠️ ① でも同じ結果になるので、② が落ちても画面を動かす。
+        // -----------------------------------------------------------------
+        'header_auth_access_time',
+        'header_auth_insert',
+        'header_auth_update',
+        'header_staff_insert',
+
         // -----------------------------------------------------------------
         // 2026-09-24 移植。SUUMO掲載順位の収集結果の保存。
         //
```

### ⚠️ `backend/src/handlers/header_edit_auth.php`（全文）

```php
<?php
// ログイン権限一覧（staff テーブル）。
//
// ⚠️ 人事マスタ（staff_list）とは別物であり、連携していない。
//   このハンドラは staff のみを返す。以前は section_list / shop_list も
//   返していたが、EditAuth.tsx では使っていない無駄なクエリだったため削除した。
//
// ⚠️⚠️ 2026-10-05（v2.2.163）: **以前は `SELECT * FROM staff` をそのまま返していた。**
//   ⚠️ ⚠️ **全スタッフの api_token と password がブラウザへ送られていた。**
//     api_token はログイン状態そのもので、取得した人は Master を含む誰にでもなりすませた。
//     しかもこのハンドラには認証チェックが無く、ログインしていなくても返っていた。
//   ⚠️ log 列（合計221MB）も返しており、ローカルではメモリ上限で落ちていた。
//
//   ⚠️⚠️ **返す列は必ず明示すること。`SELECT *` に戻さないこと。**
//
// ⚠️ 通常は ② へ転送される（core/express_proxy.php）。ここが動くのは ② が落ちたときだけ。
//   ⚠️ 総アクセス時間は ② でしか計算しない（このハンドラは返さない）。

require_once __DIR__ . '/../core/authz.php';

$staffRow = requireStaff($pdo, $headers);
requireAuthority($staffRow, ['Master', 'BrandAdmin']);

$sql = "SELECT id, name, brand, shop, mail, heartbeat, (password <> '') AS has_password
          FROM staff
         WHERE mail <> ''
         ORDER BY id";
$stmt = $pdo->prepare($sql);
$stmt->execute();
$staff = $stmt->fetchAll(PDO::FETCH_ASSOC);

echo json_encode([
    "staff" => $staff,
], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
```

### ⚠️ `frontend/src/components/header/EditAuth.tsx`（作り直し・全文）

```tsx
import React, { useState, useEffect, useContext, useRef, useCallback } from 'react';
import Table from 'react-bootstrap/Table';
import BsForm from 'react-bootstrap/Form';
import apiClient from '../../utils/apiClient';
import AuthContext from '../../context/AuthContext';

/**
 * ログイン権限（staff テーブル）の編集画面。
 *
 * ⚠️ 人事マスタ（staff_list テーブル）は EditStaff.tsx の担当であり、
 *   ここでは一切触らない。両テーブルは連携していないため、
 *   ここでアカウントを作っても人事マスタには登録されない。
 *   人事登録は EditStaff 側で別途行う。
 *
 * ログインは login.php がメールアドレスだけで本人を特定する仕組みのため、
 * メールアドレスの重複は登録できない（サーバー側で弾いている）。
 *
 * ─────────────────────────────────────────────
 * ⚠️⚠️ 2026-10-05（v2.2.163）に作り替えた。
 *
 *   ⚠️ 氏名・権限・事業区分・メールアドレス・パスワードを**この画面で直せる**ようにした。
 *
 *   ⚠️⚠️ **文字の入力欄は非制御（defaultValue + ref）にしてある。**
 *     ⚠️ 制御コンポーネントにすると1文字打つたびに state が更新され、
 *       ⚠️ **200行を超える表全体が描き直されて入力がもたつく。**
 *     ⚠️ 保存はフォーカスが外れたとき（または Enter）に1回だけ行う。
 *
 *   ⚠️⚠️ **パスワードは表示しない。** ⚠️ サーバーも値を返さない（有無だけ）。
 *     ⚠️ 入力したときだけ ② がハッシュにして保存する。
 *
 *   ⚠️⚠️ **総アクセス時間は一覧と別に取る**（`header_auth_access_time`）。
 *     ⚠️ 計算にログ485万件を読むため、⚠️ **一覧を先に出して時間は後から埋める。**
 *
 *   ⚠️ 以前は一覧の取得で ⚠️⚠️ **全員の api_token と password が届いていた**
 *     （サーバー側の不具合。② と ① の両方で塞いだ）。
 * ─────────────────────────────────────────────
 */

/**
 * 権限（staff.brand）。⚠️ 表示名と保存値の対応は 2026-10-05 の指示書どおり。
 * ⚠️⚠️ **② の AUTH_BRANDS（features/staffAdmin.ts）と同じ並び・同じ値にすること。**
 *   ⚠️ ここだけ増やしても ② が「許可されていない権限です」で弾く。
 */
const BRAND_OPTIONS = [
    { value: 'Master', label: '開発者権限' },
    { value: 'BrandAdmin', label: 'マネージャー' },
    { value: 'ordinary', label: '一般' },
    { value: 'Consulting', label: 'コンサル' },
] as const;

/**
 * 事業区分（staff.shop）。⚠️ 店舗名ではない。
 *
 * ⚠️⚠️ **Category.tsx の入場判定がこの値を見ている。**
 *   ⚠️ 空だとどの事業区分にも入れない（2026-10-05 に実際に起きた）。
 * ⚠️ `all` は指示書には無かったが、⚠️ 全事業を見る人（Master / BrandAdmin の多く）が
 *   この値なので加えた（利用者と確認済み）。
 * ⚠️⚠️ **② の AUTH_SHOPS と同じ値にすること。**
 */
const SHOP_OPTIONS = [
    { value: 'order', label: '注文' },
    { value: 'spec', label: '建売' },
    { value: 'used', label: '中古' },
    { value: 'all', label: '全事業' },
] as const;

type Staff = {
    id: string;
    name: string;
    brand: string;
    shop: string;
    mail: string;
    heartbeat: string;
    /** ⚠️ パスワードが設定されているか。⚠️⚠️ **値そのものは届かない** */
    has_password: number;
};

type Field = 'name' | 'brand' | 'shop' | 'mail' | 'password';

const FIELD_LABEL: Record<Field, string> = {
    name: '氏名', brand: '権限', shop: '事業区分', mail: 'メールアドレス', password: 'パスワード',
};

/**
 * 権限の並び順。⚠️ 選択肢の順に並べ、⚠️⚠️ **選択肢に無い値の人は最後に出す。**
 *   ⚠️ 以前は Master / BrandAdmin / ordinary の3つだけを出しており、
 *   ⚠️ ⚠️ **それ以外の権限（insideSales・空など）の人は一覧から消えていた。**
 */
const brandOrder = (brand: string): number => {
    const index = BRAND_OPTIONS.findIndex(o => o.value === brand);
    return index === -1 ? BRAND_OPTIONS.length : index;
};

/** 「◯時間◯分◯秒」。⚠️ 以前の表示（calculateTotalAccessTime）と同じ形 */
const formatSeconds = (totalSeconds: number): string => {
    if (totalSeconds <= 0) return '0秒';
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    let result = '';
    if (hours > 0) result += `${hours}時間`;
    if (minutes > 0 || hours > 0) result += `${minutes}分`;
    result += `${seconds}秒`;
    return result;
};

/**
 * 選択肢に無い現在の値を、選択肢の先頭に「現在の値」として足す。
 *
 * ⚠️⚠️ **足さないと、select は先頭の選択肢を表示してしまう。**
 *   ⚠️ 見た目は「開発者権限」なのに実際は `insideSales`、のようにずれ、
 *   ⚠️ ⚠️ **触っていないのに変わったように見える／うっかり保存して権限が変わる。**
 */
const withCurrent = (
    options: ReadonlyArray<{ value: string; label: string }>,
    current: string
): { value: string; label: string; disabled?: boolean }[] => {
    if (options.some(o => o.value === current)) return [...options];
    return [{ value: current, label: current === '' ? '（未設定）' : `（現在の値: ${current}）`, disabled: true }, ...options];
};

const EditAuth = () => {
    const [staffList, setStaffList] = useState<Staff[]>([]);
    const [accessTimes, setAccessTimes] = useState<Record<string, number> | null>(null);
    const [newAuth, setNewAuth] = useState(false);
    const [newBrand, setNewBrand] = useState<string>('ordinary');
    // ⚠️⚠️ **事業区分は空から始める。** ⚠️ 既定値を入れると、選んだように見えて触らずに保存される
    const [newShop, setNewShop] = useState<string>('');
    const [notice, setNotice] = useState<{ text: string; tone: 'ok' | 'error' } | null>(null);
    const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    // ⚠️ 新規登録行の文字入力は非制御。⚠️ 登録時に ref から読む
    const newNameRef = useRef<HTMLInputElement>(null);
    const newMailRef = useRef<HTMLInputElement>(null);
    const newPasswordRef = useRef<HTMLInputElement>(null);

    const { authority } = useContext(AuthContext);

    // 権限の変更・新規作成は開発者権限のみ。⚠️ ② も Master 以外を 403 で弾く
    const isReadOnly = authority !== 'Master';

    const showNotice = useCallback((text: string, tone: 'ok' | 'error' = 'ok') => {
        setNotice({ text, tone });
        if (noticeTimer.current) clearTimeout(noticeTimer.current);
        noticeTimer.current = setTimeout(() => setNotice(null), tone === 'ok' ? 2000 : 5000);
    }, []);

    useEffect(() => () => {
        if (noticeTimer.current) clearTimeout(noticeTimer.current);
    }, []);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const response = await apiClient.post('', { request: 'header_edit_auth' });
                setStaffList((response.data.staff ?? []).filter((s: Staff) => s.mail));
            } catch (err) {
                console.error(err);
                showNotice('一覧を取得できませんでした。', 'error');
                return;
            }

            // ⚠️⚠️ **一覧を出してから取る。** ⚠️ 初回は数十秒かかることがある（② の再起動直後）
            try {
                const response = await apiClient.post('', { request: 'header_auth_access_time' });
                const times = response.data?.times ?? {};
                const byId: Record<string, number> = {};
                Object.keys(times).forEach(id => { byId[String(id)] = Number(times[id]); });
                setAccessTimes(byId);
            } catch (err) {
                // ⚠️ 時間が出なくても一覧の編集はできる。⚠️ 画面は止めない
                console.error(err);
                setAccessTimes({});
            }
        };
        fetchData();
    }, [showNotice]);

    /**
     * 1項目を保存する。
     * ⚠️ 成功したら画面の行も直す。⚠️ 失敗したら false を返す（呼び出し側で入力を元に戻す）。
     */
    const saveField = async (id: string, field: Field, value: string): Promise<boolean> => {
        try {
            const response = await apiClient.post('', { request: 'header_auth_update', id, field, value });
            if (response.data?.status !== 'success') {
                showNotice(response.data?.message ?? `${FIELD_LABEL[field]}を保存できませんでした。`, 'error');
                return false;
            }
        } catch (err) {
            const message = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
            showNotice(message ?? `${FIELD_LABEL[field]}を保存できませんでした。`, 'error');
            return false;
        }

        setStaffList(prev => prev.map(p => {
            if (p.id !== id) return p;
            // ⚠️ パスワードは値を持たない。⚠️ 「設定済み」にするだけ
            return field === 'password' ? { ...p, has_password: 1 } : { ...p, [field]: value };
        }));
        showNotice(`${FIELD_LABEL[field]}を保存しました。`);
        return true;
    };

    /**
     * 文字の入力欄（氏名・メール）のフォーカスが外れたとき。
     * ⚠️ 変わっていなければ送らない。⚠️ 失敗したら元の値に戻す。
     */
    const commitText = async (e: React.FocusEvent<HTMLInputElement>, item: Staff, field: 'name' | 'mail') => {
        const input = e.currentTarget;
        const next = input.value.trim();
        const before = item[field];
        if (next === before) {
            input.value = before;
            return;
        }
        const ok = await saveField(item.id, field, next);
        if (!ok) input.value = before;
    };

    /** パスワード。⚠️ 空なら何もしない。⚠️ 保存後は欄を空に戻す（⚠️ 画面に残さない） */
    const commitPassword = async (e: React.FocusEvent<HTMLInputElement>, item: Staff) => {
        const input = e.currentTarget;
        const next = input.value;
        if (next === '') return;
        await saveField(item.id, 'password', next);
        input.value = '';
    };

    /** Enter で確定（＝フォーカスを外す）、Esc で元に戻す */
    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, original: string) => {
        if (e.key === 'Enter') {
            e.currentTarget.blur();
        } else if (e.key === 'Escape') {
            e.currentTarget.value = original;
            e.currentTarget.blur();
        }
    };

    const resetNewAuth = () => {
        setNewAuth(false);
        setNewBrand('ordinary');
        setNewShop('');
    };

    const handleSaveNewAuth = async () => {
        // ⚠️ 文字の欄は非制御なので state ではなく ref から読む
        const name = (newNameRef.current?.value ?? '').trim();
        const mail = (newMailRef.current?.value ?? '').trim();
        const password = newPasswordRef.current?.value ?? '';

        if (!name) {
            alert('氏名を入力してください。');
            return;
        }
        if (!mail) {
            alert('ログイン用メールアドレスを入力してください。');
            return;
        }
        // ⚠️⚠️ **事業区分は必須。** ⚠️ 空で作ると、その人はどの事業区分の画面にも入れない
        if (!newShop) {
            alert('事業区分を選択してください。');
            return;
        }

        try {
            const response = await apiClient.post('', {
                request: 'header_auth_insert',
                name, mail, password, brand: newBrand, shop: newShop,
            });

            if (response.data.status === 'success') {
                // id はサーバーが採番した実IDでなければならない。
                // 仮IDを入れると、直後に権限を変更しても存在しないIDで UPDATE され保存されない。
                if (!response.data.id) {
                    alert('登録は完了しましたが、IDが取得できませんでした。画面を再読み込みしてください。');
                    return;
                }
                const created: Staff = {
                    id: String(response.data.id),
                    name, mail, brand: newBrand, shop: newShop,
                    heartbeat: '',
                    has_password: password === '' ? 0 : 1,
                };
                setStaffList(prev => [created, ...prev]);
                setAccessTimes(prev => (prev === null ? prev : { ...prev, [created.id]: 0 }));
                resetNewAuth();
                showNotice('ログイン用アカウントを作成しました。');
            } else {
                alert('登録に失敗しました: ' + response.data.message);
            }
        } catch (err) {
            console.error(err);
            const message = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
            alert(message ?? '通信エラーが発生しました。');
        }
    };

    const sorted = [...staffList].sort((a, b) => brandOrder(a.brand) - brandOrder(b.brand));

    const accessTimeOf = (id: string) => {
        if (accessTimes === null) return <span className="text-muted fw-normal" style={{ fontSize: '11px' }}>計算中…</span>;
        const value = accessTimes[id];
        return value === undefined ? '—' : formatSeconds(value);
    };

    const inputStyle: React.CSSProperties = { fontSize: '12px' };
    const selectStyle: React.CSSProperties = { fontSize: '12px', backgroundColor: '#fafafa', cursor: 'pointer' };

    return (
        <>
            <div className="bg-white p-4 rounded shadow-sm border">
                <div className="d-flex align-items-center mb-3 gap-3">
                    <div className="text-muted" style={{ fontSize: '12px' }}>
                        ログイン用アカウントの一覧です。人事マスタ（スタッフ編集）とは連動していません。
                        {!isReadOnly && <span className="ms-1">氏名・メールアドレス・パスワードは、入力して欄の外を押すか Enter で保存されます（Esc で取り消し）。</span>}
                    </div>
                    {notice && (
                        <div
                            className={`small fw-bold px-2 py-1 rounded ${notice.tone === 'ok' ? 'text-success bg-success-subtle' : 'text-danger bg-danger-subtle'}`}
                            style={{ fontSize: '12px', whiteSpace: 'nowrap' }}
                            role="status"
                        >
                            {notice.text}
                        </div>
                    )}
                    <div className="ms-auto">
                        {newAuth ? (
                            <div className="d-flex gap-2">
                                <button className="btn btn-success btn-sm px-3" style={{ fontSize: '12px', fontWeight: 'bold' }} onClick={handleSaveNewAuth}>
                                    <i className="fa-solid fa-check me-1"></i>登録する
                                </button>
                                <button className="btn btn-secondary btn-sm px-3" style={{ fontSize: '12px' }} onClick={resetNewAuth}>
                                    キャンセル
                                </button>
                            </div>
                        ) : (
                            <button
                                className="btn btn-primary btn-sm px-3"
                                style={{ fontSize: '12px', fontWeight: 'bold' }}
                                onClick={() => setNewAuth(true)}
                                disabled={isReadOnly}
                            >
                                <i className="fa-solid fa-user-plus me-1"></i>新規追加
                            </button>
                        )}
                    </div>
                </div>

                <div className="table-responsive" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
                    <Table hover className="align-middle mb-0" style={{ minWidth: '1280px' }}>
                        <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
                            <tr className="text-secondary border-bottom" style={{ fontSize: '12px', backgroundColor: '#f8f9fa' }}>
                                <th className="py-3 text-center" style={{ width: '50px' }}>No</th>
                                <th className="py-3" style={{ width: '160px' }}>氏名</th>
                                <th className="py-3" style={{ width: '150px' }}>権限</th>
                                <th className="py-3" style={{ width: '130px' }}>事業区分</th>
                                <th className="py-3">ログイン用メールアドレス</th>
                                <th className="py-3" style={{ width: '170px' }}>パスワード</th>
                                <th className="py-3" style={{ width: '160px' }}>最終アクセス日時</th>
                                <th className="py-3" style={{ width: '140px' }}>総アクセス時間</th>
                            </tr>
                        </thead>
                        <tbody style={{ fontSize: '13px' }}>

                            {/* 新規登録行 */}
                            {newAuth && <tr className="table-primary border-bottom" style={{ backgroundColor: '#f0f7ff' }}>
                                <td className="text-center text-muted" style={{ fontSize: '12px' }}>-</td>
                                <td className="p-2">
                                    <BsForm.Control
                                        size="sm" type="text" placeholder="氏名を入力"
                                        ref={newNameRef} defaultValue="" autoComplete="off"
                                        className="fw-bold" style={inputStyle}
                                    />
                                </td>
                                <td className="p-2">
                                    <BsForm.Select
                                        size="sm" value={newBrand}
                                        onChange={(e) => setNewBrand(e.target.value)}
                                        className="border-light-subtle text-dark" style={selectStyle}
                                    >
                                        {BRAND_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                                    </BsForm.Select>
                                </td>
                                <td className="p-2">
                                    <BsForm.Select
                                        size="sm" value={newShop}
                                        onChange={(e) => setNewShop(e.target.value)}
                                        className={`border-light-subtle ${newShop ? 'text-dark' : 'text-danger'}`} style={selectStyle}
                                    >
                                        <option value="" disabled>選択してください</option>
                                        {SHOP_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                                    </BsForm.Select>
                                </td>
                                <td className="p-2">
                                    <BsForm.Control
                                        size="sm" type="email" placeholder="ログイン用メールアドレスを入力"
                                        ref={newMailRef} defaultValue="" autoComplete="off" style={inputStyle}
                                    />
                                </td>
                                <td className="p-2">
                                    <BsForm.Control
                                        size="sm" type="password" placeholder="任意"
                                        ref={newPasswordRef} defaultValue="" autoComplete="new-password" style={inputStyle}
                                    />
                                </td>
                                <td className="text-muted" style={{ fontSize: '12px' }}>-</td>
                                <td className="text-muted" style={{ fontSize: '12px' }}>-</td>
                            </tr>}

                            {sorted.map((item, index) => (
                                <tr key={item.id} className="border-bottom" style={{ transition: 'background-color 0.15s ease' }}>
                                    <td className="text-center text-muted" style={{ fontSize: '12px' }}>{index + 1}</td>
                                    <td className="p-2">
                                        {/* ⚠️⚠️ 非制御。⚠️ key に id を含めているので、並び替えても別人の値が残らない */}
                                        <BsForm.Control
                                            size="sm" type="text"
                                            defaultValue={item.name ?? ''}
                                            onBlur={(e: React.FocusEvent<HTMLInputElement>) => commitText(e, item, 'name')}
                                            onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => handleKeyDown(e, item.name ?? '')}
                                            disabled={isReadOnly} autoComplete="off"
                                            className="fw-bold text-dark border-0 bg-transparent" style={inputStyle}
                                        />
                                    </td>
                                    <td className="p-2">
                                        <BsForm.Select
                                            size="sm" value={item.brand ?? ''}
                                            onChange={(e) => { void saveField(item.id, 'brand', e.target.value); }}
                                            className="border-light-subtle text-dark" style={selectStyle}
                                            disabled={isReadOnly}
                                        >
                                            {withCurrent(BRAND_OPTIONS, item.brand ?? '').map(o =>
                                                <option key={o.value} value={o.value} disabled={o.disabled}>{o.label}</option>)}
                                        </BsForm.Select>
                                    </td>
                                    <td className="p-2">
                                        <BsForm.Select
                                            size="sm" value={item.shop ?? ''}
                                            onChange={(e) => { void saveField(item.id, 'shop', e.target.value); }}
                                            // ⚠️ 未設定は赤。⚠️ その人はどの事業区分の画面にも入れない
                                            className={`border-light-subtle ${item.shop ? 'text-dark' : 'text-danger'}`} style={selectStyle}
                                            disabled={isReadOnly}
                                        >
                                            {withCurrent(SHOP_OPTIONS, item.shop ?? '').map(o =>
                                                <option key={o.value} value={o.value} disabled={o.disabled}>{o.label}</option>)}
                                        </BsForm.Select>
                                    </td>
                                    <td className="p-2">
                                        <BsForm.Control
                                            size="sm" type="email"
                                            defaultValue={item.mail ?? ''}
                                            onBlur={(e: React.FocusEvent<HTMLInputElement>) => commitText(e, item, 'mail')}
                                            onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => handleKeyDown(e, item.mail ?? '')}
                                            disabled={isReadOnly} autoComplete="off"
                                            className="text-muted border-0 bg-transparent" style={inputStyle}
                                        />
                                    </td>
                                    <td className="p-2">
                                        {/* ⚠️⚠️ パスワードは表示しない。⚠️ 入れたときだけ保存し、欄は空に戻す */}
                                        <BsForm.Control
                                            size="sm" type="password"
                                            placeholder={Number(item.has_password) === 1 ? '設定済み（変更時のみ入力）' : '未設定'}
                                            defaultValue=""
                                            onBlur={(e: React.FocusEvent<HTMLInputElement>) => commitPassword(e, item)}
                                            onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => handleKeyDown(e, '')}
                                            disabled={isReadOnly} autoComplete="new-password"
                                            style={inputStyle}
                                        />
                                    </td>
                                    <td className="text-muted" style={{ fontSize: '12px' }}>{item.heartbeat ?? ''}</td>
                                    <td className="fw-bold text-secondary">{accessTimeOf(item.id)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </Table>
                </div>
            </div>
        </>
    );
};

export default EditAuth;
```

### `frontend/src/components/header/EditStaff.tsx`（差分）

```diff
diff --git a/frontend/src/components/header/EditStaff.tsx b/frontend/src/components/header/EditStaff.tsx
index cd5bc178..492b2907 100644
--- a/frontend/src/components/header/EditStaff.tsx
+++ b/frontend/src/components/header/EditStaff.tsx
@@ -39,6 +39,9 @@ const EditStaff = () => {
         // 制御コンポーネントにすると1文字打つたびに state が更新され、
         // 数千行のテーブル全体が再レンダリングされて入力がもたつく。
         const nameInputRef = useRef<HTMLInputElement>(null);
+        // ⚠️ ID（khg_id）も同じ理由で非制御にした（2026-10-05）。
+        //   ⚠️ 以前は制御コンポーネントで、⚠️ **1文字ごとに表全体が描き直されていた。**
+        const khgIdInputRef = useRef<HTMLInputElement>(null);
         // サジェストの絞り込みだけは state が必要なので、遅延させて更新する。
         const [nameKeyword, setNameKeyword] = useState('');
         const nameKeywordTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
@@ -83,10 +86,16 @@ const EditStaff = () => {
                                 setSectionList(response.data.section);
                                 setAuthNames(response.data.auth_names ?? []);
 
+                                /**
+                                 * ⚠️⚠️ **課と店舗は空から始める**（2026-10-05）。
+                                 *   ⚠️ 以前はマスタの先頭（鹿児島営業1課・KH霧島店）を入れていた。
+                                 *   ⚠️ ⚠️ **選んだように見えるので、触らずに登録されて気づけなかった。**
+                                 *     ⚠️ 実際に「入力していないのに KH霧島店 で保存される」と報告があった。
+                                 */
                                 setNewStaffData(prev => ({
                                         ...prev,
-                                        section: response.data.section[0]?.name ?? '',
-                                        shop: response.data.shop[0]?.shop ?? '',
+                                        section: '',
+                                        shop: '',
                                         period: String(thisYear)
                                 }));
                         } catch (err) {
@@ -128,17 +137,28 @@ const EditStaff = () => {
         };
 
         const handleSaveNewStaff = async () => {
-                // 氏名は非制御 input のため state ではなく ref から読む
+                // 氏名と ID は非制御 input のため state ではなく ref から読む
                 const name = (nameInputRef.current?.value ?? '').trim();
+                const khgId = (khgIdInputRef.current?.value ?? '').trim();
 
                 if (!name) {
                         alert('氏名を入力してください。');
                         return;
                 }
+                // ⚠️⚠️ **課と店舗は必須**（2026-10-05）。⚠️ ② も空なら弾く
+                if (!newStaffData.section) {
+                        alert('所属（課）を選択してください。');
+                        return;
+                }
+                if (!newStaffData.shop) {
+                        alert('店舗を選択してください。');
+                        return;
+                }
 
                 try {
                         const postData = {
                                 ...newStaffData,
+                                khg_id: khgId,
                                 name,
                                 request: "header_staff_insert"
                         };
@@ -153,7 +173,7 @@ const EditStaff = () => {
                                         alert('登録は完了しましたが、IDが取得できませんでした。画面を再読み込みしてください。');
                                         return;
                                 }
-                                const createdRecord = { ...newStaffData, name, id: String(response.data.id) };
+                                const createdRecord = { ...newStaffData, khg_id: khgId, name, id: String(response.data.id) };
 
                                 setOriginalStaffList(prev => [createdRecord, ...prev]);
                                 // 行がアンマウントされるので非制御 input の値は自動的にクリアされる
@@ -166,8 +186,9 @@ const EditStaff = () => {
                                         name: '',
                                         position: '一般',
                                         status: '在籍',
-                                        section: sectionList[0]?.name ?? '',
-                                        shop: shopList[0]?.shop ?? '',
+                                        // ⚠️⚠️ 登録後も空に戻す（⚠️ 先頭の課・店舗を入れない。上の取得時と同じ理由）
+                                        section: '',
+                                        shop: '',
                                         category: '0',
                                         rank: '0',
                                         report: '0',
@@ -297,12 +318,14 @@ const EditStaff = () => {
                                                         {/* 新規登録行 */}
                                                         {newStaff && <tr className="table-primary border-bottom" style={{ backgroundColor: '#f0f7ff' }}>
                                                                 <td className="p-2">
+                                                                        {/* ⚠️ 非制御（ref から読む）。⚠️ 1文字ごとに表全体を描き直さないため */}
                                                                         <BsForm.Control
                                                                                 size="sm"
                                                                                 type="text"
                                                                                 placeholder="ID"
-                                                                                value={newStaffData.khg_id}
-                                                                                onChange={(e) => setNewStaffData(prev => ({ ...prev, khg_id: e.target.value }))}
+                                                                                ref={khgIdInputRef}
+                                                                                defaultValue=""
+                                                                                autoComplete="off"
                                                                                 className="text-center"
                                                                                 style={{ fontSize: '12px' }}
                                                                         />
@@ -399,14 +422,20 @@ const EditStaff = () => {
                                                                         </BsForm.Select>
                                                                 </td>
                                                                 <td>
+                                                                        {/*
+                                                                            ⚠️⚠️ **新規行の課・店舗は一般（ordinary）でも選べる**（2026-10-05）。
+                                                                              ⚠️ 以前は無効になっており、⚠️ **一般が登録すると必ず先頭の課・店舗で保存されていた。**
+                                                                              ⚠️ 必須にした以上、選べないと登録自体ができなくなる。
+                                                                              ⚠️ 既存行の変更は従来どおり一般には無効のまま。
+                                                                        */}
                                                                         <BsForm.Select
                                                                                 size="sm"
                                                                                 value={newStaffData.section}
                                                                                 onChange={(e) => setNewStaffData(prev => ({ ...prev, section: e.target.value }))}
-                                                                                className="border-light-subtle text-muted"
+                                                                                className={`border-light-subtle ${newStaffData.section ? 'text-muted' : 'text-danger'}`}
                                                                                 style={{ fontSize: '12px', backgroundColor: '#fafafa', cursor: 'pointer' }}
-                                                                                disabled={isOrdinary}
                                                                         >
+                                                                                <option value="" disabled>選択してください</option>
                                                                                 {sectionList.map((section, sIndex) => <option key={sIndex} value={section.name}>{section.name}</option>)}
                                                                         </BsForm.Select>
                                                                 </td>
@@ -415,10 +444,10 @@ const EditStaff = () => {
                                                                                 size="sm"
                                                                                 value={newStaffData.shop}
                                                                                 onChange={(e) => setNewStaffData(prev => ({ ...prev, shop: e.target.value }))}
-                                                                                className="border-light-subtle text-muted"
+                                                                                className={`border-light-subtle ${newStaffData.shop ? 'text-muted' : 'text-danger'}`}
                                                                                 style={{ fontSize: '12px', backgroundColor: '#fafafa', cursor: 'pointer' }}
-                                                                                disabled={isOrdinary}
                                                                         >
+                                                                                <option value="" disabled>選択してください</option>
                                                                                 {shopList.map((shop, sIndex) => <option value={shop.shop} key={sIndex}>{shop.shop}</option>)}
                                                                         </BsForm.Select>
                                                                 </td>
```

### `backend-express/package.json`（差分）

```diff
diff --git a/backend-express/package.json b/backend-express/package.json
index d4b2b140..997b2d08 100644
--- a/backend-express/package.json
+++ b/backend-express/package.json
@@ -14,6 +14,7 @@
   },
   "dependencies": {
     "@types/qrcode": "^1.5.6",
+    "bcryptjs": "^3.0.3",
     "compression": "^1.8.1",
     "cors": "^2.8.5",
     "express": "^5.1.0",
```

### `backend/scripts/sql/2026-10-05_update_log_2.2.163.sql`

```sql
-- =====================================================================
-- update_log に v2.2.163 を追加する
--
-- ⚠️ `no` は AUTO_INCREMENT なので指定しないこと。
-- ⚠️ 実行環境: ① レンタルサーバー（phpMyAdmin）
--
-- ⚠️⚠️ **この版はDBの構造を変えない**（表も列も追加なし）。流すのはこれだけ。
-- =====================================================================

INSERT INTO update_log (version, date, note) VALUES
('2.2.163', '2026-10-05', 'スタッフ管理を改修した。権限編集で氏名・権限・事業区分・メールアドレス・パスワードを変更できるようにした。スタッフ追加では課と店舗を選ばないと登録できないようにした。権限編集の一覧からログイン情報が送られないようにした。');
```

### ⚠️ `backend/scripts/sql/dev/mask_personal_info.sql`（新規・全文）

```sql
-- =====================================================================
-- 個人情報のマスク（自宅の開発環境用）
--
-- ⚠️⚠️⚠️ **本番では絶対に実行しないこと。** ⚠️ 元に戻せない。
--   ⚠️ 顧客の氏名・かな・メールアドレス・電話番号を `*` に書き換える。
--   ⚠️ バックアップからしか復元できない。
--
-- ⚠️ 実行環境: 自宅の Ubuntu の Docker（dashboard-mariadb-db-1 の local_db）
--
-- 実行方法（⚠️ 2行目の SET を付けないと安全装置で止まる）:
--
--   docker cp backend/scripts/sql/dev/mask_personal_info.sql dashboard-mariadb-db-1:/tmp/mask.sql
--   docker exec -i dashboard-mariadb-db-1 sh -c \
--     'mariadb --default-character-set=utf8mb4 -uroot -p"$MARIADB_ROOT_PASSWORD" local_db \
--        -e "SET @confirm_mask = '"'"'YES'"'"'; source /tmp/mask.sql;"'
--
-- ─────────────────────────────────────────────
-- ⚠️⚠️ 安全装置（2つとも満たさないと何もせずに止まる）
--   1. 接続先のDB名が `local_db` であること
--      （⚠️ 本番のDB名は local_db ではない。⚠️ 誤って本番に流しても、ここで止まる）
--   2. 実行前に `SET @confirm_mask = 'YES';` を打っていること
--      （⚠️ ⚠️ **会社のPCのローカルDBも `local_db` という名前**なので、
--        1つ目だけでは会社の開発データを消してしまう。⚠️ 意図した実行だと明示させる）
--
-- ⚠️ 全体を1つのブロック・1つのトランザクションにしてある。⚠️ 途中で失敗したら**何も変わらない**。
--   ⚠️ 対象の表はすべて InnoDB（2026-10-05 確認）。
-- ─────────────────────────────────────────────
-- 書き換え方
--   氏名・かな … 同じ文字数の `*`（例: 山田 太郎 → *****）。空は空のまま
--   メール     … `@` と `.` だけ残す（例: taro@example.com → ****@*******.***）
--     ⚠️ 一意制約のある4表（catalog_kaeru / catalog_resale / reserve_kaeru / reserve_resale）は
--       ⚠️ 同じ形だと重複して失敗するため、`********<no>@****.***` にする
--   電話・FAX  … 数字（半角・全角）だけ `*`（例: 090-1234-5678 → ***-****-****）
--
-- ⚠️⚠️ 対象外にしたもの（意図的）
--   ⚠️ スタッフの氏名（staff / staff_list / created_by_name など）
--     ⚠️ 営業別の集計などで**顧客の担当営業と突合している**ため。⚠️ 伏せると画面が壊れる
--   ⚠️ call_achievement.name（98件すべてスタッフ名）/ company_achievement.name（3割がスタッフ名）
--   ⚠️ funding_plan.x_tel（⚠️ 電話番号ではなく家計の通信費。decimal）
--   ⚠️ 物件名・会社名・キャンペーン名・店舗名
--   ⚠️ form_table / form_database の mail_to / mail_cc（社内の通知先）
--
-- ⚠️⚠️ **伏せていないもの（残る個人情報）**
--   ⚠️ 住所（zip / pref / city / town / street など）
--   ⚠️ 自由記述（remarks / note / interview_log / master_data_log など）
--     ⚠️ 本文に氏名や電話番号が書かれていることがある
--   ⚠️ 判定できなかった列: introductory.name / spreadSheet.name / registered_estate.name /
--     hotlead_db.client_user_name
--
-- 生成: 2026-10-05（v2.2.163）。⚠️ 64表・261列。
--   ⚠️ 列を足すときは docs/task-2026-10-05-01-*.md の手順で作り直すこと。
-- =====================================================================

-- ⚠️⚠️⚠️ **UPDATE はすべて、この1つのブロック（BEGIN NOT ATOMIC … END）の中に置くこと。**
--
--   ⚠️ 2026-10-05 の検証で、⚠️⚠️ **安全装置をブロックの外の UPDATE の前に置く形では止まらなかった。**
--     ⚠️ `source` で読み込んだファイルは、⚠️ **エラーが出ても次の文へ進む。**
--     ⚠️ 安全装置は「STOP」と表示したのに、⚠️ **その後の文がそのまま実行された。**
--   ⚠️ ブロックの中なら、⚠️ SIGNAL で残りがすべて打ち切られる。
--   ⚠️ ⚠️ **ブロックの外に UPDATE を書き足すと、安全装置が効かない。**
--
-- ⚠️ 途中で失敗した場合は、下の EXIT HANDLER がロールバックして ⚠️ **何も変わらない。**

DELIMITER //
BEGIN NOT ATOMIC
  DECLARE EXIT HANDLER FOR SQLEXCEPTION
  BEGIN
    ROLLBACK;
    RESIGNAL;
  END;

  -- ---- 安全装置 ------------------------------------------------------
  IF DATABASE() IS NULL OR DATABASE() <> 'local_db' THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'STOP: database is not local_db. Nothing was changed.';
  END IF;
  IF @confirm_mask IS NULL OR @confirm_mask <> 'YES' THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'STOP: run SET @confirm_mask = ''YES''; first. Nothing was changed.';
  END IF;

  START TRANSACTION;

  UPDATE `after_interview` SET
    `name` = CASE WHEN `name` IS NULL OR `name` = '' THEN `name` ELSE REPEAT('*', CHAR_LENGTH(`name`)) END,
    `phone` = REGEXP_REPLACE(`phone`, '[0-9０-９]', '*');
  
  UPDATE `allGrit_db` SET
    `mail_allGrit` = REGEXP_REPLACE(`mail_allGrit`, '[^@.]', '*'),
    `phone_allGrit` = REGEXP_REPLACE(`phone_allGrit`, '[0-9０-９]', '*');
  
  UPDATE `allGrit_kaeru` SET
    `line_display_name` = CASE WHEN `line_display_name` IS NULL OR `line_display_name` = '' THEN `line_display_name` ELSE REPEAT('*', CHAR_LENGTH(`line_display_name`)) END,
    `last_name` = CASE WHEN `last_name` IS NULL OR `last_name` = '' THEN `last_name` ELSE REPEAT('*', CHAR_LENGTH(`last_name`)) END,
    `first_name` = CASE WHEN `first_name` IS NULL OR `first_name` = '' THEN `first_name` ELSE REPEAT('*', CHAR_LENGTH(`first_name`)) END,
    `name_kana` = CASE WHEN `name_kana` IS NULL OR `name_kana` = '' THEN `name_kana` ELSE REPEAT('*', CHAR_LENGTH(`name_kana`)) END,
    `email` = REGEXP_REPLACE(`email`, '[^@.]', '*'),
    `phone` = REGEXP_REPLACE(`phone`, '[0-9０-９]', '*');
  
  UPDATE `ambassador_list` SET
    `name` = CASE WHEN `name` IS NULL OR `name` = '' THEN `name` ELSE REPEAT('*', CHAR_LENGTH(`name`)) END,
    `kana` = CASE WHEN `kana` IS NULL OR `kana` = '' THEN `kana` ELSE REPEAT('*', CHAR_LENGTH(`kana`)) END,
    `mail` = REGEXP_REPLACE(`mail`, '[^@.]', '*'),
    `mobile` = REGEXP_REPLACE(`mobile`, '[0-9０-９]', '*');
  
  UPDATE `athome_db_kaeru` SET
    `name` = CASE WHEN `name` IS NULL OR `name` = '' THEN `name` ELSE REPEAT('*', CHAR_LENGTH(`name`)) END,
    `email` = REGEXP_REPLACE(`email`, '[^@.]', '*'),
    `tel` = REGEXP_REPLACE(`tel`, '[0-9０-９]', '*');
  
  UPDATE `athome_db_resale` SET
    `name` = CASE WHEN `name` IS NULL OR `name` = '' THEN `name` ELSE REPEAT('*', CHAR_LENGTH(`name`)) END,
    `email` = REGEXP_REPLACE(`email`, '[^@.]', '*'),
    `tel` = REGEXP_REPLACE(`tel`, '[0-9０-９]', '*');
  
  UPDATE `before_interview` SET
    `name` = CASE WHEN `name` IS NULL OR `name` = '' THEN `name` ELSE REPEAT('*', CHAR_LENGTH(`name`)) END,
    `kana` = CASE WHEN `kana` IS NULL OR `kana` = '' THEN `kana` ELSE REPEAT('*', CHAR_LENGTH(`kana`)) END,
    `mail` = REGEXP_REPLACE(`mail`, '[^@.]', '*'),
    `phone` = REGEXP_REPLACE(`phone`, '[0-9０-９]', '*'),
    `mobile` = REGEXP_REPLACE(`mobile`, '[0-9０-９]', '*');
  
  UPDATE `before_survey` SET
    `name` = CASE WHEN `name` IS NULL OR `name` = '' THEN `name` ELSE REPEAT('*', CHAR_LENGTH(`name`)) END;
  
  UPDATE `black_list` SET
    `name` = CASE WHEN `name` IS NULL OR `name` = '' THEN `name` ELSE REPEAT('*', CHAR_LENGTH(`name`)) END,
    `mail` = REGEXP_REPLACE(`mail`, '[^@.]', '*'),
    `mobile` = REGEXP_REPLACE(`mobile`, '[0-9０-９]', '*');
  
  UPDATE `brokerage_listings` SET
    `name` = CASE WHEN `name` IS NULL OR `name` = '' THEN `name` ELSE REPEAT('*', CHAR_LENGTH(`name`)) END,
    `mail` = REGEXP_REPLACE(`mail`, '[^@.]', '*'),
    `phone` = REGEXP_REPLACE(`phone`, '[0-9０-９]', '*');
  
  UPDATE `call_sheet` SET
    `name` = CASE WHEN `name` IS NULL OR `name` = '' THEN `name` ELSE REPEAT('*', CHAR_LENGTH(`name`)) END;
  
  UPDATE `catalog_kaeru` SET
    `name` = CASE WHEN `name` IS NULL OR `name` = '' THEN `name` ELSE REPEAT('*', CHAR_LENGTH(`name`)) END,
    `email` = CASE WHEN `email` IS NULL OR `email` = '' THEN `email` ELSE CONCAT('********', `no`, '@****.***') END,
    `tel` = REGEXP_REPLACE(`tel`, '[0-9０-９]', '*');
  
  UPDATE `catalog_resale` SET
    `name` = CASE WHEN `name` IS NULL OR `name` = '' THEN `name` ELSE REPEAT('*', CHAR_LENGTH(`name`)) END,
    `email` = CASE WHEN `email` IS NULL OR `email` = '' THEN `email` ELSE CONCAT('********', `no`, '@****.***') END,
    `tel` = REGEXP_REPLACE(`tel`, '[0-9０-９]', '*');
  
  UPDATE `contract_customer` SET
    `name` = CASE WHEN `name` IS NULL OR `name` = '' THEN `name` ELSE REPEAT('*', CHAR_LENGTH(`name`)) END;
  
  UPDATE `contract_customer_backup_20260827` SET
    `name` = CASE WHEN `name` IS NULL OR `name` = '' THEN `name` ELSE REPEAT('*', CHAR_LENGTH(`name`)) END;
  
  UPDATE `customers` SET
    `name` = CASE WHEN `name` IS NULL OR `name` = '' THEN `name` ELSE REPEAT('*', CHAR_LENGTH(`name`)) END,
    `phone_number` = REGEXP_REPLACE(`phone_number`, '[0-9０-９]', '*');
  
  UPDATE `event_db` SET
    `name` = CASE WHEN `name` IS NULL OR `name` = '' THEN `name` ELSE REPEAT('*', CHAR_LENGTH(`name`)) END,
    `kana` = CASE WHEN `kana` IS NULL OR `kana` = '' THEN `kana` ELSE REPEAT('*', CHAR_LENGTH(`kana`)) END,
    `mail` = REGEXP_REPLACE(`mail`, '[^@.]', '*'),
    `phone` = REGEXP_REPLACE(`phone`, '[0-9０-９]', '*');
  
  UPDATE `family_info` SET
    `name` = CASE WHEN `name` IS NULL OR `name` = '' THEN `name` ELSE REPEAT('*', CHAR_LENGTH(`name`)) END;
  
  UPDATE `funding_plan` SET
    `k_name` = CASE WHEN `k_name` IS NULL OR `k_name` = '' THEN `k_name` ELSE REPEAT('*', CHAR_LENGTH(`k_name`)) END,
    `k_kana` = CASE WHEN `k_kana` IS NULL OR `k_kana` = '' THEN `k_kana` ELSE REPEAT('*', CHAR_LENGTH(`k_kana`)) END,
    `k_h_name` = CASE WHEN `k_h_name` IS NULL OR `k_h_name` = '' THEN `k_h_name` ELSE REPEAT('*', CHAR_LENGTH(`k_h_name`)) END,
    `k_w_name` = CASE WHEN `k_w_name` IS NULL OR `k_w_name` = '' THEN `k_w_name` ELSE REPEAT('*', CHAR_LENGTH(`k_w_name`)) END,
    `k_mail` = REGEXP_REPLACE(`k_mail`, '[^@.]', '*'),
    `k_tel` = REGEXP_REPLACE(`k_tel`, '[0-9０-９]', '*');
  
  UPDATE `homes_db` SET
    `name_homes` = CASE WHEN `name_homes` IS NULL OR `name_homes` = '' THEN `name_homes` ELSE REPEAT('*', CHAR_LENGTH(`name_homes`)) END,
    `kana_homes` = CASE WHEN `kana_homes` IS NULL OR `kana_homes` = '' THEN `kana_homes` ELSE REPEAT('*', CHAR_LENGTH(`kana_homes`)) END,
    `mail_homes` = REGEXP_REPLACE(`mail_homes`, '[^@.]', '*'),
    `phone_homes` = REGEXP_REPLACE(`phone_homes`, '[0-9０-９]', '*');
  
  UPDATE `homes_db_kaeru` SET
    `name` = CASE WHEN `name` IS NULL OR `name` = '' THEN `name` ELSE REPEAT('*', CHAR_LENGTH(`name`)) END,
    `mail` = REGEXP_REPLACE(`mail`, '[^@.]', '*'),
    `mobile` = REGEXP_REPLACE(`mobile`, '[0-9０-９]', '*');
  
  UPDATE `homes_db_resale` SET
    `name` = CASE WHEN `name` IS NULL OR `name` = '' THEN `name` ELSE REPEAT('*', CHAR_LENGTH(`name`)) END,
    `mail` = REGEXP_REPLACE(`mail`, '[^@.]', '*'),
    `mobile` = REGEXP_REPLACE(`mobile`, '[0-9０-９]', '*');
  
  UPDATE `hotlead_db` SET
    `name` = CASE WHEN `name` IS NULL OR `name` = '' THEN `name` ELSE REPEAT('*', CHAR_LENGTH(`name`)) END,
    `name_kana` = CASE WHEN `name_kana` IS NULL OR `name_kana` = '' THEN `name_kana` ELSE REPEAT('*', CHAR_LENGTH(`name_kana`)) END,
    `email` = REGEXP_REPLACE(`email`, '[^@.]', '*'),
    `phone` = REGEXP_REPLACE(`phone`, '[0-9０-９]', '*');
  
  UPDATE `iei_db` SET
    `name` = CASE WHEN `name` IS NULL OR `name` = '' THEN `name` ELSE REPEAT('*', CHAR_LENGTH(`name`)) END,
    `name_kana` = CASE WHEN `name_kana` IS NULL OR `name_kana` = '' THEN `name_kana` ELSE REPEAT('*', CHAR_LENGTH(`name_kana`)) END,
    `email` = REGEXP_REPLACE(`email`, '[^@.]', '*');
  
  UPDATE `ieuru_resale` SET
    `name` = CASE WHEN `name` IS NULL OR `name` = '' THEN `name` ELSE REPEAT('*', CHAR_LENGTH(`name`)) END,
    `email` = REGEXP_REPLACE(`email`, '[^@.]', '*'),
    `mobile` = REGEXP_REPLACE(`mobile`, '[0-9０-９]', '*');
  
  UPDATE `inquiry_ambassador` SET
    `name` = CASE WHEN `name` IS NULL OR `name` = '' THEN `name` ELSE REPEAT('*', CHAR_LENGTH(`name`)) END,
    `kana` = CASE WHEN `kana` IS NULL OR `kana` = '' THEN `kana` ELSE REPEAT('*', CHAR_LENGTH(`kana`)) END,
    `mail` = REGEXP_REPLACE(`mail`, '[^@.]', '*'),
    `mobile` = REGEXP_REPLACE(`mobile`, '[0-9０-９]', '*');
  
  UPDATE `inquiry_customer` SET
    `first_name` = CASE WHEN `first_name` IS NULL OR `first_name` = '' THEN `first_name` ELSE REPEAT('*', CHAR_LENGTH(`first_name`)) END,
    `last_name` = CASE WHEN `last_name` IS NULL OR `last_name` = '' THEN `last_name` ELSE REPEAT('*', CHAR_LENGTH(`last_name`)) END,
    `first_name_kana` = CASE WHEN `first_name_kana` IS NULL OR `first_name_kana` = '' THEN `first_name_kana` ELSE REPEAT('*', CHAR_LENGTH(`first_name_kana`)) END,
    `last_name_kana` = CASE WHEN `last_name_kana` IS NULL OR `last_name_kana` = '' THEN `last_name_kana` ELSE REPEAT('*', CHAR_LENGTH(`last_name_kana`)) END,
    `mail` = REGEXP_REPLACE(`mail`, '[^@.]', '*'),
    `mhl_mail` = REGEXP_REPLACE(`mhl_mail`, '[^@.]', '*'),
    `mobile` = REGEXP_REPLACE(`mobile`, '[0-9０-９]', '*'),
    `landline` = REGEXP_REPLACE(`landline`, '[0-9０-９]', '*');
  
  UPDATE `inquiry_customer_kaeru` SET
    `first_name` = CASE WHEN `first_name` IS NULL OR `first_name` = '' THEN `first_name` ELSE REPEAT('*', CHAR_LENGTH(`first_name`)) END,
    `last_name` = CASE WHEN `last_name` IS NULL OR `last_name` = '' THEN `last_name` ELSE REPEAT('*', CHAR_LENGTH(`last_name`)) END,
    `first_name_kana` = CASE WHEN `first_name_kana` IS NULL OR `first_name_kana` = '' THEN `first_name_kana` ELSE REPEAT('*', CHAR_LENGTH(`first_name_kana`)) END,
    `last_name_kana` = CASE WHEN `last_name_kana` IS NULL OR `last_name_kana` = '' THEN `last_name_kana` ELSE REPEAT('*', CHAR_LENGTH(`last_name_kana`)) END,
    `mail` = REGEXP_REPLACE(`mail`, '[^@.]', '*'),
    `mhl_mail` = REGEXP_REPLACE(`mhl_mail`, '[^@.]', '*'),
    `mobile` = REGEXP_REPLACE(`mobile`, '[0-9０-９]', '*'),
    `landline` = REGEXP_REPLACE(`landline`, '[0-9０-９]', '*');
  
  UPDATE `inquiry_customer_resale` SET
    `first_name` = CASE WHEN `first_name` IS NULL OR `first_name` = '' THEN `first_name` ELSE REPEAT('*', CHAR_LENGTH(`first_name`)) END,
    `last_name` = CASE WHEN `last_name` IS NULL OR `last_name` = '' THEN `last_name` ELSE REPEAT('*', CHAR_LENGTH(`last_name`)) END,
    `first_name_kana` = CASE WHEN `first_name_kana` IS NULL OR `first_name_kana` = '' THEN `first_name_kana` ELSE REPEAT('*', CHAR_LENGTH(`first_name_kana`)) END,
    `last_name_kana` = CASE WHEN `last_name_kana` IS NULL OR `last_name_kana` = '' THEN `last_name_kana` ELSE REPEAT('*', CHAR_LENGTH(`last_name_kana`)) END,
    `mail` = REGEXP_REPLACE(`mail`, '[^@.]', '*'),
    `mhl_mail` = REGEXP_REPLACE(`mhl_mail`, '[^@.]', '*'),
    `mobile` = REGEXP_REPLACE(`mobile`, '[0-9０-９]', '*'),
    `landline` = REGEXP_REPLACE(`landline`, '[0-9０-９]', '*');
  
  UPDATE `inquiry_introductory` SET
    `registrantName` = CASE WHEN `registrantName` IS NULL OR `registrantName` = '' THEN `registrantName` ELSE REPEAT('*', CHAR_LENGTH(`registrantName`)) END,
    `friendName` = CASE WHEN `friendName` IS NULL OR `friendName` = '' THEN `friendName` ELSE REPEAT('*', CHAR_LENGTH(`friendName`)) END,
    `mail` = REGEXP_REPLACE(`mail`, '[^@.]', '*'),
    `tel` = REGEXP_REPLACE(`tel`, '[0-9０-９]', '*'),
    `fax` = REGEXP_REPLACE(`fax`, '[0-9０-９]', '*'),
    `mobile` = REGEXP_REPLACE(`mobile`, '[0-9０-９]', '*'),
    `friendTel` = REGEXP_REPLACE(`friendTel`, '[0-9０-９]', '*');
  
  UPDATE `interview_sheet` SET
    `name` = CASE WHEN `name` IS NULL OR `name` = '' THEN `name` ELSE REPEAT('*', CHAR_LENGTH(`name`)) END;
  
  UPDATE `kaeeru_db` SET
    `name` = CASE WHEN `name` IS NULL OR `name` = '' THEN `name` ELSE REPEAT('*', CHAR_LENGTH(`name`)) END,
    `name_kana` = CASE WHEN `name_kana` IS NULL OR `name_kana` = '' THEN `name_kana` ELSE REPEAT('*', CHAR_LENGTH(`name_kana`)) END,
    `email` = REGEXP_REPLACE(`email`, '[^@.]', '*'),
    `tel` = REGEXP_REPLACE(`tel`, '[0-9０-９]', '*');
  
  UPDATE `khf_customers` SET
    `name` = CASE WHEN `name` IS NULL OR `name` = '' THEN `name` ELSE REPEAT('*', CHAR_LENGTH(`name`)) END,
    `kana` = CASE WHEN `kana` IS NULL OR `kana` = '' THEN `kana` ELSE REPEAT('*', CHAR_LENGTH(`kana`)) END,
    `mail` = REGEXP_REPLACE(`mail`, '[^@.]', '*'),
    `phone` = REGEXP_REPLACE(`phone`, '[0-9０-９]', '*');
  
  UPDATE `maillist` SET
    `name` = CASE WHEN `name` IS NULL OR `name` = '' THEN `name` ELSE REPEAT('*', CHAR_LENGTH(`name`)) END,
    `mail` = REGEXP_REPLACE(`mail`, '[^@.]', '*');
  
  UPDATE `master_data` SET
    `customer_contacts_name` = CASE WHEN `customer_contacts_name` IS NULL OR `customer_contacts_name` = '' THEN `customer_contacts_name` ELSE REPEAT('*', CHAR_LENGTH(`customer_contacts_name`)) END,
    `customer_contacts_name_kana` = CASE WHEN `customer_contacts_name_kana` IS NULL OR `customer_contacts_name_kana` = '' THEN `customer_contacts_name_kana` ELSE REPEAT('*', CHAR_LENGTH(`customer_contacts_name_kana`)) END,
    `customer_contacts_name_2` = CASE WHEN `customer_contacts_name_2` IS NULL OR `customer_contacts_name_2` = '' THEN `customer_contacts_name_2` ELSE REPEAT('*', CHAR_LENGTH(`customer_contacts_name_2`)) END,
    `customer_contacts_name_kana_2` = CASE WHEN `customer_contacts_name_kana_2` IS NULL OR `customer_contacts_name_kana_2` = '' THEN `customer_contacts_name_kana_2` ELSE REPEAT('*', CHAR_LENGTH(`customer_contacts_name_kana_2`)) END,
    `introduction_person_name` = CASE WHEN `introduction_person_name` IS NULL OR `introduction_person_name` = '' THEN `introduction_person_name` ELSE REPEAT('*', CHAR_LENGTH(`introduction_person_name`)) END,
    `customer_contacts_email` = REGEXP_REPLACE(`customer_contacts_email`, '[^@.]', '*'),
    `customer_contacts_phone_number` = REGEXP_REPLACE(`customer_contacts_phone_number`, '[0-9０-９]', '*'),
    `customer_contacts_mobile_phone_number` = REGEXP_REPLACE(`customer_contacts_mobile_phone_number`, '[0-9０-９]', '*');
  
  UPDATE `master_data_kaeru` SET
    `customer_contacts_name` = CASE WHEN `customer_contacts_name` IS NULL OR `customer_contacts_name` = '' THEN `customer_contacts_name` ELSE REPEAT('*', CHAR_LENGTH(`customer_contacts_name`)) END,
    `customer_contacts_name_kana` = CASE WHEN `customer_contacts_name_kana` IS NULL OR `customer_contacts_name_kana` = '' THEN `customer_contacts_name_kana` ELSE REPEAT('*', CHAR_LENGTH(`customer_contacts_name_kana`)) END,
    `customer_contacts_name_2` = CASE WHEN `customer_contacts_name_2` IS NULL OR `customer_contacts_name_2` = '' THEN `customer_contacts_name_2` ELSE REPEAT('*', CHAR_LENGTH(`customer_contacts_name_2`)) END,
    `customer_contacts_name_kana_2` = CASE WHEN `customer_contacts_name_kana_2` IS NULL OR `customer_contacts_name_kana_2` = '' THEN `customer_contacts_name_kana_2` ELSE REPEAT('*', CHAR_LENGTH(`customer_contacts_name_kana_2`)) END,
    `introduction_person_name` = CASE WHEN `introduction_person_name` IS NULL OR `introduction_person_name` = '' THEN `introduction_person_name` ELSE REPEAT('*', CHAR_LENGTH(`introduction_person_name`)) END,
    `customer_contacts_email` = REGEXP_REPLACE(`customer_contacts_email`, '[^@.]', '*'),
    `customer_contacts_phone_number` = REGEXP_REPLACE(`customer_contacts_phone_number`, '[0-9０-９]', '*'),
    `customer_contacts_mobile_phone_number` = REGEXP_REPLACE(`customer_contacts_mobile_phone_number`, '[0-9０-９]', '*');
  
  UPDATE `master_data_kana_backup_20260925` SET
    `customer_contacts_name_kana` = CASE WHEN `customer_contacts_name_kana` IS NULL OR `customer_contacts_name_kana` = '' THEN `customer_contacts_name_kana` ELSE REPEAT('*', CHAR_LENGTH(`customer_contacts_name_kana`)) END,
    `customer_contacts_name_kana_2` = CASE WHEN `customer_contacts_name_kana_2` IS NULL OR `customer_contacts_name_kana_2` = '' THEN `customer_contacts_name_kana_2` ELSE REPEAT('*', CHAR_LENGTH(`customer_contacts_name_kana_2`)) END;
  
  UPDATE `master_data_planner` SET
    `customer_contacts_name` = CASE WHEN `customer_contacts_name` IS NULL OR `customer_contacts_name` = '' THEN `customer_contacts_name` ELSE REPEAT('*', CHAR_LENGTH(`customer_contacts_name`)) END,
    `customer_contacts_name_kana` = CASE WHEN `customer_contacts_name_kana` IS NULL OR `customer_contacts_name_kana` = '' THEN `customer_contacts_name_kana` ELSE REPEAT('*', CHAR_LENGTH(`customer_contacts_name_kana`)) END,
    `customer_contacts_name_2` = CASE WHEN `customer_contacts_name_2` IS NULL OR `customer_contacts_name_2` = '' THEN `customer_contacts_name_2` ELSE REPEAT('*', CHAR_LENGTH(`customer_contacts_name_2`)) END,
    `customer_contacts_name_kana_2` = CASE WHEN `customer_contacts_name_kana_2` IS NULL OR `customer_contacts_name_kana_2` = '' THEN `customer_contacts_name_kana_2` ELSE REPEAT('*', CHAR_LENGTH(`customer_contacts_name_kana_2`)) END,
    `introduction_person_name` = CASE WHEN `introduction_person_name` IS NULL OR `introduction_person_name` = '' THEN `introduction_person_name` ELSE REPEAT('*', CHAR_LENGTH(`introduction_person_name`)) END,
    `customer_contacts_email` = REGEXP_REPLACE(`customer_contacts_email`, '[^@.]', '*'),
    `customer_contacts_phone_number` = REGEXP_REPLACE(`customer_contacts_phone_number`, '[0-9０-９]', '*'),
    `customer_contacts_mobile_phone_number` = REGEXP_REPLACE(`customer_contacts_mobile_phone_number`, '[0-9０-９]', '*');
  
  UPDATE `master_data_resale` SET
    `customer_contacts_name` = CASE WHEN `customer_contacts_name` IS NULL OR `customer_contacts_name` = '' THEN `customer_contacts_name` ELSE REPEAT('*', CHAR_LENGTH(`customer_contacts_name`)) END,
    `customer_contacts_name_kana` = CASE WHEN `customer_contacts_name_kana` IS NULL OR `customer_contacts_name_kana` = '' THEN `customer_contacts_name_kana` ELSE REPEAT('*', CHAR_LENGTH(`customer_contacts_name_kana`)) END,
    `customer_contacts_name_2` = CASE WHEN `customer_contacts_name_2` IS NULL OR `customer_contacts_name_2` = '' THEN `customer_contacts_name_2` ELSE REPEAT('*', CHAR_LENGTH(`customer_contacts_name_2`)) END,
    `customer_contacts_name_kana_2` = CASE WHEN `customer_contacts_name_kana_2` IS NULL OR `customer_contacts_name_kana_2` = '' THEN `customer_contacts_name_kana_2` ELSE REPEAT('*', CHAR_LENGTH(`customer_contacts_name_kana_2`)) END,
    `introduction_person_name` = CASE WHEN `introduction_person_name` IS NULL OR `introduction_person_name` = '' THEN `introduction_person_name` ELSE REPEAT('*', CHAR_LENGTH(`introduction_person_name`)) END,
    `customer_contacts_email` = REGEXP_REPLACE(`customer_contacts_email`, '[^@.]', '*'),
    `customer_contacts_phone_number` = REGEXP_REPLACE(`customer_contacts_phone_number`, '[0-9０-９]', '*'),
    `customer_contacts_mobile_phone_number` = REGEXP_REPLACE(`customer_contacts_mobile_phone_number`, '[0-9０-９]', '*');
  
  UPDATE `member_kaeru` SET
    `name` = CASE WHEN `name` IS NULL OR `name` = '' THEN `name` ELSE REPEAT('*', CHAR_LENGTH(`name`)) END,
    `name_kana` = CASE WHEN `name_kana` IS NULL OR `name_kana` = '' THEN `name_kana` ELSE REPEAT('*', CHAR_LENGTH(`name_kana`)) END,
    `email` = REGEXP_REPLACE(`email`, '[^@.]', '*'),
    `tel` = REGEXP_REPLACE(`tel`, '[0-9０-９]', '*'),
    `mobile` = REGEXP_REPLACE(`mobile`, '[0-9０-９]', '*');
  
  UPDATE `member_resale` SET
    `name` = CASE WHEN `name` IS NULL OR `name` = '' THEN `name` ELSE REPEAT('*', CHAR_LENGTH(`name`)) END,
    `name_kana` = CASE WHEN `name_kana` IS NULL OR `name_kana` = '' THEN `name_kana` ELSE REPEAT('*', CHAR_LENGTH(`name_kana`)) END,
    `email` = REGEXP_REPLACE(`email`, '[^@.]', '*'),
    `tel` = REGEXP_REPLACE(`tel`, '[0-9０-９]', '*'),
    `mobile` = REGEXP_REPLACE(`mobile`, '[0-9０-９]', '*');
  
  UPDATE `mhr_db` SET
    `sei_kana_mhr` = CASE WHEN `sei_kana_mhr` IS NULL OR `sei_kana_mhr` = '' THEN `sei_kana_mhr` ELSE REPEAT('*', CHAR_LENGTH(`sei_kana_mhr`)) END,
    `mei_kana_mhr` = CASE WHEN `mei_kana_mhr` IS NULL OR `mei_kana_mhr` = '' THEN `mei_kana_mhr` ELSE REPEAT('*', CHAR_LENGTH(`mei_kana_mhr`)) END,
    `mail_mhr` = REGEXP_REPLACE(`mail_mhr`, '[^@.]', '*'),
    `phone_mhr` = REGEXP_REPLACE(`phone_mhr`, '[0-9０-９]', '*');
  
  UPDATE `mochiie_db` SET
    `sei_kana_mochiie` = CASE WHEN `sei_kana_mochiie` IS NULL OR `sei_kana_mochiie` = '' THEN `sei_kana_mochiie` ELSE REPEAT('*', CHAR_LENGTH(`sei_kana_mochiie`)) END,
    `mei_kana_mochiie` = CASE WHEN `mei_kana_mochiie` IS NULL OR `mei_kana_mochiie` = '' THEN `mei_kana_mochiie` ELSE REPEAT('*', CHAR_LENGTH(`mei_kana_mochiie`)) END,
    `mail_mochiie` = REGEXP_REPLACE(`mail_mochiie`, '[^@.]', '*'),
    `phone_mochiie` = REGEXP_REPLACE(`phone_mochiie`, '[0-9０-９]', '*');
  
  UPDATE `nexus` SET
    `customer_contacts_name` = CASE WHEN `customer_contacts_name` IS NULL OR `customer_contacts_name` = '' THEN `customer_contacts_name` ELSE REPEAT('*', CHAR_LENGTH(`customer_contacts_name`)) END,
    `customer_contacts_name_kana` = CASE WHEN `customer_contacts_name_kana` IS NULL OR `customer_contacts_name_kana` = '' THEN `customer_contacts_name_kana` ELSE REPEAT('*', CHAR_LENGTH(`customer_contacts_name_kana`)) END,
    `customer_contacts_email` = REGEXP_REPLACE(`customer_contacts_email`, '[^@.]', '*'),
    `customer_contacts_phone_number` = REGEXP_REPLACE(`customer_contacts_phone_number`, '[0-9０-９]', '*'),
    `customer_contacts_mobile_phone_number` = REGEXP_REPLACE(`customer_contacts_mobile_phone_number`, '[0-9０-９]', '*');
  
  UPDATE `pgcloud` SET
    `姓` = CASE WHEN `姓` IS NULL OR `姓` = '' THEN `姓` ELSE REPEAT('*', CHAR_LENGTH(`姓`)) END,
    `名` = CASE WHEN `名` IS NULL OR `名` = '' THEN `名` ELSE REPEAT('*', CHAR_LENGTH(`名`)) END,
    `セイ` = CASE WHEN `セイ` IS NULL OR `セイ` = '' THEN `セイ` ELSE REPEAT('*', CHAR_LENGTH(`セイ`)) END,
    `メイ` = CASE WHEN `メイ` IS NULL OR `メイ` = '' THEN `メイ` ELSE REPEAT('*', CHAR_LENGTH(`メイ`)) END,
    `メールアドレス` = REGEXP_REPLACE(`メールアドレス`, '[^@.]', '*'),
    `携帯番号` = REGEXP_REPLACE(`携帯番号`, '[0-9０-９]', '*');
  
  UPDATE `pgcloud_data` SET
    `mail` = REGEXP_REPLACE(`mail`, '[^@.]', '*'),
    `landline` = REGEXP_REPLACE(`landline`, '[0-9０-９]', '*'),
    `mobile` = REGEXP_REPLACE(`mobile`, '[0-9０-９]', '*');
  
  UPDATE `pre_kaeru` SET
    `name` = CASE WHEN `name` IS NULL OR `name` = '' THEN `name` ELSE REPEAT('*', CHAR_LENGTH(`name`)) END,
    `name_kana` = CASE WHEN `name_kana` IS NULL OR `name_kana` = '' THEN `name_kana` ELSE REPEAT('*', CHAR_LENGTH(`name_kana`)) END,
    `email` = REGEXP_REPLACE(`email`, '[^@.]', '*'),
    `tel` = REGEXP_REPLACE(`tel`, '[0-9０-９]', '*');
  
  UPDATE `raclear_djh` SET
    `名前(漢字)` = CASE WHEN `名前(漢字)` IS NULL OR `名前(漢字)` = '' THEN `名前(漢字)` ELSE REPEAT('*', CHAR_LENGTH(`名前(漢字)`)) END,
    `名前(かな)` = CASE WHEN `名前(かな)` IS NULL OR `名前(かな)` = '' THEN `名前(かな)` ELSE REPEAT('*', CHAR_LENGTH(`名前(かな)`)) END,
    `メールアドレス` = REGEXP_REPLACE(`メールアドレス`, '[^@.]', '*'),
    `電話番号` = REGEXP_REPLACE(`電話番号`, '[0-9０-９]', '*'),
    `携帯電話番号` = REGEXP_REPLACE(`携帯電話番号`, '[0-9０-９]', '*');
  
  UPDATE `raclear_furukomi` SET
    `名前(漢字)` = CASE WHEN `名前(漢字)` IS NULL OR `名前(漢字)` = '' THEN `名前(漢字)` ELSE REPEAT('*', CHAR_LENGTH(`名前(漢字)`)) END,
    `名前(かな)` = CASE WHEN `名前(かな)` IS NULL OR `名前(かな)` = '' THEN `名前(かな)` ELSE REPEAT('*', CHAR_LENGTH(`名前(かな)`)) END,
    `メールアドレス` = REGEXP_REPLACE(`メールアドレス`, '[^@.]', '*'),
    `電話番号` = REGEXP_REPLACE(`電話番号`, '[0-9０-９]', '*'),
    `携帯電話番号` = REGEXP_REPLACE(`携帯電話番号`, '[0-9０-９]', '*');
  
  UPDATE `raclear_kh` SET
    `名前(漢字)` = CASE WHEN `名前(漢字)` IS NULL OR `名前(漢字)` = '' THEN `名前(漢字)` ELSE REPEAT('*', CHAR_LENGTH(`名前(漢字)`)) END,
    `名前(かな)` = CASE WHEN `名前(かな)` IS NULL OR `名前(かな)` = '' THEN `名前(かな)` ELSE REPEAT('*', CHAR_LENGTH(`名前(かな)`)) END,
    `メールアドレス` = REGEXP_REPLACE(`メールアドレス`, '[^@.]', '*'),
    `電話番号` = REGEXP_REPLACE(`電話番号`, '[0-9０-９]', '*'),
    `携帯電話番号` = REGEXP_REPLACE(`携帯電話番号`, '[0-9０-９]', '*');
  
  UPDATE `raclear_nagomi` SET
    `名前(漢字)` = CASE WHEN `名前(漢字)` IS NULL OR `名前(漢字)` = '' THEN `名前(漢字)` ELSE REPEAT('*', CHAR_LENGTH(`名前(漢字)`)) END,
    `名前(かな)` = CASE WHEN `名前(かな)` IS NULL OR `名前(かな)` = '' THEN `名前(かな)` ELSE REPEAT('*', CHAR_LENGTH(`名前(かな)`)) END,
    `メールアドレス` = REGEXP_REPLACE(`メールアドレス`, '[^@.]', '*'),
    `電話番号` = REGEXP_REPLACE(`電話番号`, '[0-9０-９]', '*'),
    `携帯電話番号` = REGEXP_REPLACE(`携帯電話番号`, '[0-9０-９]', '*');
  
  UPDATE `raclear_nieru` SET
    `名前(漢字)` = CASE WHEN `名前(漢字)` IS NULL OR `名前(漢字)` = '' THEN `名前(漢字)` ELSE REPEAT('*', CHAR_LENGTH(`名前(漢字)`)) END,
    `名前(かな)` = CASE WHEN `名前(かな)` IS NULL OR `名前(かな)` = '' THEN `名前(かな)` ELSE REPEAT('*', CHAR_LENGTH(`名前(かな)`)) END,
    `メールアドレス` = REGEXP_REPLACE(`メールアドレス`, '[^@.]', '*'),
    `電話番号` = REGEXP_REPLACE(`電話番号`, '[0-9０-９]', '*'),
    `携帯電話番号` = REGEXP_REPLACE(`携帯電話番号`, '[0-9０-９]', '*');
  
  UPDATE `resale_customers` SET
    `name` = CASE WHEN `name` IS NULL OR `name` = '' THEN `name` ELSE REPEAT('*', CHAR_LENGTH(`name`)) END,
    `kana` = CASE WHEN `kana` IS NULL OR `kana` = '' THEN `kana` ELSE REPEAT('*', CHAR_LENGTH(`kana`)) END,
    `mail` = REGEXP_REPLACE(`mail`, '[^@.]', '*'),
    `phone` = REGEXP_REPLACE(`phone`, '[0-9０-９]', '*');
  
  UPDATE `reserve_kaeru` SET
    `name` = CASE WHEN `name` IS NULL OR `name` = '' THEN `name` ELSE REPEAT('*', CHAR_LENGTH(`name`)) END,
    `email` = CASE WHEN `email` IS NULL OR `email` = '' THEN `email` ELSE CONCAT('********', `no`, '@****.***') END,
    `tel` = REGEXP_REPLACE(`tel`, '[0-9０-９]', '*');
  
  UPDATE `reserve_resale` SET
    `name` = CASE WHEN `name` IS NULL OR `name` = '' THEN `name` ELSE REPEAT('*', CHAR_LENGTH(`name`)) END,
    `email` = CASE WHEN `email` IS NULL OR `email` = '' THEN `email` ELSE CONCAT('********', `no`, '@****.***') END,
    `tel` = REGEXP_REPLACE(`tel`, '[0-9０-９]', '*');
  
  UPDATE `satbase_property` SET
    `customer_name` = CASE WHEN `customer_name` IS NULL OR `customer_name` = '' THEN `customer_name` ELSE REPEAT('*', CHAR_LENGTH(`customer_name`)) END;
  
  UPDATE `satbase_property_old` SET
    `customer_name` = CASE WHEN `customer_name` IS NULL OR `customer_name` = '' THEN `customer_name` ELSE REPEAT('*', CHAR_LENGTH(`customer_name`)) END;
  
  UPDATE `smile_fes` SET
    `name` = CASE WHEN `name` IS NULL OR `name` = '' THEN `name` ELSE REPEAT('*', CHAR_LENGTH(`name`)) END,
    `phone` = REGEXP_REPLACE(`phone`, '[0-9０-９]', '*');
  
  UPDATE `sumai_step_db` SET
    `sei_kana` = CASE WHEN `sei_kana` IS NULL OR `sei_kana` = '' THEN `sei_kana` ELSE REPEAT('*', CHAR_LENGTH(`sei_kana`)) END,
    `mei_kana` = CASE WHEN `mei_kana` IS NULL OR `mei_kana` = '' THEN `mei_kana` ELSE REPEAT('*', CHAR_LENGTH(`mei_kana`)) END,
    `mail` = REGEXP_REPLACE(`mail`, '[^@.]', '*'),
    `phone` = REGEXP_REPLACE(`phone`, '[0-9０-９]', '*');
  
  UPDATE `suumo_db` SET
    `sei_kana_suumo` = CASE WHEN `sei_kana_suumo` IS NULL OR `sei_kana_suumo` = '' THEN `sei_kana_suumo` ELSE REPEAT('*', CHAR_LENGTH(`sei_kana_suumo`)) END,
    `mei_kana_suumo` = CASE WHEN `mei_kana_suumo` IS NULL OR `mei_kana_suumo` = '' THEN `mei_kana_suumo` ELSE REPEAT('*', CHAR_LENGTH(`mei_kana_suumo`)) END,
    `mail_suumo` = REGEXP_REPLACE(`mail_suumo`, '[^@.]', '*'),
    `phone_suumo` = REGEXP_REPLACE(`phone_suumo`, '[0-9０-９]', '*');
  
  UPDATE `suumo_db_kaeru` SET
    `name` = CASE WHEN `name` IS NULL OR `name` = '' THEN `name` ELSE REPEAT('*', CHAR_LENGTH(`name`)) END,
    `name_kana` = CASE WHEN `name_kana` IS NULL OR `name_kana` = '' THEN `name_kana` ELSE REPEAT('*', CHAR_LENGTH(`name_kana`)) END,
    `email` = REGEXP_REPLACE(`email`, '[^@.]', '*'),
    `phone` = REGEXP_REPLACE(`phone`, '[0-9０-９]', '*'),
    `fax` = REGEXP_REPLACE(`fax`, '[0-9０-９]', '*');
  
  UPDATE `suumo_db_resale` SET
    `last_name_kanji` = CASE WHEN `last_name_kanji` IS NULL OR `last_name_kanji` = '' THEN `last_name_kanji` ELSE REPEAT('*', CHAR_LENGTH(`last_name_kanji`)) END,
    `first_name_kanji` = CASE WHEN `first_name_kanji` IS NULL OR `first_name_kanji` = '' THEN `first_name_kanji` ELSE REPEAT('*', CHAR_LENGTH(`first_name_kanji`)) END,
    `last_name_kana` = CASE WHEN `last_name_kana` IS NULL OR `last_name_kana` = '' THEN `last_name_kana` ELSE REPEAT('*', CHAR_LENGTH(`last_name_kana`)) END,
    `first_name_kana` = CASE WHEN `first_name_kana` IS NULL OR `first_name_kana` = '' THEN `first_name_kana` ELSE REPEAT('*', CHAR_LENGTH(`first_name_kana`)) END,
    `email` = REGEXP_REPLACE(`email`, '[^@.]', '*'),
    `phone_1` = REGEXP_REPLACE(`phone_1`, '[0-9０-９]', '*'),
    `phone_2` = REGEXP_REPLACE(`phone_2`, '[0-9０-９]', '*'),
    `phone_3` = REGEXP_REPLACE(`phone_3`, '[0-9０-９]', '*'),
    `fax_1` = REGEXP_REPLACE(`fax_1`, '[0-9０-９]', '*'),
    `fax_2` = REGEXP_REPLACE(`fax_2`, '[0-9０-９]', '*'),
    `fax_3` = REGEXP_REPLACE(`fax_3`, '[0-9０-９]', '*');
  
  UPDATE `townlife_db` SET
    `name_townlife` = CASE WHEN `name_townlife` IS NULL OR `name_townlife` = '' THEN `name_townlife` ELSE REPEAT('*', CHAR_LENGTH(`name_townlife`)) END,
    `kana_townlife` = CASE WHEN `kana_townlife` IS NULL OR `kana_townlife` = '' THEN `kana_townlife` ELSE REPEAT('*', CHAR_LENGTH(`kana_townlife`)) END,
    `mail_townlife` = REGEXP_REPLACE(`mail_townlife`, '[^@.]', '*'),
    `phone_townlife` = REGEXP_REPLACE(`phone_townlife`, '[0-9０-９]', '*');
  
  UPDATE `townlife_db_khf` SET
    `name` = CASE WHEN `name` IS NULL OR `name` = '' THEN `name` ELSE REPEAT('*', CHAR_LENGTH(`name`)) END,
    `kana` = CASE WHEN `kana` IS NULL OR `kana` = '' THEN `kana` ELSE REPEAT('*', CHAR_LENGTH(`kana`)) END,
    `mail` = REGEXP_REPLACE(`mail`, '[^@.]', '*'),
    `phone` = REGEXP_REPLACE(`phone`, '[0-9０-９]', '*');

  COMMIT;

  -- ---- 確認（⚠️ どれも 0 になっていれば伏せ終わっている） ----------------
  SELECT 'inquiry_customer の電話に数字が残っている行' AS 確認, COUNT(*) AS 件数
    FROM inquiry_customer WHERE mobile REGEXP '[0-9]' OR landline REGEXP '[0-9]'
  UNION ALL
  SELECT 'inquiry_customer のメールに英数字が残っている行', COUNT(*)
    FROM inquiry_customer WHERE mail REGEXP '[A-Za-z0-9]'
  UNION ALL
  SELECT 'master_data の顧客名が伏せられていない行', COUNT(*)
    FROM master_data WHERE customer_contacts_name <> '' AND customer_contacts_name NOT REGEXP '^[*]+$'
  UNION ALL
  SELECT 'master_data の電話に数字が残っている行', COUNT(*)
    FROM master_data WHERE customer_contacts_mobile_phone_number REGEXP '[0-9]'
                        OR customer_contacts_phone_number REGEXP '[0-9]';
END //
DELIMITER ;

SET @confirm_mask = NULL;
```

### ⚠️ マスクSQLの作り直し方

⚠️ 対象の一覧（表 → 種類 → 列）。⚠️ 列を足すときはここに足して、下の生成スクリプトで作り直す。

```js
// マスク対象の一覧（種類: name=氏名・かな / mail=メール / tel=電話・FAX）
// ⚠️ スタッフ名（staff / staff_list / created_by_name など）は入れない。突合に使っているため。
module.exports = {
  after_interview: { name: ['name'], tel: ['phone'] },
  allGrit_db: { mail: ['mail_allGrit'], tel: ['phone_allGrit'] },
  allGrit_kaeru: { name: ['line_display_name', 'last_name', 'first_name', 'name_kana'], mail: ['email'], tel: ['phone'] },
  ambassador_list: { name: ['name', 'kana'], mail: ['mail'], tel: ['mobile'] },
  athome_db_kaeru: { name: ['name'], mail: ['email'], tel: ['tel'] },
  athome_db_resale: { name: ['name'], mail: ['email'], tel: ['tel'] },
  before_interview: { name: ['name', 'kana'], mail: ['mail'], tel: ['phone', 'mobile'] },
  before_survey: { name: ['name'] },
  black_list: { name: ['name'], mail: ['mail'], tel: ['mobile'] },
  brokerage_listings: { name: ['name'], mail: ['mail'], tel: ['phone'] },
  call_sheet: { name: ['name'] },
  catalog_kaeru: { name: ['name'], mail: ['email'], tel: ['tel'] },
  catalog_resale: { name: ['name'], mail: ['email'], tel: ['tel'] },
  contract_customer: { name: ['name'] },
  contract_customer_backup_20260827: { name: ['name'] },
  customers: { name: ['name'], tel: ['phone_number'] },
  event_db: { name: ['name', 'kana'], mail: ['mail'], tel: ['phone'] },
  family_info: { name: ['name'] },
  // ⚠️ x_tel は電話番号ではない（家計の通信費・decimal）。入れない
  funding_plan: { name: ['k_name', 'k_kana', 'k_h_name', 'k_w_name'], mail: ['k_mail'], tel: ['k_tel'] },
  homes_db: { name: ['name_homes', 'kana_homes'], mail: ['mail_homes'], tel: ['phone_homes'] },
  homes_db_kaeru: { name: ['name'], mail: ['mail'], tel: ['mobile'] },
  homes_db_resale: { name: ['name'], mail: ['mail'], tel: ['mobile'] },
  hotlead_db: { name: ['name', 'name_kana'], mail: ['email'], tel: ['phone'] },
  iei_db: { name: ['name', 'name_kana'], mail: ['email'] },
  ieuru_resale: { name: ['name'], mail: ['email'], tel: ['mobile'] },
  inquiry_ambassador: { name: ['name', 'kana'], mail: ['mail'], tel: ['mobile'] },
  inquiry_customer: { name: ['first_name', 'last_name', 'first_name_kana', 'last_name_kana'], mail: ['mail', 'mhl_mail'], tel: ['mobile', 'landline'] },
  inquiry_customer_kaeru: { name: ['first_name', 'last_name', 'first_name_kana', 'last_name_kana'], mail: ['mail', 'mhl_mail'], tel: ['mobile', 'landline'] },
  inquiry_customer_resale: { name: ['first_name', 'last_name', 'first_name_kana', 'last_name_kana'], mail: ['mail', 'mhl_mail'], tel: ['mobile', 'landline'] },
  inquiry_introductory: { name: ['registrantName', 'friendName'], mail: ['mail'], tel: ['tel', 'fax', 'mobile', 'friendTel'] },
  interview_sheet: { name: ['name'] },
  kaeeru_db: { name: ['name', 'name_kana'], mail: ['email'], tel: ['tel'] },
  khf_customers: { name: ['name', 'kana'], mail: ['mail'], tel: ['phone'] },
  maillist: { name: ['name'], mail: ['mail'] },
  master_data: { name: ['customer_contacts_name', 'customer_contacts_name_kana', 'customer_contacts_name_2', 'customer_contacts_name_kana_2', 'introduction_person_name'], mail: ['customer_contacts_email'], tel: ['customer_contacts_phone_number', 'customer_contacts_mobile_phone_number'] },
  master_data_kaeru: { name: ['customer_contacts_name', 'customer_contacts_name_kana', 'customer_contacts_name_2', 'customer_contacts_name_kana_2', 'introduction_person_name'], mail: ['customer_contacts_email'], tel: ['customer_contacts_phone_number', 'customer_contacts_mobile_phone_number'] },
  master_data_planner: { name: ['customer_contacts_name', 'customer_contacts_name_kana', 'customer_contacts_name_2', 'customer_contacts_name_kana_2', 'introduction_person_name'], mail: ['customer_contacts_email'], tel: ['customer_contacts_phone_number', 'customer_contacts_mobile_phone_number'] },
  master_data_resale: { name: ['customer_contacts_name', 'customer_contacts_name_kana', 'customer_contacts_name_2', 'customer_contacts_name_kana_2', 'introduction_person_name'], mail: ['customer_contacts_email'], tel: ['customer_contacts_phone_number', 'customer_contacts_mobile_phone_number'] },
  master_data_kana_backup_20260925: { name: ['customer_contacts_name_kana', 'customer_contacts_name_kana_2'] },
  member_kaeru: { name: ['name', 'name_kana'], mail: ['email'], tel: ['tel', 'mobile'] },
  member_resale: { name: ['name', 'name_kana'], mail: ['email'], tel: ['tel', 'mobile'] },
  mhr_db: { name: ['sei_kana_mhr', 'mei_kana_mhr'], mail: ['mail_mhr'], tel: ['phone_mhr'] },
  mochiie_db: { name: ['sei_kana_mochiie', 'mei_kana_mochiie'], mail: ['mail_mochiie'], tel: ['phone_mochiie'] },
  nexus: { name: ['customer_contacts_name', 'customer_contacts_name_kana'], mail: ['customer_contacts_email'], tel: ['customer_contacts_phone_number', 'customer_contacts_mobile_phone_number'] },
  pgcloud: { name: ['姓', '名', 'セイ', 'メイ'], mail: ['メールアドレス'], tel: ['携帯番号'] },
  pgcloud_data: { mail: ['mail'], tel: ['landline', 'mobile'] },
  pre_kaeru: { name: ['name', 'name_kana'], mail: ['email'], tel: ['tel'] },
  raclear_djh: { name: ['名前(漢字)', '名前(かな)'], mail: ['メールアドレス'], tel: ['電話番号', '携帯電話番号'] },
  raclear_furukomi: { name: ['名前(漢字)', '名前(かな)'], mail: ['メールアドレス'], tel: ['電話番号', '携帯電話番号'] },
  raclear_kh: { name: ['名前(漢字)', '名前(かな)'], mail: ['メールアドレス'], tel: ['電話番号', '携帯電話番号'] },
  raclear_nagomi: { name: ['名前(漢字)', '名前(かな)'], mail: ['メールアドレス'], tel: ['電話番号', '携帯電話番号'] },
  raclear_nieru: { name: ['名前(漢字)', '名前(かな)'], mail: ['メールアドレス'], tel: ['電話番号', '携帯電話番号'] },
  reserve_kaeru: { name: ['name'], mail: ['email'], tel: ['tel'] },
  reserve_resale: { name: ['name'], mail: ['email'], tel: ['tel'] },
  resale_customers: { name: ['name', 'kana'], mail: ['mail'], tel: ['phone'] },
  satbase_property: { name: ['customer_name'] },
  satbase_property_old: { name: ['customer_name'] },
  smile_fes: { name: ['name'], tel: ['phone'] },
  sumai_step_db: { name: ['sei_kana', 'mei_kana'], mail: ['mail'], tel: ['phone'] },
  suumo_db: { name: ['sei_kana_suumo', 'mei_kana_suumo'], mail: ['mail_suumo'], tel: ['phone_suumo'] },
  suumo_db_kaeru: { name: ['name', 'name_kana'], mail: ['email'], tel: ['phone', 'fax'] },
  suumo_db_resale: { name: ['last_name_kanji', 'first_name_kanji', 'last_name_kana', 'first_name_kana'], mail: ['email'], tel: ['phone_1', 'phone_2', 'phone_3', 'fax_1', 'fax_2', 'fax_3'] },
  townlife_db: { name: ['name_townlife', 'kana_townlife'], mail: ['mail_townlife'], tel: ['phone_townlife'] },
  townlife_db_khf: { name: ['name', 'kana'], mail: ['mail'], tel: ['phone'] },
};
```

```js
// マスク用 SQL を生成する。⚠️ 対象の一覧は pii_targets.js
const fs = require('fs');
const path = require('path');
const targets = require('./pii_targets.js');

// ⚠️ メールに一意制約がある表。⚠️ 同じ形の伏せ字にすると重複して UPDATE ごと失敗する
const UNIQUE_MAIL = { catalog_kaeru: 'no', catalog_resale: 'no', reserve_kaeru: 'no', reserve_resale: 'no' };

const q = (s) => '`' + s.replace(/`/g, '``') + '`';
const EXPR = {
  name: (c) => `CASE WHEN ${c} IS NULL OR ${c} = '' THEN ${c} ELSE REPEAT('*', CHAR_LENGTH(${c})) END`,
  mail: (c) => `REGEXP_REPLACE(${c}, '[^@.]', '*')`,
  mailUnique: (c, pk) => `CASE WHEN ${c} IS NULL OR ${c} = '' THEN ${c} ELSE CONCAT('********', ${q(pk)}, '@****.***') END`,
  tel: (c) => `REGEXP_REPLACE(${c}, '[0-9０-９]', '*')`,
};

const out = [];
const tables = Object.keys(targets).sort();
let columnCount = 0;

for (const table of tables) {
  const sets = [];
  for (const [kind, cols] of Object.entries(targets[table])) {
    for (const col of cols) {
      const c = q(col);
      const expr = kind === 'mail' && UNIQUE_MAIL[table] ? EXPR.mailUnique(c, UNIQUE_MAIL[table]) : EXPR[kind](c);
      sets.push(`  ${c} = ${expr}`);
      columnCount += 1;
    }
  }
  out.push(`UPDATE ${q(table)} SET\n${sets.join(',\n')};`);
}

const body = out.join('\n\n');
fs.writeFileSync(path.join(__dirname, 'mask_body.sql'), body, 'utf8');
console.log(`表 ${tables.length} / 列 ${columnCount}`);
```
