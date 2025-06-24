import React, { useState, useEffect } from "react";
import AuthContext from "./AuthContext";

const AuthProvider = ({ children }) => {
    const [brand, setBrand] = useState(localStorage.getItem("brand") || "");

    useEffect(() => {
        const storedBrand = localStorage.getItem("brand");
        if (storedBrand) {
            setBrand(storedBrand);
            }
        }, []);

    useEffect(() => {
        if (brand) {
        localStorage.setItem("brand", brand);
        } else {
        localStorage.removeItem("brand");
        }
        }, [brand]);

    return (
        <AuthContext.Provider value={{ brand, setBrand }}>
            {children}
        </AuthContext.Provider>
        );
    };

export default AuthProvider;