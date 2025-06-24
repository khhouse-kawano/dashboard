import { createContext } from "react";

const AuthContext = createContext({
  brand: "",
  setBrand: () => {},
});

export default AuthContext;