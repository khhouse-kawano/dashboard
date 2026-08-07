import React from 'react'
import Modal from 'react-bootstrap/Modal';
import Table from 'react-bootstrap/Table';

type Survey = { id: number, sync: number, brand: string, dateStr: string, name: string, considerationStart: string, desiredMoveIn: string, visitedCompanies: string, reasonForConsidering: string, reasonOther: string, futurePlan: string, futureOther: string, desiredSize: string, desiredLayout: string, priorityItem: string, expectedResidents: string, totalBudget: string, monthlyRepayment: string, annualIncome: string, yearsOfService: string, otherIncomePerson: string, otherAnnualIncome: string, ownFunds: string, otherLoans: string, thingsToDo: string, thingsToDoOther: string, housingType: string, housingTypeOther: string, landArea: string, referrerName: string, emailAddress: string, campaign: string };

type Props = {
    show: boolean,
    modalClose: () => void,
    modalContent: string,
    modalBeforeContent: Survey | undefined
};

const OrderModal = ({show, modalClose, modalContent, modalBeforeContent}: Props) => {
  return (
    <>
                <Modal show={show} onHide={modalClose} size='lg'>
                <Modal.Header closeButton>
                    <Modal.Title style={{ fontSize: '15px' }}>{modalContent === 'beforeSurvey' ? 'アンケート詳細' : ''}</Modal.Title>
                </Modal.Header>
                <Modal.Body>{modalContent === 'beforeSurvey' &&
                    <Table striped bordered>
                        <tbody style={{ fontSize: '12px' }}>
                            <tr>
                                <td>受信日</td>
                                <td>{modalBeforeContent?.dateStr ?? '-'}</td>
                            </tr>
                            <tr>
                                <td>顧客名</td>
                                <td>{modalBeforeContent?.name ?? '-'}</td>
                            </tr>
                            <tr>
                                <td>ブランド</td>
                                <td>{modalBeforeContent?.brand ?? '-'}</td>
                            </tr>
                            <tr>
                                <td>反響経路</td>
                                <td>{modalBeforeContent?.campaign ?? '-'}</td>
                            </tr>
                            <tr>
                                <td>検討時期</td>
                                <td>{modalBeforeContent?.considerationStart ?? '-'}</td>
                            </tr>
                            <tr>
                                <td>入居希望時期</td>
                                <td>{modalBeforeContent?.desiredMoveIn ?? '-'}</td>
                            </tr>
                            <tr>
                                <td>住宅会社訪問数</td>
                                <td>{modalBeforeContent?.visitedCompanies ?? '-'}</td>
                            </tr>
                            <tr>
                                <td>新築検討理由</td>
                                <td>{modalBeforeContent?.reasonForConsidering ?? '-'}</td>
                            </tr>
                            <tr>
                                <td>その他の検討理由</td>
                                <td>{modalBeforeContent?.reasonOther ?? '-'}</td>
                            </tr>
                            <tr>
                                <td>今後の行動予定</td>
                                <td>{modalBeforeContent?.futurePlan ?? '-'}</td>
                            </tr>
                            <tr>
                                <td>その他の行動予定</td>
                                <td>{modalBeforeContent?.futureOther ?? '-'}</td>
                            </tr>
                            <tr>
                                <td>希望の広さ</td>
                                <td>{modalBeforeContent?.desiredSize ?? '-'}</td>
                            </tr>
                            <tr>
                                <td>希望の間取り</td>
                                <td>{modalBeforeContent?.desiredLayout ?? '-'}</td>
                            </tr>
                            <tr>
                                <td>重視項目</td>
                                <td>{modalBeforeContent?.priorityItem ?? '-'}</td>
                            </tr>
                            <tr>
                                <td>入居予定人数</td>
                                <td>{modalBeforeContent?.expectedResidents ?? '-'}</td>
                            </tr>
                            <tr>
                                <td>総予算</td>
                                <td>{modalBeforeContent?.totalBudget ?? '-'}</td>
                            </tr>
                            <tr>
                                <td>返済額</td>
                                <td>{modalBeforeContent?.monthlyRepayment ?? '-'}</td>
                            </tr>
                            <tr>
                                <td>前年度の年収</td>
                                <td>{modalBeforeContent?.annualIncome ?? '-'}</td>
                            </tr>
                            <tr>
                                <td>勤続年数</td>
                                <td>{modalBeforeContent?.yearsOfService ?? '-'}</td>
                            </tr>
                            <tr>
                                <td>年収がある方</td>
                                <td>{modalBeforeContent?.otherIncomePerson ?? '-'}</td>
                            </tr>
                            <tr>
                                <td>年収がある方の年収</td>
                                <td>{modalBeforeContent?.otherAnnualIncome ?? '-'}</td>
                            </tr>
                            <tr>
                                <td>自己資金の支払予定</td>
                                <td>{modalBeforeContent?.ownFunds ?? '-'}</td>
                            </tr>
                            <tr>
                                <td>その他ローン</td>
                                <td>{modalBeforeContent?.otherLoans ?? '-'}</td>
                            </tr>
                            <tr>
                                <td>当日したいこと</td>
                                <td>{modalBeforeContent?.thingsToDo ?? '-'}</td>
                            </tr>
                            <tr>
                                <td>その他当日したいこと</td>
                                <td>{modalBeforeContent?.thingsToDoOther ?? '-'}</td>
                            </tr>
                            <tr>
                                <td>新居の希望</td>
                                <td>{modalBeforeContent?.housingType ?? '-'}</td>
                            </tr>
                            <tr>
                                <td>その他の希望</td>
                                <td>{modalBeforeContent?.housingTypeOther ?? '-'}</td>
                            </tr>
                            <tr>
                                <td>希望の土地エリア</td>
                                <td>{modalBeforeContent?.landArea ?? '-'}</td>
                            </tr>
                            <tr>
                                <td>紹介者様</td>
                                <td>{modalBeforeContent?.referrerName ?? '-'}</td>
                            </tr>
                            <tr>
                                <td>メールアドレス</td>
                                <td>{modalBeforeContent?.emailAddress ?? '-'}</td>
                            </tr>
                        </tbody>
                    </Table>}
                </Modal.Body>
            </Modal></>
  )
}

export default OrderModal