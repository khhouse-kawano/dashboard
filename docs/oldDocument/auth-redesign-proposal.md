# 認証の再設計 — 提案書

**作成: 2026-09-02 / 状態: 提案（未着手・未承認）**

現状の認証は3つの独立した欠陥を抱えている。この文書はそれぞれの証拠と、
既存ロジックを前提にしない設計案、段階的な導入計画をまとめたもの。

⚠️ **実装前に「決めてほしいこと」（最終節）への回答が必要。**

---

## 1. 現状の欠陥

### 欠陥1: ログインが本人確認になっていない

`backend/src/handlers/login.php`

```php
$mail = $data['mail'] ?? '';
$stmt = $pdo->prepare("SELECT * FROM staff WHERE mail = ?");
```

フロント（`Login.tsx`）は Google から受け取った IDトークンを `jwtDecode` し、
**メールアドレスだけ**を送っている。IDトークン本体はサーバーに届いていない。

```ts
const decodedData = jwtDecode<GoogleJwtPayload>(token);
apiClient.post("", { request: 'login', mail: decodedData.email });
```

`jwtDecode` は署名を検証しない。ただのBase64デコードである。

| | |
|---|---|
| 防げていること | 社外の無関係な人。`staff` から削除済みの退職者 |
| 防げていないこと | **在籍者のメールアドレスを知っている人が、その人になりすますこと** |

```
POST https://khg-marketing.info/dashboard/api/gateway/
{ "request": "login", "mail": "<在籍者のメールアドレス>" }
→ 200 { "token": "...", "authority": "Master", ... }
```

⚠️ **最も重大なのは権限の昇格。** 一般権限の人が Master 権限者のメールアドレスを送れば
Master のトークンが手に入る。メールアドレスは `氏名@kh-group.jp` の規則性があり、社内では既知。

⚠️ `kpi_*` を `auth: 'master'` で守っても、この経路で突破できる。**認可の土台が崩れている。**

### 欠陥2: ほとんどのエンドポイントが認証を要求していない

`backend/src/core/db.php`

```php
$authHeader = $headers['Authorization'] ?? $headers['authorization'] ?? null;
// ↑ この後どこからも参照されない
```

認証しているのは `requireStaff()` / `requireMaster()` を明示的に呼ぶ一部のハンドラのみ。
残りは **URLを知っていれば誰でも**顧客の氏名・電話番号・住所を取得できる。

```
POST https://khg-marketing.info/dashboard/api/gateway/
{ "request": "list", "category": "order" }
```

⚠️ フロントが送っている `Authorization: 4081Kokubu`（`apiClient.ts` の固定文字列）は
**どこでも検証されていない。** ビルド成果物に平文で入っているため秘密でもない。

### 欠陥3: トークンに有効期限がない

`backend/src/core/token.php`

```php
function storeToken($pdo, $userId, $token) {
    $stmt = $pdo->prepare("UPDATE staff SET api_token = ? WHERE mail = ?");
}
function getUserByToken($pdo, $token) {
    $stmt = $pdo->prepare("SELECT * FROM staff WHERE api_token = ?");   // 期限を見ていない
}
```

期限を判定しているのはブラウザ側だけ（`AuthProvider.tsx` が `staff.timestamp` を見て
約23.9時間で追い出す）。**APIを直接叩けば何ヶ月前のトークンでも通る。**

⚠️ さらに `get_token` は呼ばれるたびに `timestamp` を更新するため、**絶対的な期限が存在しない。**

⚠️ `api_token` は `staff` テーブルの1列しかないため、**1人につき有効なトークンは1本**。
2台目でログインすると1台目が落ちる。ローカルと本番の同時作業ができない。

---

## 2. 設計の前提

| 前提 | 内容 |
|---|---|
| 利用者 | 社内のみ。50名程度 |
| ID基盤 | **Google Workspace（`kh-group.jp`）が既にある** |
| 認証方式 | Google ログインのみ。パスワード認証は使っていない |
| バックエンド | ① のPHP（182ハンドラ）と ② の Express が**当面併存する** |
| 運用体制 | Linuxを操作できる人が1人。**複雑な仕組みは維持できない** |

