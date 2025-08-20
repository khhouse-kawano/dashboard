import { useState, useRef, useContext } from "react";
import AuthContext from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import "./Home.css";
import "bootstrap/dist/css/bootstrap.min.css";
import axios from "axios";
import Logo from "../assets/images/logo.png";

const Home = () => {
  const [validationMessage, setValidationMessage] = useState({
    mail: "",
    password: "",
    general: "",
  });
  const mailRef = useRef(null);
  const passwordRef = useRef(null);
  const navigate = useNavigate();
  const { setBrand } = useContext(AuthContext);

  const submit = async (event) => {
    event.preventDefault();
    let isValid = true;
    const newValidationMessage = { mail: "", password: "", general: "" };

    const mailValue = mailRef.current.value;
    if (mailValue === "") {
      newValidationMessage.mail = "メールアドレスが未入力です";
      isValid = false;
    }

    const passwordValue = passwordRef.current.value;
    if (passwordValue === "") {
      newValidationMessage.password = "パスワードが未入力です";
      isValid = false;
    }

    setValidationMessage(newValidationMessage);

    if (isValid) {
      try {
        const response = await axios.post("/dashboard/login.php", {
          mail: mailValue,
          password: passwordValue,
        });

        if (response.data.message === "success") {
          setBrand(response.data.brand);
          navigate("/contract", {
            state: {
              brand: response.data.brand,
            },
          });
        } else {
          setValidationMessage({
            ...newValidationMessage,
            general: response.data.details,
          });
        }
      } catch (error) {
        setValidationMessage({
          ...newValidationMessage,
          general: "サーバーエラーが発生",
        });
      }
    }
  };

  return (
    <div className="home container">
      <div className="box bg-white">
        <div className="img mb-5 pt-5">
          <img
            src={ Logo }
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
        <div className="validation">{validationMessage.general}</div>
        <button
          className="btn bg-primary text-white text-center px-5 rounded-pill"
          onClick={submit}
        >
          ログイン
        </button>
        {/* <h5 className="text-center">ただいま改修作業中です</h5> */}
      </div>
    </div>
  );
};

export default Home;
