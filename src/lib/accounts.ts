// Two hardcoded accounts for Perfect Spot.
export type AccountKey = "mango" | "anshalien";

export interface AccountInfo {
  username: string; // canonical display username
  key: AccountKey;
  email: string; // internal supabase email
  password: string;
  displayName: string; // who they are IRL
  partnerName: string; // who they are greeted with ("Hello X")
}

export const ACCOUNTS: Record<AccountKey, AccountInfo> = {
  mango: {
    username: "Mango",
    key: "mango",
    email: "mango@perfectspot.love",
    password: "290624",
    displayName: "Priyanshu",
    partnerName: "Sidrah",
  },
  anshalien: {
    username: "Anshalien",
    key: "anshalien",
    email: "anshalien@perfectspot.love",
    password: "290624",
    displayName: "Sidrah",
    partnerName: "Priyanshu",
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
