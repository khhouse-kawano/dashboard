# 2026-09-29 分析API：広告費とKPI単価（v2.2.153）

## ⚠️ 依頼

⚠️ 分析API（MCPサーバー経由）で ⚠️⚠️ **かかった広告費（総額とKPI単価）を出せるようにする。**

> ⚠️ **指定期間(YYYY/MM～YYYY/MM)の〇〇(販促媒体名)の広告費を**
> ⚠️ **指定期間(YYYY/MM～YYYY/MM)の販促媒体ごとの広告費を**

⚠️ ⚠️ **参照する画面**: `customer/CustomerOrder.tsx` と `customer/CustomerKaeru.tsx`。
⚠️ ⚠️ **ここと同じ歩留まりとKPI単価を返すこと。** ⚠️ 併せて予算適正化の助言も返せるようにする。

---

## ⚠️ 変えたもの

| ディレクトリ | ファイル | |
|---|---|---|
| `backend-express/src/features/analysis/` | ⚠️⚠️ **adspend.ts**（新規） | ⚠️ 本体 |
| `backend-express/src/features/analysis/` | **index.ts** | ⚠️ `GET /adspend` を追加 |
| `backend-express/src/features/analysis/` | **meta.ts** | ⚠️ カタログに追記。⚠️ **`basis` の古い注記も直した** |
| `mcp-server/src/` | **index.ts** | ⚠️⚠️ **`get_ad_spend` ツールを追加**。⚠️ `basis` の説明も直した |
| `mcp-server/dist/` | **index.js / apiClient.js** | ⚠️⚠️ **ビルド済み** |
| `frontend/src/utils/` | **version.ts** | ⚠️ `2.2.152` → ⚠️ **`2.2.153`** |
| `backend/scripts/sql/` | ⚠️ **2026-09-29_update_log_2.2.153.sql**（新規） | ⚠️ 更新履歴 |

⚠️⚠️ **変えていないもの**

| | 理由 |
|---|---|
| ⚠️ `metrics.ts` / `query.ts` / `dimensions.ts` | ⚠️⚠️ **既存の指標は1つも変えていない** |
| ⚠️ 画面（`CustomerOrder.tsx` / `CustomerKaeru.tsx`） | ⚠️ 表示は変えない |
| ⚠️ ① の PHP | ⚠️⚠️ **分析APIは最初から ② だけにある** |
| ⚠️ DBの構造 | ⚠️⚠️ **表も列も足していない** |

---

## ⚠️⚠️ なぜ `/pivot` の指標にしなかったか

⚠️ 広告費は `budget` テーブルにあり、⚠️⚠️ **顧客1件ごとには紐づかない**（⚠️ 媒体 × 月 × 店舗）。

⚠️ ⚠️ **`master_data` を SUM する仕組みに混ぜると、軸の組み合わせ次第で同じ広告費が何度も足される。**
⚠️ ⚠️ **そのため独立したエンドポイントにした。** ⚠️ 軸（`groupBy`）も受け取らない。

---

## ⚠️⚠️ 基準日を反響日起算で固定した

⚠️ 分析APIの既定は ⚠️ **実績日起算**だが、⚠️⚠️ **このエンドポイントだけ反響日起算で固定**している。

⚠️ ⚠️ **画面が反響日（`register`）で切っているため。** ⚠️ 揃えないと単価の分母が合わない。
⚠️ ⚠️ **そもそも実績日起算では返せない。** ⚠️ 広告費は月×店舗×媒体でしか無く、工程ごとの日付に割り付けられない。

---

## ⚠️ 画面に合わせたKPIの判定

⚠️⚠️ **既存の `/pivot` の同名の指標とは一致しない。** ⚠️ 意図的である。

| | 画面（＝新エンドポイント） | ⚠️ `/pivot` |
|---|---|---|
| ⚠️ 日付が「入っている」判定 | ⚠️⚠️ **文字列が空でないか** | ⚠️ 日付として読めるか |
| ⚠️ 注文の契約 | ⚠️⚠️ **契約日あり かつ status が 契約済み/解約** | ⚠️ 契約日ありのみ |
| ⚠️ 建売の契約 | ⚠️⚠️ **自社＋仲介 かつ status が 契約済み**（⚠️ 解約を含まない） | ⚠️ status を見ない |
| ⚠️ 注文の次アポ率・契約率の分母 | ⚠️⚠️ **来場数** | ⚠️ 反響日起算では総反響 |
| ⚠️ 建売の契約率の分母 | ⚠️⚠️ **申込数** | ⚠️ 来場数 |
| ⚠️ ランク | ⚠️ 注文は `見込み` で絞る／建売は絞らない | ⚠️ 絞らない |
| ⚠️ 店舗台帳との突き合わせ | ⚠️⚠️ **しない**（⚠️ 絞り込み時のみ LEFT JOIN） | ⚠️ `report_flag = 1` で INNER JOIN |

