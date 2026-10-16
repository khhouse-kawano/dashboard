# 2026-10-12 v2.2.188 キャンペーン設定（NewCampaign.tsx）と公開フォーム（form_get）を Dashboard 風の SaaS デザインに

## 依頼（回答 2026-10-12）
- 公開フォームも直す。さらに **Dashboard 風の SaaS デザイン**に変更（NewCampaign.tsx と form_get）
- 決定事項
  - 設定画面: **左に設定のカード ＋ 右に公開フォームのプレビュー**（入力するとその場で反映）＋ 下に保存バー
  - 公開フォームの色: **ブランド色を差し色**に（ボタン・入力欄の枠・段階表示）
  - 出し方: **一度に全フォーム**（項目・並び・入力チェック・送信の動きは今と同じで、見た目だけ変える）

## 公開フォーム（`C:\Users\shinji-kawano\react\form_get`、⚠️ git 管理外）
変更前のファイルはスクラッチの `form_get_backup_2026-10-12/`（Form.tsx・Confirm.tsx・brands.ts・App.css）に退避。

| ファイル | 内容 |
|---|---|
| src/components/**publicForm.css**（新規） | 見た目のすべて（.pf-*）。白地・カード・見出しの上に入力欄・必須/任意のバッジ・48px の入力欄（16px＝iPhone で拡大されない）・差し色のフォーカス枠・段階表示（入力→確認→完了）・確認画面の一覧・特典条件の下から出るシート。動きを減らす設定にも対応 |
| src/api/**brands.ts** | `brandAccent(brand)`（差し色の表）。Dashboard の setStyleClass.ts のブランド色と同じ。⚠️ djh・2l は白い文字が読めるよう同じ色相で少し暗く |
| src/components/**Form.tsx** | 描画部分（return 以下）を作り直し。⚠️ 項目・並び・id・confirmData・送信は同じ。項目を「ご来場について／お客様情報／ご連絡先／ご住所／その他」のカードにまとめた（中の項目が全部非表示ならカードごと出さない）。`Field`（ラベル＋入力欄＋エラー）を外に定義。特典条件は state（showConditions）で開閉 |
| src/components/**Confirm.tsx** | 描画部分を作り直し（段階表示・一覧カード・送信ボタン）。⚠️ 出す項目・順番・registerData は同じ。react-bootstrap の Table は使わなくなった |

### ついでに直ったこと（既存の不具合）
- お名前・フリガナ・ご住所が **必須で未入力**のとき、confirmData は `name` / `kana` / `address` へスクロールし validation もその名前にするが、⚠️ **その id もメッセージも無く、何も起きなかった**（送れない理由が出ない）。→ まとまりに id を付け、「お名前が未入力です」などを出すようにした
- 「ご質問・ご要望」を必須にしたときの未入力メッセージが無かった → 追加

### 確認（ローカル）
- `tsc -p tsconfig.app.json --noEmit` OK
- vite の開発サーバー（⚠️ `/form/` は退避済みの build（form フォルダ）が出るため `/khg/form/` で確認）＋ Playwright で、⚠️ **外部への通信をすべて止め、設定は偽物を返して**表示（本番の form_show などには書いていない）
  - PC 幅・スマホ幅（390px）の入力画面、未入力のエラー（赤枠＋メッセージ）、確認画面（LINE ID の空白が除かれて表示）
- 送信（registerData）は押していない

## Dashboard（frontend/src/components/Campaign）
| ファイル | 内容 |
|---|---|
| **NewCampaign.tsx** | 描画部分を作り直し。`FormState` を export（プレビュー用）。保存（postForm）・読み込み・入力チェック・送る中身（form）は同じ。部品を外に定義: `Switch` / `Segmented` / `TextField` / `FieldItem` / `OptionList`。中で `patch()`（項目の設定の一部だけ書き換え）・`setFlag()`（表示・必須だけ）・`item()`（項目の行）。メール文面の編集欄（mailTemplateEditor）は見た目だけ変更。`Table` の import と `newShop` / `newTime` / `newMedium` を削除（OptionList が持つ） |
| **newCampaign.css**（新規） | 設定画面の見た目（.nc-*）。Dashboard の配色（#5e72e4 / #32325d / #f8f9fe）。書体はゴシック（Dashboard 全体の書体だと入力欄が明朝になるため） |
| **formPreview.tsx**（新規） | プレビュー。公開フォームの Form.tsx と同じまとまり・並び。入力はできない。ロゴと差し色の表は form_get の brands.ts と同じ |
| **formPreview.css**（新規） | ⚠️ 公開フォームの publicForm.css の **写し**（同じ見た目にするため）。⚠️ 公開フォーム側を変えたら置き換えること |

### ついでに直ったこと（既存の不具合）
- 項目の「表示する」チェック（shop / date / medium 以外）が `changeForm(項目名)` で ⚠️ **項目の設定ごと '' に上書き**していた（外すと文言・必須が消え、付け直しても戻らない。公開フォームでは欄が消える）→ `setFlag()` で bool だけ書き換える
- 販促媒体の選択肢の編集・追加が ⚠️ `...prev.shop` を広げていたため、**来場希望場所の設定が販促媒体に混ざっていた** → OptionList で販促媒体だけを書き換える
- 「来場希望時間」の追加欄に入力するたびに時間の選択肢を作り直していた → OptionList に置き換え

### 確認（ローカル）
- eslint: 新規の警告なし、`npm run build` 成功 → **`main.d3804e4d.js` ／ ⚠️ CSS も変わる `main.8804e4b8.css`**
- ビルド済みを手元で /dashboard/ として配り、Playwright で ⚠️ **API への POST はすべて偽物の応答**で表示（① ② には送っていない）
  - キャンペーン修正の画面（基本情報・通知とメール・フォーム項目・注意事項）とプレビュー、「住所」の表示をオンにするとその場で中身が出る
- 保存ボタンは押していない（保存処理は変えていない）

## 差分: 公開フォーム（退避した元のファイルとの差。⚠️ LINE ID の分 ＝ task-04 も含む）
```diff
--- C:/Users/SHINJI~1/AppData/Local/Temp/claude/c--Users-shinji-kawano-react-dashboard/f17ffd00-1ebc-4533-a8d9-ede3c6283bd3/scratchpad/form_get_backup_2026-10-12/Form.tsx	2026-10-12 11:12:46.466047500 +0900
+++ /c/Users/shinji-kawano/react/form_get/src/components/Form.tsx	2026-10-12 11:25:37.913988300 +0900
@@ -1,901 +1,826 @@
-import { useLocation, useNavigate } from "react-router-dom";
-import { useState, useEffect } from "react";
-import axios from "axios";
-import { post as postToGateway } from "../api/gateway";
-import { brandLogo } from "../api/brands";
-import { FaArrowRotateLeft } from "react-icons/fa6";
-
-type Form = {
-    brand: string;
-    campaign: string;
-    campaign_id: string;
-    mail_to: string;
-    mail_cc: string;
-    redirect: string;
-    thanks: boolean | null;
-    notice: {
-        bool: boolean | null,
-        text: string
-    }
-    shop: {
-        bool: boolean | null,
-        required: boolean | null,
-        text: string,
-        shopName: string[],
-        /**
-         * ⚠️⚠️ **聞かない（bool=false）ときに、代わりに送る値。**
-         *   ⚠️ 既存の設定にはこのキーが無いので **必ず `?? ''` で読むこと**。
-         *   ⚠️ ダッシュボードの「キャンペーン作成」で指定する。
-         *     ⚠️ **片方だけ直さないこと。** 指定したのに送られない状態になる。
-         */
-        default?: string
-    }
-    date: {
-        bool: boolean | null,
-        required: boolean | null,
-        text_day: string,
-        text_time: string,
-        time: string[]
-    }
-    name: {
-        bool: boolean | null,
-        required: boolean | null,
-        text_sei: string,
-        text_mei: string
-    }
-    kana: {
-        bool: boolean | null,
-        required: boolean | null,
-        text_sei: string,
-        text_mei: string
-    }
-    age: {
-        bool: boolean | null,
-        required: boolean | null,
-        text: string
-    }
-    phone: {
-        bool: boolean | null,
-        required: boolean | null,
-        text: string
-    }
-    mail: {
-        bool: boolean | null,
-        required: boolean | null,
-        text: string
-    }
-    address: {
-        bool: boolean | null,
-        required: boolean | null,
-        text_zip: string,
-        text_pref: string,
-        text_city: string,
-        text_town: string,
-        text_street: string
-    }
-    question: {
-        bool: boolean | null,
-        required: boolean | null,
-        text: string
-    }
-    attention: {
-        bool: boolean | null,
-        text: string,
-        bool_red: boolean | null,
-        text_red: string
-    }
-    medium: {
-        bool: boolean | null,
-        required: boolean | null,
-        text: string,
-        mediumName: string[]
-    }
-};
-
-type PostData = {
-    shop: string;
-    date: string;
-    time: string;
-    sei: string;
-    mei: string;
-    seiKana: string;
-    meiKana: string;
-    age: string;
-    phone: string;
-    mail: string;
-    zip: string;
-    pref: string;
-    city: string;
-    town: string;
-    street: string;
-    medium: string;
-    question: string;
-    brand: string;
-    campaign: string;
-    campaign_id: string;
-    mail_to: string;
-    mail_cc: string;
-    redirect: string;
-    thanks: boolean;
-};
-
-type Param = { campaign_id: string | null, brand: string | null, url: string, source: string | null, campaign: string | null, device: string | null }
-
-const Confirm = () => {
-    const location = useLocation();
-    const queryParams = new URLSearchParams(location.search);
-    const href = window.parent.location.href.toLowerCase();
-    const parentUrl = window.parent.location.href;
-    const urlObj = new URL(parentUrl);
-    const parentQueryParams = new URLSearchParams(urlObj.search);
-    const sourceMap = [
-        { key: "utm_source", value: parentQueryParams.get("utm_source") },
-        { key: "fbclid", value: "Facebook/Instagram" },
-        { key: "gclid", value: "Google" },
-        { key: "wbraid", value: "Google" },
-        { key: "gbraid", value: "Google" },
-        { key: "yclid", value: "Yahoo" },
-        { key: "flyer", value: "Flyer" },
-    ];
-
-    const sourceValue = sourceMap.find(s => href.includes(s.key))?.value || "";
-
-    console.log(parentQueryParams.get('utm_campaign'));
-
-    let sourceCampaign;
-    if (parentQueryParams.get('utm_campaign')) {
-        sourceCampaign = parentQueryParams.get('utm_campaign');
-    } else {
-        sourceCampaign = ''
-    }
-
-    const ua = navigator.userAgent.toLowerCase();
-    const deviceValue = /mobile|android|iphone|ipad/.test(ua) ? 'mobile' : 'desktop';
-
-    const getParam: Param = {
-        campaign_id: queryParams.get('id'),
-        brand: queryParams.get('brand'),
-        url: window.parent.location.href,
-        source: sourceValue,
-        campaign: sourceCampaign,
-        device: deviceValue
-    };
-
-    const navigate = useNavigate();
-    /**
-     * ⚠️ フォーム設定を読めなかったときに立てる。
-     *   ⚠️ 以前は読めないと**画面が真っ白**になり、
-     *     見ている人にも問い合わせを受けた側にも原因が分からなかった。
-     */
-    const [loadError, setLoadError] = useState(false);
-
-    const [form, setForm] = useState<Form>({
-        brand: '',
-        campaign: '',
-        campaign_id: '',
-        mail_to: '',
-        mail_cc: '',
-        thanks: null,
-        redirect: '',
-        notice: {
-            bool: null,
-            text: ''
-        },
-        shop: {
-            bool: null,
-            required: null,
-            text: '',
-            shopName: [],
-            default: ''
-        },
-        date: {
-            bool: null,
-            required: null,
-            text_day: '',
-            text_time: '',
-            time: []
-        },
-        name: {
-            bool: null,
-            required: null,
-            text_sei: '',
-            text_mei: ''
-        },
-        kana: {
-            bool: null,
-            required: null,
-            text_sei: '',
-            text_mei: ''
-        },
-        age: {
-            bool: null,
-            required: null,
-            text: ''
-        },
-        phone: {
-            bool: null,
-            required: null,
-            text: ''
-        },
-        mail: {
-            bool: null,
-            required: null,
-            text: ''
-        },
-        address: {
-            bool: null,
-            required: null,
-            text_zip: '',
-            text_pref: '',
-            text_city: '',
-            text_town: '',
-            text_street: ''
-        },
-        medium: {
-            bool: null,
-            required: null,
-            text: '',
-            mediumName: []
-        },
-        question: {
-            bool: null,
-            required: null,
-            text: ''
-        },
-        attention: {
-            bool: null,
-            text: '',
-            bool_red: null,
-            text_red: ''
-        },
-    });
-
-    const [postData, setPostData] = useState<PostData>({
-        shop: '',
-        date: '',
-        time: '',
-        sei: '',
-        mei: '',
-        seiKana: '',
-        meiKana: '',
-        age: '',
-        phone: '',
-        mail: '',
-        zip: '',
-        pref: '',
-        city: '',
-        town: '',
-        street: '',
-        medium: '',
-        question: '',
-        brand: '',
-        campaign: '',
-        campaign_id: '',
-        mail_to: '',
-        mail_cc: '',
-        redirect: '',
-        thanks: true,
-    });
-
-    // ⚠️ ロゴの分岐は src/api/brands.ts へ集約した（Confirm.tsx と共通）
-    const imgCode = brandLogo(getParam.brand);
-
-    useEffect(() => {
-        console.log(getParam);
-        const fetchData = async () => {
-            try {
-                // ⚠️⚠️ 通信先の分岐は src/api/gateway.ts へ移した。
-                //   ⚠️ ② を叩き、失敗したら ①（移行前と同じ経路）へ回す。
-                //   ⚠️ ここに URL を書き戻さないこと。Confirm.tsx と食い違う。
-
-                if (sourceValue) {
-                    window.parent.localStorage.setItem("source", sourceValue);
-                } else if (window.parent.localStorage.getItem("source")) {
-                    getParam.source = window.parent.localStorage.getItem("source");
-                } else {
-                    getParam.source = '';
-                }
-
-                if (sourceCampaign) {
-                    window.parent.localStorage.setItem("campaign", sourceCampaign);
-                } else if (window.parent.localStorage.getItem("campaign")) {
-                    getParam.campaign = window.parent.localStorage.getItem("campaign");
-                } else {
-                    getParam.campaign = '';
-                }
-
-                window.parent.localStorage.setItem("url", window.parent.location.href);
-
-                const response = await postToGateway('form_get', String(getParam.brand ?? ''), getParam);
-                const row = response.data.data;
-
-                /**
-                 * ⚠️⚠️ **設定が取れなかったときに落とさない。**
-                 *   ⚠️ 以前は `response.data.data.address` を直接読んでいたため、
-                 *     キャンペーンIDが間違っていると `data` が null で
-                 *     **実行時エラーになり、フォームが何も表示されなかった**。
-                 *   ⚠️ 原因が画面に出ないので、問い合わせを受けても調べようがなかった。
-                 */
-                if (!row) {
-                    console.error(
-                        `[form] フォーム設定が見つかりません brand="${getParam.brand}" id="${getParam.campaign_id}"`
-                    );
-                    setLoadError(true);
-                    return;
-                }
-
-                /**
-                 * ⚠️ JSON 列は文字列で入っている。
-                 *   ⚠️ 中身が壊れている行が1つでもあると JSON.parse が投げ、
-                 *     **フォーム全体が出なくなる**。項目ごとに受け止める。
-                 */
-                const parse = <T,>(value: string | undefined, fallback: T): T => {
-                    if (!value) return fallback;
-                    try {
-                        return JSON.parse(value) as T;
-                    } catch {
-                        console.error(`[form] 設定の解釈に失敗しました: ${value.slice(0, 80)}`);
-                        return fallback;
-                    }
-                };
-
-                await setForm({
-                    address: parse(row.address, form.address),
-                    age: parse(row.age, form.age),
-                    brand: row.brand ?? '',
-                    campaign: row.campaign ?? '',
-                    campaign_id: row.campaign_id ?? '',
-                    date: parse(row.date, form.date),
-                    kana: parse(row.kana, form.kana),
-                    mail: parse(row.mail, form.mail),
-                    /**
-                     * ⚠️⚠️ **返ってきた値をそのまま持つ。空で固定しないこと。**
-                     *
-                     *   ⚠️ ② は `mail_to` / `mail_cc` を**返さない**（返すと誰でも読める）。
-                     *     → ここは空になり、送信時も空で送られるが、
-                     *       ② が `form_table` から引くので**問題ない**。
-                     *
-                     *   ⚠️⚠️ ② が落ちて ① へ退避したときは話が別で、
-                     *     ① は**リクエストの宛先しか見ない**。
-                     *     ⚠️ ここで空に固定すると、退避したときに
-                     *       **社内通知が1通も飛ばなくなる**（しかも気づけない）。
-                     *
-                     *   ⚠️ ① の応答には宛先が含まれるので、そのまま受け取れば
-                     *     退避時だけ宛先が埋まる。**この形を崩さないこと。**
-                     */
-                    mail_cc: row.mail_cc ?? '',
-                    mail_to: row.mail_to ?? '',
-                    medium: parse(row.medium, form.medium),
-                    name: parse(row.name, form.name),
-                    notice: parse(row.notice, form.notice),
-                    phone: parse(row.phone, form.phone),
-                    question: parse(row.question, form.question),
-                    redirect: row.redirect ?? '',
-                    shop: parse(row.shop, form.shop),
-                    thanks: Boolean(Number(row.thanks ?? 0)),
-                    attention: parse(row.attention, form.attention)
-                });
-            } catch (error) {
-                console.error("データ取得エラー:", error);
-            }
-        };
-
-        fetchData();
-    }, [])
-
-    useEffect(() => {
-        setPostData((prev) => ({
-            ...prev,
-            brand: form.brand === 'nagomi' ? 'なごみ' : form.brand,
-            /**
-             * ⚠️⚠️ **聞かない項目に既定値が指定されていれば、それを送る。**
-             *   ⚠️ 聞いている（bool=true）ときは**上書きしない**。
-             *     上書きすると、利用者が選んだ値が消える。
-             *   ⚠️ 既定値が空なら今までどおり何も入らない。
-             */
-            ...(form.shop.bool || !(form.shop.default ?? '') ? {} : { shop: form.shop.default }),
-            campaign: form.campaign,
-            campaign_id: form.campaign_id,
-            mail_to: form.mail_to,
-            mail_cc: form.mail_cc,
-            redirect: form.redirect,
-            thanks: Boolean(form.thanks)
-        }));
-    }, [form]);
-
-    useEffect(() => {
-        const handleBeforeUnload = () => {
-            const { brand, campaign_id, campaign, mail_cc, mail_to, redirect, thanks, ...filtered } = postData;
-            const filledKeys = Object.entries(filtered)
-                .filter(([_, value]) => value !== "")
-                .map(([key]) => key);
-
-            if (filledKeys.length > 0) {
-                const data = {
-                    time: new Date().toISOString(),
-                    brand: getParam.brand,
-                    campaign: postData.campaign,
-                    filled: filledKeys.join(",")
-                };
-
-                navigator.sendBeacon(
-                    "https://sync-pg-cloud-9f739ab131ed.herokuapp.com/api/breakaway",
-                    JSON.stringify(data)
-                );
-            }
-        };
-
-        window.addEventListener("beforeunload", handleBeforeUnload);
-        return () => window.removeEventListener("beforeunload", handleBeforeUnload);
-    }, [postData]);
-
-
-    const [zipcode, setZipcode] = useState("");
-    const [addressValue, setAddressValue] = useState("");
-    const [validation, setValidation] = useState<string>('');
-
-    const searchAddress = async () => {
-        try {
-            const res = await axios.get("https://zipcloud.ibsnet.co.jp/api/search", {
-                params: { zipcode }
-            });
-            const result = res.data.results?.[0];
-            if (result) {
-                setAddressValue(`${result.address1}${result.address2}${result.address3}`);
-                setPostData(prev => {
-                    return {
-                        ...prev,
-                        pref: result.address1,
-                        city: result.address2,
-                        town: result.address3
-                    };
-                });
-            } else {
-                setAddressValue("住所が見つかりませんでした");
-            }
-        } catch (error) {
-            console.error("郵便番号検索エラー:", error);
-            setAddressValue("検索に失敗しました");
-        }
-    };
-
-    const confirmData = async () => {
-        await setValidation('');
-        const requiredKeys = Object.entries(form)
-            .filter(([_, value]) => {
-                try {
-                    const parsed = typeof value === 'string' ? JSON.parse(value) : value;
-                    return typeof parsed === 'object' && parsed !== null &&
-                        parsed.required === true && parsed.bool === true;
-                } catch {
-                    return false;
-                }
-            })
-            .map(([key]) => key);
-
-        const missingKeys = requiredKeys.filter((key) => {
-            const value = postData[key as keyof typeof postData];
-            if (key === 'name') {
-                return !postData.sei.trim() || !postData.mei.trim();
-            }
-            if (key === 'kana') {
-                return !postData.seiKana.trim() || !postData.meiKana.trim();
-            }
-            if (key === 'address') {
-                return !postData.zip.trim() || !postData.pref.trim() || !postData.city.trim() || !postData.town.trim() || !postData.street.trim();
-            }
-            return typeof value === 'string' && !value.trim();
-        });
-
-        if (missingKeys.length > 0) {
-            await document.getElementById(missingKeys[0])?.scrollIntoView({ behavior: 'smooth' });
-            await setValidation(missingKeys[0]);
-            return;
-        }
-
-        if (postData.phone) {
-            const formattedNumber = postData.phone.replace(/\D/g, '');
-            const isHalfWidthNumber = (number: string): boolean => {
-                return /^[0-9]+$/.test(number);
-            };
-            if (!isHalfWidthNumber(formattedNumber) || formattedNumber.length < 10) {
-                await setValidation('phone_wrong');
-                await document.getElementById('phone')?.scrollIntoView({ behavior: 'smooth' });
-            }
-        }
-
-
-        if (postData.mail) {
-            const mailValue = postData.mail;
-            const isEmail = (mail: string): boolean => {
-                const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
-                return emailRegex.test(mail);
-            };
-            if (!isEmail(mailValue)) {
-                await setValidation('mail_wrong');
-                await document.getElementById('mail')?.scrollIntoView({ behavior: 'smooth' });
-                return;
-            }
-
-        }
-
-        if (postData.zip) {
-            const formattedZip = postData.zip.replace(/\D/g, '');
-            if (formattedZip.length < 7) {
-                await setValidation('zip_wrong');
-                await document.getElementById('zip')?.scrollIntoView({ behavior: 'smooth' });
-                return;
-            }
-        }
-
-        const confirmedData = {
-            ...postData,
-            url: window.parent.location.href,
-            source: sourceValue,
-            campaignName: sourceCampaign
-        };
-
-        console.log(confirmedData);
-        await navigate('/confirm', {
-            state: confirmedData
-        });
-    };
-
-    return (
-        <div className="bg-white w-100">
-            {/**
-              * ⚠️⚠️ **失敗したら回し続けない。**
-              *   ⚠️ 以前は `!form.campaign` だけを見ていたため、設定が取れないと
-              *     「フォーム読み込み中」が**永久に回り続けていた**。
-              *   ⚠️ 見ている人は待ち続け、問い合わせを受けた側も原因が分からない。
-              */}
-            {loadError ? <div style={{ fontSize: '14px', textAlign: 'center', padding: '50px', lineHeight: 1.8 }}>
-                フォームを読み込めませんでした。<br />
-                お手数ですが、ページを再読み込みしてください。<br />
-                繰り返す場合はお電話でお問い合わせください。
-            </div> :
-                !form.campaign ? <div style={{ fontSize: '14px', textAlign: 'center', padding: '50px' }}><FaArrowRotateLeft style={{ marginRight: '10px' }} className='spin' />フォーム読み込み中</div> :
-                <div style={{ width: '90%', maxWidth: '768px', margin: '0 auto' }}>
-                    <div style={{ width: '40%', minWidth: '300px', margin: '50px auto' }}>
-                        <img src={imgCode} className="w-100" />
-                    </div>
-                    {!form.notice.bool || <div style={{ fontSize: '13px', letterSpacing: '1px', textAlign: 'justify' }}>{form.notice.text}</div>}
-                    {!form.shop.bool ||
-                        <div className="my-3">
-                            <div>
-                                <label style={{ width: '100%', borderRadius: '7px', fontSize: '10px', letterSpacing: '.7px' }}>{!form.shop.required || <span style={{ backgroundColor: 'red', padding: '2px 8px', color: '#fff', borderRadius: '10px', fontSize: '10px', marginRight: '2px' }}>必須</span>}{form.shop.text}</label>
-                            </div>
-                            <div>
-                                <select id='shop' style={{ width: '100%', height: '40px', borderRadius: '7px', fontSize: '14px', letterSpacing: '.7px', border: '1px solid #D3D3D3' }}
-                                    value={postData.shop}
-                                    onChange={(e) => setPostData((prev) => ({
-                                        ...prev,
-                                        shop: e.target.value
-                                    })
-                                    )}>
-                                    <option value="">選択してください</option>
-                                    {form.shop.shopName.map((item, index) =>
-                                        <option key={index}>{item}</option>
-                                    )}
-                                </select>
-                            </div>
-                            {validation !== 'shop' || <div style={{ fontSize: '11px', letterSpacing: '.7px', marginBottom: '5px', color: 'red' }}>来場希望場所が未入力です</div>}
-                        </div>}
-                    {!form.date.bool ||
-                        <div className="row my-3">
-                            <div className="col">
-                                <div>
-                                    <label style={{ width: '100%', borderRadius: '7px', fontSize: '10px', letterSpacing: '.7px' }}>{!form.date.required || <span style={{ backgroundColor: 'red', padding: '2px 8px', color: '#fff', borderRadius: '10px', fontSize: '10px', marginRight: '2px' }}>必須</span>}{form.date.text_day}</label>
-                                </div>
-                                <div >
-                                    <input id='date' type="date" style={{ height: '40px', borderRadius: '7px', fontSize: '14px', letterSpacing: '.7px', width: '100%', border: '1px solid #D3D3D3' }}
-                                        value={postData.date}
-                                        onChange={(e) => setPostData((prev) => ({
-                                            ...prev,
-                                            date: e.target.value
-                                        })
-                                        )} />
-                                </div>
-                                {validation !== 'date' || <div style={{ fontSize: '11px', letterSpacing: '.7px', marginBottom: '5px', color: 'red' }}>来場希望日が未入力です</div>}
-                            </div>
-                            <div className="col">
-                                <div>
-                                    <label style={{ width: '100%', borderRadius: '7px', fontSize: '10px', letterSpacing: '.7px' }}>{!form.date.required || <span style={{ backgroundColor: 'red', padding: '2px 8px', color: '#fff', borderRadius: '10px', fontSize: '10px', marginRight: '2px' }}>必須</span>}{form.date.text_time}</label>
-                                </div>
-                                <div>
-                                    <select id='time' style={{ height: '40px', borderRadius: '7px', fontSize: '14px', letterSpacing: '.7px', width: '100%', border: '1px solid #D3D3D3' }}
-                                        value={postData.time}
-                                        onChange={(e) => setPostData((prev) => ({
-                                            ...prev,
-                                            time: e.target.value
-                                        })
-                                        )}>
-                                        <option value="">選択してください</option>
-                                        {form.date.time.map((item, index) =>
-                                            <option key={index}>{item}</option>
-                                        )}
-                                    </select>
-                                </div>
-                                {validation !== 'time' || <div style={{ fontSize: '11px', letterSpacing: '.7px', marginBottom: '5px', color: 'red' }}>来場希望時間が未入力です</div>}
-                            </div>
-                        </div>}
-                    {!form.name.bool ||
-                        <div className="row my-3">
-                            <div className="col">
-                                <div>
-                                    <label style={{ width: '100%', borderRadius: '7px', fontSize: '10px', letterSpacing: '.7px' }}>{!form.name.required || <span style={{ backgroundColor: 'red', padding: '2px 8px', color: '#fff', borderRadius: '10px', fontSize: '10px', marginRight: '2px' }}>必須</span>}{form.name.text_sei}</label>
-                                </div>
-                                <div >
-                                    <input id='sei' type="text" style={{ height: '40px', borderRadius: '7px', fontSize: '14px', letterSpacing: '.7px', width: '100%', border: '1px solid #D3D3D3' }}
-                                        value={postData.sei}
-                                        onChange={(e) => setPostData((prev) => ({
-                                            ...prev,
-                                            sei: e.target.value
-                                        })
-                                        )} />
-                                </div>
-                                {validation !== 'sei' || <div style={{ fontSize: '11px', letterSpacing: '.7px', marginBottom: '5px', color: 'red' }}>お名前(姓)が未入力です</div>}
-                            </div>
-                            <div className="col">
-                                <div>
-                                    <label style={{ width: '100%', borderRadius: '7px', fontSize: '10px', letterSpacing: '.7px' }}>{!form.name.required || <span style={{ backgroundColor: 'red', padding: '2px 8px', color: '#fff', borderRadius: '10px', fontSize: '10px', marginRight: '2px' }}>必須</span>}{form.name.text_mei}</label>
-                                </div>
-                                <div >
-                                    <input id='mei' type="text" style={{ height: '40px', borderRadius: '7px', fontSize: '14px', letterSpacing: '.7px', width: '100%', border: '1px solid #D3D3D3' }}
-                                        value={postData.mei}
-                                        onChange={(e) => setPostData((prev) => ({
-                                            ...prev,
-                                            mei: e.target.value
-                                        })
-                                        )} />
-                                </div>
-                                {validation !== 'mei' || <div style={{ fontSize: '11px', letterSpacing: '.7px', marginBottom: '5px', color: 'red' }}>お名前(名)が未入力です</div>}
-                            </div>
-                        </div>}
-                    {!form.kana.bool ||
-                        <div className="row my-3">
-                            <div className="col">
-                                <div>
-                                    <label style={{ width: '100%', borderRadius: '7px', fontSize: '10px', letterSpacing: '.7px' }}>{!form.kana.required || <span style={{ backgroundColor: 'red', padding: '2px 8px', color: '#fff', borderRadius: '10px', fontSize: '10px', marginRight: '2px' }}>必須</span>}{form.kana.text_sei}</label>
-                                </div>
-                                <div >
-                                    <input id='seiKana' type="text" style={{ height: '40px', borderRadius: '7px', fontSize: '14px', letterSpacing: '.7px', width: '100%', border: '1px solid #D3D3D3' }}
-                                        value={postData.seiKana}
-                                        onChange={(e) => setPostData((prev) => ({
-                                            ...prev,
-                                            seiKana: e.target.value
-                                        })
-                                        )} />
-                                </div>
-                                {validation !== 'seiKana' || <div style={{ fontSize: '11px', letterSpacing: '.7px', marginBottom: '5px', color: 'red' }}>お名前(セイ)が未入力です</div>}
-                            </div>
-                            <div className="col">
-                                <div>
-                                    <label style={{ width: '100%', borderRadius: '7px', fontSize: '10px', letterSpacing: '.7px' }}>{!form.kana.required || <span style={{ backgroundColor: 'red', padding: '2px 8px', color: '#fff', borderRadius: '10px', fontSize: '10px', marginRight: '2px' }}>必須</span>}{form.kana.text_mei}</label>
-                                </div>
-                                <div >
-                                    <input id='meiKana' type="text" style={{ height: '40px', borderRadius: '7px', fontSize: '14px', letterSpacing: '.7px', width: '100%', border: '1px solid #D3D3D3' }}
-                                        value={postData.meiKana}
-                                        onChange={(e) => setPostData((prev) => ({
-                                            ...prev,
-                                            meiKana: e.target.value
-                                        })
-                                        )} />
-                                </div>
-                                {validation !== 'meiKana' || <div style={{ fontSize: '11px', letterSpacing: '.7px', marginBottom: '5px', color: 'red' }}>お名前(メイ)が未入力です</div>}
-                            </div>
-                        </div>}
-                    {!form.age.bool ||
-                        <div className="row my-3">
-                            <div className="col">
-                                <div>
-                                    <label style={{ width: '100%', borderRadius: '7px', fontSize: '10px', letterSpacing: '.7px' }}>{!form.age.required || <span style={{ backgroundColor: 'red', padding: '2px 8px', color: '#fff', borderRadius: '10px', fontSize: '10px', marginRight: '2px' }}>必須</span>}{form.age.text}</label>
-                                </div>
-                                <div >
-                                    <input id='age' type="text" style={{ height: '40px', borderRadius: '7px', fontSize: '14px', letterSpacing: '.7px', width: '100%', border: '1px solid #D3D3D3' }}
-                                        value={postData.age}
-                                        onChange={(e) => setPostData((prev) => ({
-                                            ...prev,
-                                            age: e.target.value
-                                        })
-                                        )} />
-                                </div>
-                                {validation !== 'age' || <div style={{ fontSize: '11px', letterSpacing: '.7px', marginBottom: '5px', color: 'red' }}>ご年齢が未入力です</div>}
-                            </div>
-                            <div className="col">
-                            </div>
-                        </div>}
-                    {!form.phone.bool ||
-                        <div className="my-3">
-                            <div>
-                                <label style={{ width: '100%', borderRadius: '7px', fontSize: '10px', letterSpacing: '.7px' }}>{!form.phone.required || <span style={{ backgroundColor: 'red', padding: '2px 8px', color: '#fff', borderRadius: '10px', fontSize: '10px', marginRight: '2px' }}>必須</span>}{form.phone.text}</label>
-                            </div>
-                            <div>
-                                <input id='phone' type="text" style={{ height: '40px', borderRadius: '7px', fontSize: '14px', letterSpacing: '.7px', width: '100%', border: '1px solid #D3D3D3' }}
-                                    value={postData.phone}
-                                    onChange={(e) => setPostData((prev) => ({
-                                        ...prev,
-                                        phone: e.target.value
-                                    })
-                                    )} />
-                            </div>
-                            {validation !== 'phone' || <div style={{ fontSize: '11px', letterSpacing: '.7px', marginBottom: '5px', color: 'red' }}>携帯番号が未入力です</div>}
-                            {validation !== 'phone_wrong' || <div style={{ fontSize: '11px', letterSpacing: '.7px', marginBottom: '5px', color: 'red' }}>正しく入力してください</div>}
-                        </div>}
-                    {!form.mail.bool ||
-                        <div className="my-3">
-                            <div>
-                                <label style={{ width: '100%', borderRadius: '7px', fontSize: '10px', letterSpacing: '.7px' }}>{!form.mail.required || <span style={{ backgroundColor: 'red', padding: '2px 8px', color: '#fff', borderRadius: '10px', fontSize: '10px', marginRight: '2px' }}>必須</span>}{form.mail.text}</label>
-                            </div>
-                            <div>
-                                <input id='mail' type="mail" style={{ height: '40px', borderRadius: '7px', fontSize: '14px', letterSpacing: '.7px', width: '100%', border: '1px solid #D3D3D3' }}
-                                    value={postData.mail}
-                                    onChange={(e) => setPostData((prev) => ({
-                                        ...prev,
-                                        mail: e.target.value
-                                    })
-                                    )} />
-                            </div>
-                            {validation !== 'mail' || <div style={{ fontSize: '11px', letterSpacing: '.7px', marginBottom: '5px', color: 'red' }}>メールアドレスが未入力です</div>}
-                            {validation !== 'mail_wrong' || <div style={{ fontSize: '11px', letterSpacing: '.7px', marginBottom: '5px', color: 'red' }}>正しく入力してください</div>}
-                        </div>}
-                    {!form.address.bool ||
-                        <div className="my-3">
-                            <div className="row d-flex align-items-end">
-                                <div className="col">
-                                    <div>
-                                        <label style={{ width: '100%', borderRadius: '7px', fontSize: '10px', letterSpacing: '.7px' }}>{!form.address.required || <span style={{ backgroundColor: 'red', padding: '2px 8px', color: '#fff', borderRadius: '10px', fontSize: '10px', marginRight: '2px' }}>必須</span>}{form.address.text_zip}</label>
-                                    </div>
-                                    <div >
-                                        <input id='zip' type="text" style={{ height: '40px', borderRadius: '7px', fontSize: '14px', letterSpacing: '.7px', width: '100%', border: '1px solid #D3D3D3' }} pattern="\d{7,}"
-                                            value={postData.zip}
-                                            onChange={(e) => {
-                                                setZipcode(e.target.value);
-                                                setPostData((prev) => ({
-                                                    ...prev,
-                                                    zip: e.target.value
-                                                }));
-                                            }} />
-                                    </div>
-                                    {validation !== 'zip' || <div style={{ fontSize: '11px', letterSpacing: '.7px', marginBottom: '5px', color: 'red' }}>郵便番号が未入力です</div>}
-                                    {validation !== 'zip_wrong' || <div style={{ fontSize: '11px', letterSpacing: '.7px', marginBottom: '5px', color: 'red' }}>正しく入力してください</div>}
-                                </div>
-                                <div className="col">
-                                    {addressValue !== '住所が見つかりませんでした' || <div style={{ fontSize: '10px', letterSpacing: '.7px', marginBottom: '5px', color: 'red' }}>住所が見つかりませんでした</div>}
-                                    <div><button type="button" className="btn btn-primary zip_button" id="search_button" onClick={() => searchAddress()}>郵便番号検索</button></div>
-                                </div>
-                            </div>
-                            <div className="row my-3">
-                                <div className="col">
-                                    <div>
-                                        <label style={{ width: '100%', borderRadius: '7px', fontSize: '10px', letterSpacing: '.7px' }}>{!form.address.required || <span style={{ backgroundColor: 'red', padding: '2px 8px', color: '#fff', borderRadius: '10px', fontSize: '10px', marginRight: '2px' }}>必須</span>}{form.address.text_pref}</label>
-                                    </div>
-                                    <div >
-                                        <input id='pref' type="text" style={{ height: '40px', borderRadius: '7px', fontSize: '14px', letterSpacing: '.7px', width: '100%', border: '1px solid #D3D3D3' }}
-                                            value={postData.pref}
-                                            onChange={(e) => setPostData((prev) => ({
-                                                ...prev,
-                                                pref: e.target.value
-                                            })
-                                            )} />
-                                    </div>
-                                    {validation !== 'pref' || <div style={{ fontSize: '11px', letterSpacing: '.7px', marginBottom: '5px', color: 'red' }}>都道府県名が未入力です</div>}
-                                </div>
-                                <div className="col">
-                                    <div>
-                                        <label style={{ width: '100%', borderRadius: '7px', fontSize: '10px', letterSpacing: '.7px' }}>{!form.address.required || <span style={{ backgroundColor: 'red', padding: '2px 8px', color: '#fff', borderRadius: '10px', fontSize: '10px', marginRight: '2px' }}>必須</span>}{form.address.text_city}</label>
-                                    </div>
-                                    <div >
-                                        <input id='city' type="text" style={{ height: '40px', borderRadius: '7px', fontSize: '14px', letterSpacing: '.7px', width: '100%', border: '1px solid #D3D3D3' }}
-                                            value={postData.city}
-                                            onChange={(e) => setPostData((prev) => ({
-                                                ...prev,
-                                                city: e.target.value
-                                            })
-                                            )} />
-                                    </div>
-                                    {validation !== 'city' || <div style={{ fontSize: '11px', letterSpacing: '.7px', marginBottom: '5px', color: 'red' }}>市・区名が未入力です</div>}
-                                </div>
-                            </div>
-                            <div className="row my-3">
-                                <div>
-                                    <label style={{ width: '100%', borderRadius: '7px', fontSize: '10px', letterSpacing: '.7px' }}>{!form.address.required || <span style={{ backgroundColor: 'red', padding: '2px 8px', color: '#fff', borderRadius: '10px', fontSize: '10px', marginRight: '2px' }}>必須</span>}{form.address.text_town}</label>
-                                </div>
-                                <div >
-                                    <input id='town' type="text" style={{ height: '40px', borderRadius: '7px', fontSize: '14px', letterSpacing: '.7px', width: '100%', border: '1px solid #D3D3D3' }}
-                                        value={postData.town}
-                                        onChange={(e) => setPostData((prev) => ({
-                                            ...prev,
-                                            town: e.target.value
-                                        })
-                                        )} />
-                                </div>
-                                {validation !== 'town' || <div style={{ fontSize: '11px', letterSpacing: '.7px', marginBottom: '5px', color: 'red' }}>町村名が未入力です</div>}
-                            </div>
-                            <div>
-                                <div>
-                                    <label style={{ width: '100%', borderRadius: '7px', fontSize: '10px', letterSpacing: '.7px' }}>{!form.address.required || <span style={{ backgroundColor: 'red', padding: '2px 8px', color: '#fff', borderRadius: '10px', fontSize: '10px', marginRight: '2px' }}>必須</span>}{form.address.text_street}</label>
-                                </div>
-                                <div >
-                                    <input id='street' type="text" style={{ height: '40px', borderRadius: '7px', fontSize: '14px', letterSpacing: '.7px', width: '100%', border: '1px solid #D3D3D3' }}
-                                        value={postData.street}
-                                        onChange={(e) => setPostData((prev) => ({
-                                            ...prev,
-                                            street: e.target.value
-                                        })
-                                        )} />
-                                </div>
-                                {validation !== 'street' || <div style={{ fontSize: '11px', letterSpacing: '.7px', marginBottom: '5px', color: 'red' }}>番地・建物名が未入力です</div>}
-                            </div>
-                        </div>}
-                    {!form.medium.bool ||
-                        <div className="my-3">
-                            <div>
-                                <label style={{ width: '100%', borderRadius: '7px', fontSize: '10px', letterSpacing: '.7px' }}>{!form.medium.required || <span style={{ backgroundColor: 'red', padding: '2px 8px', color: '#fff', borderRadius: '10px', fontSize: '10px', marginRight: '2px' }}>必須</span>}{form.medium.text}</label>
-                            </div>
-                            <div>
-                                <select id='medium' style={{ height: '40px', borderRadius: '7px', fontSize: '14px', letterSpacing: '.7px', width: '100%', border: '1px solid #D3D3D3' }}
-                                    value={postData.medium}
-                                    onChange={(e) => setPostData((prev) => ({
-                                        ...prev,
-                                        medium: e.target.value
-                                    })
-                                    )}>
-                                    <option value="">選択してください</option>
-                                    {form.medium.mediumName.map((item, index) =>
-                                        <option key={index}>{item}</option>)}
-                                </select>
-                            </div>
-                            {validation !== 'medium' || <div style={{ fontSize: '11px', letterSpacing: '.7px', marginBottom: '5px', color: 'red' }}>ご予約のきっかけが未入力です</div>}
-                        </div>
-                    }
-                    {!form.question.bool ||
-                        <div className="my-3">
-                            <div>
-                                <label style={{ width: '100%', borderRadius: '7px', fontSize: '10px', letterSpacing: '.7px' }}>{!form.question.required || <span style={{ backgroundColor: 'red', padding: '2px 8px', color: '#fff', borderRadius: '10px', fontSize: '10px', marginRight: '2px' }}>必須</span>}{form.question.text}</label>
-                            </div>
-                            <div>
-                                <textarea id='question' style={{ borderRadius: '7px', fontSize: '14px', letterSpacing: '.7px', width: '100%', border: '1px solid #D3D3D3' }} cols={3}
-                                    value={postData.question}
-                                    onChange={(e) => setPostData((prev) => ({
-                                        ...prev,
-                                        question: e.target.value
-                                    })
-                                    )}></textarea>
-                            </div>
-                        </div>
-                    }
-                    {!form.attention.bool ||
-                        <div className="my-3">
-                            <div>
-                                <div style={{ fontSize: '12px', color: '#fff', backgroundColor: 'gray', letterSpacing: '.7px', textAlign: 'justify', padding: '10px', borderRadius: '10px' }}>{form.attention.text}</div>
-                                {!form.attention.bool_red || <><div className="hover" style={{ fontSize: '14px', color: '#fff', backgroundColor: 'black', letterSpacing: '.7px', textAlign: 'justify', padding: '10px 20px', borderRadius: '10px', width: 'fit-content', margin: '20px auto', cursor: 'pointer' }}
-                                    onClick={() => {
-                                        const modal = document.querySelector('#modal') as HTMLElement;
-                                        modal.style.display = 'block'
-                                    }}>特典進呈条件を見る</div>
-                                    <div style={{ display: 'none', position: 'fixed', zIndex: '1000', bottom: '40px', left: '0', backgroundColor: '#fff', width: '100vw' }} id='modal'>
-                                        <div style={{ backgroundColor: '#fff', boxShadow: '6px 6px 10px 0px rgba(0, 0, 0, 0.4)', width: '90%', maxWidth: '560px', margin: '0 auto 0', padding: '10px', borderRadius: '10px' }}>
-                                            <div style={{ color: 'red', lineHeight: '20px', fontSize: '12px', whiteSpace: 'pre-line' }}>
-                                                <span style={{ fontWeight: 'bold' }}>【来場予約特典条件】</span>{form.attention.text_red.replace(/\\r?\\n/g, '\n')}
-                                            </div>
-                                            <div className="hover" style={{ fontSize: '14px', color: '#fff', backgroundColor: 'black', letterSpacing: '.7px', textAlign: 'justify', padding: '10px 20px', borderRadius: '10px', width: 'fit-content', margin: '20px auto', cursor: 'pointer' }}
-                                                onClick={() => {
-                                                    const modal = document.querySelector('#modal') as HTMLElement;
-                                                    modal.style.display = 'none'
-                                                }}>閉じる</div>
-                                        </div>
-                                    </div></>}
-                            </div>
-                        </div>
-                    }
-                    <div className="hover" style={{ backgroundColor: 'red', color: '#fff', width: 'fit-content', padding: '10px 30px', fontWeight: 'bold', borderRadius: '26px', margin: '0 auto', cursor: 'pointer', marginBottom: '50px' }}
-                        onClick={() => confirmData()}>入力内容の確認</div>
-                </div>}
-        </div>)
-}
-
-export default Confirm
-
-
-
+import { useLocation, useNavigate } from "react-router-dom";
+import { useState, useEffect } from "react";
+import type { ChangeEvent, CSSProperties, ReactNode } from "react";
+import axios from "axios";
+import { post as postToGateway } from "../api/gateway";
+import { brandLogo, brandAccent } from "../api/brands";
+import { FaArrowRotateLeft } from "react-icons/fa6";
+// ⚠️ 2026-10-12: 見た目（Dashboard 風の SaaS デザイン）。⚠️ 確認画面（Confirm.tsx）と共通
+import "./publicForm.css";
+
+type Form = {
+    brand: string;
+    campaign: string;
+    campaign_id: string;
+    mail_to: string;
+    mail_cc: string;
+    redirect: string;
+    thanks: boolean | null;
+    notice: {
+        bool: boolean | null,
+        text: string
+    }
+    shop: {
+        bool: boolean | null,
+        required: boolean | null,
+        text: string,
+        shopName: string[],
+        /**
+         * ⚠️⚠️ **聞かない（bool=false）ときに、代わりに送る値。**
+         *   ⚠️ 既存の設定にはこのキーが無いので **必ず `?? ''` で読むこと**。
+         *   ⚠️ ダッシュボードの「キャンペーン作成」で指定する。
+         *     ⚠️ **片方だけ直さないこと。** 指定したのに送られない状態になる。
+         */
+        default?: string
+    }
+    date: {
+        bool: boolean | null,
+        required: boolean | null,
+        text_day: string,
+        text_time: string,
+        time: string[]
+    }
+    name: {
+        bool: boolean | null,
+        required: boolean | null,
+        text_sei: string,
+        text_mei: string
+    }
+    kana: {
+        bool: boolean | null,
+        required: boolean | null,
+        text_sei: string,
+        text_mei: string
+    }
+    age: {
+        bool: boolean | null,
+        required: boolean | null,
+        text: string
+    }
+    phone: {
+        bool: boolean | null,
+        required: boolean | null,
+        text: string
+    }
+    mail: {
+        bool: boolean | null,
+        required: boolean | null,
+        text: string
+    }
+    /**
+     * LINE ID（2026-10-12 追加 / Dashboard v2.2.188）。⚠️ form_table.line_id（JSON）。
+     * ⚠️ ② が古い・列が無いときは返ってこない → 既定（bool: null）のまま＝⚠️ 欄を出さない。
+     */
+    line_id: {
+        bool: boolean | null,
+        required: boolean | null,
+        text: string
+    }
+    address: {
+        bool: boolean | null,
+        required: boolean | null,
+        text_zip: string,
+        text_pref: string,
+        text_city: string,
+        text_town: string,
+        text_street: string
+    }
+    question: {
+        bool: boolean | null,
+        required: boolean | null,
+        text: string
+    }
+    attention: {
+        bool: boolean | null,
+        text: string,
+        bool_red: boolean | null,
+        text_red: string
+    }
+    medium: {
+        bool: boolean | null,
+        required: boolean | null,
+        text: string,
+        mediumName: string[]
+    }
+};
+
+type PostData = {
+    shop: string;
+    date: string;
+    time: string;
+    sei: string;
+    mei: string;
+    seiKana: string;
+    meiKana: string;
+    age: string;
+    phone: string;
+    mail: string;
+    /** LINE ID（2026-10-12 追加）。⚠️ ② entry.ts が `line_id` で受けて inquiry_customer.line_id に保存する */
+    line_id: string;
+    zip: string;
+    pref: string;
+    city: string;
+    town: string;
+    street: string;
+    medium: string;
+    question: string;
+    brand: string;
+    campaign: string;
+    campaign_id: string;
+    mail_to: string;
+    mail_cc: string;
+    redirect: string;
+    thanks: boolean;
+};
+
+type Param = { campaign_id: string | null, brand: string | null, url: string, source: string | null, campaign: string | null, device: string | null }
+
+const Confirm = () => {
+    const location = useLocation();
+    const queryParams = new URLSearchParams(location.search);
+    const href = window.parent.location.href.toLowerCase();
+    const parentUrl = window.parent.location.href;
+    const urlObj = new URL(parentUrl);
+    const parentQueryParams = new URLSearchParams(urlObj.search);
+    const sourceMap = [
+        { key: "utm_source", value: parentQueryParams.get("utm_source") },
+        { key: "fbclid", value: "Facebook/Instagram" },
+        { key: "gclid", value: "Google" },
+        { key: "wbraid", value: "Google" },
+        { key: "gbraid", value: "Google" },
+        { key: "yclid", value: "Yahoo" },
+        { key: "flyer", value: "Flyer" },
+    ];
+
+    const sourceValue = sourceMap.find(s => href.includes(s.key))?.value || "";
+
+    console.log(parentQueryParams.get('utm_campaign'));
+
+    let sourceCampaign;
+    if (parentQueryParams.get('utm_campaign')) {
+        sourceCampaign = parentQueryParams.get('utm_campaign');
+    } else {
+        sourceCampaign = ''
+    }
+
+    const ua = navigator.userAgent.toLowerCase();
+    const deviceValue = /mobile|android|iphone|ipad/.test(ua) ? 'mobile' : 'desktop';
+
+    const getParam: Param = {
+        campaign_id: queryParams.get('id'),
+        brand: queryParams.get('brand'),
+        url: window.parent.location.href,
+        source: sourceValue,
+        campaign: sourceCampaign,
+        device: deviceValue
+    };
+
+    const navigate = useNavigate();
+    /**
+     * ⚠️ フォーム設定を読めなかったときに立てる。
+     *   ⚠️ 以前は読めないと**画面が真っ白**になり、
+     *     見ている人にも問い合わせを受けた側にも原因が分からなかった。
+     */
+    const [loadError, setLoadError] = useState(false);
+    /**
+     * 特典進呈条件の表示（2026-10-12）。⚠️ 以前は `#modal` の style を直接書き換えていた。
+     * ⚠️ 中身・開き方（ボタン → 下から出る）は同じ。
+     */
+    const [showConditions, setShowConditions] = useState(false);
+
+    const [form, setForm] = useState<Form>({
+        brand: '',
+        campaign: '',
+        campaign_id: '',
+        mail_to: '',
+        mail_cc: '',
+        thanks: null,
+        redirect: '',
+        notice: {
+            bool: null,
+            text: ''
+        },
+        shop: {
+            bool: null,
+            required: null,
+            text: '',
+            shopName: [],
+            default: ''
+        },
+        date: {
+            bool: null,
+            required: null,
+            text_day: '',
+            text_time: '',
+            time: []
+        },
+        name: {
+            bool: null,
+            required: null,
+            text_sei: '',
+            text_mei: ''
+        },
+        kana: {
+            bool: null,
+            required: null,
+            text_sei: '',
+            text_mei: ''
+        },
+        age: {
+            bool: null,
+            required: null,
+            text: ''
+        },
+        phone: {
+            bool: null,
+            required: null,
+            text: ''
+        },
+        mail: {
+            bool: null,
+            required: null,
+            text: ''
+        },
+        line_id: {
+            bool: null,
+            required: null,
+            text: ''
+        },
+        address: {
+            bool: null,
+            required: null,
+            text_zip: '',
+            text_pref: '',
+            text_city: '',
+            text_town: '',
+            text_street: ''
+        },
+        medium: {
+            bool: null,
+            required: null,
+            text: '',
+            mediumName: []
+        },
+        question: {
+            bool: null,
+            required: null,
+            text: ''
+        },
+        attention: {
+            bool: null,
+            text: '',
+            bool_red: null,
+            text_red: ''
+        },
+    });
+
+    const [postData, setPostData] = useState<PostData>({
+        shop: '',
+        date: '',
+        time: '',
+        sei: '',
+        mei: '',
+        seiKana: '',
+        meiKana: '',
+        age: '',
+        phone: '',
+        mail: '',
+        line_id: '',
+        zip: '',
+        pref: '',
+        city: '',
+        town: '',
+        street: '',
+        medium: '',
+        question: '',
+        brand: '',
+        campaign: '',
+        campaign_id: '',
+        mail_to: '',
+        mail_cc: '',
+        redirect: '',
+        thanks: true,
+    });
+
+    // ⚠️ ロゴの分岐は src/api/brands.ts へ集約した（Confirm.tsx と共通）
+    const imgCode = brandLogo(getParam.brand);
+
+    useEffect(() => {
+        console.log(getParam);
+        const fetchData = async () => {
+            try {
+                // ⚠️⚠️ 通信先の分岐は src/api/gateway.ts へ移した。
+                //   ⚠️ ② を叩き、失敗したら ①（移行前と同じ経路）へ回す。
+                //   ⚠️ ここに URL を書き戻さないこと。Confirm.tsx と食い違う。
+
+                if (sourceValue) {
+                    window.parent.localStorage.setItem("source", sourceValue);
+                } else if (window.parent.localStorage.getItem("source")) {
+                    getParam.source = window.parent.localStorage.getItem("source");
+                } else {
+                    getParam.source = '';
+                }
+
+                if (sourceCampaign) {
+                    window.parent.localStorage.setItem("campaign", sourceCampaign);
+                } else if (window.parent.localStorage.getItem("campaign")) {
+                    getParam.campaign = window.parent.localStorage.getItem("campaign");
+                } else {
+                    getParam.campaign = '';
+                }
+
+                window.parent.localStorage.setItem("url", window.parent.location.href);
+
+                const response = await postToGateway('form_get', String(getParam.brand ?? ''), getParam);
+                const row = response.data.data;
+
+                /**
+                 * ⚠️⚠️ **設定が取れなかったときに落とさない。**
+                 *   ⚠️ 以前は `response.data.data.address` を直接読んでいたため、
+                 *     キャンペーンIDが間違っていると `data` が null で
+                 *     **実行時エラーになり、フォームが何も表示されなかった**。
+                 *   ⚠️ 原因が画面に出ないので、問い合わせを受けても調べようがなかった。
+                 */
+                if (!row) {
+                    console.error(
+                        `[form] フォーム設定が見つかりません brand="${getParam.brand}" id="${getParam.campaign_id}"`
+                    );
+                    setLoadError(true);
+                    return;
+                }
+
+                /**
+                 * ⚠️ JSON 列は文字列で入っている。
+                 *   ⚠️ 中身が壊れている行が1つでもあると JSON.parse が投げ、
+                 *     **フォーム全体が出なくなる**。項目ごとに受け止める。
+                 */
+                const parse = <T,>(value: string | undefined, fallback: T): T => {
+                    if (!value) return fallback;
+                    try {
+                        return JSON.parse(value) as T;
+                    } catch {
+                        console.error(`[form] 設定の解釈に失敗しました: ${value.slice(0, 80)}`);
+                        return fallback;
+                    }
+                };
+
+                await setForm({
+                    address: parse(row.address, form.address),
+                    age: parse(row.age, form.age),
+                    brand: row.brand ?? '',
+                    campaign: row.campaign ?? '',
+                    campaign_id: row.campaign_id ?? '',
+                    date: parse(row.date, form.date),
+                    kana: parse(row.kana, form.kana),
+                    mail: parse(row.mail, form.mail),
+                    // ⚠️ 2026-10-12: LINE ID。⚠️ 返ってこなければ既定（bool: null）＝欄を出さない
+                    line_id: parse(row.line_id, form.line_id),
+                    /**
+                     * ⚠️⚠️ **返ってきた値をそのまま持つ。空で固定しないこと。**
+                     *
+                     *   ⚠️ ② は `mail_to` / `mail_cc` を**返さない**（返すと誰でも読める）。
+                     *     → ここは空になり、送信時も空で送られるが、
+                     *       ② が `form_table` から引くので**問題ない**。
+                     *
+                     *   ⚠️⚠️ ② が落ちて ① へ退避したときは話が別で、
+                     *     ① は**リクエストの宛先しか見ない**。
+                     *     ⚠️ ここで空に固定すると、退避したときに
+                     *       **社内通知が1通も飛ばなくなる**（しかも気づけない）。
+                     *
+                     *   ⚠️ ① の応答には宛先が含まれるので、そのまま受け取れば
+                     *     退避時だけ宛先が埋まる。**この形を崩さないこと。**
+                     */
+                    mail_cc: row.mail_cc ?? '',
+                    mail_to: row.mail_to ?? '',
+                    medium: parse(row.medium, form.medium),
+                    name: parse(row.name, form.name),
+                    notice: parse(row.notice, form.notice),
+                    phone: parse(row.phone, form.phone),
+                    question: parse(row.question, form.question),
+                    redirect: row.redirect ?? '',
+                    shop: parse(row.shop, form.shop),
+                    thanks: Boolean(Number(row.thanks ?? 0)),
+                    attention: parse(row.attention, form.attention)
+                });
+            } catch (error) {
+                console.error("データ取得エラー:", error);
+            }
+        };
+
+        fetchData();
+    }, [])
+
+    useEffect(() => {
+        setPostData((prev) => ({
+            ...prev,
+            brand: form.brand === 'nagomi' ? 'なごみ' : form.brand,
+            /**
+             * ⚠️⚠️ **聞かない項目に既定値が指定されていれば、それを送る。**
+             *   ⚠️ 聞いている（bool=true）ときは**上書きしない**。
+             *     上書きすると、利用者が選んだ値が消える。
+             *   ⚠️ 既定値が空なら今までどおり何も入らない。
+             */
+            ...(form.shop.bool || !(form.shop.default ?? '') ? {} : { shop: form.shop.default }),
+            campaign: form.campaign,
+            campaign_id: form.campaign_id,
+            mail_to: form.mail_to,
+            mail_cc: form.mail_cc,
+            redirect: form.redirect,
+            thanks: Boolean(form.thanks)
+        }));
+    }, [form]);
+
+    useEffect(() => {
+        const handleBeforeUnload = () => {
+            const { brand, campaign_id, campaign, mail_cc, mail_to, redirect, thanks, ...filtered } = postData;
+            const filledKeys = Object.entries(filtered)
+                .filter(([_, value]) => value !== "")
+                .map(([key]) => key);
+
+            if (filledKeys.length > 0) {
+                const data = {
+                    time: new Date().toISOString(),
+                    brand: getParam.brand,
+                    campaign: postData.campaign,
+                    filled: filledKeys.join(",")
+                };
+
+                navigator.sendBeacon(
+                    "https://sync-pg-cloud-9f739ab131ed.herokuapp.com/api/breakaway",
+                    JSON.stringify(data)
+                );
+            }
+        };
+
+        window.addEventListener("beforeunload", handleBeforeUnload);
+        return () => window.removeEventListener("beforeunload", handleBeforeUnload);
+    }, [postData]);
+
+
+    const [zipcode, setZipcode] = useState("");
+    const [addressValue, setAddressValue] = useState("");
+    const [validation, setValidation] = useState<string>('');
+
+    const searchAddress = async () => {
+        try {
+            const res = await axios.get("https://zipcloud.ibsnet.co.jp/api/search", {
+                params: { zipcode }
+            });
+            const result = res.data.results?.[0];
+            if (result) {
+                setAddressValue(`${result.address1}${result.address2}${result.address3}`);
+                setPostData(prev => {
+                    return {
+                        ...prev,
+                        pref: result.address1,
+                        city: result.address2,
+                        town: result.address3
+                    };
+                });
+            } else {
+                setAddressValue("住所が見つかりませんでした");
+            }
+        } catch (error) {
+            console.error("郵便番号検索エラー:", error);
+            setAddressValue("検索に失敗しました");
+        }
+    };
+
+    const confirmData = async () => {
+        await setValidation('');
+        const requiredKeys = Object.entries(form)
+            .filter(([_, value]) => {
+                try {
+                    const parsed = typeof value === 'string' ? JSON.parse(value) : value;
+                    return typeof parsed === 'object' && parsed !== null &&
+                        parsed.required === true && parsed.bool === true;
+                } catch {
+                    return false;
+                }
+            })
+            .map(([key]) => key);
+
+        const missingKeys = requiredKeys.filter((key) => {
+            const value = postData[key as keyof typeof postData];
+            if (key === 'name') {
+                return !postData.sei.trim() || !postData.mei.trim();
+            }
+            if (key === 'kana') {
+                return !postData.seiKana.trim() || !postData.meiKana.trim();
+            }
+            if (key === 'address') {
+                return !postData.zip.trim() || !postData.pref.trim() || !postData.city.trim() || !postData.town.trim() || !postData.street.trim();
+            }
+            return typeof value === 'string' && !value.trim();
+        });
+
+        if (missingKeys.length > 0) {
+            await document.getElementById(missingKeys[0])?.scrollIntoView({ behavior: 'smooth' });
+            await setValidation(missingKeys[0]);
+            return;
+        }
+
+        if (postData.phone) {
+            const formattedNumber = postData.phone.replace(/\D/g, '');
+            const isHalfWidthNumber = (number: string): boolean => {
+                return /^[0-9]+$/.test(number);
+            };
+            if (!isHalfWidthNumber(formattedNumber) || formattedNumber.length < 10) {
+                await setValidation('phone_wrong');
+                await document.getElementById('phone')?.scrollIntoView({ behavior: 'smooth' });
+            }
+        }
+
+
+        if (postData.mail) {
+            const mailValue = postData.mail;
+            const isEmail = (mail: string): boolean => {
+                const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
+                return emailRegex.test(mail);
+            };
+            if (!isEmail(mailValue)) {
+                await setValidation('mail_wrong');
+                await document.getElementById('mail')?.scrollIntoView({ behavior: 'smooth' });
+                return;
+            }
+
+        }
+
+        if (postData.zip) {
+            const formattedZip = postData.zip.replace(/\D/g, '');
+            if (formattedZip.length < 7) {
+                await setValidation('zip_wrong');
+                await document.getElementById('zip')?.scrollIntoView({ behavior: 'smooth' });
+                return;
+            }
+        }
+
+        const confirmedData = {
+            ...postData,
+            url: window.parent.location.href,
+            source: sourceValue,
+            campaignName: sourceCampaign
+        };
+
+        console.log(confirmedData);
+        await navigate('/confirm', {
+            state: confirmedData
+        });
+    };
+
+    /**
+     * ⚠️ 2026-10-12: 見た目だけ作り直した（Dashboard 風の SaaS デザイン。publicForm.css）。
+     *   ⚠️ 項目・並び・id・入力チェック・送信の流れは ⚠️ **変えていない**（confirmData はそのまま）。
+     *   ⚠️ id（shop / date / time / sei …）は confirmData のスクロール先なので ⚠️ 消さないこと。
+     *   ⚠️ name / kana / address の id は ⚠️ 項目のまとまりに付けた（⚠️ confirmData が missingKeys[0] でこの名前へ
+     *     スクロールし、validation もこの名前になる。⚠️ 以前は該当する id もメッセージも無く、未入力でも何も出なかった）。
+     */
+    const setValue = (key: keyof PostData) =>
+        (e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
+            const value = e.target.value;
+            setPostData((prev) => ({ ...prev, [key]: value }));
+        };
+
+    // ⚠️ 項目のまとまり（カード）。⚠️ 中の項目が1つも出ないときはカードごと出さない
+    const visitShown = Boolean(form.shop.bool || form.date.bool);
+    const personShown = Boolean(form.name.bool || form.kana.bool || form.age.bool);
+    const contactShown = Boolean(form.phone.bool || form.mail.bool || form.line_id.bool);
+    const otherShown = Boolean(form.medium.bool || form.question.bool);
+
+    return (
+        <div className="pf" style={{ ['--pf-accent' as string]: brandAccent(getParam.brand) } as CSSProperties}>
+            {/**
+              * ⚠️⚠️ **失敗したら回し続けない。**
+              *   ⚠️ 以前は `!form.campaign` だけを見ていたため、設定が取れないと
+              *     「フォーム読み込み中」が**永久に回り続けていた**。
+              *   ⚠️ 見ている人は待ち続け、問い合わせを受けた側も原因が分からない。
+              */}
+            {loadError ? <div className="pf-state" role="alert">
+                フォームを読み込めませんでした。<br />
+                お手数ですが、ページを再読み込みしてください。<br />
+                繰り返す場合はお電話でお問い合わせください。
+            </div> :
+                !form.campaign ? <div className="pf-state" role="status"><FaArrowRotateLeft style={{ marginRight: '10px' }} className='spin' />フォーム読み込み中</div> :
+                <>
+                    {!imgCode || <div className="pf-logo"><img src={imgCode} alt="" /></div>}
+                    <ol className="pf-steps" aria-label="お申し込みの流れ">
+                        <li aria-current="step"><span className="pf-step-num">1</span>入力</li>
+                        <li><span className="pf-step-num">2</span>確認</li>
+                        <li><span className="pf-step-num">3</span>完了</li>
+                    </ol>
+                    {!form.notice.bool || !form.notice.text || <p className="pf-lead">{form.notice.text}</p>}
+
+                    {!visitShown ||
+                        <section className="pf-card" aria-labelledby="pf-visit">
+                            <h2 className="pf-card-title" id="pf-visit">ご来場について</h2>
+                            {!form.shop.bool ||
+                                <Field htmlFor="shop" label={form.shop.text} required={form.shop.required}
+                                    error={validation === 'shop' ? '来場希望場所が未入力です' : ''}>
+                                    <select id='shop' className="pf-select" value={postData.shop} onChange={setValue('shop')}>
+                                        <option value="">選択してください</option>
+                                        {form.shop.shopName.map((item, index) =>
+                                            <option key={index}>{item}</option>
+                                        )}
+                                    </select>
+                                </Field>}
+                            {!form.date.bool ||
+                                <div className="pf-row pf-row-2">
+                                    <Field htmlFor="date" label={form.date.text_day} required={form.date.required}
+                                        error={validation === 'date' ? '来場希望日が未入力です' : ''}>
+                                        <input id='date' type="date" className="pf-input" value={postData.date} onChange={setValue('date')} />
+                                    </Field>
+                                    <Field htmlFor="time" label={form.date.text_time} required={form.date.required}
+                                        error={validation === 'time' ? '来場希望時間が未入力です' : ''}>
+                                        <select id='time' className="pf-select" value={postData.time} onChange={setValue('time')}>
+                                            <option value="">選択してください</option>
+                                            {form.date.time.map((item, index) =>
+                                                <option key={index}>{item}</option>
+                                            )}
+                                        </select>
+                                    </Field>
+                                </div>}
+                        </section>}
+
+                    {!personShown ||
+                        <section className="pf-card" aria-labelledby="pf-person">
+                            <h2 className="pf-card-title" id="pf-person">お客様情報</h2>
+                            {!form.name.bool ||
+                                <div id="name" className="pf-field">
+                                    <div className="pf-row pf-row-2">
+                                        <Field htmlFor="sei" label={form.name.text_sei} required={form.name.required}
+                                            error={validation === 'sei' ? 'お名前(姓)が未入力です' : ''} invalid={validation === 'name' && !postData.sei.trim()}>
+                                            <input id='sei' type="text" className="pf-input" autoComplete="family-name" value={postData.sei} onChange={setValue('sei')} />
+                                        </Field>
+                                        <Field htmlFor="mei" label={form.name.text_mei} required={form.name.required}
+                                            error={validation === 'mei' ? 'お名前(名)が未入力です' : ''} invalid={validation === 'name' && !postData.mei.trim()}>
+                                            <input id='mei' type="text" className="pf-input" autoComplete="given-name" value={postData.mei} onChange={setValue('mei')} />
+                                        </Field>
+                                    </div>
+                                    {validation !== 'name' || <p className="pf-error">お名前が未入力です</p>}
+                                </div>}
+                            {!form.kana.bool ||
+                                <div id="kana" className="pf-field">
+                                    <div className="pf-row pf-row-2">
+                                        <Field htmlFor="seiKana" label={form.kana.text_sei} required={form.kana.required}
+                                            error={validation === 'seiKana' ? 'お名前(セイ)が未入力です' : ''} invalid={validation === 'kana' && !postData.seiKana.trim()}>
+                                            <input id='seiKana' type="text" className="pf-input" value={postData.seiKana} onChange={setValue('seiKana')} />
+                                        </Field>
+                                        <Field htmlFor="meiKana" label={form.kana.text_mei} required={form.kana.required}
+                                            error={validation === 'meiKana' ? 'お名前(メイ)が未入力です' : ''} invalid={validation === 'kana' && !postData.meiKana.trim()}>
+                                            <input id='meiKana' type="text" className="pf-input" value={postData.meiKana} onChange={setValue('meiKana')} />
+                                        </Field>
+                                    </div>
+                                    {validation !== 'kana' || <p className="pf-error">フリガナが未入力です</p>}
+                                </div>}
+                            {!form.age.bool ||
+                                <div className="pf-row pf-row-2">
+                                    <Field htmlFor="age" label={form.age.text} required={form.age.required}
+                                        error={validation === 'age' ? 'ご年齢が未入力です' : ''}>
+                                        <input id='age' type="text" className="pf-input" inputMode="numeric" value={postData.age} onChange={setValue('age')} />
+                                    </Field>
+                                </div>}
+                        </section>}
+
+                    {!contactShown ||
+                        <section className="pf-card" aria-labelledby="pf-contact">
+                            <h2 className="pf-card-title" id="pf-contact">ご連絡先</h2>
+                            {!form.phone.bool ||
+                                <Field htmlFor="phone" label={form.phone.text} required={form.phone.required}
+                                    error={validation === 'phone' ? '携帯番号が未入力です' : validation === 'phone_wrong' ? '正しく入力してください' : ''}>
+                                    <input id='phone' type="text" className="pf-input" inputMode="tel" autoComplete="tel" value={postData.phone} onChange={setValue('phone')} />
+                                </Field>}
+                            {!form.mail.bool ||
+                                <Field htmlFor="mail" label={form.mail.text} required={form.mail.required}
+                                    error={validation === 'mail' ? 'メールアドレスが未入力です' : validation === 'mail_wrong' ? '正しく入力してください' : ''}>
+                                    <input id='mail' type="mail" className="pf-input" inputMode="email" autoComplete="email" value={postData.mail} onChange={setValue('mail')} />
+                                </Field>}
+                            {/*
+                              ⚠️ 2026-10-12: LINE ID（メールアドレスの下）。⚠️ 形は確かめない（空白だけ取り除く）。
+                                ⚠️ 必須の確認は他の項目と同じ仕組み（form.line_id.required ＋ postData.line_id）。
+                            */}
+                            {!form.line_id.bool ||
+                                <Field htmlFor="line_id" label={form.line_id.text} required={form.line_id.required}
+                                    error={validation === 'line_id' ? 'LINE IDが未入力です' : ''}>
+                                    <input id='line_id' type="text" className="pf-input" autoComplete="off" autoCapitalize="none" spellCheck={false}
+                                        placeholder="LINE ID"
+                                        value={postData.line_id}
+                                        onChange={(e) => {
+                                            const value = e.target.value.replace(/[\s　]+/g, '');
+                                            setPostData((prev) => ({ ...prev, line_id: value }));
+                                        }} />
+                                </Field>}
+                        </section>}
+
+                    {!form.address.bool ||
+                        <section className="pf-card" aria-labelledby="pf-address" id="address">
+                            <h2 className="pf-card-title" id="pf-address">ご住所</h2>
+                            <Field htmlFor="zip" label={form.address.text_zip} required={form.address.required}
+                                error={validation === 'zip' ? '郵便番号が未入力です' : validation === 'zip_wrong' ? '正しく入力してください'
+                                    : addressValue === '住所が見つかりませんでした' ? '住所が見つかりませんでした' : ''}
+                                invalid={validation === 'address' && !postData.zip.trim()}>
+                                <div className="pf-inline">
+                                    <input id='zip' type="text" className="pf-input" inputMode="numeric" autoComplete="postal-code" pattern="\d{7,}"
+                                        value={postData.zip}
+                                        onChange={(e) => {
+                                            setZipcode(e.target.value);
+                                            setPostData((prev) => ({ ...prev, zip: e.target.value }));
+                                        }} />
+                                    <button type="button" className="pf-btn zip_button" id="search_button" onClick={() => searchAddress()}>住所を検索</button>
+                                </div>
+                            </Field>
+                            <div className="pf-row pf-row-2">
+                                <Field htmlFor="pref" label={form.address.text_pref} required={form.address.required}
+                                    error={validation === 'pref' ? '都道府県名が未入力です' : ''} invalid={validation === 'address' && !postData.pref.trim()}>
+                                    <input id='pref' type="text" className="pf-input" autoComplete="address-level1" value={postData.pref} onChange={setValue('pref')} />
+                                </Field>
+                                <Field htmlFor="city" label={form.address.text_city} required={form.address.required}
+                                    error={validation === 'city' ? '市・区名が未入力です' : ''} invalid={validation === 'address' && !postData.city.trim()}>
+                                    <input id='city' type="text" className="pf-input" autoComplete="address-level2" value={postData.city} onChange={setValue('city')} />
+                                </Field>
+                            </div>
+                            <Field htmlFor="town" label={form.address.text_town} required={form.address.required}
+                                error={validation === 'town' ? '町村名が未入力です' : ''} invalid={validation === 'address' && !postData.town.trim()}>
+                                <input id='town' type="text" className="pf-input" value={postData.town} onChange={setValue('town')} />
+                            </Field>
+                            <Field htmlFor="street" label={form.address.text_street} required={form.address.required}
+                                error={validation === 'street' ? '番地・建物名が未入力です' : ''} invalid={validation === 'address' && !postData.street.trim()}>
+                                <input id='street' type="text" className="pf-input" value={postData.street} onChange={setValue('street')} />
+                            </Field>
+                            {validation !== 'address' || <p className="pf-error">ご住所が未入力です</p>}
+                        </section>}
+
+                    {!otherShown ||
+                        <section className="pf-card" aria-labelledby="pf-other">
+                            <h2 className="pf-card-title" id="pf-other">その他</h2>
+                            {!form.medium.bool ||
+                                <Field htmlFor="medium" label={form.medium.text} required={form.medium.required}
+                                    error={validation === 'medium' ? 'ご予約のきっかけが未入力です' : ''}>
+                                    <select id='medium' className="pf-select" value={postData.medium} onChange={setValue('medium')}>
+                                        <option value="">選択してください</option>
+                                        {form.medium.mediumName.map((item, index) =>
+                                            <option key={index}>{item}</option>)}
+                                    </select>
+                                </Field>}
+                            {!form.question.bool ||
+                                <Field htmlFor="question" label={form.question.text} required={form.question.required}
+                                    error={validation === 'question' ? 'ご質問・ご要望が未入力です' : ''}>
+                                    <textarea id='question' className="pf-textarea" rows={4} value={postData.question} onChange={setValue('question')}></textarea>
+                                </Field>}
+                        </section>}
+
+                    {!form.attention.bool ||
+                        <div className="pf-card">
+                            {!form.attention.text || <p className="pf-note">{form.attention.text}</p>}
+                            {!form.attention.bool_red ||
+                                <div style={{ display: 'flex', justifyContent: 'center' }}>
+                                    <button type="button" className="pf-btn" onClick={() => setShowConditions(true)}>特典進呈条件を見る</button>
+                                </div>}
+                        </div>}
+                    {showConditions &&
+                        <div className="pf-sheet-backdrop" onClick={() => setShowConditions(false)}>
+                            <div className="pf-sheet" role="dialog" aria-modal="true" aria-labelledby="pf-conditions" onClick={(e) => e.stopPropagation()}>
+                                <h2 className="pf-sheet-title" id="pf-conditions">【来場予約特典条件】</h2>
+                                <p className="pf-sheet-body">{form.attention.text_red.replace(/\\r?\\n/g, '\n')}</p>
+                                <div style={{ display: 'flex', justifyContent: 'center' }}>
+                                    <button type="button" className="pf-btn" onClick={() => setShowConditions(false)}>閉じる</button>
+                                </div>
+                            </div>
+                        </div>}
+
+                    <div className="pf-actions">
+                        <button type="button" className="pf-btn pf-btn-primary" onClick={() => confirmData()}>入力内容の確認へ進む</button>
+                    </div>
+                </>}
+        </div>)
+}
+
+/**
+ * 項目1つ（ラベル ＋ 入力欄 ＋ エラー）。⚠️ 2026-10-12 新規。
+ * ⚠️⚠️ **コンポーネントの外に置くこと。** 中に書くと描画のたびに作り直され、⚠️ 入力中にカーソルが外れる。
+ * ⚠️ required が真なら「必須」、偽なら「任意」の印。
+ */
+const Field = ({ htmlFor, label, required, error, invalid, children }: {
+    htmlFor: string;
+    label: string;
+    required: boolean | null;
+    error?: string;
+    /** ⚠️ まとまり（お名前・ご住所）の未入力で、この欄だけ赤枠にしたいとき */
+    invalid?: boolean;
+    children: ReactNode;
+}) => (
+    <div className="pf-field" data-invalid={error || invalid ? '1' : '0'}>
+        <label className="pf-label" htmlFor={htmlFor}>
+            {required
+                ? <span className="pf-badge pf-badge-req">必須</span>
+                : <span className="pf-badge pf-badge-opt">任意</span>}
+            <span>{label}</span>
+        </label>
+        {children}
+        {!error || <p className="pf-error" role="alert">{error}</p>}
+    </div>
+);
+
+export default Confirm
+
+
+
--- C:/Users/SHINJI~1/AppData/Local/Temp/claude/c--Users-shinji-kawano-react-dashboard/f17ffd00-1ebc-4533-a8d9-ede3c6283bd3/scratchpad/form_get_backup_2026-10-12/Confirm.tsx	2026-10-12 11:12:46.483391000 +0900
+++ /c/Users/shinji-kawano/react/form_get/src/components/Confirm.tsx	2026-10-12 11:26:27.805715300 +0900
@@ -1,256 +1,231 @@
-import { useEffect, useState } from "react";
-import { useLocation, useNavigate } from "react-router-dom";
-import { Table } from "react-bootstrap";
-import { post as postToGateway } from "../api/gateway";
-import { brandLogo, KHG_BRAND, KHG_THANKS } from "../api/brands";
-
-type PostData = {
-    shop: string;
-    date: string;
-    time: string;
-    sei: string;
-    mei: string;
-    seiKana: string;
-    meiKana: string;
-    age: string;
-    phone: string;
-    mail: string;
-    zip: string;
-    pref: string;
-    city: string;
-    town: string;
-    street: string;
-    building: string;
-    medium: string;
-    question: string;
-    brand: string;
-    campaign: string;
-    campaign_id: string;
-    mail_to: string;
-    mail_cc: string;
-    redirect: string;
-    thanks: boolean;
-};
-
-const Confirm = () => {
-    const location = useLocation();
-    const navigate = useNavigate();
-    const [postData, setPostData] = useState<PostData>({
-        shop: '',
-        date: '',
-        time: '',
-        sei: '',
-        mei: '',
-        seiKana: '',
-        meiKana: '',
-        age: '',
-        phone: '',
-        mail: '',
-        zip: '',
-        pref: '',
-        city: '',
-        town: '',
-        street: '',
-        building: '',
-        medium: '',
-        question: '',
-        brand: '',
-        campaign: '',
-        campaign_id: '',
-        mail_to: '',
-        mail_cc: '',
-        redirect: '',
-        thanks: true,
-    });
-
-    const [imgCode, setIngCode] = useState<string>('');
-    const [loading, setLoading] = useState(false);
-
-    useEffect(() => {
-        console.log(location.state);
-        setPostData(location.state);
-
-        // ⚠️ ロゴの分岐は src/api/brands.ts へ集約した（Form.tsx と共通）
-        setIngCode(brandLogo(location.state.brand));
-
-        const formEl = parent.document.getElementById('form');
-        if (formEl) {
-            formEl.scrollIntoView({ behavior: 'smooth' });
-        }
-
-    }, [])
-
-    useEffect(() => {
-        console.log(`POSTデータ:${postData.campaign}_${postData.sei}`);
-    }, [postData])
-
-    const registerData = async (): Promise<void> => {
-        if (loading) return; // 二重送信防止
-        setLoading(true);
-
-        try {
-
-            let sourceValue;
-            
-            if (window.parent.localStorage.getItem("source")) {
-                sourceValue = window.parent.localStorage.getItem("source");
-            } else {
-                sourceValue = ''
-            }
-
-            let urlValue;
-            if (window.parent.localStorage.getItem("url")) {
-                urlValue = window.parent.localStorage.getItem("url");
-            } else {
-                urlValue = ''
-            }
-
-            let campaignValue;
-            if (window.parent.localStorage.getItem("campaign")) {
-                campaignValue = window.parent.localStorage.getItem("campaign");
-            } else {
-                campaignValue = ''
-            }
-
-            const updatedData = {
-                ...postData,
-                request: "homepage",
-                source: sourceValue,
-                url: urlValue,
-                campaignName: campaignValue
-            };
-
-
-
-            /**
-             * ⚠️⚠️ **通知先（mail_cc）をここで組み立てるのはやめた。**
-             *
-             *   ⚠️ 以前はブランド・店舗ごとの Cc を**この画面が決めて送っていた**。
-             *     ソースを見れば誰でも通知先が読め、書き換えれば
-             *     **任意の宛先へ社内通知を送らせることができた**。
-             *   ⚠️ 宛先は ② の `features/campaignForm/entry.ts`（KHG_CC）へ移した。
-             *   ⚠️ **ここへ宛先を書き戻さないこと。**
-             *
-             * ⚠️⚠️ **ただしブランドの解決だけは残す。**
-             *   ⚠️ `khg` は共通フォームで、**選んだ店舗で実ブランドが決まる**。
-             *   ⚠️ ② は自分で解決できるが、退避先（①）の PHP には
-             *     **khg の分岐が無い**。⚠️ `khg` のまま送ると
-             *     **brand が空文字で保存される**（実データで20件確認済み）。
-             *   ⚠️ ブランドキーは宛先ではないので、ここに置いても漏れる情報は無い。
-             */
-            if (location.state.brand === 'khg' && KHG_BRAND[updatedData.shop]) {
-                updatedData.brand = KHG_BRAND[updatedData.shop];
-            }
-
-            const response = (await postToGateway(
-                'form_register',
-                String(location.state.brand ?? ''),
-                updatedData
-            )).data;
-
-            if (response.status === "success") {
-                /**
-                 * ⚠️ khg は店舗ごとにサンクスページが違う。
-                 *   ⚠️ 対応表は src/api/brands.ts に集約した。
-                 *   ⚠️ 表に無い店舗は form_table.redirect へ落とす。
-                 */
-                if (location.state.brand === 'khg' && KHG_THANKS[postData.shop]) {
-                    window.parent.location.href = KHG_THANKS[postData.shop];
-                } else {
-                    window.parent.location.href = postData.redirect;
-                }
-            } else {
-                alert("フォームの登録に失敗しました。再度トライしてください。");
-                navigate(-1);
-            }
-        } catch (error) {
-            console.error("データ取得エラー:", error);
-            alert("通信エラーが発生しました");
-        } finally {
-            setLoading(false);
-        }
-    };
-
-
-    return (
-        <div className="bg-white w-100">
-            <div style={{ width: '90%', maxWidth: '768px', margin: '0 auto' }}>
-                <div style={{ width: '40%', minWidth: '300px', margin: '50px auto' }}>
-                    <img src={imgCode} className="w-100" />
-                </div>
-                <div className="w-100">
-                    <div className="text-center" style={{ fontSize: '17px', marginBottom: '55px' }} id='title'>入力内容をご確認ください。</div>
-                </div>
-                <Table>
-                    <tbody style={{ textAlign: 'center' }}>
-                        {!postData.shop ||
-                            <tr>
-                                <td style={{ fontSize: '14px', width: '40%' }}>来場希望場所</td>
-                                <td style={{ fontWeight: 'bold', fontSize: '13px' }}>{postData.shop}</td>
-                            </tr>}
-                        {!postData.date ||
-                            <tr>
-                                <td style={{ fontSize: '14px', width: '40%' }}>来場希望日</td>
-                                <td style={{ fontWeight: 'bold', fontSize: '13px' }}>{postData.date}</td>
-                            </tr>}
-                        {!postData.time ||
-                            <tr>
-                                <td style={{ fontSize: '14px', width: '40%' }}>来場希望時間</td>
-                                <td style={{ fontWeight: 'bold', fontSize: '13px' }}>{postData.time}</td>
-                            </tr>}
-                        {!postData.sei ||
-                            <tr>
-                                <td style={{ fontSize: '14px', width: '40%' }}>お名前（漢字）</td>
-                                <td style={{ fontWeight: 'bold', fontSize: '13px' }}>{postData.sei} {postData.mei}</td>
-                            </tr>}
-                        {!postData.seiKana ||
-                            <tr>
-                                <td style={{ fontSize: '14px', width: '40%' }}>お名前（カナ）</td>
-                                <td style={{ fontWeight: 'bold', fontSize: '13px' }}>{postData.seiKana} {postData.meiKana}</td>
-                            </tr>}
-                        {!postData.phone ||
-                            <tr>
-                                <td style={{ fontSize: '14px', width: '40%' }}>携帯電話</td>
-                                <td style={{ fontWeight: 'bold', fontSize: '13px' }}>{postData.phone}</td>
-                            </tr>}
-                        {!postData.mail ||
-                            <tr>
-                                <td style={{ fontSize: '14px', width: '40%' }}>メールアドレス</td>
-                                <td style={{ fontWeight: 'bold', fontSize: '13px' }}>{postData.mail}</td>
-                            </tr>}
-                        {!postData.zip ||
-                            <tr>
-                                <td style={{ fontSize: '14px', width: '40%' }}>郵便番号</td>
-                                <td style={{ fontWeight: 'bold', fontSize: '13px' }}>{postData.zip}</td>
-                            </tr>}
-                        {!postData.pref ||
-                            <tr>
-                                <td style={{ fontSize: '14px', width: '40%' }}>住所（都道府県市区町村）</td>
-                                <td style={{ fontWeight: 'bold', fontSize: '13px' }}>{postData.pref}{postData.city}{postData.town}</td>
-                            </tr>}
-                        {!postData.street ||
-                            <tr>
-                                <td style={{ fontSize: '14px', width: '40%' }}>住所（番地・建物）</td>
-                                <td style={{ fontWeight: 'bold', fontSize: '13px' }}>{postData.street}</td>
-                            </tr>}
-                        {!postData.medium ||
-                            <tr>
-                                <td style={{ fontSize: '14px', width: '40%' }}>ご予約のきっかけ</td>
-                                <td style={{ fontWeight: 'bold', fontSize: '13px' }}>{postData.medium}</td>
-                            </tr>}
-                        {!postData.question ||
-                            <tr>
-                                <td style={{ fontSize: '14px', width: '40%' }}>ご質問・ご要望</td>
-                                <td style={{ fontWeight: 'bold', fontSize: '13px' }}>{postData.question}</td>
-                            </tr>}
-                    </tbody>
-                </Table>
-                <div className="hover" style={{ backgroundColor: loading ? "gray" : "red", color: '#fff', width: 'fit-content', padding: '10px 30px', fontWeight: 'bold', borderRadius: '26px', margin: '50px auto 150px', cursor: 'pointer' }}
-                    onClick={!loading ? registerData : undefined}>
-                    {loading ? "送信中..." : "入力内容で申し込む"}
-                </div>
-            </div>
-        </div>)
-}
-
+import { useEffect, useState } from "react";
+import type { CSSProperties } from "react";
+import { useLocation, useNavigate } from "react-router-dom";
+import { post as postToGateway } from "../api/gateway";
+import { brandLogo, brandAccent, KHG_BRAND, KHG_THANKS } from "../api/brands";
+// ⚠️ 2026-10-12: 見た目（Dashboard 風の SaaS デザイン）。⚠️ 入力画面（Form.tsx）と共通
+import "./publicForm.css";
+
+type PostData = {
+    shop: string;
+    date: string;
+    time: string;
+    sei: string;
+    mei: string;
+    seiKana: string;
+    meiKana: string;
+    age: string;
+    phone: string;
+    mail: string;
+    /** LINE ID（2026-10-12 追加） */
+    line_id?: string;
+    zip: string;
+    pref: string;
+    city: string;
+    town: string;
+    street: string;
+    building: string;
+    medium: string;
+    question: string;
+    brand: string;
+    campaign: string;
+    campaign_id: string;
+    mail_to: string;
+    mail_cc: string;
+    redirect: string;
+    thanks: boolean;
+};
+
+const Confirm = () => {
+    const location = useLocation();
+    const navigate = useNavigate();
+    const [postData, setPostData] = useState<PostData>({
+        shop: '',
+        date: '',
+        time: '',
+        sei: '',
+        mei: '',
+        seiKana: '',
+        meiKana: '',
+        age: '',
+        phone: '',
+        mail: '',
+        zip: '',
+        pref: '',
+        city: '',
+        town: '',
+        street: '',
+        building: '',
+        medium: '',
+        question: '',
+        brand: '',
+        campaign: '',
+        campaign_id: '',
+        mail_to: '',
+        mail_cc: '',
+        redirect: '',
+        thanks: true,
+    });
+
+    const [imgCode, setIngCode] = useState<string>('');
+    const [loading, setLoading] = useState(false);
+
+    useEffect(() => {
+        console.log(location.state);
+        setPostData(location.state);
+
+        // ⚠️ ロゴの分岐は src/api/brands.ts へ集約した（Form.tsx と共通）
+        setIngCode(brandLogo(location.state.brand));
+
+        const formEl = parent.document.getElementById('form');
+        if (formEl) {
+            formEl.scrollIntoView({ behavior: 'smooth' });
+        }
+
+    }, [])
+
+    useEffect(() => {
+        console.log(`POSTデータ:${postData.campaign}_${postData.sei}`);
+    }, [postData])
+
+    const registerData = async (): Promise<void> => {
+        if (loading) return; // 二重送信防止
+        setLoading(true);
+
+        try {
+
+            let sourceValue;
+            
+            if (window.parent.localStorage.getItem("source")) {
+                sourceValue = window.parent.localStorage.getItem("source");
+            } else {
+                sourceValue = ''
+            }
+
+            let urlValue;
+            if (window.parent.localStorage.getItem("url")) {
+                urlValue = window.parent.localStorage.getItem("url");
+            } else {
+                urlValue = ''
+            }
+
+            let campaignValue;
+            if (window.parent.localStorage.getItem("campaign")) {
+                campaignValue = window.parent.localStorage.getItem("campaign");
+            } else {
+                campaignValue = ''
+            }
+
+            const updatedData = {
+                ...postData,
+                request: "homepage",
+                source: sourceValue,
+                url: urlValue,
+                campaignName: campaignValue
+            };
+
+
+
+            /**
+             * ⚠️⚠️ **通知先（mail_cc）をここで組み立てるのはやめた。**
+             *
+             *   ⚠️ 以前はブランド・店舗ごとの Cc を**この画面が決めて送っていた**。
+             *     ソースを見れば誰でも通知先が読め、書き換えれば
+             *     **任意の宛先へ社内通知を送らせることができた**。
+             *   ⚠️ 宛先は ② の `features/campaignForm/entry.ts`（KHG_CC）へ移した。
+             *   ⚠️ **ここへ宛先を書き戻さないこと。**
+             *
+             * ⚠️⚠️ **ただしブランドの解決だけは残す。**
+             *   ⚠️ `khg` は共通フォームで、**選んだ店舗で実ブランドが決まる**。
+             *   ⚠️ ② は自分で解決できるが、退避先（①）の PHP には
+             *     **khg の分岐が無い**。⚠️ `khg` のまま送ると
+             *     **brand が空文字で保存される**（実データで20件確認済み）。
+             *   ⚠️ ブランドキーは宛先ではないので、ここに置いても漏れる情報は無い。
+             */
+            if (location.state.brand === 'khg' && KHG_BRAND[updatedData.shop]) {
+                updatedData.brand = KHG_BRAND[updatedData.shop];
+            }
+
+            const response = (await postToGateway(
+                'form_register',
+                String(location.state.brand ?? ''),
+                updatedData
+            )).data;
+
+            if (response.status === "success") {
+                /**
+                 * ⚠️ khg は店舗ごとにサンクスページが違う。
+                 *   ⚠️ 対応表は src/api/brands.ts に集約した。
+                 *   ⚠️ 表に無い店舗は form_table.redirect へ落とす。
+                 */
+                if (location.state.brand === 'khg' && KHG_THANKS[postData.shop]) {
+                    window.parent.location.href = KHG_THANKS[postData.shop];
+                } else {
+                    window.parent.location.href = postData.redirect;
+                }
+            } else {
+                alert("フォームの登録に失敗しました。再度トライしてください。");
+                navigate(-1);
+            }
+        } catch (error) {
+            console.error("データ取得エラー:", error);
+            alert("通信エラーが発生しました");
+        } finally {
+            setLoading(false);
+        }
+    };
+
+
+    /**
+     * ⚠️ 2026-10-12: 見た目だけ作り直した（Dashboard 風の SaaS デザイン。publicForm.css）。
+     *   ⚠️ 出す項目・順番・送信（registerData）は ⚠️ **変えていない**。⚠️ 値が空の項目は出さない（今までどおり）。
+     */
+    const rows: { label: string; value: string }[] = [
+        { label: '来場希望場所', value: postData.shop },
+        { label: '来場希望日', value: postData.date },
+        { label: '来場希望時間', value: postData.time },
+        { label: 'お名前（漢字）', value: postData.sei ? `${postData.sei} ${postData.mei}` : '' },
+        { label: 'お名前（カナ）', value: postData.seiKana ? `${postData.seiKana} ${postData.meiKana}` : '' },
+        { label: '携帯電話', value: postData.phone },
+        { label: 'メールアドレス', value: postData.mail },
+        // ⚠️ 2026-10-12: LINE ID（入力があるときだけ）
+        { label: 'LINE ID', value: postData.line_id ?? '' },
+        { label: '郵便番号', value: postData.zip },
+        { label: '住所（都道府県市区町村）', value: postData.pref ? `${postData.pref}${postData.city}${postData.town}` : '' },
+        { label: '住所（番地・建物）', value: postData.street },
+        { label: 'ご予約のきっかけ', value: postData.medium },
+        { label: 'ご質問・ご要望', value: postData.question },
+    ].filter(row => Boolean(row.value));
+
+    return (
+        <div className="pf" style={{ ['--pf-accent' as string]: brandAccent(postData.brand || location.state?.brand) } as CSSProperties}>
+            {!imgCode || <div className="pf-logo"><img src={imgCode} alt="" /></div>}
+            <ol className="pf-steps" aria-label="お申し込みの流れ">
+                <li><span className="pf-step-num">1</span>入力</li>
+                <li aria-current="step"><span className="pf-step-num">2</span>確認</li>
+                <li><span className="pf-step-num">3</span>完了</li>
+            </ol>
+            <h1 className="pf-title" id='title'>入力内容をご確認ください</h1>
+            <p className="pf-lead" style={{ textAlign: 'center' }}>内容にお間違いがなければ、下のボタンでお申し込みください。</p>
+
+            <section className="pf-card" aria-labelledby="title">
+                <dl className="pf-summary">
+                    {rows.map(row => (
+                        <div className="pf-summary-row" key={row.label}>
+                            <dt>{row.label}</dt>
+                            <dd>{row.value}</dd>
+                        </div>
+                    ))}
+                </dl>
+            </section>
+
+            <div className="pf-actions">
+                <button type="button" className="pf-btn pf-btn-primary" aria-busy={loading} disabled={loading}
+                    onClick={!loading ? registerData : undefined}>
+                    {loading ? "送信中..." : "入力内容で申し込む"}
+                </button>
+            </div>
+        </div>)
+}
+
 export default Confirm
