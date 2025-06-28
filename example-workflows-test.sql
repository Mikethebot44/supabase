-- Example Test Script for Workflows System
-- Run this after deploying the migration and Edge Functions

-- 1. Create a test table to trigger workflows on
CREATE TABLE IF NOT EXISTS public.test_users (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS (if needed)
ALTER TABLE public.test_users ENABLE ROW LEVEL SECURITY;

-- Create a basic policy for testing
CREATE POLICY "Allow all operations for testing" ON public.test_users
  FOR ALL USING (true) WITH CHECK (true);

-- 2. Create sample workflows

-- Webhook Workflow: Trigger on user creation
INSERT INTO public.workflows (name, table_name, event, action_type, action_payload, enabled)
VALUES (
  'User Registration Webhook',
  'test_users',
  'INSERT',
  'webhook',
  '{
    "url": "https://httpbin.org/post",
    "headers": {
      "Content-Type": "application/json",
      "X-Source": "Supabase-Workflows"
    },
    "timeout": 10000
  }',
  true
);

-- Email Workflow: Send welcome email on user creation  
INSERT INTO public.workflows (name, table_name, event, action_type, action_payload, enabled)
VALUES (
  'Welcome Email',
  'test_users', 
  'INSERT',
  'email',
  '{
    "recipient_field": "email",
    "subject": "Welcome {{name}}!",
    "body": "Hello {{name}}, welcome to our platform! Your account with email {{email}} has been created.",
    "sender_email": "noreply@example.com",
    "sender_name": "Test App"
  }',
  true
);

-- Table Insert Workflow: Log user updates to audit table
-- First create the audit table
CREATE TABLE IF NOT EXISTS public.user_audit_log (
  id SERIAL PRIMARY KEY,
  user_id INTEGER,
  user_email TEXT,
  workflow_source_table TEXT,
  workflow_source_event TEXT,
  workflow_created_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create the audit workflow
INSERT INTO public.workflows (name, table_name, event, action_type, action_payload, enabled)
VALUES (
  'User Update Audit Log',
  'test_users',
  'UPDATE', 
  'insert_table',
  '{
    "destination_table": "user_audit_log",
    "field_mappings": {
      "id": "user_id",
      "email": "user_email"
    }
  }',
  true
);

-- 3. View created workflows
SELECT 
  id,
  name,
  table_name,
  event,
  action_type,
  enabled,
  created_at
FROM public.workflows 
ORDER BY created_at;

-- 4. Now call the manage-triggers Edge Function to create database triggers
-- This needs to be done via HTTP call to: POST /functions/v1/manage-triggers
-- Example with curl:
/*
curl -X POST "https://your-project.supabase.co/functions/v1/manage-triggers" \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json"
*/

-- 5. After triggers are created, test the workflows by inserting test data

-- This should trigger the webhook and email workflows
INSERT INTO public.test_users (name, email)
VALUES ('John Doe', 'john.doe@example.com');

-- This should trigger the audit log workflow  
UPDATE public.test_users 
SET name = 'John Smith' 
WHERE email = 'john.doe@example.com';

-- 6. Check if audit log was created
SELECT * FROM public.user_audit_log ORDER BY created_at DESC LIMIT 5;

-- 7. View existing triggers (should see workflow triggers)
SELECT * FROM public.get_workflow_triggers();

-- 8. Check Edge Function logs for webhook and email execution
-- View logs in Supabase dashboard: Functions → handle-workflows → Logs

-- 9. Test disabling a workflow
UPDATE public.workflows 
SET enabled = false 
WHERE name = 'Welcome Email';

-- Call manage-triggers again to sync trigger state
-- The email workflow trigger should be dropped

-- 10. Clean up test data (optional)
/*
DELETE FROM public.test_users;
DELETE FROM public.user_audit_log;
DELETE FROM public.workflows WHERE table_name = 'test_users';
DROP TABLE public.test_users;
DROP TABLE public.user_audit_log;
*/ 