⚠️ この前提から導かれる制約が2つある。

1. **① と ② の両方で同じ検証ができなければならない。** どちらか片方だけ厳しくすると、
   移植の進み具合で認証が通る／通らないが変わり、原因の切り分けが不可能になる。
2. **仕組みは可能な限り小さくする。** OAuth のフルスタックや自前の鍵ローテーションは
   1人では維持できない。

---

## 3. 3つの案

| | A: Google IDトークンを毎回検証 | B: 自前JWT + リフレッシュ | **C: 不透明トークン + セッション表（推奨）** |
|---|---|---|---|
| クライアントが送るもの | Google の IDトークン | 自前の短命JWT | ランダムな64桁の文字列 |
| ヘッダ | `Authorization: Bearer` | `Authorization: Bearer` | `Authorization: Bearer` |
| サーバーの検証 | JWKS で署名検証（ネットワーク不要・キャッシュ） | 自前の鍵で署名検証 | **DBを1回引く** |
| 有効期限 | 1時間（Google が決める） | 15分＋リフレッシュ7日 | 任意に決められる |
| 失効（退職・端末紛失） | `staff` から消せば即座に不可 | リフレッシュ表で失効 | **セッション表で即座に失効** |
| 複数端末 | 可 | 可 | 可 |
| ① のPHPでの実装量 | JWKS検証を自前実装（中） | 同（中） | **SQL 1本（小）** |
| ② の Express での実装量 | `jose` 導入（小） | 鍵管理が必要（中） | **SQL 1本（小）** |
| 維持の手間 | 小 | **大**（鍵ローテーション） | 小 |
| ⚠️ 弱点 | **1時間ごとに再ログインを迫られる恐れ**。GISの無音更新は保証されない | 実装量が最大。1人で維持しづらい | リクエストごとにDBを1回引く |

### 推奨: C

理由は3つ。

1. **① と ② で実装が同じ**（`SELECT` 1本）。既存の `getUserByToken()` の置き換えで済む。
2. **失効が確実にできる。** 退職者・紛失端末をその場で無効化できる。A では `staff` から
   消すまで最大1時間残り、B ではリフレッシュ表の管理が別途必要になる。
3. **1人で維持できる。** 鍵も JWKS キャッシュも要らない。

⚠️ **A を推奨しない最大の理由は再ログインの頻度。** Google の IDトークンは1時間で切れる。
`@react-oauth/google` の無音更新は環境（複数Googleアカウント、Cookieのブロック）に左右され、
**1時間ごとにログイン画面が出る事故が起こりうる。** 1日8時間使う業務では受け入れられない。

⚠️ ただし **Google IDトークンの検証自体は C でも必須**。ログイン時に1回だけ行う（欠陥1の対策）。
「Google で本人確認 → 自前のセッションを発行」という、ごく標準的な形になる。

---

## 4. 推奨案（C）の詳細

### 全体の流れ

```
ブラウザ
  │ ① Google ログイン（既存のまま）
  │    → credential（IDトークン JWT）を取得
  ▼
POST { request: 'login', credential: '<IDトークン>' }
  │
  ▼ サーバー
  ├─ Google の IDトークンを検証
  │    署名 / iss / aud / exp / email_verified / hd
  │    ⚠️ ここが欠陥1の対策
  │
  ├─ 検証済みの email で staff を突合
  │    ⚠️ email は「Googleが保証した値」になる
  │
  ├─ ランダム64桁のトークンを生成
  ├─ SHA-256 ハッシュを staff_session に INSERT
  │
  ▼
{ "token": "<64桁>", "expires_at": "...", "authority": "...", ... }
  │
  ▼ 以降のリクエスト
Authorization: Bearer <64桁>
  │
  ▼ サーバー（① / ② 共通）
  SELECT ... FROM staff_session s JOIN staff st ...
   WHERE s.token_hash = SHA2(?, 256)
     AND s.revoked_at IS NULL
     AND s.expires_at   > NOW()
     AND s.last_used_at > NOW() - INTERVAL 24 HOUR
```