\ No newline at end of file
--- C:/Users/SHINJI~1/AppData/Local/Temp/claude/c--Users-shinji-kawano-react-dashboard/f17ffd00-1ebc-4533-a8d9-ede3c6283bd3/scratchpad/form_get_backup_2026-10-12/brands.ts	2026-10-12 11:21:44.620056900 +0900
+++ /c/Users/shinji-kawano/react/form_get/src/api/brands.ts	2026-10-12 11:22:33.691589200 +0900
@@ -34,6 +34,33 @@
     LOGO[(brand ?? '').trim()] ?? '';
 
 /**
+ * ブランドキー → 差し色（2026-10-12 追加。ボタン・入力欄の枠の色）。
+ *
+ * ⚠️ 色は Dashboard の `frontend/src/utils/setStyleClass.ts`（ブランド色）と同じ。
+ *   ⚠️ Dashboard の「キャンペーン作成」のプレビュー（`Campaign/formPreview.tsx`）にも同じ表がある。
+ *     ⚠️ **3か所とも揃えること**（片方だけ直すと、プレビューと実際のフォームで色が違う）。
+ * ⚠️ khg（グループ共通）は国分ハウジングの紺。⚠️ 知らないブランドは落とさず既定の紺。
+ * ⚠️ djh・2l はブランド色（#28aeba / #0d9f6d）のままだと ⚠️ 白い文字が読みにくい（ボタンの文字）ので、
+ *   ⚠️ **同じ色相で少し暗く**している。
+ */
+const ACCENT: Record<string, string> = {
+    kh: '#0f3675',
+    djh: '#1d8a94',
+    nagomi: '#956134',
+    'なごみ': '#956134',
+    '2l': '#0b8659',
+    jh: '#dc4235',
+    fh: '#cd3c33',
+    pg: '#1a1a1a',
+    khf: '#0d6d4b',
+    khg: '#0f3675',
+};
+const DEFAULT_ACCENT = '#0f3675';
+
+export const brandAccent = (brand: string | null | undefined): string =>
+    ACCENT[(brand ?? '').trim()] ?? DEFAULT_ACCENT;
+
+/**
  * ⚠️⚠️ `khg`（グループ共通フォーム）で店舗を選んだときの**実ブランド**。
  *
  *   ⚠️ ② は自分で解決できるが、**退避先（①）の PHP には khg の分岐が無い**。
```

## 全コード: 公開フォーム publicForm.css（新規）
```css
/*
 * 公開フォーム（入力 Form.tsx ／ 確認 Confirm.tsx）の見た目（2026-10-12 新規）。
 *
 * ─────────────────────────────────────────────
 * ⚠️ 色は1か所（下の .pf の変数）で決める。⚠️ 差し色（--pf-accent）だけブランドごとに
 *   画面側が style で渡す（src/api/brands.ts の brandAccent）。
 * ⚠️ 埋め込み先（各ブランドのサイト）は白地なので ⚠️ **明るい配色だけ**にしている（ダークモードは作らない）。
 *   ⚠️ 色はすべてここで明示する（⚠️ 埋め込み先の CSS に引きずられないため）。
 * ⚠️ 入力欄の文字は 16px。⚠️ 16px 未満だと iPhone で入力時に画面が拡大される。
 * ⚠️ Dashboard の「キャンペーン作成」のプレビュー（Campaign/formPreview.css）が ⚠️ **同じ見た目を写している**。
 *   ⚠️ ここを変えたらプレビューも揃えること。
 * ─────────────────────────────────────────────
 */

