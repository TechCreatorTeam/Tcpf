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
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const url = new URL(req.url)
    const token = url.searchParams.get('token') || url.searchParams.get('token_hash')
    const type = url.searchParams.get('type') || 'email_change'
    const email = url.searchParams.get('email')

    console.log('🔍 Email verification request:', {
      token: token ? `${token.substring(0, 8)}...` : 'missing',
      type,
      email: email ? decodeURIComponent(email) : 'missing'
    })

    if (!token) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'No verification token provided' 
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Verify the token with Supabase Auth
    let verificationResult
    
    try {
      if (token.length === 6 && /^\d+$/.test(token)) {
        // 6-digit OTP token
        verificationResult = await supabase.auth.verifyOtp({
          token,
          type: 'email_change' as any,
          email: email ? decodeURIComponent(email) : undefined
        })
      } else {
        // Hash token
        verificationResult = await supabase.auth.verifyOtp({
          token_hash: token,
          type: 'email_change' as any
        })
      }

      const { data, error } = verificationResult

      if (error) {
        console.error('❌ Verification error:', error)
        
        // Redirect to login page with error
        const redirectUrl = `${url.origin}/admin/login?verification_failed=1&error=${encodeURIComponent(error.message)}`
        
        return new Response(null, {
          status: 302,
          headers: {
            ...corsHeaders,
            'Location': redirectUrl
          }
        })
      }

      if (data.user) {
        console.log('✅ Email verification successful for user:', data.user.id)
        
        // Insert audit record
        try {
          await supabase
            .from('email_change_audit')
            .insert({
              user_id: data.user.id,
              old_email: email ? decodeURIComponent(email) : '',
              new_email: data.user.email,
              changed_at: new Date().toISOString(),
              ip_address: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown',
              user_agent: req.headers.get('user-agent') || ''
            })
          
          console.log('📋 Email change audit record inserted')
        } catch (auditError) {
          console.error('❌ Failed to insert audit record:', auditError)
        }

        // Sign out all sessions globally for security
        try {
          await supabase.auth.admin.signOut(data.user.id, 'global')
          console.log('🔐 Global sign out completed')
        } catch (signOutError) {
          console.error('❌ Global sign out failed:', signOutError)
        }

        // Redirect to login page with success
        const redirectUrl = `${url.origin}/admin/login?email_changed=1&new_email=${encodeURIComponent(data.user.email || '')}`
        
        return new Response(null, {
          status: 302,
          headers: {
            ...corsHeaders,
            'Location': redirectUrl
          }
        })
      }

      // No user data but no error - still redirect to login
      const redirectUrl = `${url.origin}/admin/login?email_changed=1`
      
      return new Response(null, {
        status: 302,
        headers: {
          ...corsHeaders,
          'Location': redirectUrl
        }
      })

    } catch (verifyError) {
      console.error('💥 Verification process error:', verifyError)
      
      const redirectUrl = `${url.origin}/admin/login?verification_failed=1&error=${encodeURIComponent(verifyError.message)}`
      
      return new Response(null, {
        status: 302,
        headers: {
          ...corsHeaders,
          'Location': redirectUrl
        }
      })
    }

  } catch (error) {
    console.error('💥 Function error:', error)
    
    const url = new URL(req.url)
    const redirectUrl = `${url.origin}/admin/login?verification_failed=1&error=system_error`
    
    return new Response(null, {
      status: 302,
      headers: {
        ...corsHeaders,
        'Location': redirectUrl
      }
    })
  }
})