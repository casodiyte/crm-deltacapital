import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.development') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SB_PUBLISHABLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
  const { data, error } = await supabase.auth.signUp({
    email: "veroramirezmat@gmail.com",
    password: "Qwerty123456*",
    options: {
      data: {
        first_name: "Veronica",
        last_name: "Ramirez",
        role: "AGENT"
      }
    }
  });
  console.log("Without accent:", error ? error.message : "Success");
}

test();