.pf {
    --pf-accent: #0f3675;
    --pf-ink: #1d2433;
    --pf-sub: #5b6476;
    --pf-line: #d5dbe5;
    --pf-surface: #f5f7fa;
    --pf-field: #ffffff;
    --pf-danger: #c62828;
    --pf-danger-bg: #fdecec;
    --pf-radius: 10px;

    max-width: 640px;
    margin: 0 auto;
    padding: 24px 16px 48px;
    color: var(--pf-ink);
    background: #ffffff;
    font-family: "Hiragino Sans", "Hiragino Kaku Gothic ProN", "Noto Sans JP", "Yu Gothic UI", Meiryo, sans-serif;
    font-size: 15px;
    line-height: 1.7;
    letter-spacing: .02em;
    -webkit-font-smoothing: antialiased;
}

.pf *,
.pf *::before,
.pf *::after {
    box-sizing: border-box;
}

/* ---- ロゴ・段階 ---- */
.pf-logo {
    display: flex;
    justify-content: center;
    margin: 8px 0 20px;
}
.pf-logo img {
    max-width: 260px;
    max-height: 72px;
    width: auto;
    height: auto;
    object-fit: contain;
}

.pf-steps {
    display: flex;
    justify-content: center;
    gap: 6px;
    margin: 0 0 24px;
    padding: 0;
    list-style: none;
    font-size: 12px;
    color: var(--pf-sub);
}
.pf-steps li {
    display: flex;
    align-items: center;
    gap: 6px;
}
.pf-steps li + li::before {
    content: "";
    width: 18px;
    height: 1px;
    background: var(--pf-line);
}
.pf-steps .pf-step-num {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 22px;
    height: 22px;
    border-radius: 50%;
    border: 1px solid var(--pf-line);
    background: #ffffff;
    font-size: 11px;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
}
.pf-steps li[aria-current="step"] {
    color: var(--pf-ink);
    font-weight: 700;
}
.pf-steps li[aria-current="step"] .pf-step-num {
    border-color: var(--pf-accent);
    background: var(--pf-accent);
    color: #ffffff;
}

