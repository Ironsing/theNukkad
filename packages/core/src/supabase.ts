import { createClient } from '@supabase/supabase-js';

// The apps own the Supabase configuration: Vite substitutes `import.meta.env`
// with the env files of whichever app is doing the bundling, so this one client
// is configured per app even though it lives in the shared package.
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabasePublishableKey =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabasePublishableKey) {
  throw new Error('Missing Supabase environment configuration');
}

export const supabase = createClient(
  supabaseUrl,
  supabasePublishableKey,
  {
    auth: {
      detectSessionInUrl: true,
      flowType: 'pkce',
    },
  },
);
