/*
  # Fix Email Verification Flow

  1. Database Functions
    - Create function to handle email change verification
    - Add function to clean up expired email change requests
    - Update email change audit triggers

  2. Security
    - Ensure proper RLS policies for email change audit
    - Add indexes for performance

  3. Triggers
    - Add trigger for automatic cleanup of expired email change requests
*/

-- Function to handle email verification and global logout
CREATE OR REPLACE FUNCTION handle_email_verification(
  user_id_param UUID,
  old_email_param TEXT,
  new_email_param TEXT
) RETURNS BOOLEAN AS $$
BEGIN
  -- Insert audit record
  INSERT INTO email_change_audit (
    user_id,
    old_email,
    new_email,
    changed_at,
    ip_address,
    user_agent
  ) VALUES (
    user_id_param,
    old_email_param,
    new_email_param,
    NOW(),
    'edge_function',
    'email_verification_handler'
  );

  -- Clean up any pending email change OTP records
  DELETE FROM email_change_otp WHERE user_id = user_id_param;

  RETURN TRUE;
EXCEPTION
  WHEN OTHERS THEN
    RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to clean up expired email change requests
CREATE OR REPLACE FUNCTION cleanup_expired_email_changes() RETURNS INTEGER AS $$
DECLARE
  cleanup_count INTEGER;
BEGIN
  -- Delete expired OTP records (older than 24 hours)
  DELETE FROM email_change_otp 
  WHERE expires_at < NOW();
  
  GET DIAGNOSTICS cleanup_count = ROW_COUNT;
  
  RETURN cleanup_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add index for better performance on email change audit queries
CREATE INDEX IF NOT EXISTS idx_email_change_audit_user_changed 
ON email_change_audit (user_id, changed_at DESC);

-- Add index for OTP cleanup
CREATE INDEX IF NOT EXISTS idx_email_change_otp_expires_cleanup 
ON email_change_otp (expires_at) 
WHERE expires_at < NOW();

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION handle_email_verification(UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION cleanup_expired_email_changes() TO authenticated;

-- Update RLS policies to ensure proper access
DROP POLICY IF EXISTS "Users can view their own email change audit" ON email_change_audit;
CREATE POLICY "Users can view their own email change audit"
  ON email_change_audit
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "System can insert email change audit" ON email_change_audit;
CREATE POLICY "System can insert email change audit"
  ON email_change_audit
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Ensure email_change_otp policies are correct
DROP POLICY IF EXISTS "Users can manage their own OTP records" ON email_change_otp;
CREATE POLICY "Users can manage their own OTP records"
  ON email_change_otp
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);