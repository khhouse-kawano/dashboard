import React from 'react'
import Table from "react-bootstrap/Table";
import Modal from "react-bootstrap/Modal";
import { dateFormate } from '../list/listUtils';

type Props = {
    integrate: Record<string, string>,
    setIntegrate: React.Dispatch<React.SetStateAction<Record<string, string>>>,
    integrateList: Record<string, string>[],
    setIntegrateList: React.Dispatch<React.SetStateAction<Record<string, string>[]>>,
    handleIntegrate: () => void
}

const IntegrateModal = ({ integrate, setIntegrate, integrateList, setIntegrateList, handleIntegrate }: Props) => {
    return (
        <>
            <Modal show={!!integrate.id} onHide={() => setIntegrate({})} size='xl'>
                <Modal.Header closeButton>重複顧客洗い出し</Modal.Header>
                <Modal.Body>
                    <div className="bg-light text-secondary rounded p-3 mb-3" style={{ fontSize: '12px' }}>
                        <div className="">※<span className='fw-bold'>「名寄せ先」</span>に顧客データが集約されます。<br />※入力情報や各種ステータスは<span className='fw-bold'>「名寄せ先」</span>のデータが残ります。
                            <br />※<span className='fw-bold'>「統合」にチェックがある</span>顧客の商談履歴や架電履歴は統合されます。<br />※<span className='fw-bold'>「統合しない」</span>もしくは<span className='fw-bold'>チェックがない場合</span>顧客データはそのまま残ります。</div>
                    </div>
                    <Table style={{ fontSize: '12px' }} bordered striped>
                        <thead>
                            <tr>
                                <th>処理</th>
                                <th>反響日</th>
                                <th>登録顧客名</th>
                                <th>担当</th>
                                <th>反響元</th>
                                <th>住所</th>
                                <th>連絡先</th>
                            </tr>
                        </thead>
                        <tbody className='align-middle'>
                            <tr>
                                <td>
                                    <div className="d-flex align-items-center">
                                        {['名寄せ先', '統合', '統合しない'].map((item, index) =>
                                            <div className='pe-2'>
                                                <label htmlFor={`integration-${index}`} className='d-flex align-items-center'>
                                                    <input type="radio" value={item} name='integration' key={index} id={`integration-${index}`}
                                                        onChange={() => setIntegrate(prev => ({
                                                            ...prev,
                                                            integration: item === '名寄せ先' ? '1' : '0',
                                                            show_dashboard: item === '統合' ? '0' : '1'
                                                        }))} />{item}
                                                </label>
                                            </div>
                                        )}
                                    </div>
                                </td>
                                <td>{dateFormate(integrate.register)}</td>
                                <td>{integrate.customer}</td>
                                <td>{integrate.staff}</td>
                                <td>{integrate.hp_campaign}</td>
                                <td>{integrate.full_address}</td>
                                <td>{integrate.mail}<br />{integrate.phone_number}</td>
                            </tr>
                            {integrateList.map((item) =>
                                <tr key={item.id}>
                                    <td>
                                        <div className="d-flex align-items-center">
                                            {['名寄せ先', '統合', '統合しない'].map((int, n) =>
                                                <div className='pe-2' key={n}>
                                                    <label
                                                        htmlFor={`integrationList-${item.id}-${n}`}
                                                        className='d-flex align-items-center'
                                                    >
                                                        <input
                                                            type="radio"
                                                            value={int}
                                                            name={`integrationListInput-${item.id}`}
                                                            id={`integrationList-${item.id}-${n}`}
                                                            checked={
                                                                int === '名寄せ先'
                                                                    ? item.integration === '1'
                                                                    : int === '統合'
                                                                        ? item.integration === '0' && item.show_dashboard === '0'
                                                                        : item.integration === '0' && item.show_dashboard === '1'
                                                            }
                                                            onChange={() =>
                                                                setIntegrateList(prev =>
                                                                    prev.map(p =>
                                                                        p.id === item.id
                                                                            ? {
                                                                                ...p,
                                                                                show_dashboard: int === '統合' ? '0' : '1',
                                                                                integration: int === '名寄せ先' ? '1' : '0'
                                                                            }
                                                                            : p
                                                                    )
                                                                )
                                                            }
                                                        />
                                                        {int}
                                                    </label>
                                                </div>
                                            )}
                                        </div>
                                    </td>
                                    <td>{dateFormate(item.register)}</td>
                                    <td>{item.customer}</td>
                                    <td>{item.staff}</td>
                                    <td>{item.hp_campaign}</td>
                                    <td>{item.full_address}</td>
                                    <td>{item.mail}<br />{item.phone_number}</td>
                                </tr>
                            )}
                        </tbody>
                    </Table>
                    <Modal.Footer>
                        <div className="d-flex justify-content-end w-100 gap-2">
                            <button
                                className="btn btn-danger btn-sm rounded-pill px-5 shadow-sm d-flex align-items-center"
                                style={{ fontSize: '12px', fontWeight: 'bold', letterSpacing: '1px' }}
                                onClick={() => {
                                    setIntegrate({});
                                    setIntegrateList([]);
                                }}
                            >
                                <i className="fa-solid fa-xmark me-2"></i>閉じる
                            </button>
                            <button
                                className="btn btn-primary btn-sm rounded-pill px-5 shadow-sm d-flex align-items-center"
                                style={{ fontSize: '12px', fontWeight: 'bold', letterSpacing: '1px' }}
                                onClick={() => handleIntegrate()}
                            >
                                <i className="fa-solid fa-check me-2"></i>顧客の統合
                            </button>
                        </div>
                    </Modal.Footer>
                </Modal.Body>
            </Modal>
        </>
    )
}

export default IntegrateModal