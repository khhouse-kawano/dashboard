import React, { useContext, useEffect, useState } from 'react';
import { Modal, Table, Badge } from 'react-bootstrap';
import AuthContext from "../../context/AuthContext";

type Customer = Record<string, string>;

type RankedStaff = {
    name: string;
    shop: string;
    value: number;
    rank: number;
};

type Props = {
    showRanking: boolean,
    setShowRanking: React.Dispatch<React.SetStateAction<boolean>>,
    customerList: Customer[],
    monthArray: string[]
};

const Ranking = ({ showRanking, setShowRanking, customerList, monthArray }: Props) => {
    const { category } = useContext(AuthContext);
    const [targetCustomer, setTargetCustomer] = useState<RankedStaff[]>([]);

    const formate = (value: string) => {
        return (value ?? '').replace(/\//g, '-').slice(0, 7);
    };

    useEffect(() => {
        if (customerList.length === 0) return;

        const categoryMapping: Record<string, string> = {
            'order': '注文', 'spec': '建売'
        };

        const filtered = customerList.filter(c =>
            c.category === categoryMapping[category] &&
            c.status === '契約済み' &&
            monthArray.includes(formate(c.contract))
        );

        const uniqueName = [...new Set(filtered.map(f => f.staff))];
        const formattedList = uniqueName.map(u => {
            const target = filtered.filter(f => f.staff === u);
            return {
                name: u,
                shop: target[0]?.shop ?? '',
                value: target.length
            };
        });

        formattedList.sort((a, b) => b.value - a.value);

        // 4. 同着を考慮した順位付け (例: 1位, 2位, 2位, 4位...)
        let previousValue = -1;
        let actualRank = 1;

        const rankedList: RankedStaff[] = formattedList.map((item, index) => {
            if (item.value !== previousValue) {
                actualRank = index + 1;
            }
            previousValue = item.value;
            return { ...item, rank: actualRank };
        });

        // 5. フェアな足切りロジック (10名を目安とするが、同着の分断を防ぐ)
        let displayList = rankedList;
        if (rankedList.length > 10) {
            // 10番目の人のスコア（ボーダーライン）を取得
            const thresholdScore = rankedList[9].value;
            // ボーダーライン以上のスコアを持つ人を全員表示リストに含める
            displayList = rankedList.filter(item => item.value >= thresholdScore);
        }

        setTargetCustomer(displayList);
    }, [customerList, monthArray, category]);

    // 順位に応じた王冠アイコンと色を返す関数
    const renderRankIcon = (rank: number) => {
        if (rank === 1) return <><i className="fa-solid fa-crown text-warning me-2"></i>1位</>;
        if (rank === 2) return <><i className="fa-solid fa-crown me-2" style={{ color: '#C0C0C0' }}></i>2位</>;
        if (rank === 3) return <><i className="fa-solid fa-crown me-2" style={{ color: '#CD7F32' }}></i>3位</>;
        return `${rank}位`;
    };

    return (
        <Modal show={showRanking} onHide={() => setShowRanking(false)} centered>
            <Modal.Header closeButton className="bg-light border-bottom-0">
                <Modal.Title className="fw-bold fs-5">
                    <i className="fa-solid fa-ranking-star me-2 text-primary"></i>
                    {category === 'order' ? '注文事業' : '建売事業'} 契約ランキング
                </Modal.Title>
            </Modal.Header>
            <Modal.Body className="p-0">
                <Table hover className="align-middle mb-0 text-center" style={{ fontSize: '14px' }}>
                    <thead className="bg-light text-muted">
                        <tr>
                            <th className="py-3" style={{ width: '80px' }}>順位</th>
                            <th className="py-3 text-start">氏名</th>
                            <th className="py-3">所属</th>
                            <th className="py-3" style={{ width: '80px' }}>棟数</th>
                        </tr>
                    </thead>
                    <tbody>
                        {targetCustomer.map((item, index) => (
                            <tr key={`${item.name}_${index}`} className={item.rank <= 3 ? "fw-bold" : ""}>
                                <td>
                                    {item.rank <= 3 ? (
                                        <span className="fs-6">{renderRankIcon(item.rank)}</span>
                                    ) : (
                                        <Badge bg="secondary" pill className="fw-normal">{item.rank}</Badge>
                                    )}
                                </td>
                                <td className="text-start">{item.name}</td>
                                <td className="text-muted" style={{ fontSize: '13px' }}>{item.shop}</td>
                                <td className="text-primary fw-bold fs-6">{item.value}</td>
                            </tr>
                        ))}
                        {targetCustomer.length === 0 && (
                            <tr>
                                <td colSpan={4} className="py-4 text-muted">該当するデータがありません</td>
                            </tr>
                        )}
                    </tbody>
                </Table>
            </Modal.Body>
        </Modal>
    );
};

export default Ranking;