import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface Workflow {
  id: string
  name: string
  table_name: string
  event: 'INSERT' | 'UPDATE' | 'DELETE'
  action_type: string
  action_payload: Record<string, any>
  enabled: boolean
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
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

    // Get all workflows from database
    const { data: workflows, error: workflowsError } = await supabaseClient
      .from('workflows')
      .select('*')
      .order('created_at')

    if (workflowsError) {
      throw new Error(`Failed to fetch workflows: ${workflowsError.message}`)
    }

    console.log(`Found ${workflows?.length || 0} workflows to process`)

    const results = []

    for (const workflow of workflows || []) {
      const triggerName = `workflow_${workflow.table_name}_${workflow.event.toLowerCase()}_${workflow.id.replace(/-/g, '_')}`
      
      if (workflow.enabled) {
        // Create or update trigger
        const triggerSQL = generateTriggerSQL(workflow, triggerName)
        
        try {
          const { error: triggerError } = await supabaseClient
            .rpc('execute_workflow_sql', {
              sql_query: triggerSQL
            })

          if (triggerError) {
            console.error(`Failed to create trigger for workflow ${workflow.name}:`, triggerError)
            results.push({
              workflow_id: workflow.id,
              workflow_name: workflow.name,
              action: 'create_trigger',
              success: false,
              error: triggerError.message
            })
          } else {
            console.log(`✅ Created trigger for workflow: ${workflow.name}`)
            results.push({
              workflow_id: workflow.id,
              workflow_name: workflow.name, 
              action: 'create_trigger',
              success: true,
              trigger_name: triggerName
            })
          }
        } catch (error) {
          console.error(`Error creating trigger for ${workflow.name}:`, error)
          results.push({
            workflow_id: workflow.id,
            workflow_name: workflow.name,
            action: 'create_trigger', 
            success: false,
            error: error.message
          })
        }
      } else {
        // Drop trigger if it exists
        const dropSQL = `DROP TRIGGER IF EXISTS ${triggerName} ON public.${workflow.table_name};`
        
        try {
          const { error: dropError } = await supabaseClient
            .rpc('execute_workflow_sql', {
              sql_query: dropSQL
            })

          if (dropError) {
            console.error(`Failed to drop trigger for workflow ${workflow.name}:`, dropError)
            results.push({
              workflow_id: workflow.id,
              workflow_name: workflow.name,
              action: 'drop_trigger',
              success: false,
              error: dropError.message
            })
          } else {
            console.log(`🗑️ Dropped trigger for disabled workflow: ${workflow.name}`)
            results.push({
              workflow_id: workflow.id,
              workflow_name: workflow.name,
              action: 'drop_trigger', 
              success: true,
              trigger_name: triggerName
            })
          }
        } catch (error) {
          console.error(`Error dropping trigger for ${workflow.name}:`, error)
          results.push({
            workflow_id: workflow.id,
            workflow_name: workflow.name,
            action: 'drop_trigger',
            success: false,
            error: error.message
          })
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Processed ${workflows?.length || 0} workflows`,
        results: results,
        summary: {
          total: workflows?.length || 0,
          created: results.filter(r => r.action === 'create_trigger' && r.success).length,
          dropped: results.filter(r => r.action === 'drop_trigger' && r.success).length,
          errors: results.filter(r => !r.success).length
        }
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    )

  } catch (error) {
    console.error('Error in manage-triggers function:', error)
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

function generateTriggerSQL(workflow: Workflow, triggerName: string): string {
  const timing = 'AFTER' // Could be configurable
  const event = workflow.event
  const tableName = workflow.table_name

  return `
    -- Drop existing trigger if it exists
    DROP TRIGGER IF EXISTS ${triggerName} ON public.${tableName};
    
    -- Create new trigger
    CREATE TRIGGER ${triggerName}
      ${timing} ${event} ON public.${tableName}
      FOR EACH ROW
      EXECUTE FUNCTION public.dispatch_workflow();
  `
} 
