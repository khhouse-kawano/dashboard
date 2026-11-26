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
  shopName: string,
  setShopName: (value: string) => void,
  /** v2.2.302 ログイン中のスタッフの id（get_token の結果。0 = まだ分からない）。⚠️ 画面の出し分けだけに使う（判定は ② が自分でする） */
  staffId: number
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
  shopName: "",
  setShopName: (value: string) => { },
  staffId: 0,
});

export default AuthContext;