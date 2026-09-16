/**
 * 単体で動く HTML フォームを組み立てる。
 *
 * ─────────────────────────────────────────────
 * ⚠️⚠️ **デザインは付けない。** LP 側の CSS に任せる。
 *   ⚠️ ここで見た目を作り込むと、貼り付け先のデザインと必ず喧嘩する。
 *
 * ⚠️⚠️ **通知先・サンクスメール・サンクスページはここに埋め込まない。**
 *   ⚠️ 生成した HTML は**誰でもソースを読める**。宛先を書くと、
 *     書き換えて任意の宛先へ送らせることができる（過去に実際そうなっていた）。
 *   ⚠️ それらは `form_table` にあり、② が `brand + campaign_id` で引く。
 *     ⚠️ HTML が送るのは**入力値と、どのキャンペーンかだけ**。
 *
 * ⚠️ 既存の iframe 埋め込み（form_table.tag）とは**別物**である。
 *   あちらは React アプリを読み込む。こちらは単体で完結する。
 * ─────────────────────────────────────────────
 */

/** ② のゲートウェイ。⚠️ 生成した HTML はここへ直接 POST する */
export const ENTRY_URL = 'https://api.khg-marketing.info/api/gateway';

/** 生成する入力欄 */
export interface BuilderField {
    /** ② が受け取るキー。⚠️ entry.ts の readAnswers と合わせること */
    key: string;
    label: string;
    /** `text` / `tel` / `email` / `date` / `textarea` / `select` */
    type: 'text' | 'tel' | 'email' | 'date' | 'textarea' | 'select';
    required: boolean;
    /** select のときの選択肢 */
    options?: string[];
}

/**
 * ⚠️⚠️ **選べる項目はここに載っているものだけ。**
 *   ⚠️ ② の `features/campaignForm/entry.ts` が読むキーと**必ず一致させる**こと。
 *     一致しないと「フォームには出るが保存されない項目」ができる。
 */
export const BUILDER_FIELDS: BuilderField[] = [
    { key: 'shop', label: '来場希望場所', type: 'select', required: false, options: [] },
    { key: 'sei', label: '姓', type: 'text', required: true },
    { key: 'mei', label: '名', type: 'text', required: true },
    { key: 'seiKana', label: 'せい', type: 'text', required: false },
    { key: 'meiKana', label: 'めい', type: 'text', required: false },
    { key: 'phone', label: '電話番号', type: 'tel', required: true },
    { key: 'mail', label: 'メールアドレス', type: 'email', required: true },
    { key: 'age', label: '年齢', type: 'select', required: false, options: ['20代', '30代', '40代', '50代', '60代以上'] },
    { key: 'zip', label: '郵便番号', type: 'text', required: false },
    { key: 'pref', label: '都道府県', type: 'text', required: false },
    { key: 'city', label: '市区町村', type: 'text', required: false },
    { key: 'town', label: '町名', type: 'text', required: false },
    { key: 'street', label: '番地', type: 'text', required: false },
    { key: 'date', label: '来場希望日', type: 'date', required: false },
    { key: 'time', label: '来場希望時間', type: 'select', required: false, options: [] },
    { key: 'medium', label: 'お問い合わせのきっかけ', type: 'select', required: false, options: [] },
    { key: 'question', label: 'ご要望・ご質問', type: 'textarea', required: false },
];

/**
 * ⚠️⚠️ **`form_table` の設定キーと、ここの項目キーの対応表。**
 *
 *   ⚠️ `form_table` は項目を JSON で持っており、1つの JSON が
 *     **複数の入力欄をまとめている**ことがある。
 *       `name`    → 姓・名（sei / mei）
 *       `kana`    → せい・めい（seiKana / meiKana）
 *       `date`    → 来場希望日・時間（date / time）
 *       `address` → 郵便番号〜番地（zip / pref / city / town / street）
 *
 *   ⚠️ そのため「設定の1項目 = 画面の1チェック」ではない。
 *     ⚠️ 取り違えると、**キャンペーンで聞いている項目が
 *       フォーム作成側に出てこない**（エラーにならないので気づけない）。
 */
export const SETTING_TO_FIELDS: Record<string, string[]> = {
    shop: ['shop'],
    name: ['sei', 'mei'],
    kana: ['seiKana', 'meiKana'],
    phone: ['phone'],
    mail: ['mail'],
    age: ['age'],
    address: ['zip', 'pref', 'city', 'town', 'street'],
    date: ['date', 'time'],
    medium: ['medium'],
    question: ['question'],
};

/** `readSettings` の戻り値 */
export interface SettingFlags {
    /** 項目キー → その項目を聞いているか */
    used: Record<string, boolean>;
    /** 項目キー → 必須か */
    required: Record<string, boolean>;
}

/**
 * キャンペーン設定から「どの項目を聞いているか」「どれが必須か」を読み取る。
 *
 * ─────────────────────────────────────────────
 * ⚠️⚠️ **`form_table` の設定 JSON は `bool` と `required` を別々に持っている。**
 *   `bool`     … その項目を聞くかどうか
 *   `required` … 必須かどうか
 *
 *   ⚠️ 以前は `bool` しか読んでおらず、必須は BUILDER_FIELDS の
 *     **ベタ書き**（姓・名・電話・メールだけ true）のままだった。
 *     ⚠️ そのため**キャンペーン側で必須にしている来場希望場所や
 *       来場希望日が、生成した HTML では必須にならなかった**
 *       （2026-09-16 の指摘）。
 *
 *   ⚠️ 公開フォーム（react/form_get の Form.tsx）も
 *     `parsed.required === true && parsed.bool === true` で判定している。
 *     ⚠️ **同じ読み方に揃えること。**片方だけ変えると
 *       iframe 版と HTML 版で必須項目が食い違う。
 *
 * ⚠️ 設定は列ごとに JSON 文字列。⚠️ 壊れていても落とさず、その項目だけ諦める。
 * ─────────────────────────────────────────────
 */
