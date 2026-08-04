import React, { useState, useEffect } from 'react';

// DB側で自動設定される項目を除いたフォーム用データ型
interface ListingFormData {
    customerId: string;
    address: string;
    propertyType: string;
    listPrice: number | '';
    mediationType: 'EXCLUSIVE_AGENCY' | 'EXCLUSIVE' | 'GENERAL' | '';
    mediationSignedAt: string;
    mediationExpireAt: string;
}

const INITIAL_FORM_DATA: ListingFormData = {
    customerId: '',
    address: '',
    propertyType: '',
    listPrice: '',
    mediationType: '',
    mediationSignedAt: '',
    mediationExpireAt: '',
};

type Props = {
    setModal: React.Dispatch<React.SetStateAction<boolean>>
}

const RegisterBrokerageListings: React.FC<Props> = ({ setModal }) => {
    const [formData, setFormData] = useState<ListingFormData>(INITIAL_FORM_DATA);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // 媒介契約日が入力されたら、自動的に3ヶ月後を満了日にセット
    useEffect(() => {
        if (formData.mediationSignedAt) {
            const signedDate = new Date(formData.mediationSignedAt);
            if (!isNaN(signedDate.getTime())) {
                const expireDate = new Date(signedDate.setMonth(signedDate.getMonth() + 3));
                const formattedExpireDate = expireDate.toISOString().split('T')[0];

                setFormData((prev) => ({
                    ...prev,
                    mediationExpireAt: formattedExpireDate,
                }));
            }
        }
    }, [formData.mediationSignedAt]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData((prev) => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);

        try {
            // APIコールの実装 (PHPバックエンドへ)
            /*
            const response = await fetch('/api/listings/create.php', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(formData),
            });
            if (!response.ok) throw new Error('Network response was not ok');
            */

            console.log('送信データ:', formData);
            alert('登録しました（Consoleを確認）');
            setModal(false); // 登録成功後にモーダルを閉じる
        } catch (error) {
            console.error(error);
            alert('エラーが発生しました');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <>
            {/* Header */}
            <div className="modal-header bg-light border-bottom-0 pb-0 pt-4 px-4">
                <h4 className="modal-title fw-bold text-dark">新規物件登録</h4>
                <button
                    type="button"
                    className="btn-close"
                    onClick={() => setModal(false)}
                    aria-label="Close"
                ></button>
            </div>

            <form onSubmit={handleSubmit}>
                {/* Body */}
                <div className="modal-body px-4 py-4">
                    <p className="text-muted mb-4">
                        物件の基本情報および媒介契約の情報を入力してください。<br />
                        <small>※ 物件ID等は登録後にシステムにより自動設定されます。</small>
                    </p>

                    <div className="row g-4">
                        {/* 左カラム: 物件基本情報 */}
                        <div className="col-lg-6 border-end-lg pe-lg-4">
                            <h5 className="fw-semibold text-primary mb-3">
                                <i className="bi bi-house-door me-2"></i>物件基本情報
                            </h5>

                            <div className="mb-3">
                                <label className="form-label text-secondary small fw-bold">物件所在地 <span className="text-danger">*</span></label>
                                <input type="text" className="form-control" name="address" value={formData.address} onChange={handleChange} placeholder="例: 東京都港区六本木1-1-1" required />
                            </div>

                            <div className="row mb-3">
                                <div className="col-md-6">
                                    <label className="form-label text-secondary small fw-bold">物件種別 <span className="text-danger">*</span></label>
                                    <select className="form-select" name="propertyType" value={formData.propertyType} onChange={handleChange} required>
                                        <option value="">選択してください</option>
                                        <option value="MANSION">中古マンション</option>
                                        <option value="HOUSE">中古戸建</option>
                                        <option value="LAND">土地</option>
                                    </select>
                                </div>
                                <div className="col-md-6">
                                    <label className="form-label text-secondary small fw-bold">売出価格 (円) <span className="text-danger">*</span></label>
                                    <div className="input-group">
                                        <input type="number" className="form-control" name="listPrice" value={formData.listPrice} onChange={handleChange} placeholder="例: 45000000" min="0" required />
                                        <span className="input-group-text">円</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* 右カラム: 顧客・契約情報 */}
                        <div className="col-lg-6 ps-lg-4">
                            <h5 className="fw-semibold text-primary mb-3">
                                <i className="bi bi-file-earmark-text me-2"></i>顧客・契約情報
                            </h5>

                            <div className="mb-3">
                                <label className="form-label text-secondary small fw-bold">売主顧客ID <span className="text-danger">*</span></label>
                                <input type="text" className="form-control" name="customerId" value={formData.customerId} onChange={handleChange} placeholder="例: C-10023" required />
                            </div>

                            <div className="mb-3">
                                <label className="form-label text-secondary small fw-bold">媒介種別 <span className="text-danger">*</span></label>
                                <select className="form-select" name="mediationType" value={formData.mediationType} onChange={handleChange} required>
                                    <option value="">選択してください</option>
                                    <option value="EXCLUSIVE_AGENCY">専属専任媒介</option>
                                    <option value="EXCLUSIVE">専任媒介</option>
                                    <option value="GENERAL">一般媒介</option>
                                </select>
                            </div>

                            <div className="row mb-3">
                                <div className="col-md-6">
                                    <label className="form-label text-secondary small fw-bold">媒介契約日 <span className="text-danger">*</span></label>
                                    <input type="date" className="form-control" name="mediationSignedAt" value={formData.mediationSignedAt} onChange={handleChange} required />
                                </div>
                                <div className="col-md-6">
                                    <label className="form-label text-secondary small fw-bold">媒介期間満了日 <span className="text-danger">*</span></label>
                                    <input type="date" className="form-control bg-light" name="mediationExpireAt" value={formData.mediationExpireAt} onChange={handleChange} required />
                                    <div className="form-text">※契約日から3ヶ月後を自動設定</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="modal-footer bg-light border-top-0 pt-3 pb-4 px-4 rounded-bottom-4">
                    <button
                        type="button"
                        className="btn btn-outline-secondary px-4"
                        onClick={() => setModal(false)}
                        disabled={isSubmitting}
                    >
                        キャンセル
                    </button>
                    <button type="submit" className="btn btn-primary px-5 fw-bold shadow-sm" disabled={isSubmitting}>
                        {isSubmitting ? '登録中...' : '物件を登録する'}
                    </button>
                </div>
            </form>
        </>
    );
};

export default RegisterBrokerageListings;