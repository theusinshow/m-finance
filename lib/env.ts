export const env = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
  authorizedEmail: process.env.AUTHORIZED_EMAIL ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",
};

export function isSupabaseConfigured() {
  if (!env.supabaseUrl || !env.supabaseAnonKey) {
    return false;
  }

  try {
    const url = new URL(env.supabaseUrl);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}