export const readSettings = (row: Record<string, string>): SettingFlags => {
    const used: Record<string, boolean> = {};
    const required: Record<string, boolean> = {};
    // ⚠️ まず全部 false にする。設定に無い項目が前の選択のまま残らないように
    for (const field of BUILDER_FIELDS) {
        used[field.key] = false;
        required[field.key] = false;
    }

    for (const [setting, keys] of Object.entries(SETTING_TO_FIELDS)) {
        const raw = row[setting];
        if (!raw) continue;

        let on = false;
        let must = false;
        try {
            const parsed = JSON.parse(raw) as { bool?: unknown; required?: unknown };
            on = parsed.bool === true;
            // ⚠️ 聞いていない項目を必須にはできない。⚠️ bool と併せて見る
            must = on && parsed.required === true;
        } catch {
            console.error(`[formBuilder] 設定の解釈に失敗しました（${setting}）`);
            continue;
        }

        if (on) {
            for (const key of keys) {
                used[key] = true;
                required[key] = must;
            }
        }
    }

    return { used, required };
};

/** ⚠️ HTML に値を埋めるときは必ず通す。属性と本文の両方で使える形にする */
const esc = (value: string): string =>
    String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');

const inputFor = (field: BuilderField): string => {
    const req = field.required ? ' required' : '';
    const name = esc(field.key);

    if (field.type === 'textarea') {
        return `      <textarea name="${name}" rows="4"${req}></textarea>`;
    }
    if (field.type === 'select') {
        const options = (field.options ?? [])
            .filter(o => o.trim() !== '')
            .map(o => `        <option value="${esc(o)}">${esc(o)}</option>`)
            .join('\n');
        return `      <select name="${name}"${req}>\n`
            + `        <option value="">選択してください</option>\n`
            + `${options}\n`
            + `      </select>`;
    }
    return `      <input type="${field.type}" name="${name}"${req}>`;
};

export interface BuildInput {
    brand: string;
    campaignId: string;
    campaign: string;
    fields: BuilderField[];
    /** 送信後に飛ばす先。⚠️ 空ならページ内に完了文言を出す */
    thanksUrl: string;
}

/**
 * 貼り付けるだけで動く HTML を作る。
 *
 * ⚠️ 生成物には**デザインを入れない**（class も付けない）。
 * ⚠️ 二重送信を防ぐため、送信中はボタンを無効にする。
 */
export const buildHtml = (input: BuildInput): string => {
    const rows = input.fields.map(field =>
        `    <p>\n`
        + `      <label>${esc(field.label)}${field.required ? '（必須）' : ''}</label><br>\n`
        + `${inputFor(field)}\n`
        + `    </p>`
    ).join('\n');

    const done = input.thanksUrl.trim() !== ''
        ? `        location.href = ${JSON.stringify(input.thanksUrl.trim())};`
        : `        form.innerHTML = '<p>送信しました。ありがとうございました。</p>';`;

    return `<!-- ${esc(input.campaign)} / ${esc(input.campaignId)} -->
<!-- ⚠️ 通知先とサンクスメールはダッシュボードのキャンペーン設定で管理しています。
     ⚠️ このHTMLには宛先を書かないでください（誰でもソースを読めます）。 -->
<form id="khg-form">
${rows}
    <p>
      <button type="submit" id="khg-submit">送信する</button>
    </p>
    <p id="khg-error" style="color:red" hidden></p>
</form>

<script>
(function () {
  var form = document.getElementById('khg-form');
  var button = document.getElementById('khg-submit');
  var error = document.getElementById('khg-error');

  form.addEventListener('submit', function (event) {
    event.preventDefault();

    // ⚠️ 二重送信を防ぐ。押した直後に無効にする
    if (button.disabled) return;
    button.disabled = true;
    error.hidden = true;

    var body = {
      request: 'campaign_form',
      roll: 'entry',
      brand: ${JSON.stringify(input.brand)},
      campaign_id: ${JSON.stringify(input.campaignId)},
      campaign: ${JSON.stringify(input.campaign)},
      // ⚠️ どのページから送られたかを残す。反響の出どころが追える
      url: location.href,
      source: (new URLSearchParams(location.search)).get('utm_source') || ''
    };

    new FormData(form).forEach(function (value, key) { body[key] = value; });

    fetch(${JSON.stringify(ENTRY_URL)}, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    })
      .then(function (res) { return res.json(); })
      .then(function (data) {
        if (data && data.status === 'success') {
${done}
          return;
        }
        throw new Error(data && data.message ? data.message : '登録に失敗しました');
      })
      .catch(function (e) {
        // ⚠️ 黙って失敗しない。反響1件は営業の機会そのもの
        console.error(e);
        error.textContent = '送信できませんでした。時間をおいて再度お試しください。';
        error.hidden = false;
        button.disabled = false;
      });
  });
})();
</script>
`;
};
