import React from 'react';
import { useState, useContext } from "react";
import AuthContext from "../context/AuthContext";
import { useNavigate, useLocation } from "react-router-dom"; // 💡 useLocationを追加
import "./Home.css";
import "bootstrap/dist/css/bootstrap.min.css";
import Logo from "../assets/images/logo.png";
import { GoogleLogin } from '@react-oauth/google';
import apiClient from '../utils/apiClient';

type Value = { mail: string, password: string, error: string };

const Login = () => {
  const [validationMessage, setValidationMessage] = useState<Value>({
    mail: "",
    password: "",
    error: "",
  });

  const navigate = useNavigate();
  const location = useLocation(); // 💡 現在のURL情報を取得
  const { setAuthority, setToken, setUserName } = useContext(AuthContext);

  const handleGoogleSuccess = (credentialResponse: any) => {
    const newValidationMessage: Value = { mail: "", password: "", error: "" };
    const token = credentialResponse.credential;

    const fetchData = async () => {
      try {
        // ⚠️ IDトークン（JWT）そのものを送る。
        //   以前はここで jwtDecode してメールアドレスだけを送っていたが、
        //   jwtDecode は署名を検証しないため、誰でも他人になりすませた。
        //   検証はサーバー側（backend/src/core/google_auth.php）で行う。
        const response = await apiClient.post("", { request: 'login', credential: token });
        console.log("API Response:", response);
        if (response.data.message === "success") {
          setAuthority(response.data.authority);
          setToken(response.data.token);
          setUserName(response.data.userName);

          // 💡 URLから redirect パラメータを取り出す
          const searchParams = new URLSearchParams(location.search);
          const redirectUrl = searchParams.get('redirect');

          // 💡 リダイレクト先があればそこに、無ければデフォルトの /home へ飛ばす
          if (redirectUrl) {
            navigate(redirectUrl, {
              state: { authority: response.data.authority },
            });
          } else {
            navigate("/home", {
              state: { authority: response.data.authority },
            });
          }
        } else {
          setValidationMessage({
            ...newValidationMessage,
            error: response.data.details || "ログイン権限がありません",
          });
        }
      } catch (err) {
        // ⚠️ IDトークンの検証に失敗するとサーバーは 401 を返し、axios は例外になる。
        //   ここでサーバーのメッセージを拾わないと、認証エラーが
        //   すべて「システムエラー」と表示されて原因が分からなくなる。
        const details = (err as { response?: { data?: { details?: string } } })
          ?.response?.data?.details;
        setValidationMessage({
          ...newValidationMessage,
          error: details ?? 'システムエラーが発生しました',
        });
      }
    };

    fetchData();
  };

  return (
    <div className="home container d-flex justify-content-center">
      <div className="box bg-white shadow-lg rounded-4 p-5 text-center" style={{ maxWidth: '450px', width: '100%' }}>
        {/* ロゴ部分 */}
        <div className="mb-4">
          <img
            src={Logo}
            alt="国分ハウジンググループ"
            style={{ maxWidth: '220px', height: 'auto' }}
          />
        </div>
        {/* 案内テキスト */}
        <p className="text-muted mb-md-5 mb-3 small">
          国分ハウジンググループの<br />
          Workspaceアカウントでログインしてください。
        </p>
        {/* エラーアラート */}
        {validationMessage.error && (
          <div className="alert alert-danger p-2 mb-md-4 mb-3 small" role="alert">
            {validationMessage.error}
          </div>
        )}
        {/* Googleログインボタン */}
        <div className="d-flex justify-content-center mb-2">
          <GoogleLogin
            onSuccess={handleGoogleSuccess}
            onError={() => {
              setValidationMessage((prev) => ({
                ...prev,
                error: "認証がキャンセルされたか、エラーが発生しました",
              }));
            }}
            useOneTap
          />
        </div>
        {/* フッター */}
        <div className="mt-md-5 mt-4 pt-3 border-top text-muted" style={{ fontSize: '0.75rem' }}>
          &copy; {new Date().getFullYear()} Kokubu Housing Group. All Rights Reserved.
        </div>
      </div>
    </div>
  )
}

export default Login;