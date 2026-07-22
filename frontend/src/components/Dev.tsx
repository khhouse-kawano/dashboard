import React, { useState } from "react";
import "./Home.css"; // 必要に応じて微調整してください
import "bootstrap/dist/css/bootstrap.min.css";
import Logo from "../assets/images/logo.png";
import { GoogleLogin } from '@react-oauth/google';

const CustomerRegister = () => {
  // UIの状態管理
  const [activeTab, setActiveTab] = useState<'google' | 'manual'>('google');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState("");
  
  // 直接入力用の状態管理
  const [formData, setFormData] = useState({ name: "", email: "" });

  // 1. Google連携の処理（バックエンド実装までのダミー）
  const handleGoogleSuccess = (credentialResponse: any) => {
    setStatus('loading');
    setErrorMessage("");
    
    // ※ここに後ほどバックエンドへの送信処理を書きます
    setTimeout(() => {
      setStatus('success');
    }, 1500); // 1.5秒後に成功画面へ
  };

  // 2. 直接入力の処理（バックエンド実装までのダミー）
  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.email) {
      setErrorMessage("氏名とメールアドレスを入力してください");
      return;
    }

    setStatus('loading');
    setErrorMessage("");

    // ※ここに後ほどバックエンドへの送信処理を書きます
    setTimeout(() => {
      setStatus('success');
    }, 1500); // 1.5秒後に成功画面へ
  };

  return (
    <div className="home container d-flex justify-content-center align-items-center" style={{ minHeight: '100vh', backgroundColor: '#f8f9fa' }}>
      <div className="box bg-white shadow-sm rounded-4 p-4 p-md-5 text-center" style={{ maxWidth: '450px', width: '100%' }}>
        
        {/* ロゴ部分 */}
        <div className="mb-4">
          <img src={Logo} alt="国分ハウジンググループ" style={{ maxWidth: '200px', height: 'auto' }} />
        </div>

        {status === 'idle' && (
          <>
            <h5 className="fw-bold mb-4 text-dark">お客様情報のご登録</h5>

            {/* タブ切り替えボタン */}
            <div className="nav nav-pills p-1 bg-light rounded-pill mb-4" style={{ border: '1px solid #e9ecef' }}>
              <button 
                className={`nav-link rounded-pill w-50 py-2 ${activeTab === 'google' ? 'active shadow-sm' : 'text-muted'}`}
                onClick={() => { setActiveTab('google'); setErrorMessage(''); }}
                style={{ transition: 'all 0.3s' }}
              >
                Googleで登録
              </button>
              <button 
                className={`nav-link rounded-pill w-50 py-2 ${activeTab === 'manual' ? 'active shadow-sm' : 'text-muted'}`}
                onClick={() => { setActiveTab('manual'); setErrorMessage(''); }}
                style={{ transition: 'all 0.3s' }}
              >
                直接入力
              </button>
            </div>

            {/* エラーメッセージ表示 */}
            {errorMessage && (
              <div className="alert alert-danger py-2 px-3 mb-4 small text-start" role="alert">
                {errorMessage}
              </div>
            )}

            {/* ▼ タブ1: Google連携 ▼ */}
            {activeTab === 'google' && (
              <div className="animate__animated animate__fadeIn">
                <p className="text-muted small mb-4">
                  Googleアカウントをご利用の方は、<br />入力の手間なく1クリックで登録完了します。
                </p>
                <div className="d-flex justify-content-center mb-2">
                  <GoogleLogin
                    onSuccess={handleGoogleSuccess}
                    onError={() => setErrorMessage("連携がキャンセルされたか、エラーが発生しました")}
                    useOneTap
                    text="signup_with"
                    shape="pill" // モダンな丸みを帯びたデザイン
                  />
                </div>
              </div>
            )}

            {/* ▼ タブ2: 直接入力 ▼ */}
            {activeTab === 'manual' && (
              <form onSubmit={handleManualSubmit} className="text-start animate__animated animate__fadeIn">
                <div className="mb-3">
                  <label className="form-label small fw-bold text-muted mb-1">氏名</label>
                  <input 
                    type="text" 
                    className="form-control bg-light" 
                    placeholder="例：国分 太郎"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    style={{ border: '1px solid #dee2e6' }}
                  />
                </div>
                <div className="mb-4">
                  <label className="form-label small fw-bold text-muted mb-1">メールアドレス</label>
                  <input 
                    type="email" 
                    className="form-control bg-light" 
                    placeholder="例：example@khg.co.jp"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    style={{ border: '1px solid #dee2e6' }}
                  />
                </div>
                <button type="submit" className="btn btn-primary w-100 rounded-pill py-2 fw-bold">
                  この内容で登録する
                </button>
              </form>
            )}
          </>
        )}

        {/* 処理中（ローディング）画面 */}
        {status === 'loading' && (
          <div className="py-5">
            <div className="spinner-border text-primary mb-3" role="status"></div>
            <p className="text-muted small fw-bold">情報を登録しています...</p>
          </div>
        )}

        {/* 完了画面 */}
        {status === 'success' && (
          <div className="py-5">
            <div className="mb-3">
              <svg width="60" height="60" viewBox="0 0 16 16" className="text-success" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                <path d="M16 8A8 8 0 1 1 0 8a8 8 0 0 1 16 0zm-3.97-3.03a.75.75 0 0 0-1.08.022L7.477 9.417 5.384 7.323a.75.75 0 0 0-1.06 1.06L6.97 11.03a.75.75 0 0 0 1.079-.02l3.992-4.99a.75.75 0 0 0-.01-1.05z"/>
              </svg>
            </div>
            <h4 className="fw-bold text-dark mb-3">ご登録ありがとうございます</h4>
            <p className="text-muted small">
              お客様情報の登録が完了いたしました。<br />
              このまま画面を閉じてお進みください。
            </p>
          </div>
        )}

        {/* フッター */}
        <div className="mt-5 pt-3 border-top text-muted" style={{ fontSize: '0.70rem' }}>
          &copy; {new Date().getFullYear()} Kokubu Housing Group. All Rights Reserved.
        </div>
      </div>
    </div>
  );
};

export default CustomerRegister;