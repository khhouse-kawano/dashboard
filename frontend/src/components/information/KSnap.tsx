import React, { useEffect, useMemo, useState } from 'react';
import { Modal, Nav, Badge } from 'react-bootstrap';
import apiClient from '../../utils/apiClient';
import { ksnapImageUrl } from '../../utils/ksnapImage';

type Customer = Record<string, string>;
type Snap = Record<string, string>;
type Props = {
    id: string,
    setKSnap: React.Dispatch<React.SetStateAction<string>>
}

/**
 * 1ページの表示件数。
 *
 * ⚠️ 以前はページ数の計算が20件、実際の切り出しが10件で食い違っており、
 *   **後半の画像に到達できなかった**。1箇所で定義して両方に使う。
 */
const PAGE_SIZE = 12;

type TabKey = 'log' | 'bookmark' | 'path';

/** 閲覧ログの1件。customerData.log に JSON で入っている */
type LogEntry = { time: string; img: string };

const KSnap = ({ id, setKSnap }: Props) => {
    const [customerData, setCustomerData] = useState<Customer>({});
    const [snaps, setSnaps] = useState<Snap[]>([]);
    const [zoomedImg, setZoomedImg] = useState<string | null>(null);
    const [showPass, setShowPass] = useState(false);
    const [copied, setCopied] = useState(false);

    const [tab, setTab] = useState<TabKey>('log');
    // タブごとにページを持つ。切り替えで先頭に戻らないほうが見比べやすい
    const [pages, setPages] = useState<Record<TabKey, number>>({ log: 1, bookmark: 1, path: 1 });

    /** カンマ区切りの文字列を配列にする */
    const splitCsv = (value: string | undefined): string[] =>
        value ? value.split(',').filter(v => v !== '') : [];

    /** JSON文字列を配列にする。壊れていても画面は止めない */
    const parseJsonArray = <T,>(value: string | undefined): T[] => {
        if (typeof value !== 'string' || value.trim() === '') return [];
        try {
            const parsed: unknown = JSON.parse(value);
            return Array.isArray(parsed) ? (parsed as T[]) : [];
        } catch {
            console.error('K-SNAP: JSONの解析に失敗しました', value);
            return [];
        }
    };

    useEffect(() => {
        if (!id) return;
        const fetchData = async () => {
            const response = await apiClient.post('', { request: 'kSnap', id });
            // ⚠️ サーバーは該当行が無いと customer に false を返す
            setCustomerData(response.data.customer || {});
            setSnaps(response.data.snap ?? []);
        };
        fetchData();
    }, [id]);

    // 開き直したときに前回のタブ・ページが残らないようにする
    useEffect(() => {
        setTab('log');
        setPages({ log: 1, bookmark: 1, path: 1 });
        setShowPass(false);
    }, [id]);

    /** スナップID → 画像ファイル名 */
    const imageById = useMemo(() => {
        const map = new Map<string, string>();
        snaps.forEach(s => map.set(String(s.id), s.image));
        return map;
    }, [snaps]);

    /**
     * 閲覧ログ。新しい順。
     *
     * ⚠️ 並べ替えは**切り出しの前**に行う。
     *   以前はページを切り出した後に sort していたため、
     *   ページをまたぐと時系列が崩れていた。
     */
    const logEntries = useMemo(() => {
        return parseJsonArray<LogEntry>(customerData.log)
            .slice()
            .sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());
    }, [customerData.log]);

    const bookmarkIds = useMemo(() => splitCsv(customerData.bookmark), [customerData.bookmark]);
    const pathIds = useMemo(() => splitCsv(customerData.path), [customerData.path]);

    /** 検索タグ。回数の多い順 */
    const tagCounts = useMemo(() => {
        const counts = new Map<string, number>();
        splitCsv(customerData.tag).forEach(t => counts.set(t, (counts.get(t) ?? 0) + 1));
        return [...counts.entries()].sort((a, b) => b[1] - a[1]);
    }, [customerData.tag]);

    const tabs: { key: TabKey; label: string; icon: string; count: number }[] = [
        { key: 'log', label: '閲覧ログ', icon: 'fa-solid fa-eye', count: logEntries.length },
        { key: 'bookmark', label: 'お気に入り', icon: 'fa-solid fa-star', count: bookmarkIds.length },
        { key: 'path', label: '拡大表示', icon: 'fa-solid fa-magnifying-glass-plus', count: pathIds.length },
    ];

    const currentPage = pages[tab];
    const totalCount = tabs.find(t => t.key === tab)?.count ?? 0;
    const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

    /** 現在のページに表示するもの。画像ファイル名と補足ラベルの組 */
    const visibleItems = useMemo<{ image: string | undefined; caption: string; key: string }[]>(() => {
        const from = (currentPage - 1) * PAGE_SIZE;
        const to = from + PAGE_SIZE;

        if (tab === 'log') {
            return logEntries.slice(from, to).map((entry, i) => ({
                image: imageById.get(entry.img),
                caption: entry.time,
                key: `${entry.img}_${entry.time}_${i}`,
            }));
        }

        const ids = tab === 'bookmark' ? bookmarkIds : pathIds;
        return ids.slice(from, to).map((snapId, i) => ({
            image: imageById.get(snapId),
            caption: '',
            key: `${snapId}_${i}`,
        }));
    }, [tab, currentPage, logEntries, bookmarkIds, pathIds, imageById]);

    const changePage = (page: number) => setPages(prev => ({ ...prev, [tab]: page }));

    const copyPass = async () => {
        const pass = customerData.pass ?? '';
        if (pass === '') return;
        try {
            await navigator.clipboard.writeText(pass);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
        } catch {
            // ⚠️ https でない環境やブラウザの設定でコピーが拒否される。
            //   目のアイコンで表示すれば手で写せるため、失敗しても何もしない
        }
    };

    return (
        <>
            <Modal show={!!id} onHide={() => setKSnap('')} size='xl'>
                <Modal.Header closeButton className="bg-light py-2">
                    <Modal.Title className="fw-bold d-flex align-items-center gap-3 flex-wrap" style={{ fontSize: '15px' }}>
                        <span>
                            <i className="fa-solid fa-images me-2 text-warning" aria-hidden="true" />
                            K-SNAP 閲覧状況
                        </span>

                        {/* パスワードは常に見える位置に置く。運用で最もよく参照される */}
                        <span className="d-flex align-items-center gap-2 bg-white border rounded px-2 py-1" style={{ fontSize: '12px' }}>
                            <span className="text-muted">パスワード</span>
                            {/* ⚠️ 表示専用なので readOnly。onChange の無い value は React が警告する */}
                            <input
                                value={customerData.pass ?? ''}
                                type={showPass ? 'text' : 'password'}
                                readOnly
                                style={{
                                    width: '80px', fontSize: '16px', border: 'none',
                                    letterSpacing: '6px', padding: 0, backgroundColor: 'transparent',
                                }}
                            />
                            <i
                                className={showPass ? 'fa-solid fa-eye-slash' : 'fa-solid fa-eye'}
                                onClick={() => setShowPass(!showPass)}
                                style={{ cursor: 'pointer' }}
                                title={showPass ? '隠す' : '表示する'}
                                aria-hidden="true"
                            />
                            <i
                                className={copied ? 'fa-solid fa-check text-success' : 'fa-regular fa-copy'}
                                onClick={() => void copyPass()}
                                style={{ cursor: 'pointer' }}
                                title="コピー"
                                aria-hidden="true"
                            />
                        </span>
                    </Modal.Title>
                </Modal.Header>

                <Modal.Body className="p-0">
                    {/* 検索タグ。回数が分かると関心の強さが読める */}
                    <div className="px-3 py-2 border-bottom bg-white">
                        <div className="text-muted mb-1" style={{ fontSize: '11px' }}>
                            <i className="fa-solid fa-tag me-1" aria-hidden="true" />検索タグ
                        </div>
                        {tagCounts.length === 0 ? (
                            <span className="text-muted" style={{ fontSize: '12px' }}>検索履歴はありません</span>
                        ) : (
                            <div className="d-flex flex-wrap gap-1">
                                {tagCounts.map(([tagName, count]) => (
                                    <Badge
                                        key={tagName}
                                        bg="warning"
                                        text="dark"
                                        className="fw-normal"
                                        style={{ fontSize: '11px' }}
                                    >
                                        {tagName}
                                        <span className="ms-1 fw-bold">×{count}</span>
                                    </Badge>
                                ))}
                            </div>
                        )}
                    </div>

                    <Nav
                        variant="tabs"
                        activeKey={tab}
                        onSelect={(key) => setTab((key as TabKey) ?? 'log')}
                        className="px-2 pt-2 bg-light"
                    >
                        {tabs.map(t => (
                            <Nav.Item key={t.key}>
                                <Nav.Link eventKey={t.key} className="py-1 px-3" style={{ fontSize: '12px' }}>
                                    <i className={`${t.icon} me-1`} aria-hidden="true" />
                                    {t.label}
                                    <span className="ms-1 text-muted">{t.count}</span>
                                </Nav.Link>
                            </Nav.Item>
                        ))}
                    </Nav>

                    <div className="p-3" style={{ minHeight: '260px' }}>
                        {totalCount === 0 ? (
                            <div className="text-center text-muted py-5" style={{ fontSize: '13px' }}>
                                データがありません
                            </div>
                        ) : (
                            <div
                                style={{
                                    display: 'grid',
                                    gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
                                    gap: '10px',
                                }}
                            >
                                {visibleItems.map(item => (
                                    <div key={item.key}>
                                        <div
                                            className="border rounded overflow-hidden bg-light"
                                            style={{ aspectRatio: '4 / 3' }}
                                        >
                                            {item.image ? (
                                                <img
                                                    src={ksnapImageUrl(item.image)}
                                                    onClick={() => setZoomedImg(item.image ?? null)}
                                                    style={{ width: '100%', height: '100%', objectFit: 'cover', cursor: 'pointer' }}
                                                    alt={item.caption || 'snap'}
                                                    loading="lazy"
                                                />
                                            ) : (
                                                // ⚠️ 削除済みのスナップが履歴に残っていると画像が引けない。
                                                //   空欄にすると原因が分からないので明示する
                                                <div className="d-flex align-items-center justify-content-center h-100 text-muted" style={{ fontSize: '10px' }}>
                                                    画像なし
                                                </div>
                                            )}
                                        </div>
                                        {item.caption !== '' && (
                                            <div className="text-muted text-center mt-1" style={{ fontSize: '10px' }}>
                                                {item.caption}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {totalPages > 1 && (
                        <div className="d-flex justify-content-center align-items-center gap-1 flex-wrap px-3 pb-3">
                            <button
                                type="button"
                                className="btn btn-sm btn-outline-secondary"
                                style={{ fontSize: '11px' }}
                                disabled={currentPage === 1}
                                onClick={() => changePage(currentPage - 1)}
                            >
                                前へ
                            </button>
                            {[...Array(totalPages)].map((_, index) => (
                                <button
                                    key={index}
                                    type="button"
                                    className={`btn btn-sm ${index + 1 === currentPage ? 'btn-secondary' : 'btn-outline-secondary'}`}
                                    style={{ fontSize: '11px', minWidth: '32px' }}
                                    onClick={() => changePage(index + 1)}
                                >
                                    {index + 1}
                                </button>
                            ))}
                            <button
                                type="button"
                                className="btn btn-sm btn-outline-secondary"
                                style={{ fontSize: '11px' }}
                                disabled={currentPage === totalPages}
                                onClick={() => changePage(currentPage + 1)}
                            >
                                次へ
                            </button>
                            <span className="text-muted ms-2" style={{ fontSize: '11px' }}>
                                {(currentPage - 1) * PAGE_SIZE + 1}〜{Math.min(currentPage * PAGE_SIZE, totalCount)} / {totalCount} 件
                            </span>
                        </div>
                    )}
                </Modal.Body>
            </Modal>

            <Modal show={!!zoomedImg} onHide={() => setZoomedImg(null)} centered size="xl">
                <Modal.Header closeButton style={{ borderBottom: 'none' }}></Modal.Header>
                <Modal.Body className="text-center p-0 pb-4">
                    {zoomedImg && (
                        <img
                            onClick={() => setZoomedImg(null)}
                            src={ksnapImageUrl(zoomedImg)}
                            alt="拡大表示"
                            style={{ maxWidth: '100%', maxHeight: '85vh', objectFit: 'contain', cursor: 'zoom-out' }}
                        />
                    )}
                </Modal.Body>
            </Modal>
        </>
    )
}

export default KSnap;
