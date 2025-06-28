import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface WorkflowEvent {
  table: string
  event: 'INSERT' | 'UPDATE' | 'DELETE'
  data: Record<string, any>
  old_data?: Record<string, any>
}

interface Workflow {
  id: string
  name: string
  table_name: string
  event: string
  action_type: 'webhook' | 'email' | 'insert_table'
  action_payload: Record<string, any>
  enabled: boolean
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Parse the incoming event from the database trigger
    const eventData: WorkflowEvent = await req.json()
    
    console.log(`🔥 Workflow event received:`, {
      table: eventData.table,
      event: eventData.event,
      hasData: !!eventData.data
    })

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    // Find all enabled workflows that match this table and event
    const { data: workflows, error: workflowsError } = await supabaseClient
      .from('workflows')
      .select('*')
      .eq('table_name', eventData.table)
      .eq('event', eventData.event)
      .eq('enabled', true)

    if (workflowsError) {
      throw new Error(`Failed to fetch workflows: ${workflowsError.message}`)
    }

    if (!workflows || workflows.length === 0) {
      console.log(`ℹ️ No matching workflows found for ${eventData.table}.${eventData.event}`)
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'No matching workflows found',
          processed: 0
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`📋 Found ${workflows.length} workflows to execute`)

    const results = []

    // Execute each matching workflow
    for (const workflow of workflows) {
      console.log(`🔄 Executing workflow: ${workflow.name} (${workflow.action_type})`)
      
      try {
        let result
        
        switch (workflow.action_type) {
          case 'webhook':
            result = await executeWebhook(workflow, eventData)
            break
          case 'email':
            result = await executeEmail(workflow, eventData)
            break
          case 'insert_table':
            result = await executeTableInsert(workflow, eventData, supabaseClient)
            break
          default:
            throw new Error(`Unknown action type: ${workflow.action_type}`)
        }

        results.push({
          workflow_id: workflow.id,
          workflow_name: workflow.name,
          action_type: workflow.action_type,
          success: true,
          result: result
        })

        console.log(`✅ Workflow executed successfully: ${workflow.name}`)

      } catch (error) {
        console.error(`❌ Workflow execution failed: ${workflow.name}`, error)
        
        results.push({
          workflow_id: workflow.id,
          workflow_name: workflow.name,
          action_type: workflow.action_type,
          success: false,
          error: error.message
        })
      }
    }

    const successCount = results.filter(r => r.success).length
    const errorCount = results.filter(r => !r.success).length

    console.log(`📊 Workflow execution summary: ${successCount} succeeded, ${errorCount} failed`)

    return new Response(
      JSON.stringify({
        success: true,
        message: `Processed ${workflows.length} workflows`,
        results: results,
        summary: {
          total: workflows.length,
          succeeded: successCount,
          failed: errorCount
        }
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    )

  } catch (error) {
    console.error('Error in handle-workflows function:', error)
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      },
    )
  }
})

async function executeWebhook(workflow: Workflow, eventData: WorkflowEvent) {
  const { url, headers = {}, timeout = 10000 } = workflow.action_payload

  if (!url) {
    throw new Error('Webhook URL is required')
  }

  const payload = {
    workflow: {
      id: workflow.id,
      name: workflow.name
    },
    event: eventData.event,
    table: eventData.table,
    data: eventData.data,
    old_data: eventData.old_data,
    timestamp: new Date().toISOString()
  }

  console.log(`🌐 Calling webhook: ${url}`)

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeout)

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Supabase-Workflows/1.0',
        ...headers
      },
      body: JSON.stringify(payload),
      signal: controller.signal
    })

    clearTimeout(timeoutId)

    if (!response.ok) {
      throw new Error(`Webhook failed with status ${response.status}: ${response.statusText}`)
    }

    const responseData = await response.text()
    
    return {
      status: response.status,
      statusText: response.statusText,
      response: responseData.substring(0, 1000) // Limit response size in logs
    }

  } catch (error) {
    clearTimeout(timeoutId)
    if (error.name === 'AbortError') {
      throw new Error(`Webhook timeout after ${timeout}ms`)
    }
    throw error
  }
}

async function executeEmail(workflow: Workflow, eventData: WorkflowEvent) {
  const { 
    recipient_field, 
    subject, 
    body, 
    sender_email = 'noreply@yourdomain.com',
    sender_name = 'Your App'
  } = workflow.action_payload

  if (!recipient_field || !subject || !body) {
    throw new Error('Email recipient field, subject, and body are required')
  }

  // Extract recipient email from the data
  const recipientEmail = eventData.data[recipient_field]
  if (!recipientEmail) {
    throw new Error(`Recipient email not found in field: ${recipient_field}`)
  }

  // Template substitution - replace {{field_name}} with actual values
  const processedSubject = processTemplate(subject, eventData.data)
  const processedBody = processTemplate(body, eventData.data)

  console.log(`📧 Sending email to: ${recipientEmail}`)

  // TODO: Integrate with your email service (SendGrid, Resend, etc.)
  // For now, we'll log the email details
  const emailData = {
    to: recipientEmail,
    from: `${sender_name} <${sender_email}>`,
    subject: processedSubject,
    body: processedBody,
    timestamp: new Date().toISOString()
  }

  console.log('📧 Email would be sent:', emailData)

  return {
    email_sent: true,
    recipient: recipientEmail,
    subject: processedSubject,
    status: 'queued' // or 'sent', 'failed', etc.
  }
}

async function executeTableInsert(workflow: Workflow, eventData: WorkflowEvent, supabaseClient: any) {
  const { destination_table, field_mappings = {} } = workflow.action_payload

  if (!destination_table) {
    throw new Error('Destination table is required')
  }

  // Build the insert data based on field mappings
  // If no mappings specified, copy all fields from source
  let insertData: Record<string, any> = {}

  if (Object.keys(field_mappings).length > 0) {
    // Use explicit field mappings
    for (const [sourceField, destField] of Object.entries(field_mappings)) {
      if (eventData.data[sourceField] !== undefined) {
        insertData[destField as string] = eventData.data[sourceField]
      }
    }
  } else {
    // Copy all fields from source data
    insertData = { ...eventData.data }
  }

  // Add metadata
  insertData.workflow_source_table = eventData.table
  insertData.workflow_source_event = eventData.event
  insertData.workflow_created_at = new Date().toISOString()

  console.log(`📋 Inserting into ${destination_table}:`, Object.keys(insertData))

  const { data, error } = await supabaseClient
    .from(destination_table)
    .insert(insertData)
    .select()

  if (error) {
    throw new Error(`Failed to insert into ${destination_table}: ${error.message}`)
  }

  return {
    table_insert: true,
    destination_table,
    inserted_rows: data?.length || 1,
    inserted_data: insertData
  }
}

function processTemplate(template: string, data: Record<string, any>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, fieldName) => {
    return data[fieldName]?.toString() || match
  })
} 
