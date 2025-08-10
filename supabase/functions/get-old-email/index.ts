// Supabase Edge Function: get-old-email
import { serve } from 'std/server';
import { createClient } from 'supabase-lib';

serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }
  const { user_id } = await req.json();
  if (!user_id) {
    return new Response('Missing user_id', { status: 400 });
  }

  // Create Supabase client
  const supabase = createClient();

  // Get and delete old email for this user
  const { data, error } = await supabase
    .from('pending_email_changes')
    .delete()
    .eq('user_id', user_id)
    .select('old_email')
    .single();

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
  return new Response(JSON.stringify({ old_email: data?.old_email || '' }), { status: 200 });
});
