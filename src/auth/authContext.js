import { createContext, useContext } from "react";

export const AuthContext = createContext({
  authenticationRequired: false,
  authenticated: true,
  logout: async () => {},
  logoutError: "",
});

export const useAuth = () => useContext(AuthContext);
