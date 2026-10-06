# 2026-10-06 フェスタLP: `?m=c` の予約を媒体「長原木」で登録（v2.2.167）

## 依頼
- `https://kh-house.jp/festa/?m=c` のように `m` が `c` の場合のみ `medium: '長原木'` で API に POST する
- パラメータ無しでも DB に登録されることを確認してから実装
- 社内通知メールの件名を `【おうちづくりフェスタ2026／予約】〇〇様(長原木2,000円チケット)` にする
- サンクスメール（予約者宛の確認メール）に「長原木2,000円チケットでのお申し込みを確認いたしました。」を添える

## 変更したファイル

| ディレクトリ | ファイル | 内容 |
|---|---|---|
| `frontend/src/utils/` | `version.ts` | `2.2.167` |
| `backend/scripts/sql/` | ⚠️ 新規 `2026-10-06_update_log_2.2.167.sql` | update_log（ローカルは no=263 で投入済み） |
| `backend-express/src/features/event/` | `reservation.ts` | ⚠️ 追加 `ALLOWED_MEDIUMS`。`runEventReservation` で `medium` を保存・メールへ渡す |
| `backend-express/src/features/event/` | `mail.ts` | ⚠️ 追加 `NOTICE_SUBJECT_SUFFIX` / `CONFIRM_NOTE_BY_MEDIUM`。`ReservationMailData.medium`。`sendReservationConfirm` / `sendInternalNotice` |
| ⚠️ リポジトリ外 `Downloads/20260425_kokubu_ouchi_festa_LP_NK/` | `index.html` | ⚠️ 追加 `MEDIUM_BY_PARAM` / `medium`。`buildPayload` に `medium` |
| 同上 | ⚠️ 新規 `index.html.before-medium` | 変更前のコピー |
| `docs/` | `deploy-v2.2.167.md` | 手順書 |

## 方針
- ② は認証なしの公開口なので、`medium` は ⚠️ **許可リスト（`長原木` のみ）**。一覧外・指定なしは NULL で保存し、予約は弾かない。
- LP は `?m=` の値を Map で媒体名に変換。該当なしは `undefined` → JSON に含まれない。
- メールの追記は媒体ごとの Map。該当しない予約は件名・本文とも従来どおり。

## 確認（ローカル）
- SMTP 未設定（メールは送られない）ことを確認してから実施。
- 変更前: `medium` なしで POST → `{"status":"ok"}`、event_db に登録・`medium` NULL。
- 変更後:

| 送った medium | 応答 | event_db.medium |
|---|---|---|
| `長原木` | ok | 長原木 |
| なし | ok | NULL |
| `偽の媒体` | ok | NULL |

- テスト行4件は削除済み。
- メール文面は送信部分を差し替えて組み立てを確認:
  - 長原木: 件名 `【おうちづくりフェスタ2026／予約】山田様(長原木2,000円チケット)`、確認メールの「以下の内容で承りました。」の次に一文
  - なし: 件名・本文とも従来どおり
- `tsc --noEmit` 通過。フロント build `main.77962e36.js`。

## コード

### reservation.ts — `ALLOWED_MEDIUMS`（追加）
```ts
/**
 * 媒体（event_db.medium）として受け付ける値。
 *
 * ⚠️⚠️ **一覧にない値は保存しない（NULL）。** 認証なしの口なので、自由な文字列を
 *   受けると一覧や媒体別の集計に任意の名前を入れられる。予約そのものは弾かない。
 *
 * ⚠️ LPの MEDIUM_BY_PARAM（`?m=` の値 → 媒体名）と一致させること。
 *   例: https://kh-house.jp/festa/?m=c → '長原木'
 */
const ALLOWED_MEDIUMS = new Set(['長原木']);
```

