import React from 'react';

/**
 * AIデジタル資金計画書を別ウインドウで開くボタン。
 *
 * ─────────────────────────────────────────────
 * ⚠️⚠️ **画面本体は React ではない。**
 *
 *   frontend/public/funding-plan/index.html に、元の2,539行の
 *   バニラJSアプリをそのまま置いている。このコンポーネントは
 *   `window.open` でそれを開くだけ。
 *
 *   なぜ移植しないのか
 *     住宅ローン控除・太陽光の売買電・FPシミュレーション・段取り表など、
 *     検算しづらい計算が10タブ分ある。TSX に書き直すと数字がずれても
 *     気づけない。計算ロジックは触らないほうが安全である。
 *
 *   顧客の受け渡しは URL の `?id=`。開いた側が
 *   `request: 'funding_plan'` で自分のデータを取りに行く。
 * ─────────────────────────────────────────────
 */

type Props = {
    /** master_data.id。⚠️ 未保存の新規顧客では空になりうる */
    id: string;
    /** 顧客名。まだ保存されていない場合の警告文に使う */
    customerName?: string;
    /** 新規登録中（id === 'new'）か。保存前は開かせない */
    isNew: boolean;
};

/**
 * 資金計画書のURL。
 *
 * ⚠️ `%PUBLIC_URL%` は JSX では使えないため `process.env.PUBLIC_URL` を使う。
 *   本番は `/dashboard` が入るので `/dashboard/funding-plan/index.html` になる。
 *   ハードコードすると、配置先が変わったときに 404 になる。
 */
const fundingPlanUrl = (id: string): string =>
    `${process.env.PUBLIC_URL}/funding-plan/index.html?id=${encodeURIComponent(id)}`;

/**
 * 別ウインドウ（ポップアップ）として開くための指定。
 *
 * ─────────────────────────────────────────────
 * ⚠️⚠️ **この第3引数を省略すると「別タブ」になる。**
 *   window.open(url, name) の2引数だけでは、最近のブラウザは
 *   新しいタブを開く。ウインドウとして開かせるには、
 *   ウインドウの大きさや位置を含む feature 文字列が必要である。
 *
 * ⚠️ `popup=yes` だけでは Firefox が既定の小さなウインドウにするため、
 *   幅・高さも明示する。
 *
 * ⚠️ `noopener` / `noreferrer` は入れない。入れると戻り値が null になり、
 *   ポップアップブロックの判定ができなくなる（open() 側のコメント参照）。
 * ─────────────────────────────────────────────
 *
 * ⚠️ 大きさは画面に収まる範囲にする。固定値だとノートPCで
 *   下端のボタンが画面外に出て押せなくなる。
 *   資金計画書は10タブの横長レイアウトなので、可能な限り広く取る。
 */
const windowFeatures = (): string => {
    const availWidth = window.screen.availWidth || 1440;
    const availHeight = window.screen.availHeight || 900;

    const width = Math.min(1440, availWidth);
    // ⚠️ タイトルバー等の分を引く。availHeight ぴったりだと縦スクロールが出る
    const height = Math.min(960, availHeight - 40);

    // 画面中央に置く。⚠️ マイナスにならないよう 0 で止める
    const left = Math.max(0, Math.round((availWidth - width) / 2));
    const top = Math.max(0, Math.round((availHeight - height) / 2));

    return [
        'popup=yes',
        `width=${width}`,
        `height=${height}`,
        `left=${left}`,
        `top=${top}`,
        // ⚠️ 印刷前提の画面なので、内容が入り切らないときはスクロールさせる
        'scrollbars=yes',
        'resizable=yes'
    ].join(',');
};

const FundingPlan = ({ id, customerName, isNew }: Props) => {

    const open = () => {
        // ⚠️ 保存前の顧客では開かない。master_data に行が無いと
        //   API が 404 を返し、開いた先で「顧客が見つかりません」になる。
        if (isNew || !id) {
            alert('先に顧客情報を保存してください。\n保存後に資金計画書を作成できます。');
            return;
        }

        // ⚠️ noopener を付けない。付けると window.open が null を返す環境があり、
        //   ポップアップブロックの判定ができなくなる。
        //   開く先は同一オリジンの自前のページなので、逆タブナビング（tabnabbing）の
        //   リスクは無い。
        const w = window.open(fundingPlanUrl(id), `funding_plan_${id}`, windowFeatures());

        if (w === null) {
            // ⚠️ 何も起きないと「ボタンが壊れている」と思われる。必ず知らせる
            alert('別ウインドウを開けませんでした。\nブラウザのポップアップブロックを解除してください。');
            return;
        }
        w.focus();
    };

    return (
        <button
            className="btn btn-sm rounded-pill px-2 d-flex align-items-center"
            // ⚠️ 他のボタン（outline 系）と区別が付くよう塗りのボタンにする。
            //   指示は「カラーを変える」。保存ボタン（btn-primary）とも別の色にする。
            style={{
                fontSize: '12px',
                fontWeight: '500',
                letterSpacing: '0',
                whiteSpace: 'nowrap',
                backgroundColor: '#0F3675',
                borderColor: '#0F3675',
                color: '#ffffff',
                // 保存前は押せないことを見た目でも示す
                opacity: isNew || !id ? 0.5 : 1
            }}
            onClick={open}
            title={
                isNew || !id
                    ? '顧客情報を保存すると使えます'
                    : `${customerName ?? ''}様のデジタル資金計画書を別ウインドウで開きます`
            }
        >
            <i className="fa-solid fa-calculator me-1"></i>デジシキ作成
        </button>
    );
};

export default FundingPlan;