---

## ⚠️ 追加した主な関数（そのまま）

### ⚠️ `filledPhase`（adspend.ts）

```ts
/**
 * ⚠️⚠️ **その工程の日付が「入っている」か。**
 *
 * ⚠️ ⚠️ **`phaseReached()` とは違う。** ⚠️ あちらは日付として読めるかを見る。
 *   ⚠️⚠️ **画面は文字列が空でないかどうかしか見ていない**ので、こちらに合わせる。
 *   ⚠️ ⚠️ **日付として壊れている値があると、ここだけ1件多く数える。**
 *     ⚠️ 画面と同じ挙動である。
 */
const filledPhase = (division: AnalysisDivision, phase: AnalysisPhase): string => {
  const columns = PHASE_COLUMNS[division][phase] ?? [];
  if (columns.length === 0) return 'FALSE';
  return columns.map((column) => `TRIM(COALESCE(m.${column}, '')) <> ''`).join(' OR ');
};
```

### ⚠️ `kpiSpec`（事業ごとのKPI・歩留まりの定義）

```ts
const kpiSpec = (division: AnalysisDivision): KpiSpec => {
  if (division === 'kaeru') {
    const contract = `((${filledPhase('kaeru', 'contract')}) AND ${STATUS} = '契約済み')`;
    const application = `((${filledPhase('kaeru', 'application')}) OR ${contract})`;
    const visit = `((${filledPhase('kaeru', 'visit')}) OR ${application})`;
    const contact = `((${filledPhase('kaeru', 'contact')}) OR ${visit})`;

    return {
      steps: [
        { key: 'contacts', label: '接触数', sql: contact },
        { key: 'visits', label: '来場数', sql: visit },
        { key: 'applications', label: '申込数', sql: application },
        { key: 'contracts', label: '契約数', sql: contract },
      ],
      rates: [
        { key: 'contactRatePct', label: '接触率（接触 ÷ 総反響）', numerator: 'contacts', denominator: 'leads' },
        { key: 'visitRatePct', label: '来場率（来場 ÷ 接触）', numerator: 'visits', denominator: 'contacts' },
        { key: 'applicationRatePct', label: '申込率（申込 ÷ 来場）', numerator: 'applications', denominator: 'visits' },
        { key: 'contractRatePct', label: '契約率（契約 ÷ 申込）', numerator: 'contracts', denominator: 'applications' },
      ],
      // ⚠️⚠️ **建売はステータスで絞らない**（show_dashboard = 1 をすべて見込みとして扱う運用）
      rankStatus: null,
    };
  }

  const contract = `((${filledPhase('order', 'contract')}) AND ${STATUS} IN ('契約済み', '解約'))`;
  const nextAppointment =
    `(${filledPhase('order', 'nextAppointment')}` +
    ` OR ${filledPhase('order', 'preScreening')}` +
    ` OR ${filledPhase('order', 'contract')})`;
  const visit = `((${filledPhase('order', 'visit')}) OR ${nextAppointment})`;

  return {
    steps: [
      { key: 'visits', label: '来場数', sql: visit },
      { key: 'nextAppointments', label: '次アポ数', sql: nextAppointment },
      { key: 'contracts', label: '契約数', sql: contract },
    ],
    rates: [
      { key: 'visitRatePct', label: '来場率（来場 ÷ 総反響）', numerator: 'visits', denominator: 'leads' },
      { key: 'nextAppointmentRatePct', label: '次アポ率（次アポ ÷ 来場）', numerator: 'nextAppointments', denominator: 'visits' },
      { key: 'contractRatePct', label: '契約率（契約 ÷ 来場）', numerator: 'contracts', denominator: 'visits' },
    ],
    // ⚠️ 注文はランクを「見込み」だけで数える（画面と同じ）
    rankStatus: '見込み',
  };
};
```

### ⚠️ `budgetMediumSql`（販促費を画面の行へ振り分ける）