### reservation.ts — `runEventReservation`（修正。全体）
```ts
/**
 * 予約を受け付ける。
 *
 * ⚠️ 応答に内部の情報を含めない。採番した `no` も返さない。
 *   フォーム側は成功・失敗しか見ていない。
 *
 * ⚠️ メール送信の失敗では 200 を返す。予約は保存済みであり、
 *   ここで失敗を返すと利用者が再送して**同じ人が二重に予約する。**
 *   （id が同じなら UNIQUE で弾かれるが、画面を開き直すと別idになる）
 */
export const runEventReservation = async (
  body: Record<string, unknown>
): Promise<EventResult> => {
  const id = clean(body.id, 64);

  if (!ID_PATTERN.test(id)) {
    // ⚠️ 形式の詳細は返さない。総当たりの手がかりになる
    return {
      httpStatus: 400,
      body: { status: 'error', message: '予約情報が正しくありません。お手数ですが最初からやり直してください。' },
    };
  }

  const name = clean(body.name, 64);
  if (name === '') {
    return { httpStatus: 400, body: { status: 'error', message: 'お名前を入力してください。' } };
  }

  const mail = clean(body.mail, 255);
  const phone = normalizePhone(clean(body.phone, 32));
  if (mail === '' && phone === '') {
    return {
      httpStatus: 400,
      body: { status: 'error', message: 'メールアドレスか電話番号のいずれかを入力してください。' },
    };
  }

  const date = clean(body.date, 32);
  if (!ALLOWED_DATES.has(date)) {
    return { httpStatus: 400, body: { status: 'error', message: '来場日を選択してください。' } };
  }

  const time = clean(body.time, 16);
  if (time === '') {
    return { httpStatus: 400, body: { status: 'error', message: '来場時間を選択してください。' } };
  }

  // ⚠️ 無い・一覧外の値は空にする（→ NULL で保存）。弾かない
  const rawMedium = clean(body.medium, 32);
  const medium = ALLOWED_MEDIUMS.has(rawMedium) ? rawMedium : '';

  const record = {
    id,
    title: EVENT_TITLE,
    date,
    time,
    name,
    kana: clean(body.kana, 64),
    mail,
    phone,
    address: clean(body.address, 128),
    area: clean(body.area, 128),
    interview: joinChoices(body.interview, 20, 64),
    // ⚠️⚠️ フォームの `request[]`（マイホームのご検討）は **`request_type`** という
    //   キーで送られてくる。`request` はゲートウェイのリクエスト種別
    //   （'event_reservation'）で予約済みのため、そのままでは使えない。
    //   ここを body.request にすると、保存される値が 'event_reservation' になる。
    request: joinChoices(body.request_type, 10, 64),
    medium,
    // ⚠️ フォームは同意必須。'1' 以外が来たら未同意として保存する（弾かない）
    agree: clean(body.agree, 4) === '1' ? 1 : 0,
    reserved_at: nowForDb(),
  };

  try {
    // ⚠️ UNIQUE キーだけに頼らず、先に確認して分かりやすい応答を返す。
    //   利用者が「送信」を2回押したときに赤いエラーを出さないため。
    const existing = await query<CountRow>(
      'SELECT COUNT(*) AS c FROM event_db WHERE id = ?',
      [id]
    );
    if ((existing[0]?.c ?? 0) > 0) {
      return {
        httpStatus: 200,
        body: { status: 'ok', duplicate: true },
      };
    }

    const columns = Object.keys(record);
    const values: SqlParam[] = columns.map((col) => {
      const v = (record as Record<string, string | number>)[col];
      return typeof v === 'number' ? v : orNull(v);
    });

    await execute(
      `INSERT INTO event_db (${columns.map((c) => `\`${c}\``).join(', ')})
       VALUES (${columns.map(() => '?').join(', ')})`,
      values
    );
  } catch (error) {
    // ⚠️ 例外の内容を応答に含めない（SQLや列名が漏れる）
    logger.error(`event_reservation の保存に失敗しました id=${id}: ${(error as Error).message}`);
    return {
      httpStatus: 500,
      body: { status: 'error', message: 'ご予約の登録に失敗しました。時間をおいて再度お試しください。' },
    };
  }

  // ⚠️ ここから先の失敗では 400 / 500 を返さない。予約は保存済みである
  const payload: ReservationMailData = {
    id: record.id,
    name: record.name,
    kana: record.kana,
    date: record.date,
    time: record.time,
    mail: record.mail,
    phone: record.phone,
    address: record.address,
    area: record.area,
    interview: record.interview,
    request: record.request,
    title: record.title,
    agree: record.agree,
    medium: record.medium,
  };

  // ⚠️ QRは1回だけ作って両方のメールに渡す。
  //   顧客宛（当日の提示用）と社内宛（紛失時の再送用）の両方に添付する。
  const qr = await buildQrPng(record.id);

  const [confirmSent, noticeSent] = await Promise.all([
    sendReservationConfirm(payload, qr),
    sendInternalNotice(payload, qr),
  ]);

  if (!noticeSent) {
    // ⚠️ 社内通知が飛ばないと誰も予約に気づかない。ログには必ず残す
    logger.warn(`event_reservation の社内通知を送信できませんでした id=${id}`);
  }

  return {
    httpStatus: 200,
    body: { status: 'ok', mailSent: confirmSent },
  };
};
```

