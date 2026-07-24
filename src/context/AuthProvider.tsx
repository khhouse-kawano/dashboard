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
    const version = newVersion;

    const [isChecking, setIsChecking] = useState(true);

    useEffect(() => {
        authority
            ? localStorage.setItem("authority", authority)
            : localStorage.removeItem("authority");

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
    }, [authority, category, token, userName, version]);

    useEffect(() => {
        if (location.pathname.includes('login')) return;
        const verifyToken = async () => {
            try {
                const data = {
                    token: token,
                    url: location.pathname,
                    request: "get_token",
                };

                const response = await apiClient.post('', data);

                if (!response.data || response.data.length === 0) {
                    window.location.replace("/dashboard/login");
                    return;
                }

                const today = new Date();
                const responseDate = response.data[0].timestamp ?? '';
                const diff = today.getTime() - new Date(responseDate).getTime();

                if (diff > 86000000 || !responseDate) {
                    window.location.replace("/dashboard/login");
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
            value={{ authority, setAuthority, token, setToken, category, setCategory, version, userName, setUserName }}
        >
            {children}
        </AuthContext.Provider>
    );
};

export default AuthProvider;
