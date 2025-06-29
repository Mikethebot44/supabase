import { tool as runSqlTool } from './tools/run_sql'
import { tool as getSchemaTool } from './tools/get_schema'
import { tool as createTableTool } from './tools/create_table'
import { tool as listTablesTool } from './tools/list_tables'
import { tool as dropTableTool } from './tools/drop_table'

// Type definitions
export interface ToolDefinition {
  name: string
  description: string
  parameters: any
  execute: (args: any, context: any) => Promise<any>
}

export interface ToolContext {
  projectRef: string
  connectionString: string
  headers?: Record<string, string>
}

// All available tools
const tools: ToolDefinition[] = [
  runSqlTool,
  getSchemaTool,
  createTableTool,
  listTablesTool,
  dropTableTool
]

// Function to get all tools in the format needed for OpenAI Assistant API
export function getAllTools() {
  // Convert tools to OpenAI function schema format
  const schema = tools.map(tool => ({
    type: 'function' as const,
    function: {
      name: tool.name,
      description: tool.description,
      parameters: {
        type: 'object',
        properties: tool.parameters._def.shape ? 
          Object.entries(tool.parameters._def.shape).reduce((acc, [key, zodSchema]: [string, any]) => {
            acc[key] = convertZodToJsonSchema(zodSchema)
            return acc
          }, {} as Record<string, any>) : {},
        required: tool.parameters._def.shape ? 
          Object.entries(tool.parameters._def.shape)
            .filter(([_, zodSchema]: [string, any]) => !zodSchema.isOptional())
            .map(([key, _]) => key) : []
      }
    }
  }))

  // Create execution map for tool calls
  const executionMap = tools.reduce((acc, tool) => {
    acc[tool.name] = tool.execute
    return acc
  }, {} as Record<string, (args: any, context: ToolContext) => Promise<any>>)

  return {
    schema,
    executionMap
  }
}

// Helper function to convert Zod schema to JSON Schema
function convertZodToJsonSchema(zodSchema: any): any {
  const def = zodSchema._def

  if (def.typeName === 'ZodString') {
    return {
      type: 'string',
      description: def.description || undefined
    }
  }

  if (def.typeName === 'ZodNumber') {
    return {
      type: 'number',
      description: def.description || undefined
    }
  }

  if (def.typeName === 'ZodBoolean') {
    return {
      type: 'boolean',
      description: def.description || undefined
    }
  }

  if (def.typeName === 'ZodArray') {
    return {
      type: 'array',
      items: convertZodToJsonSchema(def.type),
      description: def.description || undefined
    }
  }

  if (def.typeName === 'ZodObject') {
    return {
      type: 'object',
      properties: Object.entries(def.shape).reduce((acc, [key, schema]: [string, any]) => {
        acc[key] = convertZodToJsonSchema(schema)
        return acc
      }, {} as Record<string, any>),
      required: Object.entries(def.shape)
        .filter(([_, schema]: [string, any]) => !schema.isOptional())
        .map(([key, _]) => key),
      description: def.description || undefined
    }
  }

  if (def.typeName === 'ZodOptional') {
    return convertZodToJsonSchema(def.innerType)
  }

  // Fallback for unknown types
  return {
    type: 'string',
    description: def.description || 'Unknown type'
  }
}

// Export individual tools for direct access if needed
export {
  runSqlTool,
  getSchemaTool,
  createTableTool,
  listTablesTool,
  dropTableTool
} 