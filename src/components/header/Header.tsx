import React, { useState, useEffect, useContext } from 'react';
import EditStaff from './EditStaff';
import EditAuth from './EditAuth';
import EditShop from './EditShop';
import EditBlackList from './EditBlackList';
import Modal from 'react-bootstrap/Modal';
import Dropdown from 'react-bootstrap/Dropdown';
import MetaAdsDashboard from './MetaAdsDashboard';
import SyncEstate from './SyncEstate';
import CompetitorMaterials from './CompetitorMaterials';
import Estate from '../Estate';
import CallStatus from '../CallStatusList';
import axios from "axios";
import { headers } from '../../utils/headers';
import { useIsSp } from '../../utils/isSp';
import AuthContext from '../../context/AuthContext';
import BudgetSimulator from './BudgetSimulator';

// 型安全のための定義
type MenuKey = '店舗管理' | 'スタッフ管理' | '反響管理' | '土地・物件管理' | '他社動向' | '架電状況';

const Header = ({  }) => {
    const { authority } = useContext(AuthContext);
    const [editMenu, setEditMenu] = useState<string>('');
    const [modal, setModal] = useState<boolean>(false);
    const [estateId, setEstateId] = useState('search');
    const [callStatusShow, setCallStatusShow] = useState(true);
    const menuArray: MenuKey[] = ['店舗管理', 'スタッフ管理', '反響管理', '土地・物件管理', '他社動向', '架電状況'];
    const [newEstate, setNewEstate] = useState<number | null>(0);

    const isSp = useIsSp();

    const menuMapping: Record<MenuKey, string[]> = {
        '店舗管理': ['店舗編集'],
        'スタッフ管理': ['スタッフ編集・追加', '権限編集'],
        '反響管理': authority === 'Master' ? ['販促媒体設定', 'ブラックリスト設定', '広告費シミュレーター'] : ['販促媒体設定', 'ブラックリスト設定'],
        '土地・物件管理': ['土地情報同期', '土地情報一覧'],
        '他社動向': ['他社広告ライブラリ', '他社資料'],
        '架電状況': ['注文営業', '建売営業', '中古営業']
    };

    const editMapping: Record<string, React.ReactNode> = {
        'スタッフ編集・追加': <EditStaff />,
        '権限編集': <EditAuth />,
        '店舗編集': <EditShop />,
        'ブラックリスト設定': <EditBlackList />,
        '他社広告ライブラリ': <MetaAdsDashboard />,
        '土地情報同期': <SyncEstate setModal={setModal} />,
        '他社資料': <CompetitorMaterials />,
        '土地情報一覧': <Estate estateId={estateId} setEstateId={setEstateId} source='header' />,
        '注文営業': <CallStatus callStatusShow={callStatusShow} setCallStatusShow={setCallStatusShow} source='order' />,
        '建売営業': <CallStatus callStatusShow={callStatusShow} setCallStatusShow={setCallStatusShow} source='spec' />,
        '中古営業': <CallStatus callStatusShow={callStatusShow} setCallStatusShow={setCallStatusShow} source='used' />,
        '広告費シミュレーター': <BudgetSimulator />
    };

    useEffect(() => {
        const fetchData = async () => {
            const response = await axios.post("https://khg-marketing.info/dashboard/api/gateway/", { request: "header" }, { headers });
            setNewEstate(response.data.estate);
        };
        fetchData();

    }, []);

    const isEstate = (value: string) => {
        return newEstate !== null && newEstate > 0 && value === '土地情報一覧';
    };

    return (
        <>
            {!isSp && <div
                className="d-flex align-items-center bg-white border-bottom px-2 position-fixed top-0 start-0 w-100"
                style={{ zIndex: 1050, height: '30px', userSelect: 'none' }}
            >
                {menuArray.map((menu) => (
                    <Dropdown key={menu} className="me-1">
                        <Dropdown.Toggle
                            variant="text"
                            size="sm"
                            className="border-0 px-2.5 py-1 text-dark d-flex align-items-center"
                            style={{
                                fontSize: '13px',
                                fontWeight: '500',
                                boxShadow: 'none',
                                borderRadius: '4px'
                            }}
                        >
                            {menu}
                        </Dropdown.Toggle>

                        <Dropdown.Menu
                            className="shadow-sm border border-light-subtle py-1"
                            style={{ fontSize: '13px', minWidth: '160px' }}
                        >
                            {menuMapping[menu].map((item) => (
                                <Dropdown.Item
                                    key={item}
                                    className="py-2 px-3 text-dark position-relative"
                                    onClick={() => {
                                        setEditMenu(item);
                                        setModal(true);
                                    }}
                                >
                                    {item}{isEstate(item) && <div className="position-absolute menu_sync" style={{ top: '12px', right: '10px' }}>新着 {newEstate}件</div>}
                                </Dropdown.Item>
                            ))}
                        </Dropdown.Menu>
                    </Dropdown>
                ))}
            </div>}
            <Modal show={modal} onHide={() => setModal(false)} size={editMenu === '土地情報同期' ? 'sm' : 'xl'} centered backdrop="static">
                <Modal.Header closeButton className="border-bottom-0 pb-0 fw-bold text-secondary" style={{ fontSize: '15px' }}>
                    {editMenu}
                </Modal.Header>
                <Modal.Body className="pt-2">
                    <div style={{ overflow: 'auto' }}>
                        <div style={{ height: '80vh' }}>
                            {editMapping[editMenu] || (
                                <div className="text-muted text-center py-4" style={{ fontSize: '13px' }}>
                                    現在、{editMenu} のコンポーネントを準備中です。
                                </div>
                            )}
                        </div>
                    </div>
                </Modal.Body>
            </Modal>
        </>
    );
};

export default Header;