```ts
/**
 * 販促費の媒体名を、画面の行の名前へ振り分けるSQL。
 *
 * ⚠️⚠️ **顧客側とは判定が違う。** ⚠️ 販促費に `hp_campaign` は無い。
 *
 * ⚠️ 注文 … ⚠️ **媒体名の素の一致**（画面が `item.medium === value.medium` のため）
 * ⚠️ 建売 … ⚠️ **別名を寄せたうえで、5媒体をホームページ反響へ**
 */
const budgetMediumSql = (division: AnalysisDivision, items: string[], hpRow: string): string => {
  const MEDIUM = cleaned('b.medium');

  if (division === 'kaeru') {
    const normalizedWhens = Object.entries(MEDIUM_ALIAS).map(
      ([canonical, aliases]) =>
        `WHEN ${MEDIUM} IN (${aliases.map(lit).join(', ')}) THEN ${lit(canonical)}`
    );
    const normalized = `CASE ${normalizedWhens.join(' ')} ELSE ${MEDIUM} END`;

    const whens = [
      // ⚠️⚠️ **ホームページ反響を先に見る。** ⚠️ 画面も `isHomepageBudget` を先に見ている
      `WHEN ${MEDIUM} IN (${HOMEPAGE_BUDGET_MEDIUMS.map(lit).join(', ')}) THEN ${lit(hpRow)}`,
      ...items
        .filter((item) => item !== hpRow)
        .map((item) => `WHEN ${normalized} = ${lit(item)} THEN ${lit(item)}`),
    ];
    return `CASE ${whens.join(' ')} ELSE ${lit(OTHER_ROW)} END`;
  }

  const whens = items.map((item) => `WHEN ${MEDIUM} = ${lit(item)} THEN ${lit(item)}`);
  // ⚠️ 媒体マスタに1つも無いときに CASE が壊れないようにする
  if (whens.length === 0) return lit(OTHER_ROW);
  return `CASE ${whens.join(' ')} ELSE ${lit(OTHER_ROW)} END`;
};
```

### ⚠️⚠️ 期間を指定していないときの扱い（`fetchCounts` の一部）

```ts
  /**
   * ⚠️⚠️ **期間を指定していないときは、反響日で絞らない。**
   *
   * ⚠️ ⚠️ **画面は反響日が空の顧客も総反響に数えている。**
   *   ⚠️ 期間を選んでいないと日付の比較そのものを行わないため。
   *   ⚠️ ⚠️ **ここで `IS NOT NULL` を足すと、全期間のときだけ画面より少なく出る。**
   *
   * ⚠️ 期間を指定したときは、⚠️ **画面でも日付の比較に失敗して落ちる**ので、
   *   ⚠️ こちらで `IS NOT NULL` を足しても結果は同じになる。
   * ⚠️ ⚠️ **0004年のような壊れた日付も、期間の指定で自然に落ちる。**
   */
  if (from !== undefined || options.to !== undefined) {
    conditions.push(`${reaction} IS NOT NULL`);
  }
```

⚠️ ⚠️ **ここは実装中に実測で見つけた差**である。⚠️ 最初は常に `IS NOT NULL` を付けていた。

### ⚠️ その他の判断

| # | |
|---|---|
| 1 | ⚠️⚠️ **建売は開始月を指定しなくても 2025-01 より前を数えない**（⚠️ 画面の `PERIOD_START`） |
| 2 | ⚠️⚠️ **建売は「反響のある店舗」の広告費だけ**（⚠️ 画面と同じ。⚠️ 外すと単価が高く出る） |
| 3 | ⚠️ 媒体を指定しても ⚠️⚠️ **総反響の行は必ず返す**（⚠️ 全体に対する位置が分かるように） |
| 4 | ⚠️ 単価は分母が0なら ⚠️ **`null`**（⚠️ **0円と返すと「無料で取れた」と読まれる**） |
| 5 | ⚠️⚠️ **エリアの絞り込みだけ画面より広い。** ⚠️ 画面は `shopArray.find()` でそのエリアの**1店舗しか見ていない**。⚠️ こちらは全店舗を見る（⚠️ **画面側の作りが意図どおりか分からないため合理的なほうを採った**） |

---

## ⚠️ 予算適正化の助言について

⚠️⚠️ **助言そのものは書いていない。** ⚠️ Claudeが推論する。
⚠️ 代わりに `meta.予算適正化を助言するときに必ず踏まえること` に ⚠️ **落とし穴を7つ**入れた。

| # | 内容 |
|---|---|
| 1 | ⚠️⚠️ **単価が安い媒体に寄せればよい、と安易に結論しない**（⚠️ leads が10件未満の単価は語らない） |
| 2 | ⚠️⚠️ **広告費0円は「無料で獲得できている」ではない**（⚠️ 該当媒体名も列挙して渡す） |
| 3 | ⚠️ 総反響の広告費は媒体行の合計と一致する（⚠️ **画面には「その他」行が無い**ので画面とは見え方が違う） |
| 4 | ⚠️⚠️ **反響日起算なので直近月は契約単価が高く出る**（⚠️ 成績の悪化ではない） |
| 5 | ⚠️ 担当者別・ランク別の単価は出してはならない |
| 6 | ⚠️ 判断は ⚠️ **契約単価と件数の規模**で行う（⚠️ 反響単価だけを見ない） |
| 7 | ⚠️⚠️ **増額しても同じ単価で伸びる保証はない**と断ること |

