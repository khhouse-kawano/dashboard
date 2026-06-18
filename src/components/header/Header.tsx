import React, { useState } from 'react';
import EditStaff from './EditStaff';
import EditAuth from './EditAuth';
import EditShop from './EditShop';
import EditBlackList from './EditBlackList';
import Modal from 'react-bootstrap/Modal';
import Dropdown from 'react-bootstrap/Dropdown';
import MetaAdsDashboard from './MetaAdsDashboard';

// 型安全のための定義
type MenuKey = '店舗管理' | 'スタッフ管理' | '反響管理' | '土地管理' | '他社動向';

const Header = () => {
    const [editMenu, setEditMenu] = useState<string>('');
    const [modal, setModal] = useState<boolean>(false);

    const menuArray: MenuKey[] = ['店舗管理', 'スタッフ管理', '反響管理', '土地管理', '他社動向'];

    const menuMapping: Record<MenuKey, string[]> = {
        '店舗管理': ['店舗編集'],
        'スタッフ管理': ['スタッフ編集・追加', '権限編集'],
        '反響管理': ['販促媒体設定', 'ブラックリスト設定'],
        '土地管理': ['土地情報同期'],
        '他社動向': ['広告ライブラリ']
    };

    const editMapping: Record<string, React.ReactNode> = {
        'スタッフ編集・追加': <EditStaff />,
        '権限編集': <EditAuth />,
        '店舗編集': <EditShop />,
        'ブラックリスト設定': <EditBlackList />,
        '広告ライブラリ': <MetaAdsDashboard />
    };

    return (
        <>
            {/* ヘッダー外枠：fixedで上部に固定し、スプレッドシート風のコンパクトな高さを維持 */}
            <div
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
                                    className="py-2 px-3 text-dark"
                                    onClick={() => {
                                        setEditMenu(item);
                                        setModal(true);
                                    }}
                                >
                                    {item}
                                </Dropdown.Item>
                            ))}
                        </Dropdown.Menu>
                    </Dropdown>
                ))}
            </div>
            <Modal show={modal} onHide={() => setModal(false)} size='xl' centered backdrop="static">
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