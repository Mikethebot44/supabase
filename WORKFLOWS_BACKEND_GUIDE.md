# Supabase Workflows Backend System

A complete database automation system that allows users to define workflows triggered by database events (INSERT, UPDATE, DELETE) and execute actions (webhooks, emails, table inserts).

## 🏗️ Architecture Overview

```
User creates workflow in UI → Stored in workflows table
                ↓
Trigger generator reads workflows → Creates PostgreSQL triggers
                ↓  
Database event occurs → Trigger calls dispatch_workflow()
                ↓
dispatch_workflow() → HTTP call to handle-workflows Edge Function
                ↓
Edge Function → Executes webhook/email/table insert actions
```

## 📦 Components

### 1. Database Schema (`workflows` table)
- **Location**: `supabase/migrations/20240115000001_create_workflows_table.sql`
- **Purpose**: Store workflow definitions with RLS security
- **Fields**:
  - `id`: UUID primary key
  - `name`: Human-readable workflow name
  - `table_name`: Target database table  
  - `event`: Trigger event (INSERT/UPDATE/DELETE)
  - `action_type`: Action to execute (webhook/email/insert_table)
  - `action_payload`: JSON configuration for the action
  - `enabled`: Boolean toggle for workflow state

### 2. Trigger Management (`manage-triggers` Edge Function)
- **Location**: `supabase/functions/manage-triggers/index.ts`
- **Purpose**: Dynamically create/drop PostgreSQL triggers based on workflow definitions
- **Usage**: Call via HTTP POST to sync triggers with workflow state

### 3. Workflow Executor (`handle-workflows` Edge Function)  
- **Location**: `supabase/functions/handle-workflows/index.ts`
- **Purpose**: Execute workflow actions when database events occur
- **Actions Supported**:
  - **Webhooks**: HTTP POST to external URLs
  - **Emails**: Send templated emails (placeholder implementation)
  - **Table Inserts**: Copy data to destination tables

### 4. SQL Helper Functions
- `dispatch_workflow()`: Core trigger function that calls the Edge Function
- `execute_workflow_sql()`: Safe dynamic SQL execution for trigger management
- `get_workflow_triggers()`: Query existing workflow triggers

## 🚀 Deployment Steps

### Step 1: Run Database Migration
```bash
supabase db reset  # or apply migration
```

### Step 2: Deploy Edge Functions
```bash
# Deploy the workflow handler
supabase functions deploy handle-workflows

# Deploy the trigger manager
supabase functions deploy manage-triggers
```

### Step 3: Set Environment Variables
```bash
# Set in Supabase dashboard or via CLI
supabase secrets set PROJECT_URL=https://your-project.supabase.co
supabase secrets set SERVICE_ROLE_KEY=your-service-role-key

# Optional: Email service API keys
supabase secrets set SENDGRID_API_KEY=your-sendgrid-key
```

### Step 4: Initialize Triggers
```bash
# Call the trigger manager to create initial triggers
curl -X POST https://your-project.supabase.co/functions/v1/manage-triggers \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY"
```

## 💻 Frontend Integration Examples

### Creating Workflows from UI
```typescript
const createWorkflow = async (workflowData) => {
  const { data, error } = await supabase
    .from('workflows')
    .insert({
      name: workflowData.name,
      table_name: workflowData.table,
      event: workflowData.event,
      action_type: workflowData.actionType,
      action_payload: {
        url: workflowData.webhookUrl, // for webhooks
        recipient_field: workflowData.emailRecipient, // for emails
        subject: workflowData.emailSubject,
        body: workflowData.emailBody
      },
      enabled: true
    })

  if (!error) {
    // Trigger sync to create database triggers
    await fetch('/functions/v1/manage-triggers', { method: 'POST' })
  }
}
```

## 🔧 Action Configuration Examples

