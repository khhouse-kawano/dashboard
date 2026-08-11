import React, { useState, useEffect, ReactNode } from "react";
import AuthContext from "./AuthContext";
import { useLocation } from "react-router-dom";
import { newVersion } from '../utils/version';
import apiClient from '../utils/apiClient';

type Props = {
    children: ReactNode;
};

const AuthProvider = ({ children }: Props) => {
    const location = useLocation();
    const [authority, setAuthority] = useState(() => localStorage.getItem("authority") || "");
    const [token, setToken] = useState(() => localStorage.getItem("token") || "");
    const [category, setCategory] = useState(() => localStorage.getItem("category") || "");
    const [userName, setUserName] = useState(() => localStorage.getItem("userName") || "");
    const [shopName, setShopName] = useState(() => localStorage.getItem("shopName") || "");
    const version = newVersion;

    const [isChecking, setIsChecking] = useState(true);

    useEffect(() => {
        authority ? localStorage.setItem("authority", authority) : localStorage.removeItem("authority");
        category ? localStorage.setItem("category", category) : localStorage.removeItem("category");
        token ? localStorage.setItem("token", token) : localStorage.removeItem("token");
        userName ? localStorage.setItem("userName", userName) : localStorage.removeItem("userName");
        version ? localStorage.setItem("version", version) : localStorage.removeItem("version");
        shopName ? localStorage.setItem("shopName", shopName) : localStorage.removeItem("shopName");
    }, [authority, category, token, userName, version, shopName]);

    useEffect(() => {
        if (location.pathname.includes('login')) {
            setIsChecking(false);
            return;
        }

        const redirectToLogin = () => {
            const currentPath = location.pathname + location.search;
            
            window.location.replace(`/dashboard/login?redirect=${encodeURIComponent(currentPath)}`);
        };

        const verifyToken = async () => {
            try {
                const data = {
                    token: token,
                    url: location.pathname,
                    request: "get_token",
                };

                const response = await apiClient.post('', data);

                if (!response.data || response.data.length === 0) {
                    redirectToLogin();
                    return;
                }

                const today = new Date();
                const responseDate = response.data[0].timestamp ?? '';
                const diff = today.getTime() - new Date(responseDate).getTime();

                if (diff > 86000000 || !responseDate) {
                    redirectToLogin();
                    return;
                }

                const showVersion = await apiClient.post('', { request: 'show_version' });
                if (showVersion.data.version !== version) {
                    window.location.reload();
                }

            } catch (error) {
                console.error("Token verification failed:", error);
                if (token !== "") {
                    setToken("");
                }
                redirectToLogin(); // エラー時も安全のためにログイン画面へ
            } finally {
                setIsChecking(false);
            }
        };

        verifyToken();
    }, [location.pathname, location.search, token, version]);

    if (!location.pathname.includes('login') && isChecking) {
        return null; 
    }

    return (
        <AuthContext.Provider
            value={{ authority, setAuthority, token, setToken, category, setCategory, version, userName, setUserName, shopName, setShopName }}
        >
            {children}
        </AuthContext.Provider>
    );
};

export default AuthProvider;