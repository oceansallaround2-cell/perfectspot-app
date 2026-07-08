// Two hardcoded accounts for Perfect Spot.
export type AccountKey = "mango" | "anshalien";

export interface AccountInfo {
  username: string; // canonical display username
  key: AccountKey;
  email: string; // internal supabase email
  password: string;
  displayName: string; // the real person behind this login
  partnerName: string; // the real person behind the OTHER login
}

export const ACCOUNTS: Record<AccountKey, AccountInfo> = {
  mango: {
    username: "Mango",
    key: "mango",
    email: "mango@perfectspot.love",
    password: "290624",
    displayName: "Sidrah",
    partnerName: "Priyanshu",
  },
  anshalien: {
    username: "Anshalien",
    key: "anshalien",
    email: "anshalien@perfectspot.love",
    password: "290624",
    displayName: "Priyanshu",
    partnerName: "Sidrah",
  },
};

export function findAccount(rawUsername: string, rawPassword: string): AccountInfo | null {
  const u = rawUsername.trim().toLowerCase();
  const p = rawPassword.trim();
  const match = Object.values(ACCOUNTS).find(
    (a) => a.key === u && a.password === p,
  );
  return match ?? null;
}

export function accountByEmail(email: string | null | undefined): AccountInfo | null {
  if (!email) return null;
  const e = email.trim().toLowerCase();
  return Object.values(ACCOUNTS).find((a) => a.email.toLowerCase() === e) ?? null;
}