.pf-title {
    margin: 0 0 6px;
    font-size: 20px;
    font-weight: 700;
    text-align: center;
    text-wrap: balance;
}
.pf-lead {
    margin: 0 0 20px;
    font-size: 14px;
    color: var(--pf-sub);
    text-align: justify;
    white-space: pre-line;
}

/* ---- まとまり（カード） ---- */
.pf-card {
    display: flex;
    flex-direction: column;
    gap: 18px;
    padding: 20px;
    margin: 0 0 16px;
    border: 1px solid var(--pf-line);
    border-radius: 14px;
    background: #ffffff;
    box-shadow: 0 1px 2px rgba(29, 36, 51, .04);
}
.pf-card-title {
    margin: 0;
    font-size: 13px;
    font-weight: 700;
    color: var(--pf-sub);
    letter-spacing: .08em;
}

/* ---- 項目 ---- */
.pf-row {
    display: grid;
    grid-template-columns: 1fr;
    gap: 18px;
}
@media (min-width: 480px) {
    .pf-row.pf-row-2 {
        grid-template-columns: 1fr 1fr;
    }
}

.pf-field {
    display: flex;
    flex-direction: column;
    gap: 6px;
    min-width: 0;
}
.pf-label {
    display: flex;
    align-items: flex-start;
    gap: 6px;
    margin: 0;
    font-size: 13px;
    font-weight: 600;
    line-height: 1.5;
    color: var(--pf-ink);
}
.pf-badge {
    flex: none;
    display: inline-block;
    padding: 1px 7px;
    border-radius: 999px;
    font-size: 11px;
    font-weight: 700;
    line-height: 1.6;
    letter-spacing: .04em;
}
.pf-badge-req {
    background: var(--pf-danger-bg);
    color: var(--pf-danger);
}
.pf-badge-opt {
    background: var(--pf-surface);
    color: var(--pf-sub);
}

.pf-input,
.pf-select,
.pf-textarea {
    width: 100%;
    min-height: 48px;
    padding: 10px 14px;
    border: 1px solid var(--pf-line);
    border-radius: var(--pf-radius);
    background: var(--pf-field);
    color: var(--pf-ink);
    font: inherit;
    font-size: 16px;
    line-height: 1.5;
    transition: border-color .15s, box-shadow .15s;
    appearance: none;
    -webkit-appearance: none;
}
.pf-select {
    padding-right: 40px;
    background-image: linear-gradient(45deg, transparent 50%, var(--pf-sub) 50%), linear-gradient(135deg, var(--pf-sub) 50%, transparent 50%);
    background-position: calc(100% - 20px) 50%, calc(100% - 15px) 50%;
    background-size: 5px 5px, 5px 5px;
    background-repeat: no-repeat;
}
.pf-textarea {
    min-height: 120px;
    resize: vertical;
}
.pf-input::placeholder,
.pf-textarea::placeholder {
    color: #9aa3b2;
}
.pf-input:focus,
.pf-select:focus,
.pf-textarea:focus {
    outline: none;
    border-color: var(--pf-accent);
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--pf-accent) 22%, transparent);
}
.pf-field[data-invalid="1"] .pf-input,
.pf-field[data-invalid="1"] .pf-select,
.pf-field[data-invalid="1"] .pf-textarea {
    border-color: var(--pf-danger);
}
/* ⚠️ 日付の入力欄は全体を押して暦を出す（既存の挙動） */
.pf input[type=date] {
    position: relative;
}

.pf-error {
    display: flex;
    align-items: center;
    gap: 6px;
    margin: 0;
    font-size: 12px;
    font-weight: 600;
    color: var(--pf-danger);
}
.pf-error::before {
    content: "!";
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex: none;
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background: var(--pf-danger);
    color: #ffffff;
    font-size: 11px;
    font-weight: 700;
}

/* 郵便番号 ＋ 住所検索 */
.pf-inline {
    display: flex;
    gap: 8px;
    align-items: stretch;
}
.pf-inline .pf-input {
    flex: 1;
}

/* ---- ボタン ---- */
.pf-actions {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
    margin: 28px 0 0;
}
.pf-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    min-height: 44px;
    padding: 10px 18px;
    border-radius: var(--pf-radius);
    border: 1px solid var(--pf-line);
    background: #ffffff;
    color: var(--pf-ink);
    font: inherit;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    white-space: nowrap;
    transition: filter .15s, background-color .15s;
}
.pf-btn:hover {
    background: var(--pf-surface);
}
.pf-btn:focus-visible {
    outline: 3px solid color-mix(in srgb, var(--pf-accent) 35%, transparent);
    outline-offset: 2px;
}
.pf-btn-primary {
    width: 100%;
    max-width: 360px;
    min-height: 54px;
    border-color: var(--pf-accent);
    background: var(--pf-accent);
    color: #ffffff;
    font-size: 16px;
    font-weight: 700;
    letter-spacing: .06em;
}
.pf-btn-primary:hover {
    background: var(--pf-accent);
    filter: brightness(.92);
}
.pf-btn-primary[aria-busy="true"],
.pf-btn-primary:disabled {
    filter: grayscale(.4) brightness(1.05);
    cursor: progress;
}
.pf-btn-sub {
    font-size: 12px;
    color: var(--pf-sub);
}

/* ---- 注意事項・特典条件 ---- */
.pf-note {
    margin: 0;
    padding: 14px 16px;
    border-radius: var(--pf-radius);
    background: var(--pf-surface);
    color: var(--pf-sub);
    font-size: 13px;
    text-align: justify;
    white-space: pre-line;
}
.pf-sheet-backdrop {
    position: fixed;
    inset: 0;
    z-index: 1000;
    display: flex;
    align-items: flex-end;
    justify-content: center;
    padding: 16px;
    background: rgba(29, 36, 51, .35);
}
.pf-sheet {
    width: 100%;
    max-width: 560px;
    max-height: 80vh;
    overflow: auto;
    padding: 20px;
    border-radius: 16px;
    background: #ffffff;
    box-shadow: 0 12px 32px rgba(29, 36, 51, .25);
}
.pf-sheet-title {
    margin: 0 0 8px;
    font-size: 15px;
    font-weight: 700;
}
.pf-sheet-body {
    margin: 0 0 16px;
    font-size: 13px;
    color: var(--pf-danger);
    white-space: pre-line;
}

/* ---- 確認画面 ---- */
.pf-summary {
    margin: 0;
}
.pf-summary-row {
    display: grid;
    grid-template-columns: 1fr;
    gap: 2px;
    padding: 12px 0;
    border-bottom: 1px solid var(--pf-line);
}
.pf-summary-row:last-child {
    border-bottom: none;
}
@media (min-width: 480px) {
    .pf-summary-row {
        grid-template-columns: 180px 1fr;
        gap: 16px;
    }
}
.pf-summary dt {
    font-size: 13px;
    font-weight: 600;
    color: var(--pf-sub);
}
.pf-summary dd {
    margin: 0;
    font-size: 15px;
    font-weight: 600;
    color: var(--pf-ink);
    word-break: break-word;
    white-space: pre-line;
}

/* ---- 読み込み中・読めない ---- */
.pf-state {
    padding: 48px 16px;
    text-align: center;
    font-size: 14px;
    color: var(--pf-sub);
    line-height: 1.9;
}

@media (prefers-reduced-motion: reduce) {
    .pf *,
    .pf *::before,
    .pf *::after {
        transition: none !important;
        animation: none !important;
    }
}
```

## 差分: Dashboard（task-04 のコミットからの差、全文。新規ファイルも含む）
```diff
diff --git a/frontend/src/components/campaign/NewCampaign.tsx b/frontend/src/components/campaign/NewCampaign.tsx
index 62d02d64..ffc01c5a 100644
--- a/frontend/src/components/campaign/NewCampaign.tsx
+++ b/frontend/src/components/campaign/NewCampaign.tsx
@@ -1,14 +1,17 @@
 import React, { useEffect, useState, useContext } from 'react';
-import Table from "react-bootstrap/Table";
 import { useNavigate, useLocation } from "react-router-dom";
 import { fetchDetail, fetchMaster, insertCampaign, updateCampaign } from './campaignApi';
 import AuthContext from '../../context/AuthContext';
 import { PLACEHOLDERS, unknownPlaceholders } from './mailTemplateFields';
+// ⚠️ v2.2.188: 画面の作り直し（Dashboard 風の SaaS デザイン）と、右側の公開フォームのプレビュー
+import FormPreview from './formPreview';
+import './newCampaign.css';
 
 type BooleanKeys =
     'thanks';
 
-type FormState = {
+/** ⚠️ v2.2.188: プレビュー（formPreview.tsx）が型だけ使うので export する */
+export type FormState = {
     brand: string;
     campaign: string;
     campaign_id: string;
@@ -237,9 +240,7 @@ const NewCampaign = () => {
         },
     });
     const [response, setResponse] = useState<Response>();