### DBスキーマ

```sql
CREATE TABLE `staff_session` (
  `id`           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `staff_id`     INT             NOT NULL,
  -- ⚠️ 平文は保存しない。漏洩してもセッションを再現できないようにする。
  --    トークンは32バイトの乱数なので、ソルト無しでも総当たりは成立しない。
  --    （既存の api_credential と同じ方針）
  `token_hash`   CHAR(64)        NOT NULL,
  `issued_at`    DATETIME        NOT NULL,
  -- 絶対期限。これを過ぎたら操作していても切れる
  `expires_at`   DATETIME        NOT NULL,
  -- 無操作期限の判定に使う
  `last_used_at` DATETIME        NOT NULL,
  `user_agent`   VARCHAR(255)    NOT NULL DEFAULT '',
  `ip`           VARCHAR(45)     NOT NULL DEFAULT '',
  `revoked_at`   DATETIME        NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_token_hash` (`token_hash`),
  KEY `idx_staff` (`staff_id`, `expires_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

| 設定 | 提案値 | 理由 |
|---|---|---|
| 絶対期限（`expires_at`） | **30日** | 端末を放置しても1ヶ月で確実に切れる |
| 無操作期限 | **24時間** | 現在のブラウザ側の挙動（約23.9時間）と揃える。運用が変わらない |
| 1人あたりのセッション数 | **上限なし** | 複数端末を許可する。異常はセッション一覧で気づける |

⚠️ **`last_used_at` の更新はリクエストごとに書かない。** 5分以上古いときだけ UPDATE する。
毎回書くと1日数万回の書き込みになり、① の共用サーバーでは無視できない負荷になる。

### 検証項目（Google IDトークン）

⚠️ **1つでも欠けると検証の意味がなくなる。**

| 項目 | 確認内容 | 欠けたときに起こること |
|---|---|---|
| 署名 | Google の公開鍵で検証 | **任意の内容を自作できる**（＝現状） |
| `iss` | `accounts.google.com` または `https://accounts.google.com` | 別発行者のトークンが通る |
| `aud` | 自社の `REACT_APP_CLIENT_ID` と一致 | **他のGoogleアプリのトークンが通る** |
| `exp` | 未来 | 期限切れが通る |
| `email_verified` | `true` | 未確認のメールで通る |
| `hd` | `kh-group.jp` | 個人のGmailで通る（`staff` 突合で防げるが二重に確認する） |

### 検証の実装方法

| 側 | 方法 | 備考 |
|---|---|---|
| ② Express | `jose` の `createRemoteJWKSet` + `jwtVerify` | 公開鍵を自動キャッシュ。ネットワークは初回のみ |
| ① PHP | **`https://oauth2.googleapis.com/tokeninfo?id_token=...` を呼ぶ** | 依存ライブラリ不要 |

⚠️ ① で `tokeninfo` を使う理由は、**Xserver で composer を使えるか未確認**であり、
RS256 の検証を手書きするより Google に任せる方が安全なため。

⚠️ `tokeninfo` は**ログイン時にしか呼ばれない**（1日数十回）。以降のリクエストは
`staff_session` を引くだけなので、ネットワーク依存は増えない。

⚠️ `tokeninfo` にも `aud` の確認は必要。**Google はトークンが正当かを返すだけで、
「あなた宛か」は判定しない。** レスポンスの `aud` を自分で照合すること。

⚠️ タイムアウトを必ず設定する（5秒程度）。設定しないと Google 側の遅延で
ログイン画面が固まる。

### エンドポイント

| request | 内容 | 認証 |
|---|---|---|
| `login` | IDトークンを検証してセッションを発行 | 不要 |
| `session` | 現在のセッションの有効性と期限を返す（`get_token` の後継） | 必要 |
| `logout` | 現在のセッションを失効させる | 必要 |
| `sessions` | 自分のセッション一覧（端末・最終利用） | 必要 |
| `session_revoke` | 指定したセッションを失効させる | 必要 |

⚠️ `logout` が**今は存在しない**。作らないと、端末を手放したときに失効させる手段がない。

### フロントエンドの変更

| ファイル | 変更 |
|---|---|
| `Login.tsx` | `mail: decodedData.email` → **`credential: token`**。`jwtDecode` の import を削除 |
| `apiClient.ts` | `Authorization: Bearer <token>` を送る。**固定文字列 `4081Kokubu` を削除** |
| `AuthProvider.tsx` | `get_token` → `session`。サーバーが返す `expires_at` を使う。401 でログインへ |

⚠️ `AuthProvider.tsx` の期限判定（`diff > 86000000`）は**サーバー側の判定に置き換える。**
クライアントで期限を判断する構造そのものが欠陥3の原因である。

⚠️ 移行期間中は `Token` ヘッダも受け付ける（既存の `api_token` と併存）。
`② の gateway/auth.ts` は既に両方に対応済み。

---

## 5. 段階的な導入計画

⚠️ **一度に全部やってはいけない。** 認証を変えて画面が壊れると、直すために必要な画面にも
入れなくなる。各段階で「何が直るか」と「切り戻し方」を明確にする。

### 段階1: ログインの本人確認（⚠️ 最優先）

**これだけで欠陥1（なりすましと権限昇格）が解消する。** 費用対効果が最も高い。

| 変更 | ファイル |
|---|---|
| IDトークンを検証してから `staff` を突合 | `backend/src/handlers/login.php` |
| `credential` を送る | `frontend/src/components/Login.tsx` |

⚠️ **移行期間中は `mail` も受け付ける。** 古いフロントを開いたままの利用者がいるため。
`credential` があればそれを優先し、無ければ従来動作にする。

```php
// 疑似コード
if (isset($data['credential'])) {
    $email = verifyGoogleIdToken($data['credential']);   // 失敗なら 401
} else {
    // ⚠️ 暫定。段階1完了から2週間後に削除する
    error_log('login: legacy mail path used');
    $email = $data['mail'] ?? '';
}
```

⚠️ `error_log` を入れておき、**旧経路が使われなくなったことを確認してから削除する。**
期限を決めずに残すと永久に残り、欠陥1が直らない。

| | |
|---|---|
| 切り戻し | `login.php` を1ファイル戻す |
| リスク | **低**。失敗しても「ログインできない」だけで、データは壊れない |
| ⚠️ 注意 | 検証を入れた直後は全員が再ログインになる。**業務時間外に実施する** |

### 段階2: セッション表と有効期限

**欠陥3（無期限）と、1人1トークン制約が解消する。**

| 変更 | 対象 |
|---|---|
| `staff_session` テーブル作成 | ① のDB |
| `login` がセッションを発行 | ① |
| `session` / `logout` / `sessions` を追加 | ① |
| `getUserByToken()` をセッション表引きに変更 | ① |
| `gateway/auth.ts` を同じロジックに変更 | ② |
| `AuthProvider.tsx` の期限判定をサーバー側へ | フロント |

⚠️ **`staff.api_token` は残したまま、両方引く。** どちらでも通る状態を作ってから、
新方式に完全移行したことを確認して旧経路を消す。

| | |
|---|---|
| 切り戻し | `getUserByToken()` を戻す。テーブルは残しても無害 |
| リスク | 中。**全リクエストの認証経路を変える** |

### 段階3: 全エンドポイントで認証を要求（⚠️ 最も危険）

**欠陥2が解消する。** ただし182ハンドラの挙動が変わる。

⚠️ **いきなり有効化してはいけない。「記録だけする期間」を先に置く。**

```php
// core/db.php に追加（段階3-a: 記録のみ）
$session = findSession($pdo, $bearerToken);
if (!$session) {
    error_log(sprintf('authz would-block: request=%s ua=%s', $request, $_SERVER['HTTP_USER_AGENT'] ?? ''));
    // ⚠️ この段階では止めない
}
```

1〜2週間ログを集め、**トークン無しで来ているリクエストを洗い出す。**

⚠️ 特に確認が必要なもの:

| | 懸念 |
|---|---|
| 外部連携（`suumo` / `athome` / `homes` / `allgrit`） | 物件情報の取り込みが**トークン無しで叩いている可能性**。止まると物件が同期されない |
| `meta_ads` | 広告データの取得元 |
| バッチ・cron | ① のサーバーパネルに登録された定期実行 |
| `portal/` 配下 | 別系統のハンドラ群 |

⚠️ **これらを調べずに有効化すると、外部連携が静かに止まる。** 気づくのは物件が
更新されなくなってからで、原因の特定に時間がかかる。

対策として、機械が使う経路には**別の認証**を用意する（既存の `analysis_api_key` と同じ方式）。

| | |
|---|---|
| 切り戻し | `core/db.php` を戻す。② は `GATEWAY_REQUIRE_AUTH=false` に戻す |
| リスク | **高**。全画面と全連携に影響する |

### 段階4: 旧経路の削除

| 変更 |
|---|
| `staff.api_token` 列を削除 |
| `login.php` の `mail` 経路を削除 |
| `apiClient.ts` の `Token` ヘッダを削除（`Bearer` のみに） |
| `get_token.php` を削除 |

⚠️ 段階3の記録ログで旧経路が0件になったことを確認してから行う。

---

## 6. やらないこと（意図的な判断）

| | 理由 |
|---|---|
| OAuth 2.1 / OIDC のフルスタック実装 | 50人の社内システムに対して過剰。1人では維持できない |
| 自前のJWT発行と鍵ローテーション | 鍵の管理が増える。不透明トークンで足りる |
| 多要素認証 | Google Workspace 側で設定すべきもの。アプリで持つ必要がない |
| パスワード認証の追加 | 現在使っていない。増やせば漏洩面が増えるだけ |
| IPアドレス制限 | 営業が外出先から使うため運用に合わない |

---

## 7. 決めてほしいこと

| # | 質問 | 既定の提案 |
|---|---|---|
| 1 | 案A / B / **C** のどれにするか | **C**（不透明トークン + セッション表） |
| 2 | 絶対期限と無操作期限 | 30日 / 24時間 |
| 3 | 段階1（ログインの本人確認）を単独で先に実施するか | **する。** 最も危険な欠陥が最小の変更で消える |
| 4 | 段階3の「記録のみ期間」をどれだけ取るか | 2週間 |
| 5 | 外部連携がトークン無しで叩いているかの調査を誰がやるか | ⚠️ 段階3の前提。**調査なしに進めない** |
| 6 | ① で `tokeninfo` を使うか、composer で `firebase/php-jwt` を入れるか | `tokeninfo`（依存を増やさない） |
| 7 | 実施のタイミング | 段階1は**業務時間外**（全員が再ログインになる） |

⚠️ **5 が最大の未知**である。ここが分からないまま段階3に進むと外部連携が止まる。
段階1と2は5に依存しないため、先に進めて構わない。

---

## 8. 工数の目安

| 段階 | 内容 | 目安 |
|---|---|---|
| 1 | ログインの本人確認 | 半日 |
| 2 | セッション表と有効期限 | 2〜3日 |
| 3-a | 記録のみ | 半日 + 2週間の観測 |
| 3-b | 有効化 + 外部連携の対応 | **未知**（調査結果に依存） |
| 4 | 旧経路の削除 | 半日 |

⚠️ 3-b を見積もれないのは、外部連携の実態が分かっていないためである。
**見積もれないことを「小さい」と読み替えないこと。**
