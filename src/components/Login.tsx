import React from 'react'
import { useState, useRef, useContext, useEffect } from "react";
import AuthContext from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import "./Home.css";
import "bootstrap/dist/css/bootstrap.min.css";
import axios from "axios";
import Logo from "../assets/images/logo.png";

type Value = { mail: string, password: string, error: string };

const Login = () => {
  const [validationMessage, setValidationMessage] = useState<Value>({
    mail: "",
    password: "",
    error: "",
  });


  const mailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const { setBrand, setToken, setUserName } = useContext(AuthContext);

  const handleLogin = async (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    let isValid = true;
    const newValidationMessage: Value = { mail: "", password: "", error: "" };

    const mailValue = mailRef.current?.value;
    if (mailValue === "") {
      newValidationMessage.mail = "メールアドレスが未入力です";
      isValid = false;
    }

    const passwordValue = passwordRef.current?.value;
    if (passwordValue === "") {
      newValidationMessage.password = "パスワードが未入力です";
      isValid = false;
    }

    setValidationMessage(newValidationMessage);

    if (isValid) {
      try {
        const headers = { Authorization: '4081Kokubu', 'Content-Type': 'application/json' };
        const response = await axios.post("https://khg-marketing.info/dashboard/api/?action=login", {
          mail: mailValue,
          password: passwordValue,
          demand: "login"
        }, { headers });

        if (response.data.message === "success") {
          setBrand(response.data.brand);
          setToken(response.data.token);
          setUserName(response.data.userName);
          navigate("/home", {
            state: {
              brand: response.data.brand,
            },
          });
        } else {
          setValidationMessage({
            ...newValidationMessage,
            error: response.data.details,
          });
        }
      } catch (error) {
        setValidationMessage({
          ...newValidationMessage,
          error: "サーバーエラーが発生",
        });
      }
    }
  };


  return (
    <div className="home container">
      <div className="box bg-white">
        <div className="img mb-5 pt-5">
          <img
            src={Logo}
            alt="国分ハウジンググループ"
          />
        </div>
        <input
          type="mail"
          className="form-control mb-3"
          id="mail"
          ref={mailRef}
          placeholder="name@kh-group.jp"
        />
        <div className="validation">{validationMessage.mail}</div>
        <input
          type="password"
          className="form-control mb-3"
          id="password"
          ref={passwordRef}
          placeholder="password"
        />
        <div className="validation">{validationMessage.password}</div>
        <div className="validation">{validationMessage.error}</div>
        <button
          className="btn bg-primary text-white text-center px-5 rounded-pill"
          onClick={(event) => handleLogin(event)}
        >
          ログイン
        </button>
      </div>
    </div>
  )
}

export default Login