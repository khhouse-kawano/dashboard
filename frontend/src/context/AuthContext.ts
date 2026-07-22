import { createContext } from "react";

type AuthContextType = {
  authority: string,
  setAuthority: (value: string) => void,
  token: string,
  setToken: (value: string) => void,
  category: string,
  setCategory: (value: string) => void,
  version: string,
  userName: string,
  setUserName: (value: string) => void,

};

const AuthContext = createContext<AuthContextType>({
  authority: "",
  setAuthority: (value: string) => { },
  token: "",
  setToken: (value: string) => { },
  category: "",
  setCategory: (value: string) => { },
  version: "",
  userName: "",
  setUserName: (value: string) => { },
});

export default AuthContext;