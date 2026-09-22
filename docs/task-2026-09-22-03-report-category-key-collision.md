# 分析レポートの画面が 502 になる不具合を直す（v2.2.142）

⚠️ 症状:

> Claudeによる分析ボタンをクリックしても502がかえってくる

⚠️ ⚠️ **デプロイの問題ではなく、こちらの実装の不具合だった。**
⚠️ 原因にたどり着くまでに ⚠️ **② の再ビルドを3回してもらっている。**

---

## ⚠️ 原因

⚠️ 画面が `category: 'competitor'` を送っていた。

```ts
// ⚠️ 直す前（CompetitorAnalysisReports.tsx）
apiClient.post('', { request: 'analysis_report_list', category: 'competitor' });
```

⚠️⚠️ **`category` は ② のゲートウェイが「どの登録先を呼ぶか」を引くためのキーである。**

| | キー |
|---|---|
| ① が送った | `analysis_report_list` :: `` :: ⚠️ **`competitor`** |
| ② に登録されていた | `analysis_report_list` :: `` :: ⚠️ **（空）** |

⚠️ ⚠️ **完全一致でしか引かない**（[registry.ts](../backend-express/src/gateway/registry.ts) の `findEntry`）。
⚠️ ⚠️ **ワイルドカードは意図的に用意していない**ため、⚠️ **別のキーとして「未登録」になった。**

⚠️ 未登録かつ ⚠️ **`X-Forwarded-By: xserver-php` が付いている**ので、
⚠️ ② は ⚠️ **ループ検知として 502** を返す（[gateway/index.ts](../backend-express/src/gateway/index.ts)）。

```
ループ検知: ① から転送された "analysis_report_list" が ② に未登録です。
```

⚠️⚠️ **この文言が「② のデプロイが古い」と読めることが、遠回りの原因になった。**
⚠️ ⚠️ **実際には ② は新しく、送られてきたキーが違っただけである。**

---

## ⚠️ 直したもの

| ディレクトリ | ファイル | 何を |
|---|---|---|
| `frontend/src/components/header/` | `CompetitorAnalysisReports.tsx` | ⚠️ **`category` → `reportCategory`**（一覧・登録の2か所） |
| `backend-express/src/gateway/` | `registry.ts` | ⚠️ 同じく ⚠️ **`ctx.body.reportCategory` を読む**（2か所） |

⚠️ ⚠️ **なぜ名前を変えたか。** ⚠️ 登録キーを `category = 'competitor'` で足す手もあるが、
⚠️ ⚠️ **種類が増えるたびに ② の登録も増やさないと 502 になる**ため、
⚠️ **振り分けキーと業務上の分類を別の名前に分けた。**

### 一覧（registry.ts）

```ts
  auth: 'staff',
  handler: async (ctx) => {
    // ⚠️⚠️ **`category` という名前は使えない。**
    //   ⚠️ ゲートウェイは request / roll / category の3つで登録先を引く
    //     （findEntry / gatewayKey）。⚠️ **完全一致でしか引かない。**
    //   ⚠️ ⚠️ **body に category を入れると別のキーとして扱われ、未登録になる。**
    //     ⚠️ 2026-09-22、画面が category: 'competitor' を送っていたため
    //       ⚠️ **「ループ検知」で 502 になった。**
    const category = String(ctx.body.reportCategory ?? '');
    return { reports: await listReports(category) };
  },
```

### 登録（registry.ts）

```ts
    const no = await saveReport({
      title,
      // ⚠️⚠️ **`category` は使えない**（ゲートウェイの振り分けキーと衝突する）。
      //   ⚠️ 詳しくは analysis_report_list の注記。
      category: String(ctx.body.reportCategory ?? '') || 'competitor',
      division: String(ctx.body.division ?? ''),
      period: String(ctx.body.period ?? ''),
      html,
      // ⚠️ MCP から入った分（staff = 'MCP'）と区別が付くようにする
      staff: String(ctx.staff?.name ?? ''),
      dataAsOf: String(ctx.body.dataAsOf ?? '') || undefined,
    });
```

### 画面（CompetitorAnalysisReports.tsx）

```ts
            // ⚠️⚠️ **`category` という名前で送らないこと。**
            //   ⚠️ ② のゲートウェイは request / roll / category の3つで登録先を引く。
            //   ⚠️ ⚠️ **category を入れると別のキー扱いになり、未登録として 502 になる。**
            const res = await apiClient.post('', { request: 'analysis_report_list', reportCategory: 'competitor' });
```

```ts
            const res = await apiClient.post('', {
                request: 'analysis_report_upload',
                title: form.title.trim(),
                // ⚠️⚠️ **`category` は使えない**（上と同じ理由。② の振り分けキーと衝突する）
                reportCategory: 'competitor',
                division: form.division,
                period: form.period.trim(),
                dataAsOf: form.dataAsOf,
                html,
            });
```

---

## ⚠️ 確認（2026-09-22・ローカル）

⚠️ ⚠️ **同じ 502 を再現させてから直した。**

```
POST /api/gateway （X-Forwarded-By: xserver-php つき）
  {"request":"analysis_report_list","category":"competitor"}        → ⚠️ 502（再現）
  {"request":"analysis_report_list","reportCategory":"competitor"}  → ⚠️ 401（認証まで到達）
```

⚠️ 401 は ⚠️ **認証していないだけ**で、⚠️ **ルーティングは成功している。**

| 確認 | 結果 |
|---|---|
| `npx tsc --noEmit`（backend-express） | ⚠️ **エラー0件** |
| `npm run build`（frontend） | ⚠️ **成功**（⚠️ 警告は既存の `Summary.tsx` のみ） |

---

## ⚠️ 申し送り

| # | 内容 |
|---|---|
| 1 | ⚠️⚠️ **ゲートウェイに送る body で `request` / `roll` / `category` の3つは予約語**。⚠️ **業務上の値を入れないこと** |
| 2 | ⚠️ 「ループ検知」のログは ⚠️ **「② が古い」と読めてしまう**。⚠️ **送られてきた roll / category もログに出すべき**（次の版） |
| 3 | ⚠️ ② の再ビルドが必要（⚠️ **registry.ts を直したため**） |
