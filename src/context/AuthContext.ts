import { createContext } from "react";

type AuthContextType = {
  brand: string,
  setBrand: (value: string) => void,
  token: string,
  setToken: (value: string) => void,
  category: string,
  setCategory: (value: string) => void
};

const AuthContext = createContext<AuthContextType>({
  brand: "",
  setBrand: (value: string) => { },
  token: "",
  setToken: (value: string) => { },
  category: "",
  setCategory: (value: string) => { }
});

export default AuthContext;