-    const [newShop, setNewShop] = useState<string>('');
-    const [newTime, setNewTime] = useState<string>('');
-    const [newMedium, setNewMedium] = useState<string>('');
+    // ⚠️ v2.2.188: 選択肢の追加欄（newShop / newTime / newMedium）は OptionList が持つようにした
     const [validation, setValidation] = useState<string[]>([]);
     /**
      * ⚠️ 設定を読めなかったことを画面に出すため。
@@ -453,52 +454,38 @@ const NewCampaign = () => {
         const unknown = [...unknownPlaceholders(subject), ...unknownPlaceholders(body)];
         const isDefault = subject.trim() === '' && body.trim() === '';
 
+        // ⚠️ v2.2.188: 見た目だけ newCampaign.css に合わせた（⚠️ 中身・「空欄＝既定」の決まりは同じ）
         return (
-            <div>
-                <div className="d-flex align-items-center mb-2" style={{ gap: '10px', flexWrap: 'wrap' }}>
-                    <span style={{ fontSize: '12px', color: '#666' }}>{note}</span>
-                    <span style={{
-                        fontSize: '11px', padding: '2px 10px', borderRadius: '999px',
-                        backgroundColor: isDefault ? '#eef2f7' : '#fff7ed',
-                        color: isDefault ? '#4b5563' : '#b45309',
-                    }}>
+            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
+                <div className="d-flex align-items-center" style={{ gap: '10px', flexWrap: 'wrap' }}>
+                    <span className="nc-hint" style={{ fontSize: '12px' }}>{note}</span>
+                    <span className={`nc-tag ${isDefault ? 'nc-tag-default' : 'nc-tag-custom'}`}>
                         {isDefault ? '既定の文面' : 'このキャンペーン専用'}
                     </span>
                     {isDefault ||
-                        <button type="button"
-                            onClick={() => { changeTemplate(subjectKey, ''); changeTemplate(bodyKey, ''); }}
-                            style={{
-                                fontSize: '11px', border: '1px solid #d1d5db', borderRadius: '999px',
-                                background: '#fff', padding: '2px 12px', cursor: 'pointer',
-                            }}>
+                        <button type="button" className="nc-btn nc-btn-ghost" style={{ minHeight: '26px', padding: '2px 10px', fontSize: '11px' }}
+                            onClick={() => { changeTemplate(subjectKey, ''); changeTemplate(bodyKey, ''); }}>
                             既定に戻す
                         </button>}
                 </div>
 
-                <input type="text" className="form-control mb-2" value={subject}
-                    placeholder="件名（空欄なら既定）"
-                    onChange={(e) => changeTemplate(subjectKey, e.target.value)}
-                    style={{ fontSize: '12px' }} />
+                <input type="text" className="nc-input" value={subject}
+                    placeholder="件名（空欄なら既定）" aria-label={`${note} 件名`}
+                    onChange={(e) => changeTemplate(subjectKey, e.target.value)} />
 
-                <textarea value={body} rows={10}
-                    placeholder="本文（空欄なら既定の文面が送られます）"
-                    onChange={(e) => changeTemplate(bodyKey, e.target.value)}
-                    style={{
-                        width: '100%', border: '1px solid #D3D3D3', borderRadius: '7px',
-                        fontSize: '12px', letterSpacing: '.7px', padding: '6px',
-                    }} />
+                <textarea className="nc-textarea" value={body} rows={8}
+                    placeholder="本文（空欄なら既定の文面が送られます）" aria-label={`${note} 本文`}
+                    onChange={(e) => changeTemplate(bodyKey, e.target.value)} />
 
                 {unknown.length === 0 ||
-                    <div style={{ color: '#b45309', fontSize: '12px', marginTop: '4px' }}>
+                    <p className="nc-warn">
                         {`差し込めない語があります：${unknown.map(k => `{{${k}}}`).join(' ')}`}
                         <span className="ms-1">そのまま本文に出ます。</span>
-                    </div>}
+                    </p>}
 
-                <details style={{ marginTop: '6px' }}>
-                    <summary style={{ fontSize: '12px', cursor: 'pointer', color: '#2563eb' }}>
-                        使える差し込み語
-                    </summary>
-                    <div style={{ fontSize: '11px', color: '#4b5563', lineHeight: 1.9, marginTop: '4px' }}>
+                <details className="nc-details">
+                    <summary>使える差し込み語</summary>
+                    <div style={{ fontSize: '11px', color: '#525f7f', lineHeight: 1.9, marginTop: '4px' }}>
                         {PLACEHOLDERS.map(item => (
                             <div key={item.key}>
                                 <code>{`{{${item.key}}}`}</code>
@@ -554,1216 +541,367 @@ const NewCampaign = () => {
         }
     }, [response])
 
+    /**
+     * ─────────────────────────────────────────────
+     * ⚠️ v2.2.188: 画面を作り直した（Dashboard 風の SaaS デザイン。newCampaign.css）。
+     *   左: 設定のカード ／ 右: 公開フォームのプレビュー（formPreview.tsx。⚠️ 入力するとその場で反映）／ 下: 保存バー
+     * ⚠️ 保存（postForm）・読み込み・入力チェックは ⚠️ **変えていない**。⚠️ 送る中身（form）の形も同じ。
+     * ⚠️ 項目の「表示する」「必須／任意」は ⚠️ **patch で bool / required だけを書き換える**。
+     *   ⚠️ 以前は changeForm(項目名) を使っており、shop / date / medium 以外は ⚠️ **項目の設定ごと '' で上書き**していた
+     *     （チェックを外すと文言・必須が消え、もう一度付けても戻らなかった）。
+     *   ⚠️ 販促媒体の選択肢の編集・追加は ⚠️ `...prev.shop` を広げていたため、来場希望場所の設定が販促媒体へ混ざっていた。
+     *     → OptionList に置き換え、⚠️ 販促媒体は販促媒体だけを書き換える。
+     * ─────────────────────────────────────────────
+     */
+    type ItemKey = 'shop' | 'date' | 'name' | 'kana' | 'age' | 'phone' | 'mail' | 'line_id' | 'address' | 'medium' | 'question';
+    const patch = <K extends ItemKey | 'notice' | 'attention'>(key: K, value: Partial<FormState[K]>) =>
+        setForm(prev => ({ ...prev, [key]: { ...prev[key], ...value } }));
+
+    /** 表示する／必須・任意 の切り替え。⚠️ bool・required だけを書き換える（他の設定は残す） */
+    const setFlag = (key: ItemKey, flag: 'bool' | 'required', value: boolean) =>
+        setForm(prev => ({ ...prev, [key]: { ...prev[key], [flag]: value } }));
+
+    /** 項目の行（表示する ／ 必須・任意）。⚠️ 中身は children */
+    const item = (key: ItemKey, title: string, children: React.ReactNode, hiddenChildren?: React.ReactNode) => (
+        <FieldItem
+            key={key}
+            title={title}
+            shown={Boolean(form[key].bool)}
+            onShown={(v) => setFlag(key, 'bool', v)}
+            required={Boolean(form[key].required)}
+            onRequired={(v) => setFlag(key, 'required', v)}
+            hiddenChildren={hiddenChildren}
+        >
+            {children}
+        </FieldItem>
+    );
+
+    const isEdit = Boolean(idValue);
+
     return (
-        <>
-            <div className='content database bg-white p-2'>
-                <div className="table-wrapper">
-                    <div className="list_table">
-                        <div className='bg-light w-75' style={{ position: 'fixed', bottom: '0', height: '130px', zIndex: '100' }}>
-                            <div className="p-3 rounded-pill" style={{ width: '400px', margin: '40px auto', textAlign: 'center', cursor: 'pointer', backgroundColor: 'blue', color: '#fff', textDecoration: 'none' }} onClick={() => postForm()}>{!idValue ? '入力内容でキャンペーン登録' : '入力内容でキャンペーン修正'}</div>
+        <div className="nc">
+            <header className="nc-header">
+                <img className="nc-header-logo" src={`https://khg-marketing.info/dashboard/form/img/${brandValue}.png`} alt="" />
+                <div>
+                    <p className="nc-crumb">キャンペーン一覧 ／ {isEdit ? '修正' : '新規作成'}</p>
+                    <h1 className="nc-title">{isEdit ? 'キャンペーン修正' : 'キャンペーン作成'}</h1>
+                </div>
+                <div className="nc-header-actions">
+                    <button type="button" className="nc-btn" onClick={() => navigate(`/campaign/?brand=${brandValue ?? ''}`)}>
+                        <i className="fa-solid fa-arrow-left" aria-hidden="true"></i>一覧へ戻る
+                    </button>
+                </div>
+            </header>
+
+            {/**
+              * ⚠️⚠️ **読み込めなかったことを必ず画面に出す。**
+              *   ⚠️ 出さないと「修正を押したのに反映されない」としか見えず、
+              *     利用者にも受けた側にも原因が分からない。
+              */}
+            {!loadError ||
+                <div className="nc-alert" role="alert">
+                    {loadError}
+                    <small>このまま保存すると内容が上書きされます。一覧に戻ってやり直してください。</small>
+                </div>}
+
+            <div className="nc-layout">
+                <div className="nc-main">
+                    {/* ---- 基本情報 ---- */}
+                    <section className="nc-card" aria-labelledby="nc-basic">
+                        <div className="nc-card-head">
+                            <h2 className="nc-card-title" id="nc-basic">基本情報</h2>
+                            <p className="nc-card-desc">キャンペーン名は反響メールの件名になります</p>
                         </div>
-                        <div className="bg-white" style={{ width: '90%', maxWidth: '960px', margin: '0 auto', paddingBottom: '200px' }}>
-                            <div className="pt-3" style={{ width: '200px', margin: '0 auto' }}>
-                                <img src={`https://khg-marketing.info/dashboard/form/img/${brandValue}.png`} className="w-100" />
+                        <div className="nc-card-body">
+                            <TextField id="campaign" label="キャンペーン名" required value={form.campaign}
+                                placeholder="例）20**【KH**】****キャンペーン"
+                                error={validation.includes('campaign') ? 'キャンペーン名が未入力です' : ''}
+                                onChange={(v) => changeForm('campaign', v)} />
+                            <TextField id="campaign_id" label="キャンペーンID" required value={form.campaign_id} disabled={isEdit}
+                                placeholder="例）20**0101_kh**_***campaign"
+                                hint={isEdit ? '登録後は変更できません' : '重複不可・半角英数のみ'}
+                                error={validation.includes('campaign_id') ? 'キャンペーンIDが未入力です' : ''}
+                                onChange={(v) => changeForm('campaign_id', v)} />
+                            <TextField id="redirect" label="送信後に表示するページ（リダイレクトURL）" required value={form.redirect}
+                                placeholder="https://"
+                                error={validation.includes('redirect') ? 'リダイレクトURLが未入力です' : ''}
+                                onChange={(v) => changeForm('redirect', v)} />
+                        </div>
+                    </section>
+
+                    {/* ---- 通知・メール ---- */}
+                    <section className="nc-card" aria-labelledby="nc-mail">
+                        <div className="nc-card-head">
+                            <h2 className="nc-card-title" id="nc-mail">通知とメール</h2>
+                            <p className="nc-card-desc">反響が届いたときの社内通知と、お客様へのサンクスメール</p>
+                        </div>
+                        <div className="nc-card-body">
+                            <div className="nc-grid-2">
+                                <TextField id="mail_to" label="反響アドレス（To）" required value={form.mail_to}
+                                    error={validation.includes('mail_to') ? '反響アドレス(To)が未入力です' : ''}
+                                    onChange={(v) => changeForm('mail_to', v)} />
+                                <TextField id="mail_cc" label="反響アドレス（Cc）" required value={form.mail_cc}
+                                    error={validation.includes('mail_cc') ? '反響アドレス(Cc)が未入力です' : ''}
+                                    onChange={(v) => changeForm('mail_cc', v)} />
                             </div>
-                            <div className="w-100 pt-3" style={{ fontSize: '15px', textAlign: 'center', marginBottom: '30px' }}>
-                                {idValue ? 'キャンペーン修正' : 'キャンペーン作成'}
+                            <div className="nc-field">
+                                <span className="nc-label">サンクスメール</span>
+                                <Segmented value={form.thanks} trueLabel="送る" falseLabel="送らない"
+                                    onChange={(v) => setForm(prev => ({ ...prev, thanks: v }))} />
                             </div>
-
-                            {/**
-                              * ⚠️⚠️ **読み込めなかったことを必ず画面に出す。**
-                              *   ⚠️ 出さないと「修正を押したのに反映されない」としか見えず、
-                              *     利用者にも受けた側にも原因が分からない。
-                              */}
-                            {!loadError ||
-                                <div className="border rounded p-3 mb-4 text-center"
-                                    style={{ fontSize: '13px', color: '#dc3545', backgroundColor: '#fff5f5' }}>
-                                    {loadError}<br />
-                                    <span style={{ fontSize: '11px', color: '#666' }}>
-                                        このまま保存すると内容が上書きされます。一覧に戻ってやり直してください。
-                                    </span>
-                                </div>}
-                            <Table style={{ width: '90%', margin: '0 auto' }}>
-                                <tbody style={{ border: '1px solid #d3d3d3ff' }}>
-                                    <tr style={{ fontSize: '13px' }}>
-                                        <td style={{ width: '200px', textAlign: 'center', verticalAlign: 'middle' }}>
-                                            キャンペーン名
-                                        </td>
-                                        <td>
-                                            <div><input type="text" className="form-control" value={form.campaign} id='campaign' onChange={(e) => changeForm('campaign', e.target.value)} placeholder='例)20**【KH**】****キャンペーン ※反響メールのタイトルになります' /></div>
-                                            {!validation.includes('campaign') || <div style={{ color: 'red', marginTop: '-5px' }}>キャンペーン名が未入力です</div>}
-                                        </td>
-                                    </tr >
-                                    <tr style={{ fontSize: '13px' }}>
-                                        <td style={{ width: '200px', textAlign: 'center', verticalAlign: 'middle' }}>
-                                            キャンペーンID
-                                        </td>
-                                        <td>
-                                            <div><input type="text" className="form-control" value={form.campaign_id} onChange={(e) => changeForm('campaign_id', e.target.value)} disabled={!!idValue} placeholder='例)20**0101_kh**_***campaign ※重複不可 半角英数のみ使用' /></div>
-                                            {!validation.includes('campaign_id') || <div style={{ color: 'red', marginTop: '-5px' }}>キャンペーンIDが未入力です</div>}
-                                        </td>
-                                    </tr>
-                                    <tr style={{ fontSize: '13px' }}>
-                                        <td style={{ width: '200px', textAlign: 'center', verticalAlign: 'middle' }}>
-                                            反響アドレス(To)
-                                        </td>
-                                        <td>
-                                            <div><input type="text" className="form-control" value={form.mail_to} onChange={(e) => changeForm('mail_to', e.target.value)} /></div>
-                                            {!validation.includes('mail_to') || <div style={{ color: 'red', marginTop: '-5px' }}>反響アドレス(To)が未入力です</div>}
-                                        </td>
-                                    </tr>
-                                    <tr style={{ fontSize: '13px' }}>
-                                        <td style={{ width: '200px', textAlign: 'center', verticalAlign: 'middle' }}>
-                                            反響アドレス(Cc)
-                                        </td>
-                                        <td>
-                                            <div><input type="text" className="form-control" value={form.mail_cc} onChange={(e) => changeForm('mail_cc', e.target.value)} /></div>
-                                            {!validation.includes('mail_cc') || <div style={{ color: 'red', marginTop: '-5px' }}>反響アドレス(Cc)が未入力です</div>}
-                                        </td>
-                                    </tr>
-                                    <tr style={{ fontSize: '13px' }}>
-                                        <td style={{ width: '200px', textAlign: 'center', verticalAlign: 'middle' }}>
-                                            サンクスメール
-                                        </td>
-                                        <td>
-                                            <div className="d-flex align-items-center mb-3">
-                                                <div>
-                                                    <input type="radio" name='thanks' style={{ transform: 'scale(1.5)', cursor: 'pointer' }} checked={form.thanks === true} onChange={() => changeForm('thanks')} />
-                                                </div>
-                                                <div className="ms-2">
-                                                    送る
-                                                </div>
-                                            </div>
-                                            <div className="d-flex align-items-center">
-                                                <div>
-                                                    <input type="radio" name='thanks' style={{ transform: 'scale(1.5)', cursor: 'pointer' }} checked={form.thanks === false} onChange={() => changeForm('thanks')} />
-                                                </div>
-                                                <div className="ms-2">
-                                                    不要
-                                                </div>
-                                            </div>
-                                        </td>
-                                    </tr>
-                                    <tr style={{ fontSize: '13px' }}>
-                                        <td style={{ width: '200px', textAlign: 'center', verticalAlign: 'middle' }}>
-                                            サンクスメールの文面
-                                        </td>
-                                        <td>
-                                            {mailTemplateEditor('thanks_subject', 'thanks_body', 'お客様へ届くメールです。')}
-                                        </td>
-                                    </tr>
-                                    <tr style={{ fontSize: '13px' }}>
-                                        <td style={{ width: '200px', textAlign: 'center', verticalAlign: 'middle' }}>
-                                            通知メールの文面
-                                        </td>
-                                        <td>
-                                            {mailTemplateEditor('internal_subject', 'internal_body', '社内（反響アドレス）へ届くメールです。')}
-                                        </td>
-                                    </tr>
-                                    <tr style={{ fontSize: '13px' }}>
-                                        <td style={{ width: '200px', textAlign: 'center', verticalAlign: 'middle' }}>
-                                            リダイレクトURL
-                                        </td>
-                                        <td>
-                                            <div><input type="text" className="form-control" value={form.redirect} onChange={(e) => changeForm('redirect', e.target.value)} /></div>
-                                            {!validation.includes('redirect') || <div style={{ color: 'red', marginTop: '-5px' }}>リダイレクトURLが未入力です</div>}
-                                        </td>
-                                    </tr>
-                                    <tr style={{ fontSize: '13px' }}>
-                                        <td style={{ textAlign: 'center', verticalAlign: 'middle' }}>
-                                            <div>注意書き</div><div style={{ marginLeft: '75px' }}><input type="checkbox" className="ms-2 form-check" style={{ width: '20px', margin: '0 auto' }} checked={form.notice.bool} onChange={() => changeForm('notice')} /></div>
-                                        </td>
-                                        <td>
-                                            <div style={{ fontSize: '13px', letterSpacing: '1px' }}>
-                                                <textarea value={form.notice.text} style={{ width: '100%', border: '1px solid #D3D3D3', borderRadius: '7px', fontSize: '12px', letterSpacing: '.7px' }} rows={5}
-                                                    onChange={(e) =>
-                                                        setForm(prev => ({
-                                                            ...prev,
-                                                            notice: {
-                                                                ...prev.notice,
-                                                                text: e.target.value
-                                                            }
-                                                        }))
-                                                    }></textarea>
-                                            </div>
-                                        </td>
-                                    </tr>
-                                    <tr style={{ fontSize: '13px', verticalAlign: 'middle' }}>
-                                        <td style={{ textAlign: 'center' }}>
-                                            <div>来場希望場所</div><div style={{ marginLeft: '75px' }}><input type="checkbox" className="ms-2 form-check" style={{ width: '20px', margin: '0 auto' }} checked={form.shop.bool} onChange={() => changeForm('shop')} /></div>
-                                        </td>
-                                        <td>
-                                            {/**
-                                              * ⚠️⚠️ **聞かないときは、代わりに入れておく値を選ばせる**（2026-09-16 の指示）。
-                                              *   ⚠️ 例: 店舗が1つに決まっているLPで、来場希望場所を尋ねずに固定する。
-                                              *   ⚠️ 空のままなら今までどおり（何も入らない）。
-                                              *   ⚠️ 候補は下の「選択肢」をそのまま使う。**別に持たせない**
-                                              *     （持たせると選択肢を直したときに片方だけ古くなる）。
-                                              */}
-                                            {form.shop.bool ||
-                                                <div className="mb-3 p-2" style={{ backgroundColor: '#f8f9fa', borderRadius: '6px' }}>
-                                                    <div style={{ fontSize: '12px', marginBottom: '4px' }}>
-                                                        聞かない代わりに、この値で登録する
-                                                    </div>
-                                                    <select
-                                                        value={form.shop.default ?? ''}
-                                                        style={{ fontSize: '13px', padding: '3px 6px', minWidth: '260px', maxWidth: '100%' }}
-                                                        onChange={(e) => setForm(prev => ({
-                                                            ...prev,
-                                                            shop: { ...prev.shop, default: e.target.value }
-                                                        }))}
-                                                    >
-                                                        <option value="">指定しない</option>
-                                                        {form.shop.shopName.map((item, index) =>
-                                                            <option key={index} value={item}>{item}</option>)}
-                                                    </select>
-                                                    {form.shop.shopName.length > 0 ||
-                                                        <div className="text-muted" style={{ fontSize: '11px', marginTop: '4px' }}>
-                                                            ⚠️ 選択肢がまだありません。下で追加すると選べます。
-                                                        </div>}
-                                                </div>}
-
-                                            <div>
-                                                <div className="d-flex align-items-center mb-2">
-                                                    <div>
-                                                        <input type="radio" name='shop' style={{ transform: 'scale(1.3)', cursor: 'pointer' }} checked={form.shop.required === true}
-                                                            onChange={() =>
-                                                                setForm(prev => ({
-                                                                    ...prev,
-                                                                    shop: {
-                                                                        ...prev.shop,
-                                                                        required: !prev.shop.required
-                                                                    }
-                                                                }))
-                                                            } />
-                                                    </div>
-                                                    <div className="ms-1">
-                                                        必須
-                                                    </div>
-                                                    <div>
-                                                        <input type="radio" name='shop' style={{ transform: 'scale(1.3)', cursor: 'pointer', marginLeft: '20px' }} checked={form.shop.required === false}
-                                                            onChange={() =>
-                                                                setForm(prev => ({
-                                                                    ...prev,
-                                                                    shop: {
-                                                                        ...prev.shop,
-                                                                        required: !prev.shop.required
-                                                                    }
-                                                                }))
-                                                            } />
-                                                    </div>
-                                                    <div className="ms-1">
-                                                        任意
-                                                    </div>
-                                                </div>
-                                                <div className="d-flex align-items-center">
-                                                    {!form.shop.required || <div style={{ backgroundColor: 'red', width: 'fit-content', color: '#fff', fontSize: '10px', padding: '2px 4px', borderRadius: '7px', marginRight: '3px' }}>必須</div>}<input type="text" style={{ width: '80%', border: '1px solid #D3D3D3', borderRadius: '7px', fontSize: '12px', letterSpacing: '.7px' }} value={form.shop.text}
-                                                        onChange={(e) =>
-                                                            setForm(prev => ({
-                                                                ...prev,
-                                                                shop: {
-                                                                    ...prev.shop,
-                                                                    text: e.target.value
-                                                                }
-                                                            }))
-                                                        } />
-                                                </div>
-                                                <div>
-                                                    <div className="">
-                                                        <select style={{ width: '100%', height: '40px', borderRadius: '7px', fontSize: '14px', letterSpacing: '.7px', border: '1px solid #D3D3D3' }} name="shop" required>
-                                                            <option value="">選択してください</option>
-                                                            {form.shop.shopName.map((item, index) =>
-                                                                <option key={index}>{item}</option>
-                                                            )}
-                                                        </select>
-                                                    </div>
-                                                    <div className="mt-2">
-                                                        {form.shop.shopName.map((item, index) =>
-                                                            <div className="d-flex align-items-center" key={index} >
-                                                                <div style={{ width: '90%' }}>
-                                                                    <input type="text" value={item} style={{ width: '100%', height: '30px', borderRadius: '2px', fontSize: '12px', letterSpacing: '.7px', marginBottom: '2px', border: '1px solid #D3D3D3' }}
-                                                                        onChange={(e) => setForm(prev => {
-                                                                            const newShops: string[] = [...prev.shop.shopName];
-                                                                            newShops[index] = e.target.value;
-                                                                            return {
-                                                                                ...prev,
-                                                                                shop: {
-                                                                                    ...prev.shop,
-                                                                                    shopName: newShops
-                                                                                }
-                                                                            }
-                                                                        })
-                                                                        } />
-                                                                </div>
-                                                                <div style={{ width: '10%', marginLeft: '6px' }}>
-                                                                    <button style={{ backgroundColor: '#DDD', borderRadius: '4px', border: 'none' }}
-                                                                        onClick={() => setForm(prev => {
-                                                                            const newShops: string[] = prev.shop.shopName.filter((_, i) => i !== index);
-                                                                            return {
-                                                                                ...prev,
-                                                                                shop: {
-                                                                                    ...prev.shop,
-                                                                                    shopName: newShops
-                                                                                }
-                                                                            }
-                                                                        })
-                                                                        }>削除</button>
-                                                                </div>
-                                                            </div>
-                                                        )}
-                                                        <div className="d-flex align-items-center">
-                                                            <div style={{ width: '90%' }}>
-                                                                <input type="text" style={{ width: '100%', height: '30px', borderRadius: '2px', fontSize: '12px', letterSpacing: '.7px', marginBottom: '2px', border: '1px solid #D3D3D3' }} value={newShop} onChange={(e) => setNewShop(e.target.value)} />
-                                                            </div>
-                                                            <div style={{ width: '10%', marginLeft: '6px' }}>
-                                                                <button style={{ backgroundColor: '#DDD', borderRadius: '4px', border: 'none' }}
-                                                                    onClick={() => {
-                                                                        if (!newShop) return;
-                                                                        setForm(prev => {
-                                                                            const newShops: string[] = [...prev.shop.shopName];
-                                                                            newShops.push(newShop);
-                                                                            return {
-                                                                                ...prev,
-                                                                                shop: {
-                                                                                    ...prev.shop,
-                                                                                    shopName: newShops
-                                                                                }
-                                                                            }
-                                                                        });
-                                                                        setNewShop('');
-                                                                    }}>追加</button>
-                                                            </div>
-                                                        </div>
-                                                    </div>
-                                                </div>
-                                            </div>
-                                        </td>
-                                    </tr>
-                                    <tr style={{ fontSize: '13px', verticalAlign: 'middle' }}>
-                                        <td style={{ textAlign: 'center' }}>
-                                            <div>来場希望時間</div><div style={{ marginLeft: '75px' }}><input type="checkbox" className="ms-2 form-check" style={{ width: '20px', margin: '0 auto' }} checked={form.date.bool} onChange={() => changeForm('date')} /></div>
-                                        </td>
-                                        <td>
-                                            <div className="d-flex align-items-center mb-2">
-                                                <div>
-                                                    <input type="radio" name='date' style={{ transform: 'scale(1.3)', cursor: 'pointer' }} checked={form.date.required === true}
-                                                        onChange={() =>
-                                                            setForm(prev => ({
-                                                                ...prev,
-                                                                date: {
-                                                                    ...prev.date,
-                                                                    required: !prev.date.required
-                                                                }
-                                                            }))
-                                                        } />
-                                                </div>
-                                                <div className="ms-1">
-                                                    必須
-                                                </div>
-                                                <div>
-                                                    <input type="radio" name='date' style={{ transform: 'scale(1.3)', cursor: 'pointer', marginLeft: '20px' }} checked={form.date.required === false}
-                                                        onChange={() =>
-                                                            setForm(prev => ({
-                                                                ...prev,
-                                                                date: {
-                                                                    ...prev.date,
-                                                                    required: !prev.date.required
-                                                                }
-                                                            }))
-                                                        } />
-                                                </div>
-                                                <div className="ms-1">
-                                                    任意
-                                                </div>
-                                            </div>
-                                            <div className="row">
-                                                <div className="col">
-                                                    <div className="d-flex align-items-center">
-                                                        {!form.date.required || <div style={{ backgroundColor: 'red', width: 'fit-content', color: '#fff', fontSize: '10px', padding: '2px 4px', borderRadius: '7px', marginRight: '3px' }}>必須</div>}
-                                                        <input type="text" style={{ width: '80%', border: '1px solid #D3D3D3', borderRadius: '7px', fontSize: '12px', letterSpacing: '.7px' }} value={form.date.text_day}
-                                                            onChange={(e) =>
-                                                                setForm(prev => ({
-                                                                    ...prev,
-                                                                    date: {
-                                                                        ...prev.date,
-                                                                        text_day: e.target.value
-                                                                    }
-                                                                }))
-                                                            } />
-                                                    </div>
-                                                    <div >
-                                                        <input type="date" style={{ height: '40px', borderRadius: '7px', fontSize: '14px', letterSpacing: '.7px', width: '100%', border: '1px solid #D3D3D3' }} />
-                                                    </div>
-                                                </div>
-                                                <div className="col">
-                                                    <div className="d-flex align-items-center">
-                                                        {!form.date.required || <div style={{ backgroundColor: 'red', width: 'fit-content', color: '#fff', fontSize: '10px', padding: '2px 4px', borderRadius: '7px', marginRight: '3px' }}>必須</div>}
-                                                        <input type="text" style={{ width: '80%', border: '1px solid #D3D3D3', borderRadius: '7px', fontSize: '12px', letterSpacing: '.7px' }} value={form.date.text_time}
-                                                            onChange={(e) =>
-                                                                setForm(prev => ({
-                                                                    ...prev,
-                                                                    date: {
-                                                                        ...prev.date,
-                                                                        text_time: e.target.value
-                                                                    }
-                                                                }))
-                                                            } />
-                                                    </div>
-                                                    <div>
-                                                        <select style={{ height: '40px', borderRadius: '7px', fontSize: '14px', letterSpacing: '.7px', width: '100%', border: '1px solid #D3D3D3' }} name="time" required aria-label="select example" >
-                                                            <option value="">選択してください</option>
-                                                            {form.date.time.map((item, index) =>
-                                                                <option key={index}>{item}</option>
-                                                            )}
-                                                        </select>
-                                                    </div>
-                                                    <div className="mt-2">
-                                                        {form.date.time.map((item, index) =>
-                                                            <div className="d-flex align-items-center" key={index} >
-                                                                <div style={{ width: '70%' }}>
-                                                                    <input type="text" value={item} style={{ width: '100%', height: '30px', borderRadius: '2px', fontSize: '12px', letterSpacing: '.7px', marginBottom: '2px', border: '1px solid #D3D3D3' }}
-                                                                        onChange={(e) => setForm(prev => {
-                                                                            const newTimes: string[] = [...prev.date.time];
-                                                                            newTimes[index] = e.target.value;
-                                                                            return {
-                                                                                ...prev,
-                                                                                date: {
-                                                                                    ...prev.date,
-                                                                                    time: newTimes
-                                                                                }
-                                                                            }
-                                                                        })
-                                                                        } />
-                                                                </div>
-                                                                <div style={{ width: '30%', marginLeft: '6px' }}>
-                                                                    <button style={{ backgroundColor: '#DDD', borderRadius: '4px', border: 'none' }}
-                                                                        onClick={() => setForm(prev => {
-                                                                            const newTimes: string[] = prev.date.time.filter((_, i) => i !== index);
-                                                                            return {
-                                                                                ...prev,
-                                                                                date: {
-                                                                                    ...prev.date,
-                                                                                    time: newTimes
-                                                                                }
-                                                                            }
-                                                                        })
-                                                                        }>削除</button>
-                                                                </div>
-                                                            </div>
-                                                        )}
-                                                        <div className="d-flex align-items-center">
-                                                            <div style={{ width: '70%' }}>
-                                                                <input type="text" value={newTime} style={{ width: '100%', height: '30px', borderRadius: '2px', fontSize: '12px', letterSpacing: '.7px', marginBottom: '2px', border: '1px solid #D3D3D3' }}
-                                                                    onChange={(e) => {
-                                                                        setNewTime(e.target.value);
-                                                                        setForm(prev => {
-                                                                            const newTime: string[] = [...prev.date.time];
-                                                                            return {
-                                                                                ...prev,
-                                                                                date: {
-                                                                                    ...prev.date,
-                                                                                    time: newTime
-                                                                                }
-                                                                            }
-                                                                        });
-                                                                    }
-                                                                    } />
-                                                            </div>
-                                                            <div style={{ width: '30%', marginLeft: '6px' }}>
-                                                                <button style={{ backgroundColor: '#DDD', borderRadius: '4px', border: 'none' }}
-                                                                    onClick={() => {
-                                                                        if (!newTime) return;
-                                                                        setForm(prev => {
-                                                                            const newTimes: string[] = [...prev.date.time];
-                                                                            newTimes.push(newTime);
-                                                                            return {
-                                                                                ...prev,
-                                                                                date: {
-                                                                                    ...prev.date,
-                                                                                    time: newTimes
-                                                                                }
-                                                                            }
-                                                                        });
-                                                                        setNewTime('');
-                                                                    }}>追加</button>
-                                                            </div>
-                                                        </div>
-                                                    </div>
-                                                </div>
-                                            </div>
-                                        </td>
-                                    </tr>
-                                    <tr style={{ fontSize: '13px', verticalAlign: 'middle' }}>
-                                        <td style={{ textAlign: 'center' }}>
-                                            <div>氏名</div><div style={{ marginLeft: '75px' }}><input type="checkbox" className="ms-2 form-check" style={{ width: '20px', margin: '0 auto' }} checked={form.name.bool} onChange={() => changeForm('name')} /></div>
-                                        </td>
-                                        <td>
-                                            <div className="d-flex align-items-center mb-2">
-                                                <div>
-                                                    <input type="radio" name='name' style={{ transform: 'scale(1.3)', cursor: 'pointer' }} checked={form.name.required === true}
-                                                        onChange={() =>
-                                                            setForm(prev => ({
-                                                                ...prev,
-                                                                name: {
-                                                                    ...prev.name,
-                                                                    required: !prev.name.required
-                                                                }
-                                                            }))
-                                                        } />
-                                                </div>
-                                                <div className="ms-1">
-                                                    必須
-                                                </div>
-                                                <div>
-                                                    <input type="radio" name='name' style={{ transform: 'scale(1.3)', cursor: 'pointer', marginLeft: '20px' }} checked={form.name.required === false}
-                                                        onChange={() =>
-                                                            setForm(prev => ({
-                                                                ...prev,
-                                                                name: {
-                                                                    ...prev.name,
-                                                                    required: !prev.name.required
-                                                                }
-                                                            }))
-                                                        } />
-                                                </div>
-                                                <div className="ms-1">
-                                                    任意
-                                                </div>
-                                            </div>
-                                            <div className="row">
-                                                <div className="col">
-                                                    <div className="d-flex align-items-center">
-                                                        {!form.name.required || <div style={{ backgroundColor: 'red', width: 'fit-content', color: '#fff', fontSize: '10px', padding: '2px 4px', borderRadius: '7px', marginRight: '3px' }}>必須</div>}
-                                                        <input type="text" style={{ width: '80%', border: '1px solid #D3D3D3', borderRadius: '7px', fontSize: '12px', letterSpacing: '.7px' }} value={form.name.text_sei}
-                                                            onChange={(e) =>
-                                                                setForm(prev => ({
-                                                                    ...prev,
-                                                                    name: {
-                                                                        ...prev.name,
-                                                                        text_sei: e.target.value
-                                                                    }
-                                                                }))
-                                                            } />
-                                                    </div>
-                                                    <div >
-                                                        <input type="text" style={{ height: '40px', borderRadius: '7px', fontSize: '14px', letterSpacing: '.7px', width: '100%', border: '1px solid #D3D3D3' }} />
-                                                    </div>
-                                                </div>
-                                                <div className="col">
-                                                    <div className="d-flex align-items-center">
-                                                        {!form.name.required || <div style={{ backgroundColor: 'red', width: 'fit-content', color: '#fff', fontSize: '10px', padding: '2px 4px', borderRadius: '7px', marginRight: '3px' }}>必須</div>}
-                                                        <input type="text" style={{ width: '80%', border: '1px solid #D3D3D3', borderRadius: '7px', fontSize: '12px', letterSpacing: '.7px' }} value={form.name.text_mei}
-                                                            onChange={(e) =>
-                                                                setForm(prev => ({
-                                                                    ...prev,
-                                                                    name: {
-                                                                        ...prev.name,
-                                                                        text_mei: e.target.value
-                                                                    }
-                                                                }))
-                                                            } />
-                                                    </div>
-                                                    <div >
-                                                        <input type="text" style={{ height: '40px', borderRadius: '7px', fontSize: '14px', letterSpacing: '.7px', width: '100%', border: '1px solid #D3D3D3' }} />
-                                                    </div>
-                                                </div>
-                                            </div>
-                                        </td>
-                                    </tr>
-                                    <tr style={{ fontSize: '13px', verticalAlign: 'middle' }}>
-                                        <td style={{ textAlign: 'center' }}>
-                                            <div>氏名(かな)</div><div style={{ marginLeft: '75px' }}><input type="checkbox" className="ms-2 form-check" style={{ width: '20px', margin: '0 auto' }} checked={form.kana.bool} onChange={() => changeForm('kana')} /></div>
-                                        </td>
-                                        <td>
-                                            <div className="d-flex align-items-center mb-2">
-                                                <div>
-                                                    <input type="radio" name='kana' style={{ transform: 'scale(1.3)', cursor: 'pointer' }} checked={form.kana.required === true}
-                                                        onChange={() =>
-                                                            setForm(prev => ({
-                                                                ...prev,
-                                                                kana: {
-                                                                    ...prev.kana,
-                                                                    required: !prev.kana.required
-                                                                }
-                                                            }))
-                                                        } />
-                                                </div>
-                                                <div className="ms-1">
-                                                    必須
-                                                </div>
-                                                <div>
-                                                    <input type="radio" name='kana' style={{ transform: 'scale(1.3)', cursor: 'pointer', marginLeft: '20px' }} checked={form.kana.required === false}
-                                                        onChange={() =>
-                                                            setForm(prev => ({
-                                                                ...prev,
-                                                                kana: {
-                                                                    ...prev.kana,
-                                                                    required: !prev.kana.required
-                                                                }
-                                                            }))
-                                                        } />
-                                                </div>
-                                                <div className="ms-1">
-                                                    任意
-                                                </div>
-                                            </div>
-                                            <div className="row">
-                                                <div className="col">
-                                                    <div className="d-flex align-items-center mb-2">
-                                                        {!form.kana.required || <div style={{ backgroundColor: 'red', width: 'fit-content', color: '#fff', fontSize: '10px', padding: '2px 4px', borderRadius: '7px', marginRight: '3px' }}>必須</div>}
-                                                        <input type="text" style={{ width: '80%', border: '1px solid #D3D3D3', borderRadius: '7px', fontSize: '12px', letterSpacing: '.7px' }} value={form.kana.text_sei}
-                                                            onChange={(e) =>
-                                                                setForm(prev => ({
-                                                                    ...prev,
-                                                                    kana: {
-                                                                        ...prev.kana,
-                                                                        text_sei: e.target.value
-                                                                    }
-                                                                }))
-                                                            } />
-                                                    </div>
-                                                    <div >
-                                                        <input type="text" style={{ height: '40px', borderRadius: '7px', fontSize: '14px', letterSpacing: '.7px', width: '100%', border: '1px solid #D3D3D3' }} />
-                                                    </div>
-                                                </div>
-                                                <div className="col">
-                                                    <div className="d-flex align-items-center mb-2">
-                                                        {!form.kana.required || <div style={{ backgroundColor: 'red', width: 'fit-content', color: '#fff', fontSize: '10px', padding: '2px 4px', borderRadius: '7px', marginRight: '3px' }}>必須</div>}
-                                                        <input type="text" style={{ width: '80%', border: '1px solid #D3D3D3', borderRadius: '7px', fontSize: '12px', letterSpacing: '.7px' }} value={form.kana.text_mei}
-                                                            onChange={(e) =>
-                                                                setForm(prev => ({
-                                                                    ...prev,
-                                                                    kana: {
-                                                                        ...prev.kana,
-                                                                        text_mei: e.target.value
-                                                                    }
-                                                                }))
-                                                            } />
-                                                    </div>
-                                                    <div >
-                                                        <input type="text" style={{ height: '40px', borderRadius: '7px', fontSize: '14px', letterSpacing: '.7px', width: '100%', border: '1px solid #D3D3D3' }} />
-                                                    </div>
-                                                </div>
-                                            </div>
-                                        </td>
-                                    </tr>
-                                    <tr style={{ fontSize: '13px', verticalAlign: 'middle' }}>
-                                        <td style={{ textAlign: 'center' }}>
-                                            <div>年齢</div><div style={{ marginLeft: '75px' }}><input type="checkbox" className="ms-2 form-check" style={{ width: '20px', margin: '0 auto' }} checked={form.age.bool} onChange={() => changeForm('age')} /></div>
-                                        </td>
-                                        <td>
-                                            <div className="d-flex align-items-center mb-2">
-                                                <div>
-                                                    <input type="radio" name='age' style={{ transform: 'scale(1.3)', cursor: 'pointer' }} checked={form.age.required === true}
-                                                        onChange={() =>
-                                                            setForm(prev => ({
-                                                                ...prev,
-                                                                age: {
-                                                                    ...prev.age,
-                                                                    required: !prev.age.required
-                                                                }
-                                                            }))
-                                                        } />
-                                                </div>
-                                                <div className="ms-1">
-                                                    必須
-                                                </div>
-                                                <div>
-                                                    <input type="radio" name='age' style={{ transform: 'scale(1.3)', cursor: 'pointer', marginLeft: '20px' }} checked={form.age.required === false}
-                                                        onChange={() =>
-                                                            setForm(prev => ({
-                                                                ...prev,
-                                                                age: {
-                                                                    ...prev.age,
-                                                                    required: !prev.age.required
-                                                                }
-                                                            }))
-                                                        } />
-                                                </div>
-                                                <div className="ms-1">
-                                                    任意
-                                                </div>
-                                            </div>
-                                            <div className="row">
-                                                <div className="col">
-                                                    <div className="d-flex align-items-center mb-2">
-                                                        {!form.age.required || <div style={{ backgroundColor: 'red', width: 'fit-content', color: '#fff', fontSize: '10px', padding: '2px 4px', borderRadius: '7px', marginRight: '3px' }}>必須</div>}
-                                                        <input type="text" style={{ width: '80%', border: '1px solid #D3D3D3', borderRadius: '7px', fontSize: '12px', letterSpacing: '.7px' }} value={form.age.text}
-                                                            onChange={(e) =>
-                                                                setForm(prev => ({
-                                                                    ...prev,
-                                                                    age: {
-                                                                        ...prev.age,
-                                                                        text: e.target.value
-                                                                    }
-                                                                }))
-                                                            } />
-                                                    </div>
-                                                    <div >
-                                                        <input type="text" style={{ height: '40px', borderRadius: '7px', fontSize: '14px', letterSpacing: '.7px', width: '100%', border: '1px solid #D3D3D3' }} />
-                                                    </div>
-                                                </div>
-                                                <div className="col">
-                                                </div>
-                                            </div>
-                                        </td>
-                                    </tr>
-                                    <tr style={{ fontSize: '13px', verticalAlign: 'middle' }}>
-                                        <td style={{ textAlign: 'center' }}>
-                                            <div>携帯電話</div><div style={{ marginLeft: '75px' }}><input type="checkbox" className="ms-2 form-check" style={{ width: '20px', margin: '0 auto' }} checked={form.phone.bool} onChange={() => changeForm('phone')} /></div>
-                                        </td>
-                                        <td>
-                                            <div className="d-flex align-items-center mb-2">
-                                                <div>
-                                                    <input type="radio" name='phone' style={{ transform: 'scale(1.3)', cursor: 'pointer' }} checked={form.phone.required === true}
-                                                        onChange={() =>
-                                                            setForm(prev => ({
-                                                                ...prev,
-                                                                phone: {
-                                                                    ...prev.phone,
-                                                                    required: !prev.phone.required
-                                                                }
-                                                            }))
-                                                        } />
-                                                </div>
-                                                <div className="ms-1">
-                                                    必須
-                                                </div>
-                                                <div>
-                                                    <input type="radio" name='phone' style={{ transform: 'scale(1.3)', cursor: 'pointer', marginLeft: '20px' }} checked={form.phone.required === false}
-                                                        onChange={() =>
-                                                            setForm(prev => ({
-                                                                ...prev,
-                                                                phone: {
-                                                                    ...prev.phone,
-                                                                    required: !prev.phone.required
-                                                                }
-                                                            }))
-                                                        } />
-                                                </div>
-                                                <div className="ms-1">
-                                                    任意
-                                                </div>
-                                            </div>
-                                            <div>
-                                                <div className="d-flex align-items-center mb-2">
-                                                    {!form.phone.required || <div style={{ backgroundColor: 'red', width: 'fit-content', color: '#fff', fontSize: '10px', padding: '2px 4px', borderRadius: '7px', marginRight: '3px' }}>必須</div>}
-                                                    <input type="text" style={{ width: '80%', border: '1px solid #D3D3D3', borderRadius: '7px', fontSize: '12px', letterSpacing: '.7px' }} value={form.phone.text}
-                                                        onChange={(e) =>
-                                                            setForm(prev => ({
-                                                                ...prev,
-                                                                phone: {
-                                                                    ...prev.phone,
-                                                                    text: e.target.value
-                                                                }
-                                                            }))
-                                                        } />
-                                                </div>
-                                                <div>
-                                                    <input type="text" style={{ height: '40px', borderRadius: '7px', fontSize: '14px', letterSpacing: '.7px', width: '100%', border: '1px solid #D3D3D3' }} pattern="\d{9,}" required />
-                                                </div>
-                                            </div>
-                                        </td>
-                                    </tr>
-                                    <tr style={{ fontSize: '13px', verticalAlign: 'middle' }}>
-                                        <td style={{ textAlign: 'center' }}>
-                                            <div>メールアドレス</div><div style={{ marginLeft: '75px' }}><input type="checkbox" className="ms-2 form-check" style={{ width: '20px', margin: '0 auto' }} checked={form.mail.bool} onChange={() => changeForm('mail')} /></div>
-                                        </td>
-                                        <td>
-                                            <div className="d-flex align-items-center mb-2">
-                                                <div>
-                                                    <input type="radio" name='mail' style={{ transform: 'scale(1.3)', cursor: 'pointer' }} checked={form.mail.required === true}
-                                                        onChange={() =>
-                                                            setForm(prev => ({
-                                                                ...prev,
-                                                                mail: {
-                                                                    ...prev.mail,
-                                                                    required: !prev.mail.required
-                                                                }
-                                                            }))
-                                                        } />
-                                                </div>
-                                                <div className="ms-1">
-                                                    必須
-                                                </div>
-                                                <div>
-                                                    <input type="radio" name='mail' style={{ transform: 'scale(1.3)', cursor: 'pointer', marginLeft: '20px' }} checked={form.mail.required === false}
-                                                        onChange={() =>
-                                                            setForm(prev => ({
-                                                                ...prev,
-                                                                mail: {
-                                                                    ...prev.mail,
-                                                                    required: !prev.mail.required
-                                                                }
-                                                            }))
-                                                        } />
-                                                </div>
-                                                <div className="ms-1">
-                                                    任意
-                                                </div>
-                                            </div>
-                                            <div>
-                                                <div className="d-flex align-items-center mb-2">
-                                                    {!form.mail.required || <div style={{ backgroundColor: 'red', width: 'fit-content', color: '#fff', fontSize: '10px', padding: '2px 4px', borderRadius: '7px', marginRight: '3px' }}>必須</div>}
-                                                    <input type="text" style={{ width: '80%', border: '1px solid #D3D3D3', borderRadius: '7px', fontSize: '12px', letterSpacing: '.7px' }} value={form.mail.text}
-                                                        onChange={(e) =>
-                                                            setForm(prev => ({
-                                                                ...prev,
-                                                                mail: {
-                                                                    ...prev.mail,
-                                                                    text: e.target.value
-                                                                }
-                                                            }))
-                                                        } />
-                                                </div>
-                                                <div>
-                                                    <input type="mail" style={{ height: '40px', borderRadius: '7px', fontSize: '14px', letterSpacing: '.7px', width: '100%', border: '1px solid #D3D3D3' }} pattern="\d{9,}" required />
-                                                </div>
-                                            </div>
-                                        </td>
-                                    </tr>
-                                    {/*
-                                      ⚠️ v2.2.188: LINE ID（メールアドレスの下）。⚠️ 操作はメールアドレスの行と同じ（表示する／必須・任意／文言）。
-                                        ⚠️ 表示の切り替えは changeForm を使わず、ここで bool だけ反転する
-                                          （⚠️ changeForm は shop / date / medium 以外の項目を文字列で上書きするため）。
-                                    */}
-                                    <tr style={{ fontSize: '13px', verticalAlign: 'middle' }}>
-                                        <td style={{ textAlign: 'center' }}>
-                                            <div>LINE ID</div><div style={{ marginLeft: '75px' }}><input type="checkbox" className="ms-2 form-check" style={{ width: '20px', margin: '0 auto' }} checked={form.line_id.bool}
-                                                onChange={() => setForm(prev => ({ ...prev, line_id: { ...prev.line_id, bool: !prev.line_id.bool } }))} /></div>
-                                        </td>
-                                        <td>
-                                            <div className="d-flex align-items-center mb-2">
-                                                <div>
-                                                    <input type="radio" name='line_id' style={{ transform: 'scale(1.3)', cursor: 'pointer' }} checked={form.line_id.required === true}
-                                                        onChange={() => setForm(prev => ({ ...prev, line_id: { ...prev.line_id, required: true } }))} />
-                                                </div>
-                                                <div className="ms-1">
-                                                    必須
-                                                </div>
-                                                <div>
-                                                    <input type="radio" name='line_id' style={{ transform: 'scale(1.3)', cursor: 'pointer', marginLeft: '20px' }} checked={form.line_id.required === false}
-                                                        onChange={() => setForm(prev => ({ ...prev, line_id: { ...prev.line_id, required: false } }))} />
-                                                </div>
-                                                <div className="ms-1">
-                                                    任意
-                                                </div>
-                                            </div>
-                                            <div>
-                                                <div className="d-flex align-items-center mb-2">
-                                                    {!form.line_id.required || <div style={{ backgroundColor: 'red', width: 'fit-content', color: '#fff', fontSize: '10px', padding: '2px 4px', borderRadius: '7px', marginRight: '3px' }}>必須</div>}
-                                                    <input type="text" style={{ width: '80%', border: '1px solid #D3D3D3', borderRadius: '7px', fontSize: '12px', letterSpacing: '.7px' }} value={form.line_id.text}
-                                                        onChange={(e) => setForm(prev => ({ ...prev, line_id: { ...prev.line_id, text: e.target.value } }))} />
-                                                </div>
-                                                <div>
-                                                    <input type="text" placeholder="LINE ID" style={{ height: '40px', borderRadius: '7px', fontSize: '14px', letterSpacing: '.7px', width: '100%', border: '1px solid #D3D3D3' }} readOnly />
-                                                </div>
-                                            </div>
-                                        </td>
-                                    </tr>
-                                    <tr style={{ fontSize: '13px', verticalAlign: 'middle' }}>
-                                        <td style={{ textAlign: 'center' }}>
-                                            <div>住所</div><div style={{ marginLeft: '75px' }}><input type="checkbox" className="ms-2 form-check" style={{ width: '20px', margin: '0 auto' }} checked={form.address.bool} onChange={() => changeForm('address')} /></div>
-                                        </td>
-                                        <td>
-                                            <div className="d-flex align-items-center mb-2">
-                                                <div>
-                                                    <input type="radio" name='address' style={{ transform: 'scale(1.3)', cursor: 'pointer' }} checked={form.address.required === true}
-                                                        onChange={() =>
-                                                            setForm(prev => ({
-                                                                ...prev,
-                                                                address: {
-                                                                    ...prev.address,
-                                                                    required: !prev.address.required
-                                                                }
-                                                            }))
-                                                        } />
-                                                </div>
-                                                <div className="ms-1">
-                                                    必須
-                                                </div>
-                                                <div>
-                                                    <input type="radio" name='address' style={{ transform: 'scale(1.3)', cursor: 'pointer', marginLeft: '20px' }} checked={form.address.required === false}
-                                                        onChange={() =>
-                                                            setForm(prev => ({
-                                                                ...prev,
-                                                                address: {
-                                                                    ...prev.address,
-                                                                    required: !prev.address.required
-                                                                }
-                                                            }))
-                                                        } />
-                                                </div>
-                                                <div className="ms-1">
-                                                    任意
-                                                </div>
-                                            </div>
-                                            <div className="row d-flex align-items-end">
-                                                <div className="col">
-                                                    <div className="d-flex align-items-center mb-2">
-                                                        {!form.address.required || <div style={{ backgroundColor: 'red', width: 'fit-content', color: '#fff', fontSize: '10px', padding: '2px 4px', borderRadius: '7px', marginRight: '3px' }}>必須</div>}
-                                                        <input type="text" style={{ width: '80%', border: '1px solid #D3D3D3', borderRadius: '7px', fontSize: '12px', letterSpacing: '.7px' }} value={form.address.text_zip}
-                                                            onChange={(e) =>
-                                                                setForm(prev => ({
-                                                                    ...prev,
-                                                                    address: {
-                                                                        ...prev.address,
-                                                                        text_zip: e.target.value
-                                                                    }
-                                                                }))
-                                                            } />
-                                                    </div>
-                                                    <div >
-                                                        <input type="text" style={{ height: '40px', borderRadius: '7px', fontSize: '14px', letterSpacing: '.7px', width: '100%', border: '1px solid #D3D3D3' }} pattern="\d{7,}" />
-                                                    </div>
-                                                </div>
-                                                <div className="col">
-                                                    <button type="button" className="btn btn-primary zip_button" id="search_button">郵便番号検索</button>
-                                                </div>
-                                            </div>
-                                            <div className="row mt-2">
-                                                <div className="col">
-                                                    <div className="d-flex align-items-center mb-2">
-                                                        {!form.address.required || <div style={{ backgroundColor: 'red', width: 'fit-content', color: '#fff', fontSize: '10px', padding: '2px 4px', borderRadius: '7px', marginRight: '3px' }}>必須</div>}
-                                                        <input type="text" style={{ width: '80%', border: '1px solid #D3D3D3', borderRadius: '7px', fontSize: '12px', letterSpacing: '.7px' }} value={form.address.text_pref}
-                                                            onChange={(e) =>
-                                                                setForm(prev => ({
-                                                                    ...prev,
-                                                                    address: {
-                                                                        ...prev.address,
-                                                                        text_pref: e.target.value
-                                                                    }
-                                                                }))
-                                                            } />
-                                                    </div>
-                                                    <div >
-                                                        <input type="text" style={{ height: '40px', borderRadius: '7px', fontSize: '14px', letterSpacing: '.7px', width: '100%', border: '1px solid #D3D3D3' }} pattern="\d{7,}" />
-                                                    </div>
-                                                </div>
-                                                <div className="col">
-                                                    <div className="d-flex align-items-center mb-2">
-                                                        {!form.address.required || <div style={{ backgroundColor: 'red', width: 'fit-content', color: '#fff', fontSize: '10px', padding: '2px 4px', borderRadius: '7px', marginRight: '3px' }}>必須</div>}
-                                                        <input type="text" style={{ width: '80%', border: '1px solid #D3D3D3', borderRadius: '7px', fontSize: '12px', letterSpacing: '.7px' }} value={form.address.text_city}
-                                                            onChange={(e) =>
-                                                                setForm(prev => ({
-                                                                    ...prev,
-                                                                    address: {
-                                                                        ...prev.address,
-                                                                        text_city: e.target.value
-                                                                    }
-                                                                }))
-                                                            } />
-                                                    </div>
-                                                    <div >
-                                                        <input type="text" style={{ height: '40px', borderRadius: '7px', fontSize: '14px', letterSpacing: '.7px', width: '100%', border: '1px solid #D3D3D3' }} pattern="\d{7,}" />
-                                                    </div>
-                                                </div>
-                                            </div>
-                                            <div className="mt-2">
-                                                <div className="d-flex align-items-center mb-2">
-                                                    {!form.address.required || <div style={{ backgroundColor: 'red', width: 'fit-content', color: '#fff', fontSize: '10px', padding: '2px 4px', borderRadius: '7px', marginRight: '3px' }}>必須</div>}
-                                                    <input type="text" style={{ width: '80%', border: '1px solid #D3D3D3', borderRadius: '7px', fontSize: '12px', letterSpacing: '.7px' }} value={form.address.text_town}
-                                                        onChange={(e) =>
-                                                            setForm(prev => ({
-                                                                ...prev,
-                                                                address: {
-                                                                    ...prev.address,
-                                                                    text_town: e.target.value
-                                                                }
-                                                            }))
-                                                        } />
-                                                </div>
-                                                <div >
-                                                    <input type="text" style={{ height: '40px', borderRadius: '7px', fontSize: '14px', letterSpacing: '.7px', width: '100%', border: '1px solid #D3D3D3' }} pattern="\d{7,}" />
-                                                </div>
-                                            </div>
-                                            <div className="mt-2">
-                                                <div className="d-flex align-items-center mb-2">
-                                                    {!form.address.required || <div style={{ backgroundColor: 'red', width: 'fit-content', color: '#fff', fontSize: '10px', padding: '2px 4px', borderRadius: '7px', marginRight: '3px' }}>必須</div>}
-                                                    <input type="text" style={{ width: '80%', border: '1px solid #D3D3D3', borderRadius: '7px', fontSize: '12px', letterSpacing: '.7px' }} value={form.address.text_street}
-                                                        onChange={(e) =>
-                                                            setForm(prev => ({
-                                                                ...prev,
-                                                                address: {
-                                                                    ...prev.address,
-                                                                    text_street: e.target.value
-                                                                }
-                                                            }))
-                                                        } />
-                                                </div>
-                                                <div >
-                                                    <input type="text" style={{ height: '40px', borderRadius: '7px', fontSize: '14px', letterSpacing: '.7px', width: '100%', border: '1px solid #D3D3D3' }} pattern="\d{7,}" />
-                                                </div>
-                                            </div>
-                                        </td>
-                                    </tr>
-                                    <tr style={{ fontSize: '13px', verticalAlign: 'middle' }}>
-                                        <td style={{ textAlign: 'center' }}>
-                                            <div>販促媒体</div><div style={{ marginLeft: '75px' }}><input type="checkbox" className="ms-2 form-check" style={{ width: '20px', margin: '0 auto' }} checked={form.medium.bool} onChange={() => changeForm('medium')} /></div>
-                                        </td>
-                                        <td>
-                                            <div className="d-flex align-items-center mb-2">
-                                                <div>
-                                                    <input type="radio" name='medium' style={{ transform: 'scale(1.3)', cursor: 'pointer' }} checked={form.medium.required === true}
-                                                        onChange={() =>
-                                                            setForm(prev => ({
-                                                                ...prev,
-                                                                medium: {
-                                                                    ...prev.medium,
-                                                                    required: !prev.medium.required
-                                                                }
-                                                            }))
-                                                        } />
-                                                </div>
-                                                <div className="ms-1">
-                                                    必須
-                                                </div>
-                                                <div>
-                                                    <input type="radio" name='medium' style={{ transform: 'scale(1.3)', cursor: 'pointer', marginLeft: '20px' }} checked={form.medium.required === false}
-                                                        onChange={() =>
-                                                            setForm(prev => ({
-                                                                ...prev,
-                                                                medium: {
-                                                                    ...prev.medium,
-                                                                    required: !prev.medium.required
-                                                                }
-                                                            }))
-                                                        } />
-                                                </div>
-                                                <div className="ms-1">
-                                                    任意
-                                                </div>
-                                            </div>
-                                            <div className="col">
-                                                <div className="d-flex align-items-center mb-2">
-                                                    {!form.medium.required || <div style={{ backgroundColor: 'red', width: 'fit-content', color: '#fff', fontSize: '10px', padding: '2px 4px', borderRadius: '7px', marginRight: '3px' }}>必須</div>}
-                                                    <input type="text" style={{ width: '80%', border: '1px solid #D3D3D3', borderRadius: '7px', fontSize: '12px', letterSpacing: '.7px' }} value={form.medium.text}
-                                                        onChange={(e) =>
-                                                            setForm(prev => ({
-                                                                ...prev,
-                                                                medium: {
-                                                                    ...prev.medium,
-                                                                    text: e.target.value
-                                                                }
-                                                            }))
-                                                        } />
-                                                </div>
-                                                <div>
-                                                    <select style={{ height: '40px', borderRadius: '7px', fontSize: '14px', letterSpacing: '.7px', width: '100%', border: '1px solid #D3D3D3' }} name="time" required aria-label="select example" >
-                                                        <option value="">選択してください</option>
-                                                        {form.medium.mediumName.map((item, index) =>
-                                                            <option key={index}>{item}</option>)}
-                                                    </select>
-                                                    <div className="mt-2">
-                                                        {form.medium.mediumName.map((item, index) =>
-                                                            <div className="d-flex align-items-center" key={index} >
-                                                                <div style={{ width: '90%' }}>
-                                                                    <input type="text" value={item} style={{ width: '100%', height: '30px', borderRadius: '2px', fontSize: '12px', letterSpacing: '.7px', marginBottom: '2px', border: '1px solid #D3D3D3' }}
-                                                                        onChange={(e) => setForm(prev => {
-                                                                            const newMediums: string[] = [...prev.medium.mediumName];
-                                                                            newMediums[index] = e.target.value;
-                                                                            return {
-                                                                                ...prev,
-                                                                                medium: {
-                                                                                    ...prev.shop,
-                                                                                    mediumName: newMediums
-                                                                                }
-                                                                            }
-                                                                        })
-                                                                        } />
-                                                                </div>
-                                                                <div style={{ width: '10%', marginLeft: '6px' }}>
-                                                                    <button style={{ backgroundColor: '#DDD', borderRadius: '4px', border: 'none' }}
-                                                                        onClick={() => setForm(prev => {
-                                                                            const newMediums: string[] = prev.medium.mediumName.filter((_, i) => i !== index);
-                                                                            return {
-                                                                                ...prev,
-                                                                                medium: {
-                                                                                    ...prev.medium,
-                                                                                    mediumName: newMediums
-                                                                                }
-                                                                            }
-                                                                        })
-                                                                        }>削除</button>
-                                                                </div>
-                                                            </div>
-                                                        )}
-                                                        <div className="d-flex align-items-center">
-                                                            <div style={{ width: '90%' }}>
-                                                                <input type="text" placeholder="新たに販促媒体を追加する際は必ずご相談ください" style={{ width: '100%', height: '30px', borderRadius: '2px', fontSize: '12px', letterSpacing: '.7px', marginBottom: '2px', border: '1px solid #D3D3D3' }} value={newMedium} onChange={(e) => setNewMedium(e.target.value)} />
-                                                            </div>
-                                                            <div style={{ width: '10%', marginLeft: '6px' }}>
-                                                                <button style={{ backgroundColor: '#DDD', borderRadius: '4px', border: 'none' }}
-                                                                    onClick={() => {
-                                                                        if (!newMedium) return;
-                                                                        setForm(prev => {
-                                                                            const newMediums: string[] = [...prev.medium.mediumName];
-                                                                            newMediums.push(newMedium);
-                                                                            return {
-                                                                                ...prev,
-                                                                                medium: {
-                                                                                    ...prev.shop,
-                                                                                    mediumName: newMediums
-                                                                                }
-                                                                            }
-                                                                        });
-                                                                        setNewMedium('');
-                                                                    }}>追加</button>
-                                                            </div>
-                                                        </div>
-                                                    </div>
-                                                </div>
-                                            </div>
-                                        </td>
-                                    </tr>
-                                    <tr style={{ fontSize: '13px', verticalAlign: 'middle' }}>
-                                        <td style={{ textAlign: 'center' }}>
-                                            <div>質問・要望</div><div style={{ marginLeft: '75px' }}><input type="checkbox" className="ms-2 form-check" style={{ width: '20px', margin: '0 auto' }} checked={form.question.bool} onChange={() => changeForm('question')} /></div>
-                                        </td>
-                                        <td>
-                                            <div className="d-flex align-items-center mb-2">
-                                                <div>
-                                                    <input type="radio" name='question' style={{ transform: 'scale(1.3)', cursor: 'pointer' }} checked={form.question.required === true}
-                                                        onChange={() =>
-                                                            setForm(prev => ({
-                                                                ...prev,
-                                                                question: {
-                                                                    ...prev.question,
-                                                                    required: !prev.question.required
-                                                                }
-                                                            }))
-                                                        } />
-                                                </div>
-                                                <div className="ms-1">
-                                                    必須
-                                                </div>
-                                                <div>
-                                                    <input type="radio" name='question' style={{ transform: 'scale(1.3)', cursor: 'pointer', marginLeft: '20px' }} checked={form.question.required === false}
-                                                        onChange={() =>
-                                                            setForm(prev => ({
-                                                                ...prev,
-                                                                question: {
-                                                                    ...prev.question,
-                                                                    required: !prev.question.required
-                                                                }
-                                                            }))
-                                                        } />
-                                                </div>
-                                                <div className="ms-1">
-                                                    任意
-                                                </div>
-                                            </div>
-                                            <div className="col">
-                                                <div className="d-flex align-items-center mb-2">
-                                                    {!form.question.required || <div style={{ backgroundColor: 'red', width: 'fit-content', color: '#fff', fontSize: '10px', padding: '2px 4px', borderRadius: '7px', marginRight: '3px' }}>必須</div>}
-                                                    <input type="text" style={{ width: '80%', border: '1px solid #D3D3D3', borderRadius: '7px', fontSize: '12px', letterSpacing: '.7px' }} value={form.question.text}
-                                                        onChange={(e) =>
-                                                            setForm(prev => ({
-                                                                ...prev,
-                                                                question: {
-                                                                    ...prev.question,
-                                                                    text: e.target.value
-                                                                }
-                                                            }))
-                                                        } />
-                                                </div>
-                                                <div>
-                                                    <textarea style={{ borderRadius: '7px', fontSize: '14px', letterSpacing: '.7px', width: '100%', border: '1px solid #D3D3D3' }} cols={5}></textarea>
-                                                </div>
-                                            </div>
-                                        </td>
-                                    </tr>
-                                    <tr style={{ fontSize: '13px', verticalAlign: 'middle' }}>
-                                        <td style={{ textAlign: 'center' }}>
-                                            <div>注意事項</div><div style={{ marginLeft: '75px' }}><input type="checkbox" className="ms-2 form-check" style={{ width: '20px', margin: '0 auto' }} checked={form.attention.bool} onChange={() => changeForm('attention')} /></div>
-                                        </td>
-                                        <td>
-                                            <div className="d-flex align-items-center mb-2">
-                                                <div>
-                                                    <input type="radio" name='attention' style={{ transform: 'scale(1.3)', cursor: 'pointer' }} checked={form.attention.bool_red === true}
-                                                        onChange={() =>
-                                                            setForm(prev => ({
-                                                                ...prev,
-                                                                attention: {
-                                                                    ...prev.attention,
-                                                                    bool_red: !prev.attention.bool_red
-                                                                }
-                                                            }))
-                                                        } />
-                                                </div>
-                                                <div className="ms-1">
-                                                    特典進呈条件を表示
-                                                </div>
-                                                <div>
-                                                    <input type="radio" name='attention' style={{ transform: 'scale(1.3)', cursor: 'pointer', marginLeft: '20px' }} checked={form.attention.bool_red === false}
-                                                        onChange={() =>
-                                                            setForm(prev => ({
-                                                                ...prev,
-                                                                attention: {
-                                                                    ...prev.attention,
-                                                                    bool_red: !prev.attention.bool_red
-                                                                }
-                                                            }))
-                                                        } />
-                                                </div>
-                                                <div className="ms-1">
-                                                    特典進呈条件を非表示
-                                                </div>
-                                            </div>
-                                            <div className="col">
-                                                <div>
-                                                    <div style={{ fontSize: '12px', color: '#fff', backgroundColor: 'gray', letterSpacing: '.7px', textAlign: 'justify', padding: '10px', borderRadius: '10px' }}>
-                                                        <textarea value={form.attention.text} style={{ width: '100%', borderRadius: '7px', fontSize: '12px', letterSpacing: '.7px', backgroundColor: 'transparent', color: '#fff' }} rows={5}
-                                                            onChange={(e) =>
-                                                                setForm(prev => ({
-                                                                    ...prev,
-                                                                    attention: {
-                                                                        ...prev.attention,
-                                                                        text: e.target.value
-                                                                    }
-                                                                }))
-                                                            }></textarea>
-                                                    </div>
-                                                    {!form.attention.bool_red || <>
-                                                        <div style={{ fontSize: '14px', color: '#fff', backgroundColor: 'black', letterSpacing: '.7px', textAlign: 'justify', padding: '10px 20px', borderRadius: '10px', width: 'fit-content', margin: '20px auto', cursor: 'pointer', textDecoration: 'none' }}
-                                                            onClick={() => {
-                                                                const modal = document.querySelector('#modal') as HTMLElement;
-                                                                modal.style.display = 'block'
-                                                            }}>特典進呈条件を見る</div>
-                                                        <div style={{ display: 'none', position: 'fixed', zIndex: '1000', top: '0', left: '0', backgroundColor: '#42424277', width: '100vw', height: '100vh' }} id='modal'>
-                                                            <div style={{ backgroundColor: '#fff', width: '90%', maxWidth: '560px', margin: '20vh auto', padding: '20px', borderRadius: '10px' }}>
-                                                                <div style={{ color: 'red', lineHeight: '20px' }}>
-                                                                    <span style={{ fontWeight: 'bold' }}>【来場予約特典条件】</span>
-                                                                    <textarea value={form.attention.text_red} style={{ width: '100%', border: '1px solid #D3D3D3', borderRadius: '7px', fontSize: '12px', letterSpacing: '.7px', color: 'red' }} rows={20}
-                                                                        onChange={(e) =>
-                                                                            setForm(prev => ({
-                                                                                ...prev,
-                                                                                attention: {
-                                                                                    ...prev.attention,
-                                                                                    text_red: e.target.value
-                                                                                }
-                                                                            }))
-                                                                        }></textarea>
-                                                                </div>
-                                                                <div style={{ fontSize: '14px', color: '#fff', backgroundColor: 'black', letterSpacing: '.7px', textAlign: 'justify', padding: '10px 20px', borderRadius: '10px', width: 'fit-content', margin: '20px auto', cursor: 'pointer', textDecoration: 'none' }}
-                                                                    onClick={() => {
-                                                                        const modal = document.querySelector('#modal') as HTMLElement;
-                                                                        modal.style.display = 'none'
-                                                                    }}>閉じる</div>
-                                                            </div>
-                                                        </div></>}
-                                                </div>
-                                            </div>
-                                        </td>
-                                    </tr>
-                                </tbody>
-                            </Table>
+                            <div className="nc-field">
+                                <span className="nc-label">サンクスメールの文面</span>
+                                {mailTemplateEditor('thanks_subject', 'thanks_body', 'お客様へ届くメールです。')}
+                            </div>
+                            <div className="nc-field">
+                                <span className="nc-label">通知メールの文面</span>
+                                {mailTemplateEditor('internal_subject', 'internal_body', '社内（反響アドレス）へ届くメールです。')}
+                            </div>
+                        </div>
+                    </section>
+
+                    {/* ---- フォームの冒頭 ---- */}
+                    <section className="nc-card" aria-labelledby="nc-notice">
+                        <div className="nc-card-head">
+                            <h2 className="nc-card-title" id="nc-notice">フォーム冒頭の案内文</h2>
+                            <p className="nc-card-desc">入力欄の上に表示されます</p>
+                            <div style={{ marginLeft: 'auto' }}>
+                                <Switch checked={Boolean(form.notice.bool)} label="表示する" onChange={(v) => patch('notice', { bool: v })} />
+                            </div>
+                        </div>
+                        {!form.notice.bool ||
+                            <div className="nc-card-body">
+                                <textarea className="nc-textarea" rows={4} value={form.notice.text} aria-label="案内文"
+                                    onChange={(e) => patch('notice', { text: e.target.value })} />
+                            </div>}
+                    </section>
+
+                    {/* ---- フォーム項目 ---- */}
+                    <section className="nc-card" aria-labelledby="nc-items">
+                        <div className="nc-card-head">
+                            <h2 className="nc-card-title" id="nc-items">フォーム項目</h2>
+                            <p className="nc-card-desc">項目ごとに表示・必須・見出しの文言を設定します</p>
                         </div>
+                        <div className="nc-items">
+                            {item('shop', '来場希望場所', <>
+                                <TextField label="見出し" value={form.shop.text} onChange={(v) => patch('shop', { text: v })} />
+                                <div className="nc-field">
+                                    <span className="nc-label">選択肢</span>
+                                    <OptionList items={form.shop.shopName} placeholder="店舗名を追加"
+                                        onChange={(items) => patch('shop', { shopName: items })} />
+                                </div>
+                            </>,
+                                /**
+                                 * ⚠️⚠️ **聞かないときは、代わりに入れておく値を選ばせる**（2026-09-16 の指示）。
+                                 *   ⚠️ 候補は「選択肢」をそのまま使う。**別に持たせない**。
+                                 */
+                                <div className="nc-field">
+                                    <span className="nc-label">聞かない代わりに、この値で登録する</span>
+                                    <select className="nc-select" style={{ maxWidth: '360px' }} value={form.shop.default ?? ''}
+                                        onChange={(e) => patch('shop', { default: e.target.value })}>
+                                        <option value="">指定しない</option>
+                                        {form.shop.shopName.map((s, i) => <option key={i} value={s}>{s}</option>)}
+                                    </select>
+                                    {form.shop.shopName.length > 0 || <p className="nc-hint">選択肢がまだありません。表示をオンにして追加すると選べます。</p>}
+                                </div>)}
+                            {item('date', '来場希望日時', <>
+                                <div className="nc-grid-2">
+                                    <TextField label="見出し（日付）" value={form.date.text_day} onChange={(v) => patch('date', { text_day: v })} />
+                                    <TextField label="見出し（時間）" value={form.date.text_time} onChange={(v) => patch('date', { text_time: v })} />
+                                </div>
+                                <div className="nc-field">
+                                    <span className="nc-label">時間の選択肢</span>
+                                    <OptionList items={form.date.time} placeholder="例）10:00〜"
+                                        onChange={(items) => patch('date', { time: items })} />
+                                </div>
+                            </>)}
+                            {item('name', '氏名', <div className="nc-grid-2">
+                                <TextField label="見出し（姓）" value={form.name.text_sei} onChange={(v) => patch('name', { text_sei: v })} />
+                                <TextField label="見出し（名）" value={form.name.text_mei} onChange={(v) => patch('name', { text_mei: v })} />
+                            </div>)}
+                            {item('kana', '氏名（かな）', <div className="nc-grid-2">
+                                <TextField label="見出し（セイ）" value={form.kana.text_sei} onChange={(v) => patch('kana', { text_sei: v })} />
+                                <TextField label="見出し（メイ）" value={form.kana.text_mei} onChange={(v) => patch('kana', { text_mei: v })} />
+                            </div>)}
+                            {item('age', '年齢', <TextField label="見出し" value={form.age.text} onChange={(v) => patch('age', { text: v })} />)}
+                            {item('phone', '携帯電話', <TextField label="見出し" value={form.phone.text} onChange={(v) => patch('phone', { text: v })} />)}
+                            {item('mail', 'メールアドレス', <TextField label="見出し" value={form.mail.text} onChange={(v) => patch('mail', { text: v })} />)}
+                            {/* ⚠️ v2.2.188: LINE ID（メールアドレスの下） */}
+                            {item('line_id', 'LINE ID', <>
+                                <TextField label="見出し" value={form.line_id.text} onChange={(v) => patch('line_id', { text: v })} />
+                                <p className="nc-hint">入力された LINE ID は反響・顧客に保存され、通知メールにも載ります。</p>
+                            </>)}
+                            {item('address', '住所', <>
+                                <div className="nc-grid-2">
+                                    <TextField label="見出し（郵便番号）" value={form.address.text_zip} onChange={(v) => patch('address', { text_zip: v })} />
+                                    <TextField label="見出し（都道府県）" value={form.address.text_pref} onChange={(v) => patch('address', { text_pref: v })} />
+                                    <TextField label="見出し（市区）" value={form.address.text_city} onChange={(v) => patch('address', { text_city: v })} />
+                                    <TextField label="見出し（町村）" value={form.address.text_town} onChange={(v) => patch('address', { text_town: v })} />
+                                </div>
+                                <TextField label="見出し（番地・建物）" value={form.address.text_street} onChange={(v) => patch('address', { text_street: v })} />
+                            </>)}
+                            {item('medium', '販促媒体（ご予約のきっかけ）', <>
+                                <TextField label="見出し" value={form.medium.text} onChange={(v) => patch('medium', { text: v })} />
+                                <div className="nc-field">
+                                    <span className="nc-label">選択肢</span>
+                                    <OptionList items={form.medium.mediumName} placeholder="新たに販促媒体を追加する際は必ずご相談ください"
+                                        onChange={(items) => patch('medium', { mediumName: items })} />
+                                </div>
+                            </>)}
+                            {item('question', '質問・要望', <TextField label="見出し" value={form.question.text} onChange={(v) => patch('question', { text: v })} />)}
+                        </div>
+                    </section>
+
+                    {/* ---- 注意事項・特典条件 ---- */}
+                    <section className="nc-card" aria-labelledby="nc-attention">
+                        <div className="nc-card-head">
+                            <h2 className="nc-card-title" id="nc-attention">注意事項と特典条件</h2>
+                            <p className="nc-card-desc">送信ボタンの上に表示されます</p>
+                            <div style={{ marginLeft: 'auto' }}>
+                                <Switch checked={Boolean(form.attention.bool)} label="表示する" onChange={(v) => patch('attention', { bool: v })} />
+                            </div>
+                        </div>
+                        {!form.attention.bool ||
+                            <div className="nc-card-body">
+                                <div className="nc-field">
+                                    <span className="nc-label">注意事項</span>
+                                    <textarea className="nc-textarea" rows={4} value={form.attention.text}
+                                        onChange={(e) => patch('attention', { text: e.target.value })} />
+                                </div>
+                                <div className="nc-field">
+                                    <span className="nc-label">特典進呈条件</span>
+                                    <Segmented value={Boolean(form.attention.bool_red)} trueLabel="表示する" falseLabel="表示しない"
+                                        onChange={(v) => patch('attention', { bool_red: v })} />
+                                </div>
+                                {!form.attention.bool_red ||
+                                    <div className="nc-field">
+                                        <span className="nc-label">特典進呈条件の本文（「特典進呈条件を見る」で表示）</span>
+                                        <textarea className="nc-textarea" rows={10} value={form.attention.text_red} style={{ color: '#c62828' }}
+                                            onChange={(e) => patch('attention', { text_red: e.target.value })} />
+                                    </div>}
+                            </div>}
+                    </section>
+                </div>
+
+                {/* ---- プレビュー ---- */}
+                <aside className="nc-preview" aria-label="公開フォームのプレビュー">
+                    <div className="nc-preview-head">
+                        <span><i className="fa-regular fa-eye me-1" aria-hidden="true"></i>プレビュー（公開フォーム）</span>
+                        <span className="nc-chip">入力すると反映</span>
+                    </div>
+                    <div className="nc-preview-body">
+                        <FormPreview form={form} brand={String(brandValue ?? '')} />
                     </div>
+                </aside>
+            </div>
+
+            <div className="nc-savebar">
+                <div className="nc-savebar-inner">
+                    <p className="nc-savebar-note">
+                        {validation.length > 0
+                            ? <span style={{ color: '#d93a4a', fontWeight: 600 }}>{validation.length}個の未入力項目があります</span>
+                            : '保存すると公開中のフォームにすぐ反映されます'}
+                    </p>
+                    <button type="button" className="nc-btn" onClick={() => navigate(`/campaign/?brand=${brandValue ?? ''}`)}>キャンセル</button>
+                    <button type="button" className="nc-btn nc-btn-primary" onClick={() => postForm()}>
+                        {isEdit ? '修正を保存する' : 'キャンペーンを登録する'}
+                    </button>
                 </div>
             </div>
-        </>
+        </div>
     )
 }
 