### mail.ts — `ReservationMailData` / `NOTICE_SUBJECT_SUFFIX` / `CONFIRM_NOTE_BY_MEDIUM`
```ts
export interface ReservationMailData {
  id: string;
  name: string;
  kana: string;
  date: string;
  time: string;
  mail: string;
  phone: string;
  address: string;
  area: string;
  interview: string;
  request: string;
  title: string;
  /**
   * 個人情報の取り扱いへの同意。1 = 同意済み。
   *
   * ⚠️ フォームは同意を必須にしているため実際には常に 1 になる。
   *   それでも 0 の表記を用意しておくこと。フォームを介さず
   *   直接APIを叩かれた場合に「チェック済み」と誤記録しないため。
   *
   * ⚠️ LPの同意文には**写真撮影と広報利用**の了承も含まれる。
   *   この値はその同意も兼ねている。文面を変えるときは
   *   LPの .form__privacy と揃えること。
   */
  agree: number;
  /** 媒体（event_db.medium）。⚠️ 許可リスト外・指定なしは空文字 */
  medium: string;
}

/**
 * 媒体 → 社内通知の件名に添える文言。
 *
 * ⚠️ 例: 【おうちづくりフェスタ2026／予約】〇〇様(長原木2,000円チケット)
 * ⚠️ ここに無い媒体は件名に何も付けない（従来どおり）。
 */
const NOTICE_SUBJECT_SUFFIX = new Map<string, string>([['長原木', '長原木2,000円チケット']]);

/**
 * 媒体 → 予約者宛の確認メール（サンクスメール）に添える一文。
 *
 * ⚠️ 「以下の内容で承りました。」の直後に入る。ここに無い媒体は何も足さない（従来どおり）。
 */
const CONFIRM_NOTE_BY_MEDIUM = new Map<string, string>([
  ['長原木', '長原木2,000円チケットでのお申し込みを確認いたしました。'],
]);
```

### mail.ts — `sendReservationConfirm`（修正。全体）
```ts
/**
 * 予約者へ確認メールを送る（QRコード添付）。
 *
 * ⚠️ LPの完了画面に「メールアドレスにも添付しております」と明記されている。
 *   ここを止めると案内と実装が食い違い、問い合わせが増える。
 */
export const sendReservationConfirm = async (
  data: ReservationMailData,
  qr: Buffer | null
): Promise<boolean> => {
  if (data.mail === '') return false;

  const lines = [
    `${data.name} 様`,
    '',
    `この度は「${data.title}」にご予約いただき、誠にありがとうございます。`,
    '以下の内容で承りました。',
    // ⚠️ 空文字は下の filter で消える（該当しない予約は従来どおり）
    CONFIRM_NOTE_BY_MEDIUM.get(data.medium) ?? '',
    '',
    `【来場日】${data.date}`,
    `【来場時間】${data.time}`,
    `【お名前】${data.name}${data.kana === '' ? '' : `（${data.kana}）`}`,
    `【電話番号】${data.phone}`,
    `【お住まいの地域】${data.address}`,
    data.area === '' ? '' : `【建築/購入希望エリア】${data.area}`,
    '【当日したいこと】',
    bulletize(data.interview),
    data.request === '' ? '' : '【マイホームのご検討】',
    data.request === '' ? '' : bulletize(data.request),
    agreeLabel(data.agree),
    '',
    '──────────────────────',
    '当日の受付について',
    '──────────────────────',
    '添付のQRコードを受付でご提示ください。スムーズにご案内できます。',
    '画像を保存いただくか、このメールをそのままご提示いただいても構いません。',
    '',
    // ⚠️ 添付を紛失したときの逃げ道。ここからQRを再表示できる
    'QRコードは下記のページでも表示できます。',
    `${RESERVATION_URL_BASE}?id=${data.id}`,
    '',
    // ⚠️ 添付が作れなかった場合に「添付があるはず」と探させない
    qr === null
      ? '※QRコードの添付に失敗しました。上記のページからご確認いただくか、受付でお名前をお伝えください。'
      : '',
    '',
    'ご不明な点がございましたら、このメールにご返信ください。',
    '',
    '国分ハウジング',
  ].filter((line) => line !== '');

  return sendMail({
    to: data.mail,
    subject: `【${data.title}】ご予約ありがとうございます`,
    text: lines.join('\n'),
    attachments:
      qr === null
        ? undefined
        : [{ filename: `${data.id}.png`, content: qr, contentType: 'image/png' }],
  });
};
```

