import {createContext, useContext} from 'react';
import {UserInfo} from 'firebase/auth';
import {Claims} from 'next-firebase-auth-edge/lib/auth/claims';

export interface User extends UserInfo {
  emailVerified: boolean;
  customClaims: Claims;
  authTime: number;
}

export interface AuthContextValue {
  user: User | null;
  hasLoaded: boolean;
}

export const AuthContext = createContext<AuthContextValue>({
  user: null,
  hasLoaded: false
});

export const useAuth = () => useContext(AuthContext);