+// ---------------------------------------------------------------------------
+// ⚠️⚠️ ここから下の部品は ⚠️ **NewCampaign の外に置くこと**（中に書くと描画のたびに作り直され、入力中にカーソルが外れる）。
+// ---------------------------------------------------------------------------
+
+/** オン・オフ（表示する／しない） */
+const Switch = ({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) => (
+    <button type="button" role="switch" aria-checked={checked} className="nc-switch" onClick={() => onChange(!checked)}>
+        <span className="nc-switch-track" aria-hidden="true"></span>
+        {label}
+    </button>
+);
+
+/** 2択（必須／任意、送る／送らない など） */
+const Segmented = ({ value, onChange, trueLabel, falseLabel, disabled }: {
+    value: boolean; onChange: (v: boolean) => void; trueLabel: string; falseLabel: string; disabled?: boolean;
+}) => (
+    <div className="nc-seg" role="group">
+        <button type="button" aria-pressed={value} disabled={disabled} onClick={() => onChange(true)}>{trueLabel}</button>
+        <button type="button" aria-pressed={!value} disabled={disabled} onClick={() => onChange(false)}>{falseLabel}</button>
+    </div>
+);
+
+/** 1行の入力欄（見出し・必須の印・エラー・補足つき） */
+const TextField = ({ id, label, value, onChange, required, placeholder, error, hint, disabled }: {
+    id?: string; label: string; value: string; onChange: (v: string) => void;
+    required?: boolean; placeholder?: string; error?: string; hint?: string; disabled?: boolean;
+}) => (
+    <div className="nc-field" data-invalid={error ? '1' : '0'}>
+        <label className="nc-label" htmlFor={id}>{label}{!required || <span className="nc-req">必須</span>}</label>
+        <input id={id} type="text" className="nc-input" value={value ?? ''} placeholder={placeholder} disabled={disabled}
+            onChange={(e) => onChange(e.target.value)} />
+        {!hint || error || <p className="nc-hint">{hint}</p>}
+        {!error || <p className="nc-error" role="alert">{error}</p>}
+    </div>
+);
+
+/** フォーム項目の1行（表示する／必須・任意 ＋ 中身）。⚠️ 表示しないときは hiddenChildren だけ出す */
+const FieldItem = ({ title, shown, onShown, required, onRequired, children, hiddenChildren }: {
+    title: string; shown: boolean; onShown: (v: boolean) => void;
+    required: boolean; onRequired: (v: boolean) => void;
+    children: React.ReactNode; hiddenChildren?: React.ReactNode;
+}) => (
+    <div className="nc-item" data-shown={shown ? '1' : '0'}>
+        <div className="nc-item-head">
+            <h3 className="nc-item-name">{title}</h3>
+            <div className="nc-item-controls">
+                <Segmented value={required} trueLabel="必須" falseLabel="任意" onChange={onRequired} disabled={!shown} />
+                <Switch checked={shown} label="表示" onChange={onShown} />
+            </div>
+        </div>
+        {shown
+            ? <div className="nc-item-body">{children}</div>
+            : !hiddenChildren || <div className="nc-item-body">{hiddenChildren}</div>}
+    </div>
+);
+
+/**
+ * 選択肢の一覧（来場希望場所・時間・販促媒体）。編集・削除・追加。
+ * ⚠️ 追加欄の文字はこの部品が持つ（⚠️ 以前は newShop / newTime / newMedium を NewCampaign が持っていた）。
+ */
+const OptionList = ({ items, onChange, placeholder }: { items: string[]; onChange: (items: string[]) => void; placeholder?: string }) => {
+    const [draft, setDraft] = useState('');
+    const add = () => {
+        const value = draft.trim();
+        if (!value) return;
+        onChange([...items, value]);
+        setDraft('');
+    };
+    return (
+        <div className="nc-options">
+            {items.map((value, index) => (
+                <div className="nc-option" key={index}>
+                    <input type="text" className="nc-input" value={value} aria-label={`選択肢 ${index + 1}`}
+                        onChange={(e) => onChange(items.map((v, i) => (i === index ? e.target.value : v)))} />
+                    <button type="button" className="nc-btn nc-btn-danger-text" aria-label={`${value} を削除`}
+                        onClick={() => onChange(items.filter((_, i) => i !== index))}>
+                        <i className="fa-solid fa-trash-can" aria-hidden="true"></i>
+                    </button>
+                </div>
+            ))}
+            <div className="nc-option">
+                <input type="text" className="nc-input" value={draft} placeholder={placeholder}
+                    onChange={(e) => setDraft(e.target.value)}
+                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } }} />
+                <button type="button" className="nc-btn" onClick={add} disabled={!draft.trim()}>
+                    <i className="fa-solid fa-plus" aria-hidden="true"></i>追加
+                </button>
+            </div>
+        </div>
+    );
+};
+
 export default NewCampaign
