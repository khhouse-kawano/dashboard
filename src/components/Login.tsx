import React from 'react'
import { useState, useContext } from "react";
import AuthContext from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import "./Home.css";
import "bootstrap/dist/css/bootstrap.min.css";
import Logo from "../assets/images/logo.png";
import { GoogleLogin } from '@react-oauth/google';
import { jwtDecode } from "jwt-decode";
import apiClient from '../utils/apiClient';

type Value = { mail: string, password: string, error: string };

type GoogleJwtPayload = {
  email: string;
  name: string;
  picture: string;
  sub: string;
};

const Login = () => {
  const [validationMessage, setValidationMessage] = useState<Value>({
    mail: "",
    password: "",
    error: "",
  });

  const navigate = useNavigate();
  const { setAuthority, setToken, setUserName } = useContext(AuthContext);

  const handleGoogleSuccess = (credentialResponse: any) => {
    const newValidationMessage: Value = { mail: "", password: "", error: "" };
    const token = credentialResponse.credential;

    const decodedData = jwtDecode<GoogleJwtPayload>(token);

    const fetchData = async () => {
      try {
        const response = await apiClient.post("", { request: 'login', mail: decodedData.email });
        console.log("API Response:", response);
        if (response.data.message === "success") {
          setAuthority(response.data.authority);
          setToken(response.data.token);
          setUserName(response.data.userName);
          navigate("/home", {
            state: {
              authority: response.data.authority,
            },
          });
        } else {
          setValidationMessage({
            ...newValidationMessage,
            error: response.data.details || "ログイン権限がありません",
          });
        }
      } catch (err) {
        setValidationMessage({
          ...newValidationMessage,
          error: 'システムエラーが発生しました',
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