### mail.ts — `sendInternalNotice`（修正。全体）
```ts
/**
 * 社内へ予約通知を送る（QRコード添付）。
 *
 * ⚠️ 宛先は EVENT_NOTIFY_TO（未設定なら AMBASSADOR_NOTIFY_TO）。
 *   ⚠️ どちらも空なら送らない。空のまま運用すると、
 *   ダッシュボードを見るまで誰も予約に気づけない。
 *
 * ⚠️ 社内宛にもQRを添付する。来場者がQRを紛失して問い合わせてきたときに、
 *   この通知メールから転送すれば済む（DBを見に行かなくてよい）。
 */
export const sendInternalNotice = async (
  data: ReservationMailData,
  qr: Buffer | null
): Promise<boolean> => {
  const to = env.eventNotifyTo;
  if (to.length === 0) return false;

  const customer = data.name === '' ? '氏名未入力' : `${data.name}様`;
  const suffix = NOTICE_SUBJECT_SUFFIX.get(data.medium);

  const lines = [
    `${data.title} のLPから予約が入りました。`,
    '',
    `【受付日時】${nowJst()}`,
    `【予約ID】${data.id}`,
    `【来場日】${data.date}`,
    `【来場時間】${data.time}`,
    `【お名前】${data.name}${data.kana === '' ? '' : `（${data.kana}）`}`,
    `【メールアドレス】${data.mail === '' ? '（未入力）' : data.mail}`,
    `【電話番号】${data.phone === '' ? '（未入力）' : data.phone}`,
    `【お住まいの地域】${data.address}`,
    `【建築/購入希望エリア】${data.area === '' ? '（未入力）' : data.area}`,
    '【当日したいこと】',
    bulletize(data.interview),
    '【マイホームのご検討】',
    bulletize(data.request),
    agreeLabel(data.agree),
    '',
    'ダッシュボードの「集客イベント → 反響一覧」から確認・編集できます。',
    '',
    '当日の受付用QRコードを添付しています。',
    `${RESERVATION_URL_BASE}?id=${data.id}`,
  ];

  return sendMail({
    to,
    subject: sanitizeHeader(
      `【${data.title}／予約】${customer}${suffix === undefined ? '' : `(${suffix})`}`
    ),
    text: lines.join('\n'),
    attachments:
      qr === null
        ? undefined
        : [{ filename: `${data.id}.png`, content: qr, contentType: 'image/png' }],
  });
};
```

### LP index.html — `MEDIUM_BY_PARAM` / `medium` / `buildPayload`
```js
        // URLの `?m=` の値 → 媒体名（event_db.medium）。
        //
        // ⚠️ 例: https://kh-house.jp/festa/?m=c → '長原木'
        // ⚠️ サーバー側（features/event/reservation.ts の ALLOWED_MEDIUMS）にも
        //   同じ媒体名が無いと保存されない（NULL になる）。足すときは両方直す。
        // ⚠️ Map にしているのは ?m=constructor などで Object の既定の
        //   プロパティを拾わないため
        const MEDIUM_BY_PARAM = new Map([["c", "長原木"]]);

        // ⚠️ 該当しなければ undefined（→ JSON に含まれず、サーバーは NULL で保存）
        const medium = MEDIUM_BY_PARAM.get(
          new URLSearchParams(window.location.search).get("m") || "",
        );

        // 予約データを組み立てる。
        //
        // ⚠️ チェックボックスは配列のまま送る。サーバー側でカンマ区切りに
        //   まとめている（既存データの形式に合わせるため）。
        const buildPayload = (reservationId) => {
          const formData = new FormData(form);
          return {
            medium,
            request: API_REQUEST,
            id: reservationId,
            date: formData.get("date") || "",
            time: formData.get("time") || "",
            name: formData.get("name") || "",
            kana: formData.get("kana") || "",
            mail: formData.get("mail") || "",
            phone: formData.get("phone") || "",
            address: formData.get("address") || "",
            area: formData.get("area") || "",
            interview: formData.getAll("interview[]"),
            request_type: formData.getAll("request[]"),
            agree: formData.get("agree") ? "1" : "0",
          };
        };

        const submitButton = document.getElementById("submitButton");

```

## 追補（同日）: `?m=j` → `junko` を追加
- ⚠️ `ALLOWED_MEDIUMS` に `junko` を追加（reservation.ts）。
- ⚠️ `NOTICE_SUBJECT_SUFFIX` に `junko` → `junko2,000円チケット`、`CONFIRM_NOTE_BY_MEDIUM` に `junko` → `junko2,000円チケットでのお申し込みを確認いたしました。`（mail.ts）。
- ⚠️ LP の `MEDIUM_BY_PARAM` を `new Map([["c", "長原木"], ["j", "junko"]])` に。
- ローカルで `medium: junko` を POST → event_db.medium = junko を確認、テスト行は削除。
