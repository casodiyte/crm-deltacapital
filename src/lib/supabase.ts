import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "";
const supabaseAnonKey = import.meta.env.VITE_SB_PUBLISHABLE_KEY || "";

console.log("Supabase Client Init: URL =", supabaseUrl, "Key length =", supabaseAnonKey.length);

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