### Webhook Action
```json
{
  "action_type": "webhook",
  "action_payload": {
    "url": "https://api.example.com/webhook",
    "headers": {"Authorization": "Bearer token123"},
    "timeout": 10000
  }
}
```

### Email Action  
```json
{
  "action_type": "email", 
  "action_payload": {
    "recipient_field": "email",
    "subject": "Welcome {{name}}!",
    "body": "Hello {{name}}, your account has been created."
  }
}
```

### Table Insert Action
```json
{
  "action_type": "insert_table",
  "action_payload": {
    "destination_table": "audit_log", 
    "field_mappings": {"user_id": "user_id", "email": "user_email"}
  }
}
```

## 🔄 Usage Flow

1. **User creates workflow in UI** → Saved to `workflows` table
2. **Call manage-triggers** → Creates PostgreSQL trigger
3. **Database event occurs** → Trigger fires → Calls Edge Function
4. **Edge Function executes action** → Webhook/Email/Table Insert

## 🚨 Troubleshooting

### Check if triggers are created:
```sql
SELECT * FROM public.get_workflow_triggers();
```

### Test workflow manually:
```sql
-- Insert test data to trigger workflow
INSERT INTO public.users (name, email) VALUES ('Test', 'test@example.com');
```

### View Edge Function logs:
```bash
supabase functions logs handle-workflows
```

## 🔒 Security Features

- **Row Level Security (RLS)**: Enabled on workflows table
- **Service Role Only**: Edge Functions use service role for elevated permissions
- **SQL Injection Protection**: Dynamic SQL execution is restricted to safe patterns
- **CORS Headers**: Proper CORS configuration for browser requests

## 📊 Monitoring & Debugging

### View Logs
```bash
# Edge Function logs
supabase functions logs handle-workflows
supabase functions logs manage-triggers

# Database logs (check for trigger execution)
# Available in Supabase dashboard
```

### Test Workflow Execution
```sql
-- Manually trigger a workflow by inserting test data
INSERT INTO public.users (name, email) 
VALUES ('Test User', 'test@example.com');

-- Check workflow execution in Edge Function logs
```

### Query Existing Triggers
```sql
-- See all workflow triggers
SELECT * FROM public.get_workflow_triggers();

-- View workflows table
SELECT * FROM public.workflows WHERE enabled = true;
```

## 🔄 Maintenance Tasks

### Sync Triggers (Run Periodically)
```bash
# Call this when workflows are added/modified/disabled
curl -X POST https://your-project.supabase.co/functions/v1/manage-triggers
```

### Clean Up Orphaned Triggers
```sql
-- Remove triggers for deleted workflows
-- (The manage-triggers function handles this automatically)
```

## 🎯 Usage Examples

### Example 1: User Registration Webhook
```sql
INSERT INTO workflows (name, table_name, event, action_type, action_payload)
VALUES (
  'User Registration Webhook',
  'users', 
  'INSERT',
  'webhook',
  '{"url": "https://api.example.com/user-created", "timeout": 5000}'
);
```

### Example 2: Order Confirmation Email  
```sql
INSERT INTO workflows (name, table_name, event, action_type, action_payload)
VALUES (
  'Order Confirmation Email',
  'orders',
  'INSERT', 
  'email',
  '{
    "recipient_field": "customer_email",
    "subject": "Order Confirmation #{{order_id}}", 
    "body": "Thank you {{customer_name}}! Your order #{{order_id}} has been confirmed."
  }'
);
```

### Example 3: Audit Trail
```sql
INSERT INTO workflows (name, table_name, event, action_type, action_payload)
VALUES (
  'User Updates Audit',
  'users',
  'UPDATE',
  'insert_table', 
  '{
    "destination_table": "user_audit_log",
    "field_mappings": {
      "id": "user_id", 
      "email": "old_email",
      "updated_at": "change_time"
    }
  }'
);
```

### Support
- Review Edge Function logs in Supabase dashboard  
- Check PostgreSQL logs for trigger execution
- Test individual components with manual API calls
