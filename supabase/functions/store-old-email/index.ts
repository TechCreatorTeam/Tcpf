// Supabase Edge Function: store-old-email
import { serve } from 'std/server';
import { createClient } from 'supabase-lib';

serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }
  const { user_id, old_email } = await req.json();
  if (!user_id || !old_email) {
    return new Response('Missing user_id or old_email', { status: 400 });
  }

  // Create Supabase client
  const supabase = createClient();

  // Upsert old email for this user
  const { error } = await supabase
    .from('pending_email_changes')
    .upsert({ user_id, old_email, created_at: new Date().toISOString() }, { onConflict: ['user_id'] });

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
  return new Response(JSON.stringify({ success: true }), { status: 200 });
});
