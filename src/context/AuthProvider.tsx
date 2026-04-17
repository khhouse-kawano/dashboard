import React, { useState, useEffect, ReactNode } from "react";
import AuthContext from "./AuthContext";
import axios from "axios";
import { useLocation } from "react-router-dom";
import { newVersion } from '../utils/version';
type Props = {
    children: ReactNode;
};

const AuthProvider = ({ children }: Props) => {
    const location = useLocation();
    const [brand, setBrand] = useState(() => localStorage.getItem("brand") || "");
    const [token, setToken] = useState(() => localStorage.getItem("token") || "");
    const [category, setCategory] = useState(() => localStorage.getItem("category") || "");
    const [userName, setUserName] = useState(() => localStorage.getItem("userName") || "");
    const version = newVersion;

    const headers = {
        Authorization: "4081Kokubu",
        "Content-Type": "application/json",
    };
    const [isChecking, setIsChecking] = useState(true);

    useEffect(() => {
        brand
            ? localStorage.setItem("brand", brand)
            : localStorage.removeItem("brand");

        category
            ? localStorage.setItem("category", category)
            : localStorage.removeItem("category");

        token
            ? localStorage.setItem("token", token)
            : localStorage.removeItem("token");

        userName
            ? localStorage.setItem("userName", userName)
            : localStorage.removeItem("userName");

        version
            ? localStorage.setItem("version", version)
            : localStorage.removeItem("version");
    }, [brand, category, token, userName, version]);

    useEffect(() => {
        if (location.pathname.includes('login')) return;
        const verifyToken = async () => {
            try {
                const data = {
                    token: token,
                    url: location.pathname,
                    demand: "get_token",
                };

                const response = await axios.post(
                    "https://khg-marketing.info/dashboard/api/",
                    data,
                    { headers }
                );
                console.log(response.data.length)

                if (!response.data || response.data.length === 0) {
                    window.location.replace("/dashboard/login");
                    return;
                }

                const today = new Date();
                const responseDate = response.data[0].timestamp ?? '';
                const diff = today.getTime() - new Date(responseDate).getTime();

                if (diff > 8600000 || !responseDate) {
                    window.location.replace("/dashboard/login");
                    return;
                }

                const showVersion = await axios.post(
                    "https://khg-marketing.info/dashboard/api/",
                    { demand: 'show_version' },
                    { headers }
                );

                if (showVersion.data.version !== version) {
                    window.location.reload();
                }

            } catch (error) {
                console.error("Token verification failed:", error);
                if (token !== "") {
                    setToken("");
                }
            }
            setIsChecking(false);
        };

        verifyToken();
    }, [location.pathname]);

    if (location.pathname !== '/login' && isChecking) {
        return null;
    }

    return (
        <AuthContext.Provider
            value={{ brand, setBrand, token, setToken, category, setCategory, version, userName, setUserName }}
        >
            {children}
        </AuthContext.Provider>
    );
};

export default AuthProvider;
