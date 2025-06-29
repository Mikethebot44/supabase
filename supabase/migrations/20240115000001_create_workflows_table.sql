-- Create workflows table for database automation system
create table if not exists public.workflows (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  table_name text not null,
  event text not null check (event in ('INSERT', 'UPDATE', 'DELETE')),
  action_type text not null check (action_type in ('webhook', 'email', 'insert_table')),
  action_payload jsonb not null, -- config for webhook, email, or table insert
  enabled boolean default true,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- Add indexes for performance
create index if not exists idx_workflows_table_event on public.workflows(table_name, event);
create index if not exists idx_workflows_enabled on public.workflows(enabled);

-- Add RLS policies for security
alter table public.workflows enable row level security;

-- Allow authenticated users to manage workflows
create policy "Users can view workflows" on public.workflows
  for select using (auth.role() = 'authenticated');

create policy "Users can insert workflows" on public.workflows
  for insert with check (auth.role() = 'authenticated');

create policy "Users can update workflows" on public.workflows
  for update using (auth.role() = 'authenticated');

create policy "Users can delete workflows" on public.workflows
  for delete using (auth.role() = 'authenticated');

-- Create updated_at trigger
create or replace function public.update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger update_workflows_updated_at
  before update on public.workflows
  for each row
  execute function public.update_updated_at_column();

-- Create the central dispatch function that all triggers will call
create or replace function public.dispatch_workflow()
returns trigger as $$
declare
  payload jsonb;
  project_url text;
begin
  -- Get project URL from environment or use default
  select coalesce(
    current_setting('app.settings.project_url', true),
    'http://localhost:54321'
  ) into project_url;

  -- Build payload with event metadata
  payload := jsonb_build_object(
    'table', TG_TABLE_NAME,
    'event', TG_OP,
    'data', case 
      when TG_OP = 'DELETE' then row_to_json(OLD)
      else row_to_json(NEW)
    end,
    'old_data', case 
      when TG_OP = 'UPDATE' then row_to_json(OLD)
      else null
    end
  );

  -- Make async HTTP call to edge function
  perform net.http_post(
    url := project_url || '/functions/v1/handle-workflows',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
    ),
    body := payload
  );

  -- Return appropriate record
  return case 
    when TG_OP = 'DELETE' then OLD
    else NEW
  end;
end;
$$ language plpgsql security definer;

-- Grant execute permission
grant execute on function public.dispatch_workflow() to authenticated;
grant execute on function public.dispatch_workflow() to service_role;

-- Helper function for executing dynamic SQL (used by manage-triggers Edge Function)
create or replace function public.execute_workflow_sql(sql_query text)
returns json as $$
declare
  result json;
begin
  -- Security: Only allow specific SQL patterns for workflow management
  if sql_query ~* '^(CREATE|DROP)\s+TRIGGER.*workflow_.*' then
    execute sql_query;
    return json_build_object('success', true, 'message', 'SQL executed successfully');
  else
    raise exception 'Unauthorized SQL pattern. Only workflow trigger operations are allowed.';
  end if;
exception
  when others then
    return json_build_object('success', false, 'error', SQLERRM);
end;
$$ language plpgsql security definer;

-- Grant execute permission for the helper function
grant execute on function public.execute_workflow_sql(text) to service_role;

-- Function to get existing workflow triggers (for management)
create or replace function public.get_workflow_triggers()
returns table(trigger_name text, table_name text, event_manipulation text) as $$
begin
  return query
  select 
    t.trigger_name::text,
    t.event_object_table::text as table_name,
    t.event_manipulation::text
  from information_schema.triggers t
  where t.trigger_name like 'workflow_%'
    and t.trigger_schema = 'public';
end;
$$ language plpgsql security definer;

-- Grant execute permission
grant execute on function public.get_workflow_triggers() to service_role; 