---

## ⚠️ ローカルでの確認（実施済み）

⚠️⚠️ **画面の集計ロジックをそのまま写した検証スクリプトを書き、実データで突き合わせた。**

### ⚠️ 総反響（画面 vs API）

| 条件 | 結果 |
|---|---|
| ⚠️ 注文 / 2025-04〜2025-09 | ⚠️⚠️ **9項目すべて完全一致**（反響7,116 / 来場1,489 / 次アポ750 / 契約257 / 広告費219,793,085 / 4つの単価） |
| ⚠️ 建売 / 2025-04〜2025-09 | ⚠️⚠️ **11項目すべて完全一致**（反響1,511 / 接触1,059 / 来場520 / 申込144 / 契約129 / 広告費69,635,581 / 5つの単価） |
| ⚠️⚠️ **注文 / 期間指定なし** | ⚠️⚠️ **9項目すべて完全一致**（反響25,158 / 広告費710,351,839） |

### ⚠️ 媒体ごとの行（注文 / 2025-04〜2025-09）

⚠️⚠️ **20媒体すべて、反響数も広告費も完全一致。**

| 例 | 画面反響 | API | 画面広告費 | API |
|---|---|---|---|---|
| HOME'S | 1,501 | 1,501 | 12,949,191 | 12,949,191 |
| タウンライフ | 2,323 | 2,323 | 14,108,884 | 14,108,884 |
| チラシ | 340 | 340 | 72,108,175 | 72,108,175 |
| SNS広告 | 565 | 565 | 46,335,722 | 46,335,722 |

⚠️ ⚠️ **「その他」行（反響645 / 広告費22,102,602）は画面に無い行。**
⚠️ ⚠️ **これがあることで、媒体行の合計が総反響とぴったり一致する。**

### ⚠️ その他

| # | 見たこと | 結果 |
|---|---|---|
| 1 | ⚠️ 媒体行の leads 合計 = 総反響 | ⚠️ ✅（3条件すべて） |
| 2 | ⚠️ 媒体行の広告費合計 = 総反響の広告費 | ⚠️ ✅（3条件すべて） |
| 3 | ⚠️ `medium=SUUMO` で絞る | ⚠️ ✅ **総反響 ＋ SUUMO の2行** |
| 4 | ⚠️ 契約0件の媒体の契約単価 | ⚠️ ✅ **`null`**（0ではない） |
| 5 | ⚠️ 建売のホームページ反響の広告費 | ⚠️ ✅ 44,926,730（5媒体を寄せたもの） |
| 6 | ⚠️ `npx tsc --noEmit`（②） | ⚠️ ✅ エラーなし |
| 7 | ⚠️ MCPサーバーのビルド | ⚠️ ✅ `dist/index.js` に `get_ad_spend` あり |
| 8 | ⚠️ フロントのビルド | ⚠️ ✅ `main.34f6c6c0.js` に `2.2.153` |
| 9 | ⚠️ 更新履歴（ローカルDB） | ⚠️ ✅ no.246 / 2.2.153 |

⚠️ ⚠️ **検証用のスクリプトはコンテナから削除済み。** ⚠️ DBには何も書いていない。

---

## ⚠️ 申し送り

| # | 内容 |
|---|---|
| 1 | ⚠️⚠️ **② の再ビルドが必要。** ⚠️ ①・DBは変更なし |
| 2 | ⚠️⚠️ **MCPサーバーを配り直さないと `get_ad_spend` は使えない。** ⚠️ `mcp-server/dist/` がビルド済み |
| 3 | ⚠️ ⚠️ **持ち越しだった「既定の reaction」の古い記述も直した**（⚠️ MCP側・API側の両方） |
| 4 | ⚠️ ⚠️ **`mcp.zip` に `scripts/` が入っていない件は未対応**（⚠️ 持ち越し） |
| 5 | ⚠️ ⚠️ **エリアの絞り込みだけ画面より広い**（⚠️ 上の「その他の判断」5） |
| 6 | ⚠️ ⚠️ **建売の媒体行は画面の行と一致しない**（⚠️ **画面は同じ人をまとめ行と個別行の両方に数えている**。⚠️ APIは1人1項目。⚠️ 既存の `medium` 軸と同じ扱い） |
| 7 | ⚠️ ブラウザでの表示は ⚠️⚠️ **未確認**（⚠️ 画面は変えていない） |
| 8 | ⚠️⚠️ **`v2.2.152` のPR #85 は `a1fa03c9` までしか取り込まれていない。** ⚠️ HOME'SのGAS（`b39c14ae`）はこのブランチに載せてある |
