export type Role = "ADMIN" | "SUPPLIER" | "BUYER" | "FREELANCER";

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  avatar?: string | null;
}

export interface AuthSession {
  user: SessionUser;
  expiresAt: number;
}

export type LoginInput = {
  email: string;
  password: string;
  rememberMe?: boolean;
};

export type SignupInput = {
  name: string;
  email: string;
  password: string;
  role: Role;
  companyName?: string;
};