\ No newline at end of file
diff --git a/frontend/src/components/campaign/formPreview.css b/frontend/src/components/campaign/formPreview.css
new file mode 100644
index 00000000..1689c2b8
--- /dev/null
+++ b/frontend/src/components/campaign/formPreview.css
@@ -0,0 +1,423 @@
+/*
+ * ⚠️⚠️ これは公開フォーム（C:\Users\shinji-kawano\react\form_get\src\components\publicForm.css）の **写し**。
+ *   ⚠️ 「キャンペーン作成」のプレビュー（formPreview.tsx）で、実際の公開フォームと同じ見た目を出すために使う。
+ *   ⚠️ 公開フォーム側を変えたら、ここも同じ内容に置き換えること（この注記より下は元のファイルそのまま）。
+ */
+/*
+ * 公開フォーム（入力 Form.tsx ／ 確認 Confirm.tsx）の見た目（2026-10-12 新規）。
+ *
+ * ─────────────────────────────────────────────
+ * ⚠️ 色は1か所（下の .pf の変数）で決める。⚠️ 差し色（--pf-accent）だけブランドごとに
+ *   画面側が style で渡す（src/api/brands.ts の brandAccent）。
+ * ⚠️ 埋め込み先（各ブランドのサイト）は白地なので ⚠️ **明るい配色だけ**にしている（ダークモードは作らない）。
+ *   ⚠️ 色はすべてここで明示する（⚠️ 埋め込み先の CSS に引きずられないため）。
+ * ⚠️ 入力欄の文字は 16px。⚠️ 16px 未満だと iPhone で入力時に画面が拡大される。
+ * ⚠️ Dashboard の「キャンペーン作成」のプレビュー（Campaign/formPreview.css）が ⚠️ **同じ見た目を写している**。
+ *   ⚠️ ここを変えたらプレビューも揃えること。
+ * ─────────────────────────────────────────────
+ */
+
+.pf {
+    --pf-accent: #0f3675;
+    --pf-ink: #1d2433;
+    --pf-sub: #5b6476;
+    --pf-line: #d5dbe5;
+    --pf-surface: #f5f7fa;
+    --pf-field: #ffffff;
+    --pf-danger: #c62828;
+    --pf-danger-bg: #fdecec;
+    --pf-radius: 10px;
+
+    max-width: 640px;
+    margin: 0 auto;
+    padding: 24px 16px 48px;
+    color: var(--pf-ink);
+    background: #ffffff;
+    font-family: "Hiragino Sans", "Hiragino Kaku Gothic ProN", "Noto Sans JP", "Yu Gothic UI", Meiryo, sans-serif;
+    font-size: 15px;
+    line-height: 1.7;
+    letter-spacing: .02em;
+    -webkit-font-smoothing: antialiased;
+}
+
+.pf *,
+.pf *::before,
+.pf *::after {
+    box-sizing: border-box;
+}
+
+/* ---- ロゴ・段階 ---- */
+.pf-logo {
+    display: flex;
+    justify-content: center;
+    margin: 8px 0 20px;
+}
+.pf-logo img {
+    max-width: 260px;
+    max-height: 72px;
+    width: auto;
+    height: auto;
+    object-fit: contain;
+}
+
+.pf-steps {
+    display: flex;
+    justify-content: center;
+    gap: 6px;
+    margin: 0 0 24px;
+    padding: 0;
+    list-style: none;
+    font-size: 12px;
+    color: var(--pf-sub);
+}
+.pf-steps li {
+    display: flex;
+    align-items: center;
+    gap: 6px;
+}
+.pf-steps li + li::before {
+    content: "";
+    width: 18px;
+    height: 1px;
+    background: var(--pf-line);
+}
+.pf-steps .pf-step-num {
+    display: inline-flex;
+    align-items: center;
+    justify-content: center;
+    width: 22px;
+    height: 22px;
+    border-radius: 50%;
+    border: 1px solid var(--pf-line);
+    background: #ffffff;
+    font-size: 11px;
+    font-weight: 700;
+    font-variant-numeric: tabular-nums;
+}
+.pf-steps li[aria-current="step"] {
+    color: var(--pf-ink);
+    font-weight: 700;
+}
+.pf-steps li[aria-current="step"] .pf-step-num {
+    border-color: var(--pf-accent);
+    background: var(--pf-accent);
+    color: #ffffff;
+}
+
+.pf-title {
+    margin: 0 0 6px;
+    font-size: 20px;
+    font-weight: 700;
+    text-align: center;
+    text-wrap: balance;
+}
+.pf-lead {
+    margin: 0 0 20px;
+    font-size: 14px;
+    color: var(--pf-sub);
+    text-align: justify;
+    white-space: pre-line;
+}
+
+/* ---- まとまり（カード） ---- */
+.pf-card {
+    display: flex;
+    flex-direction: column;
+    gap: 18px;
+    padding: 20px;
+    margin: 0 0 16px;
+    border: 1px solid var(--pf-line);
+    border-radius: 14px;
+    background: #ffffff;
+    box-shadow: 0 1px 2px rgba(29, 36, 51, .04);
+}
+.pf-card-title {
+    margin: 0;
+    font-size: 13px;
+    font-weight: 700;
+    color: var(--pf-sub);
+    letter-spacing: .08em;
+}
+
+/* ---- 項目 ---- */
+.pf-row {
+    display: grid;
+    grid-template-columns: 1fr;
+    gap: 18px;
+}
+@media (min-width: 480px) {
+    .pf-row.pf-row-2 {
+        grid-template-columns: 1fr 1fr;
+    }
+}
+
+.pf-field {
+    display: flex;
+    flex-direction: column;
+    gap: 6px;
+    min-width: 0;
+}
+.pf-label {
+    display: flex;
+    align-items: flex-start;
+    gap: 6px;
+    margin: 0;
+    font-size: 13px;
+    font-weight: 600;
+    line-height: 1.5;
+    color: var(--pf-ink);
+}
+.pf-badge {
+    flex: none;
+    display: inline-block;
+    padding: 1px 7px;
+    border-radius: 999px;
+    font-size: 11px;
+    font-weight: 700;
+    line-height: 1.6;
+    letter-spacing: .04em;
+}
+.pf-badge-req {
+    background: var(--pf-danger-bg);
+    color: var(--pf-danger);
+}
+.pf-badge-opt {
+    background: var(--pf-surface);
+    color: var(--pf-sub);
+}
+
+.pf-input,
+.pf-select,
+.pf-textarea {
+    width: 100%;
+    min-height: 48px;
+    padding: 10px 14px;
+    border: 1px solid var(--pf-line);
+    border-radius: var(--pf-radius);
+    background: var(--pf-field);
+    color: var(--pf-ink);
+    font: inherit;
+    font-size: 16px;
+    line-height: 1.5;
+    transition: border-color .15s, box-shadow .15s;
+    appearance: none;
+    -webkit-appearance: none;
+}
+.pf-select {
+    padding-right: 40px;
+    background-image: linear-gradient(45deg, transparent 50%, var(--pf-sub) 50%), linear-gradient(135deg, var(--pf-sub) 50%, transparent 50%);
+    background-position: calc(100% - 20px) 50%, calc(100% - 15px) 50%;
+    background-size: 5px 5px, 5px 5px;
+    background-repeat: no-repeat;
+}
+.pf-textarea {
+    min-height: 120px;
+    resize: vertical;
+}
+.pf-input::placeholder,
+.pf-textarea::placeholder {
+    color: #9aa3b2;
+}
+.pf-input:focus,
+.pf-select:focus,
+.pf-textarea:focus {
+    outline: none;
+    border-color: var(--pf-accent);
+    box-shadow: 0 0 0 3px color-mix(in srgb, var(--pf-accent) 22%, transparent);
+}
+.pf-field[data-invalid="1"] .pf-input,
+.pf-field[data-invalid="1"] .pf-select,
+.pf-field[data-invalid="1"] .pf-textarea {
+    border-color: var(--pf-danger);
+}
+/* ⚠️ 日付の入力欄は全体を押して暦を出す（既存の挙動） */
+.pf input[type=date] {
+    position: relative;
+}
+
+.pf-error {
+    display: flex;
+    align-items: center;
+    gap: 6px;
+    margin: 0;
+    font-size: 12px;
+    font-weight: 600;
+    color: var(--pf-danger);
+}
+.pf-error::before {
+    content: "!";
+    display: inline-flex;
+    align-items: center;
+    justify-content: center;
+    flex: none;
+    width: 16px;
+    height: 16px;
+    border-radius: 50%;
+    background: var(--pf-danger);
+    color: #ffffff;
+    font-size: 11px;
+    font-weight: 700;
+}
+
+/* 郵便番号 ＋ 住所検索 */
+.pf-inline {
+    display: flex;
+    gap: 8px;
+    align-items: stretch;
+}
+.pf-inline .pf-input {
+    flex: 1;
+}
+
+/* ---- ボタン ---- */
+.pf-actions {
+    display: flex;
+    flex-direction: column;
+    align-items: center;
+    gap: 10px;
+    margin: 28px 0 0;
+}
+.pf-btn {
+    display: inline-flex;
+    align-items: center;
+    justify-content: center;
+    gap: 8px;
+    min-height: 44px;
+    padding: 10px 18px;
+    border-radius: var(--pf-radius);
+    border: 1px solid var(--pf-line);
+    background: #ffffff;
+    color: var(--pf-ink);
+    font: inherit;
+    font-size: 14px;
+    font-weight: 600;
+    cursor: pointer;
+    white-space: nowrap;
+    transition: filter .15s, background-color .15s;
+}
+.pf-btn:hover {
+    background: var(--pf-surface);
+}
+.pf-btn:focus-visible {
+    outline: 3px solid color-mix(in srgb, var(--pf-accent) 35%, transparent);
+    outline-offset: 2px;
+}
+.pf-btn-primary {
+    width: 100%;
+    max-width: 360px;
+    min-height: 54px;
+    border-color: var(--pf-accent);
+    background: var(--pf-accent);
+    color: #ffffff;
+    font-size: 16px;
+    font-weight: 700;
+    letter-spacing: .06em;
+}
+.pf-btn-primary:hover {
+    background: var(--pf-accent);
+    filter: brightness(.92);
+}
+.pf-btn-primary[aria-busy="true"],
+.pf-btn-primary:disabled {
+    filter: grayscale(.4) brightness(1.05);
+    cursor: progress;
+}
+.pf-btn-sub {
+    font-size: 12px;
+    color: var(--pf-sub);
+}
+
+/* ---- 注意事項・特典条件 ---- */
+.pf-note {
+    margin: 0;
+    padding: 14px 16px;
+    border-radius: var(--pf-radius);
+    background: var(--pf-surface);
+    color: var(--pf-sub);
+    font-size: 13px;
+    text-align: justify;
+    white-space: pre-line;
+}
+.pf-sheet-backdrop {
+    position: fixed;
+    inset: 0;
+    z-index: 1000;
+    display: flex;
+    align-items: flex-end;
+    justify-content: center;
+    padding: 16px;
+    background: rgba(29, 36, 51, .35);
+}
+.pf-sheet {
+    width: 100%;
+    max-width: 560px;
+    max-height: 80vh;
+    overflow: auto;
+    padding: 20px;
+    border-radius: 16px;
+    background: #ffffff;
+    box-shadow: 0 12px 32px rgba(29, 36, 51, .25);
+}
+.pf-sheet-title {
+    margin: 0 0 8px;
+    font-size: 15px;
+    font-weight: 700;
+}
+.pf-sheet-body {
+    margin: 0 0 16px;
+    font-size: 13px;
+    color: var(--pf-danger);
+    white-space: pre-line;
+}
+
+/* ---- 確認画面 ---- */
+.pf-summary {
+    margin: 0;
+}
+.pf-summary-row {
+    display: grid;
+    grid-template-columns: 1fr;
+    gap: 2px;
+    padding: 12px 0;
+    border-bottom: 1px solid var(--pf-line);
+}
+.pf-summary-row:last-child {
+    border-bottom: none;
+}
+@media (min-width: 480px) {
+    .pf-summary-row {
+        grid-template-columns: 180px 1fr;
+        gap: 16px;
+    }
+}
+.pf-summary dt {
+    font-size: 13px;
+    font-weight: 600;
+    color: var(--pf-sub);
+}
+.pf-summary dd {
+    margin: 0;
+    font-size: 15px;
+    font-weight: 600;
+    color: var(--pf-ink);
+    word-break: break-word;
+    white-space: pre-line;
+}
+
+/* ---- 読み込み中・読めない ---- */
+.pf-state {
+    padding: 48px 16px;
+    text-align: center;
+    font-size: 14px;
+    color: var(--pf-sub);
+    line-height: 1.9;
+}
+
+@media (prefers-reduced-motion: reduce) {
+    .pf *,
+    .pf *::before,
+    .pf *::after {
+        transition: none !important;
+        animation: none !important;
+    }
+}
diff --git a/frontend/src/components/campaign/formPreview.tsx b/frontend/src/components/campaign/formPreview.tsx
new file mode 100644
index 00000000..bc5d3301
--- /dev/null
+++ b/frontend/src/components/campaign/formPreview.tsx
@@ -0,0 +1,160 @@
+import React from 'react';
+import type { FormState } from './NewCampaign';
+import './formPreview.css';
+
+/**
+ * 「キャンペーン作成」の右側のプレビュー（v2.2.188 新規）。
+ *
+ * ─────────────────────────────────────────────
+ * ⚠️⚠️ **公開フォーム（react/form_get の Form.tsx）の見た目を写したもの。** 入力はできない（見るだけ）。
+ *   ⚠️ 見た目は formPreview.css（公開フォームの publicForm.css の写し）。
+ *   ⚠️ 項目のまとまり・並び・文言の出し方は Form.tsx と同じにしている。
+ *     ⚠️ **公開フォームの並びを変えたら、ここも揃えること**（揃えないとプレビューと実物が食い違う）。
+ * ⚠️ ロゴと差し色の表は form_get の src/api/brands.ts（LOGO / ACCENT）と同じ。
+ * ─────────────────────────────────────────────
+ */
+
+const LOGO: Record<string, string> = {
+    kh: 'https://kh-house.jp/wp-content/themes/kokubu/img/index/imgHeaderLogo_top.png?221028',
+    djh: 'https://day-just-house.com/wp/wp-content/themes/dayjusthouse/assets/img/pc/header_logo.png',
+    nagomi: 'https://www.nagomi-koumuten.jp/wp-content/themes/nagomi/img/movie/imgHeaderLogo.png',
+    fh: 'https://furukomi-home.com/data/wp-content/themes/cms/images/header_logo.png?v=20210608',
+    '2l': 'https://2lhome.net/wp-content/uploads/2025/08/brand-logo.png',
+    pg: 'https://miyazaki.pg-house.jp/img/logo.webp',
+    jh: 'https://jusfy-home.com/lp/assets/logo-Lleu0Agz.png',
+    khg: 'https://kh-house.jp/khg/form/img/khg.png',
+};
+
+const ACCENT: Record<string, string> = {
+    kh: '#0f3675',
+    djh: '#1d8a94',
+    nagomi: '#956134',
+    'なごみ': '#956134',
+    '2l': '#0b8659',
+    jh: '#dc4235',
+    fh: '#cd3c33',
+    pg: '#1a1a1a',
+    khf: '#0d6d4b',
+    khg: '#0f3675',
+};
+
+/** ブランドの差し色（⚠️ form_get の brandAccent と同じ） */
+export const previewAccent = (brand: string): string => ACCENT[brand.trim()] ?? '#0f3675';
+
+const Badge = ({ required }: { required: boolean }) => required
+    ? <span className="pf-badge pf-badge-req">必須</span>
+    : <span className="pf-badge pf-badge-opt">任意</span>;
+
+/** 項目1つ（見るだけ）。⚠️ 公開フォームの Field と同じ形 */
+const PreviewField = ({ label, required, children }: { label: string; required: boolean; children: React.ReactNode }) => (
+    <div className="pf-field">
+        <span className="pf-label"><Badge required={required} /><span>{label || '（見出し未入力）'}</span></span>
+        {children}
+    </div>
+);
+
+const Input = ({ placeholder }: { placeholder?: string }) =>
+    <input className="pf-input" readOnly tabIndex={-1} placeholder={placeholder} />;
+
+const Select = ({ options }: { options: string[] }) => (
+    <select className="pf-select" tabIndex={-1} defaultValue="">
+        <option value="">選択してください</option>
+        {options.map((o, i) => <option key={i}>{o}</option>)}
+    </select>
+);
+
+type Props = { form: FormState; brand: string };
+
+const FormPreview = ({ form, brand }: Props) => {
+    const visitShown = form.shop.bool || form.date.bool;
+    const personShown = form.name.bool || form.kana.bool || form.age.bool;
+    const contactShown = form.phone.bool || form.mail.bool || form.line_id.bool;
+    const otherShown = form.medium.bool || form.question.bool;
+    const logo = LOGO[brand] ?? '';
+
+    return (
+        <div className="pf" style={{ ['--pf-accent' as string]: previewAccent(brand), padding: '20px 14px 28px' } as React.CSSProperties}
+            aria-label="公開フォームのプレビュー">
+            {!logo || <div className="pf-logo"><img src={logo} alt="" /></div>}
+            <ol className="pf-steps" aria-hidden="true">
+                <li aria-current="step"><span className="pf-step-num">1</span>入力</li>
+                <li><span className="pf-step-num">2</span>確認</li>
+                <li><span className="pf-step-num">3</span>完了</li>
+            </ol>
+            {!form.notice.bool || !form.notice.text || <p className="pf-lead">{form.notice.text}</p>}
+
+            {!visitShown ||
+                <section className="pf-card">
+                    <h2 className="pf-card-title">ご来場について</h2>
+                    {!form.shop.bool ||
+                        <PreviewField label={form.shop.text} required={form.shop.required}><Select options={form.shop.shopName} /></PreviewField>}
+                    {!form.date.bool ||
+                        <div className="pf-row pf-row-2">
+                            <PreviewField label={form.date.text_day} required={form.date.required}><Input placeholder="年 / 月 / 日" /></PreviewField>
+                            <PreviewField label={form.date.text_time} required={form.date.required}><Select options={form.date.time} /></PreviewField>
+                        </div>}
+                </section>}
+
+            {!personShown ||
+                <section className="pf-card">
+                    <h2 className="pf-card-title">お客様情報</h2>
+                    {!form.name.bool ||
+                        <div className="pf-row pf-row-2">
+                            <PreviewField label={form.name.text_sei} required={form.name.required}><Input /></PreviewField>
+                            <PreviewField label={form.name.text_mei} required={form.name.required}><Input /></PreviewField>
+                        </div>}
+                    {!form.kana.bool ||
+                        <div className="pf-row pf-row-2">
+                            <PreviewField label={form.kana.text_sei} required={form.kana.required}><Input /></PreviewField>
+                            <PreviewField label={form.kana.text_mei} required={form.kana.required}><Input /></PreviewField>
+                        </div>}
+                    {!form.age.bool ||
+                        <div className="pf-row pf-row-2">
+                            <PreviewField label={form.age.text} required={form.age.required}><Input /></PreviewField>
+                        </div>}
+                </section>}
+
+            {!contactShown ||
+                <section className="pf-card">
+                    <h2 className="pf-card-title">ご連絡先</h2>
+                    {!form.phone.bool || <PreviewField label={form.phone.text} required={form.phone.required}><Input /></PreviewField>}
+                    {!form.mail.bool || <PreviewField label={form.mail.text} required={form.mail.required}><Input /></PreviewField>}
+                    {!form.line_id.bool || <PreviewField label={form.line_id.text} required={form.line_id.required}><Input placeholder="LINE ID" /></PreviewField>}
+                </section>}
+
+            {!form.address.bool ||
+                <section className="pf-card">
+                    <h2 className="pf-card-title">ご住所</h2>
+                    <PreviewField label={form.address.text_zip} required={form.address.required}>
+                        <div className="pf-inline"><Input /><span className="pf-btn" aria-hidden="true">住所を検索</span></div>
+                    </PreviewField>
+                    <div className="pf-row pf-row-2">
+                        <PreviewField label={form.address.text_pref} required={form.address.required}><Input /></PreviewField>
+                        <PreviewField label={form.address.text_city} required={form.address.required}><Input /></PreviewField>
+                    </div>
+                    <PreviewField label={form.address.text_town} required={form.address.required}><Input /></PreviewField>
+                    <PreviewField label={form.address.text_street} required={form.address.required}><Input /></PreviewField>
+                </section>}
+
+            {!otherShown ||
+                <section className="pf-card">
+                    <h2 className="pf-card-title">その他</h2>
+                    {!form.medium.bool || <PreviewField label={form.medium.text} required={form.medium.required}><Select options={form.medium.mediumName} /></PreviewField>}
+                    {!form.question.bool || <PreviewField label={form.question.text} required={form.question.required}><textarea className="pf-textarea" readOnly tabIndex={-1} rows={3} /></PreviewField>}
+                </section>}
+
+            {!form.attention.bool ||
+                <div className="pf-card">
+                    {!form.attention.text || <p className="pf-note">{form.attention.text}</p>}
+                    {!form.attention.bool_red ||
+                        <div style={{ display: 'flex', justifyContent: 'center' }}><span className="pf-btn" aria-hidden="true">特典進呈条件を見る</span></div>}
+                </div>}
+
+            <div className="pf-actions">
+                <span className="pf-btn pf-btn-primary" aria-hidden="true">入力内容の確認へ進む</span>
+            </div>
+        </div>
+    );
+};
+
+export default FormPreview;
diff --git a/frontend/src/components/campaign/newCampaign.css b/frontend/src/components/campaign/newCampaign.css
new file mode 100644
index 00000000..13299469
--- /dev/null
+++ b/frontend/src/components/campaign/newCampaign.css
@@ -0,0 +1,487 @@
+/*
+ * キャンペーン作成・修正（NewCampaign.tsx）の見た目（v2.2.188 新規。Dashboard 風の SaaS デザイン）。
+ *
+ * ⚠️ 色は Dashboard の既存の配色（listUtils の styles・FestaDashboard など）に合わせた:
+ *   アクセント #5e72e4 ／ 文字 #32325d ／ 補足 #8898aa・#525f7f ／ 地 #f8f9fe ／ 罫線 #e9ecef
+ * ⚠️ プレビュー（右側）は formPreview.css（公開フォームの写し）。⚠️ ここに公開フォームの見た目を書かない。
+ */
+
+.nc {
+    --nc-accent: #5e72e4;
+    --nc-accent-soft: #eef0fd;
+    --nc-ink: #32325d;
+    --nc-sub: #525f7f;
+    --nc-muted: #8898aa;
+    --nc-line: #e9ecef;
+    --nc-bg: #f8f9fe;
+    --nc-card: #ffffff;
+    --nc-danger: #d93a4a;
+    --nc-danger-bg: #fdecee;
+    --nc-warn: #b45309;
+    --nc-warn-bg: #fff7ed;
+
+    min-height: 100%;
+    background: var(--nc-bg);
+    color: var(--nc-ink);
+    /* ⚠️ Dashboard 全体の書体（明朝寄り）を引き継ぐと入力欄が明朝になるので、ここだけゴシックにそろえる */
+    font-family: "Hiragino Sans", "Hiragino Kaku Gothic ProN", "Noto Sans JP", "Yu Gothic UI", Meiryo, sans-serif;
+    font-size: 13px;
+    line-height: 1.6;
+    padding: 20px 20px 120px;
+}
+
+/* ---- 見出し ---- */
+.nc-header {
+    display: flex;
+    align-items: center;
+    gap: 14px;
+    max-width: 1280px;
+    margin: 0 auto 18px;
+}
+.nc-header-logo {
+    height: 34px;
+    width: auto;
+    object-fit: contain;
+}
+.nc-title {
+    margin: 0;
+    font-size: 18px;
+    font-weight: 700;
+    color: var(--nc-ink);
+}
+.nc-crumb {
+    margin: 0;
+    font-size: 12px;
+    color: var(--nc-muted);
+}
+.nc-header-actions {
+    margin-left: auto;
+}
+
+/* ---- 2列（設定 ／ プレビュー） ---- */
+.nc-layout {
+    display: grid;
+    grid-template-columns: minmax(0, 1fr);
+    gap: 20px;
+    max-width: 1280px;
+    margin: 0 auto;
+    align-items: start;
+}
+@media (min-width: 1200px) {
+    .nc-layout {
+        grid-template-columns: minmax(0, 1fr) 420px;
+    }
+}
+.nc-main {
+    display: flex;
+    flex-direction: column;
+    gap: 16px;
+    min-width: 0;
+}
+.nc-preview {
+    position: sticky;
+    top: 16px;
+    border: 1px solid var(--nc-line);
+    border-radius: 12px;
+    background: var(--nc-card);
+    box-shadow: 0 1px 3px rgba(50, 50, 93, .08);
+    overflow: hidden;
+}
+.nc-preview-head {
+    display: flex;
+    align-items: center;
+    justify-content: space-between;
+    padding: 10px 14px;
+    border-bottom: 1px solid var(--nc-line);
+    font-size: 12px;
+    font-weight: 700;
+    color: var(--nc-sub);
+}
+.nc-preview-body {
+    max-height: calc(100vh - 150px);
+    overflow-y: auto;
+    background: #ffffff;
+}
+
+/* ---- カード ---- */
+.nc-card {
+    border: 1px solid var(--nc-line);
+    border-radius: 12px;
+    background: var(--nc-card);
+    box-shadow: 0 1px 3px rgba(50, 50, 93, .06);
+}
+.nc-card-head {
+    display: flex;
+    align-items: baseline;
+    gap: 10px;
+    padding: 14px 18px;
+    border-bottom: 1px solid var(--nc-line);
+}
+.nc-card-title {
+    margin: 0;
+    font-size: 14px;
+    font-weight: 700;
+    color: var(--nc-ink);
+}
+.nc-card-desc {
+    margin: 0;
+    font-size: 12px;
+    color: var(--nc-muted);
+}
+.nc-card-body {
+    display: flex;
+    flex-direction: column;
+    gap: 14px;
+    padding: 16px 18px 18px;
+}
+
+/* ---- 入力欄 ---- */
+.nc-grid-2 {
+    display: grid;
+    grid-template-columns: minmax(0, 1fr);
+    gap: 14px;
+}
+@media (min-width: 720px) {
+    .nc-grid-2 {
+        grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
+    }
+}
+.nc-field {
+    display: flex;
+    flex-direction: column;
+    gap: 5px;
+    min-width: 0;
+}
+.nc-label {
+    font-size: 12px;
+    font-weight: 600;
+    color: var(--nc-sub);
+}
+.nc-label .nc-req {
+    margin-left: 6px;
+    font-size: 11px;
+    color: var(--nc-danger);
+}
+.nc-input,
+.nc-textarea,
+.nc-select {
+    width: 100%;
+    min-height: 36px;
+    padding: 7px 10px;
+    border: 1px solid #dee2e6;
+    border-radius: 8px;
+    background: #ffffff;
+    color: var(--nc-ink);
+    font: inherit;
+    font-size: 13px;
+    transition: border-color .15s, box-shadow .15s;
+}
+.nc-textarea {
+    min-height: 90px;
+    resize: vertical;
+    line-height: 1.6;
+}
+.nc-input:focus,
+.nc-textarea:focus,
+.nc-select:focus {
+    outline: none;
+    border-color: var(--nc-accent);
+    box-shadow: 0 0 0 3px rgba(94, 114, 228, .18);
+}
+.nc-input:disabled {
+    background: #f6f8fb;
+    color: var(--nc-muted);
+}
+.nc-field[data-invalid="1"] .nc-input {
+    border-color: var(--nc-danger);
+}
+.nc-error {
+    margin: 0;
+    font-size: 12px;
+    font-weight: 600;
+    color: var(--nc-danger);
+}
+.nc-hint {
+    margin: 0;
+    font-size: 11px;
+    color: var(--nc-muted);
+}
+
+/* ---- スイッチ ---- */
+.nc-switch {
+    display: inline-flex;
+    align-items: center;
+    gap: 8px;
+    border: none;
+    background: transparent;
+    padding: 0;
+    font: inherit;
+    font-size: 12px;
+    color: var(--nc-sub);
+    cursor: pointer;
+}
+.nc-switch-track {
+    position: relative;
+    width: 36px;
+    height: 20px;
+    border-radius: 999px;
+    background: #ced4da;
+    transition: background-color .15s;
+    flex: none;
+}
+.nc-switch-track::after {
+    content: "";
+    position: absolute;
+    top: 2px;
+    left: 2px;
+    width: 16px;
+    height: 16px;
+    border-radius: 50%;
+    background: #ffffff;
+    box-shadow: 0 1px 2px rgba(0, 0, 0, .2);
+    transition: transform .15s;
+}
+.nc-switch[aria-checked="true"] .nc-switch-track {
+    background: var(--nc-accent);
+}
+.nc-switch[aria-checked="true"] .nc-switch-track::after {
+    transform: translateX(16px);
+}
+.nc-switch:focus-visible {
+    outline: 2px solid var(--nc-accent);
+    outline-offset: 3px;
+    border-radius: 6px;
+}
+
+/* ---- 2択（必須／任意 など） ---- */
+.nc-seg {
+    display: inline-flex;
+    padding: 2px;
+    border-radius: 8px;
+    background: #eef1f6;
+}
+.nc-seg button {
+    min-width: 52px;
+    padding: 4px 12px;
+    border: none;
+    border-radius: 6px;
+    background: transparent;
+    color: var(--nc-sub);
+    font: inherit;
+    font-size: 12px;
+    font-weight: 600;
+    cursor: pointer;
+}
+.nc-seg button[aria-pressed="true"] {
+    background: #ffffff;
+    color: var(--nc-ink);
+    box-shadow: 0 1px 2px rgba(50, 50, 93, .15);
+}
+.nc-seg button:disabled {
+    cursor: not-allowed;
+    opacity: .5;
+}
+.nc-seg button:focus-visible {
+    outline: 2px solid var(--nc-accent);
+    outline-offset: 1px;
+}
+
+/* ---- フォーム項目の行 ---- */
+.nc-items {
+    display: flex;
+    flex-direction: column;
+}
+.nc-item {
+    border-top: 1px solid var(--nc-line);
+    padding: 14px 18px;
+}
+.nc-item:first-child {
+    border-top: none;
+}
+.nc-item[data-shown="0"] {
+    background: #fafbfd;
+}
+.nc-item-head {
+    display: flex;
+    align-items: center;
+    flex-wrap: wrap;
+    gap: 12px;
+}
+.nc-item-name {
+    margin: 0;
+    min-width: 120px;
+    font-size: 13px;
+    font-weight: 700;
+    color: var(--nc-ink);
+}
+.nc-item[data-shown="0"] .nc-item-name {
+    color: var(--nc-muted);
+}
+.nc-item-controls {
+    display: flex;
+    align-items: center;
+    gap: 14px;
+    margin-left: auto;
+}
+.nc-item-body {
+    display: flex;
+    flex-direction: column;
+    gap: 12px;
+    margin-top: 12px;
+}
+.nc-chip {
+    display: inline-block;
+    padding: 1px 8px;
+    border-radius: 999px;
+    font-size: 11px;
+    font-weight: 700;
+    background: var(--nc-accent-soft);
+    color: var(--nc-accent);
+}
+
+/* ---- 選択肢の一覧（店舗・時間・媒体） ---- */
+.nc-options {
+    display: flex;
+    flex-direction: column;
+    gap: 6px;
+}
+.nc-option {
+    display: flex;
+    gap: 6px;
+    align-items: center;
+}
+.nc-option .nc-input {
+    flex: 1;
+}
+
+/* ---- ボタン ---- */
+.nc-btn {
+    display: inline-flex;
+    align-items: center;
+    justify-content: center;
+    gap: 6px;
+    min-height: 34px;
+    padding: 6px 14px;
+    border: 1px solid #dee2e6;
+    border-radius: 8px;
+    background: #ffffff;
+    color: var(--nc-sub);
+    font: inherit;
+    font-size: 12px;
+    font-weight: 600;
+    white-space: nowrap;
+    cursor: pointer;
+    transition: background-color .15s, border-color .15s;
+}
+.nc-btn:hover {
+    background: #f6f8fb;
+}
+.nc-btn:focus-visible {
+    outline: 2px solid var(--nc-accent);
+    outline-offset: 2px;
+}
+.nc-btn-primary {
+    border-color: var(--nc-accent);
+    background: var(--nc-accent);
+    color: #ffffff;
+}
+.nc-btn-primary:hover {
+    background: #4c5fd5;
+}
+.nc-btn-ghost {
+    border-color: transparent;
+    background: transparent;
+}
+.nc-btn-danger-text {
+    border-color: transparent;
+    background: transparent;
+    color: var(--nc-danger);
+}
+.nc-btn-danger-text:hover {
+    background: var(--nc-danger-bg);
+}
+
+/* ---- 下の保存バー ---- */
+.nc-savebar {
+    position: fixed;
+    left: 0;
+    right: 0;
+    bottom: 0;
+    z-index: 100;
+    border-top: 1px solid var(--nc-line);
+    background: rgba(255, 255, 255, .96);
+    backdrop-filter: blur(6px);
+}
+.nc-savebar-inner {
+    display: flex;
+    align-items: center;
+    gap: 10px;
+    max-width: 1280px;
+    margin: 0 auto;
+    padding: 12px 20px;
+}
+.nc-savebar-note {
+    margin: 0 auto 0 0;
+    font-size: 12px;
+    color: var(--nc-muted);
+}
+.nc-savebar .nc-btn-primary {
+    min-width: 200px;
+    min-height: 40px;
+    font-size: 13px;
+}
+
+/* ---- お知らせ ---- */
+.nc-alert {
+    max-width: 1280px;
+    margin: 0 auto 16px;
+    padding: 12px 16px;
+    border-radius: 10px;
+    border: 1px solid #f5c2c7;
+    background: var(--nc-danger-bg);
+    color: var(--nc-danger);
+    font-size: 13px;
+}
+.nc-alert small {
+    display: block;
+    color: var(--nc-sub);
+    font-size: 12px;
+}
+
+/* ---- メール文面 ---- */
+.nc-tag {
+    display: inline-block;
+    padding: 2px 10px;
+    border-radius: 999px;
+    font-size: 11px;
+    font-weight: 700;
+}
+.nc-tag-default {
+    background: #eef1f6;
+    color: var(--nc-sub);
+}
+.nc-tag-custom {
+    background: var(--nc-warn-bg);
+    color: var(--nc-warn);
+}
+.nc-warn {
+    margin: 0;
+    font-size: 12px;
+    color: var(--nc-warn);
+}
+.nc-details summary {
+    font-size: 12px;
+    color: var(--nc-accent);
+    cursor: pointer;
+}
+.nc-details code {
+    font-size: 11px;
+}
+
+@media (prefers-reduced-motion: reduce) {
+    .nc *,
+    .nc *::before,
+    .nc *::after {
+        transition: none !important;
+    }
+}
```
