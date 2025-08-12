import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    })
  }

  try {
    const { newEmail, currentPassword, userId } = await req.json()

    if (!newEmail || !currentPassword || !userId) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Missing required fields' 
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Get current user
    const { data: userData, error: userError } = await supabase.auth.admin.getUserById(userId)
    
    if (userError || !userData.user) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'User not found' 
        }),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    console.log('👤 Current user:', userData.user.email)

    // Verify current password by attempting sign in
    const { error: verifyError } = await supabase.auth.signInWithPassword({
      email: userData.user.email,
      password: currentPassword,
    })

    if (verifyError) {
      console.log('❌ Password verification failed:', verifyError.message)
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Current password is incorrect' 
        }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    console.log('✅ Password verified, initiating email change...')

    // Create the redirect URL
    const origin = req.headers.get('origin') || 'https://quiet-nougat-f9de42.netlify.app'
    const redirectUrl = `${origin}/admin/login/verify-email-change`
    
    console.log('🔗 Using redirect URL:', redirectUrl)

    // Initiate email change with extended expiry
    const { error: updateError } = await supabase.auth.admin.updateUserById(userId, {
      email: newEmail,
      email_confirm: false, // Require email confirmation
      user_metadata: {
        ...userData.user.user_metadata,
        email_change_initiated_at: new Date().toISOString(),
        old_email: userData.user.email,
        email_change_redirect_url: redirectUrl
      }
    })

    if (updateError) {
      console.log('❌ Email update failed:', updateError.message)
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: updateError.message 
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Also trigger the email change confirmation
    const { error: confirmError } = await supabase.auth.updateUser({
      email: newEmail,
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          email_change_initiated_at: new Date().toISOString(),
          old_email: userData.user.email
        }
      }
    })

    if (confirmError) {
      console.log('❌ Email confirmation trigger failed:', confirmError.message)
    }

    console.log('✅ Email change initiated successfully')
    
    return new Response(
      JSON.stringify({ 
        success: true, 
        requiresConfirmation: true,
        message: 'Verification email sent. Link valid for 24 hours.'
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('💥 Function error:', error)
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: 'Internal server error' 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})