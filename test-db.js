const { createClient } = require('@supabase/supabase-js');
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
db.from('deal_price_state').select('*').limit(1).then(console.log).catch(console.error);
