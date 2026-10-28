import React, { useEffect, useState } from 'react';
import { loadRecords } from '../common/realtyState';
import type { Row } from '../summary/kpi';
import { monthLabel } from '../summary/kpi';
import { contactKpi } from './callqLogic';
import type { ContactKpi } from './callqLogic';

/**
 * 📞 接触の質（週次行動計画に差し込む表。v2.2.226）。
 *
 * ⚠️ 移植元は以前のアプリの V16.weeklyPanel。主KPIは成約ではなく**接触確認率**
 *   ＝ 架電のうち相手の状況を確認できた割合（✅終了確定＝他決の判明も前進としてプラス計上）。
 * ⚠️ 売り・買いの両方の📞架電を、架電した人ごとに数える（callqLogic.ts の contactKpi）。
 *   「結果未記録」（📞架電ボタンだけで記録した架電）は分母に入れない。
 */

type Props = { month: string; names: string[] };

const FIELDS: (keyof ContactKpi)[] = ['calls', 'contact', 'known', 'talk', 'apo', 'end', 'abs', 'none'];

const rateCls = (r: number | null) => (r === null ? '' : r >= 0.5 ? 'rlt-ok' : r >= 0.3 ? 'rlt-mid' : 'rlt-bad');
const rateTxt = (r: number | null) => (r === null ? '―' : `${Math.round(r * 100)}%`);

const ContactQualityPanel: React.FC<Props> = ({ month, names }) => {
    const [rows, setRows] = useState<{ leads: Row[]; buyLeads: Row[] } | null>(null);

    useEffect(() => {
        loadRecords(['leads', 'buyLeads'])
            .then(r => setRows({ leads: r.records.leads, buyLeads: r.records.buyLeads }))
            .catch((e: Error) => alert(`接触の質を読み込めませんでした: ${e.message}`));
    }, []);

    const from = `${month}-01`;
    const to = `${month}-31`;
    const per = rows ? names.map(n => ({ n, k: contactKpi(rows.leads, rows.buyLeads, n, from, to) })) : [];
    const tot = per.reduce<Record<string, number>>((a, { k }) => {
        for (const f of FIELDS) a[f] = (a[f] ?? 0) + (k[f] as number);
        return a;
    }, {});
    const totRate = tot.known ? tot.contact / tot.known : null;

    return (
        <div className="rlt-card">
            <div className="rlt-card-head">
                <h3>📞 接触の質（{monthLabel(month)}）</h3>
                <span className="rlt-note">主KPIは成約ではなく<b>接触確認率</b>＝架電のうち相手の状況を確認できた割合（✅終了確定＝他決の判明も前進としてプラス計上）</span>
            </div>
            <div className="rlt-tblwrap">
                <table className="rlt-tbl">
                    <thead><tr>
                        <th>担当者</th><th className="r">📞架電</th><th className="r">接触確認</th><th className="r">接触確認率</th>
                        <th className="r">🗣通電</th><th className="r">📅アポ</th><th className="r">✅終了確定</th><th className="r">📵不在</th><th className="r">結果未記録</th>
                    </tr></thead>
                    <tbody>
                        {!rows && <tr><td colSpan={9} className="rlt-sub">読み込み中…</td></tr>}
                        {per.map(({ n, k }) => (
                            <tr key={n}>
                                <td>{n}</td><td className="r">{k.calls}</td><td className="r">{k.contact}</td>
                                <td className={`r ${rateCls(k.rate)}`}>{rateTxt(k.rate)}</td>
                                <td className="r">{k.talk}</td><td className="r">{k.apo}</td><td className="r">{k.end}</td>
                                <td className="r">{k.abs}</td><td className="r">{k.none || '―'}</td>
                            </tr>
                        ))}
                        {per.length > 0 && (
                            <tr className="total">
                                <td>チーム計</td><td className="r">{tot.calls}</td><td className="r">{tot.contact}</td>
                                <td className="r">{rateTxt(totRate)}</td>
                                <td className="r">{tot.talk}</td><td className="r">{tot.apo}</td><td className="r">{tot.end}</td>
                                <td className="r">{tot.abs}</td><td className="r">{tot.none || '―'}</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
            <div className="rlt-body rlt-note" style={{ paddingTop: 8 }}>
                「結果未記録」は📞架電ボタンだけで記録され、結果（不在／通電／アポ／終了）が入っていない件数です。分母には含めていません。結果は<b>📞今日の架電キュー</b>の4ボタンから記録されます。
            </div>
        </div>
    );
};

export default ContactQualityPanel;
