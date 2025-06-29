import { AnimatePresence, motion } from 'framer-motion'
import { Bot, ChevronDown, Copy, GripVertical, Settings, X } from 'lucide-react'
import { useRouter } from 'next/router'
import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { FC } from 'react'
import { Button, Alert, CodeBlock as UICodeBlock, CodeBlockLang } from 'ui'
import { MessageCircle } from 'lucide-react'
import { useProjectContext } from 'components/layouts/ProjectLayout/ProjectContext'
import { AIAssistantService } from 'lib/ai-assistant-service'
import { Message } from 'lib/types'
import { Markdown } from 'components/interfaces/Markdown'
import { useAiAssistantStateSnapshot } from 'state/ai-assistant-state'
import {
  cn,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  ScrollArea,
  Separator,
  Textarea,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from 'ui'
import { useAppStateSnapshot } from 'state/app-state'

interface AIAgentSidebarProps {
  className?: string
}

// Mock messages for demonstration
const MOCK_MESSAGES = [
  {
    id: '1',
    role: 'user' as const,
    content: 'How can I optimize this SQL query for better performance?',
    createdAt: new Date(Date.now() - 300000), // 5 minutes ago
  },
  {
    id: '2',
    role: 'assistant' as const,
    content: `I can help you optimize your SQL query! Here are some general strategies:

## Query Optimization Tips

1. **Use indexes effectively**
   - Add indexes on columns used in WHERE, JOIN, and ORDER BY clauses
   - Consider composite indexes for multiple column queries

2. **Limit result sets**
   - Use LIMIT to reduce the number of rows returned
   - Add specific WHERE conditions to filter data

3. **Optimize JOINs**
   - Use INNER JOIN instead of OUTER JOIN when possible
   - Ensure JOIN conditions use indexed columns

4. **Avoid SELECT ***
   - Only select the columns you actually need
   - This reduces data transfer and memory usage

Would you like me to analyze a specific query? Please share the SQL you'd like me to help optimize.`,
    createdAt: new Date(Date.now() - 280000), // 4 minutes 40 seconds ago
  },
  {
    id: '3',
    role: 'user' as const,
    content: 'Can you help me create a RLS policy for user data?',
    createdAt: new Date(Date.now() - 120000), // 2 minutes ago
  },
  {
    id: '4',
    role: 'assistant' as const,
    content: `Absolutely! Row Level Security (RLS) is crucial for protecting user data. Here's how to create a basic RLS policy:

## Basic RLS Setup

\`\`\`sql
-- Enable RLS on your table
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- Create a policy for users to only see their own data
CREATE POLICY "Users can view own profile" ON user_profiles
  FOR SELECT USING (auth.uid() = user_id);

-- Create a policy for users to update their own data
CREATE POLICY "Users can update own profile" ON user_profiles
  FOR UPDATE USING (auth.uid() = user_id);
\`\`\`

## Key Points

- Use \`auth.uid()\` to get the current user's ID
- Create separate policies for SELECT, INSERT, UPDATE, DELETE
- Test your policies thoroughly before deploying

Would you like me to help you create a policy for a specific table structure?`,
    createdAt: new Date(Date.now() - 60000), // 1 minute ago
  },
]

// AI Model options
const AI_MODELS = [
  { key: 'gpt-4', label: 'GPT-4', description: 'Most capable, slower' },
  { key: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo', description: 'Fast and efficient' },
  { key: 'claude-3-sonnet', label: 'Claude 3 Sonnet', description: 'Balanced performance' },
  { key: 'claude-3-haiku', label: 'Claude 3 Haiku', description: 'Fastest responses' },
]

// Supabase Functions
const SUPABASE_FUNCTIONS = [
  // Database
  { key: 'create-table', label: 'Create Table', category: 'Database', description: 'Help create database tables with proper schema' },
  { key: 'optimize-query', label: 'Optimize Query', category: 'Database', description: 'Analyze and optimize SQL queries for better performance' },
  { key: 'rls-policy', label: 'RLS Policy', category: 'Database', description: 'Create Row Level Security policies' },
  { key: 'database-functions', label: 'Database Functions', category: 'Database', description: 'Create PostgreSQL functions and triggers' },
  { key: 'migration-help', label: 'Migration Help', category: 'Database', description: 'Assistance with database migrations' },
  
  // Auth
  { key: 'user-management', label: 'User Management', category: 'Auth', description: 'Help with user authentication and management' },
  { key: 'auth-providers', label: 'Auth Providers', category: 'Auth', description: 'Configure third-party authentication providers' },
  { key: 'jwt-tokens', label: 'JWT Tokens', category: 'Auth', description: 'Help with JWT token configuration and validation' },
  
  // Storage
  { key: 'bucket-management', label: 'Bucket Management', category: 'Storage', description: 'Create and configure storage buckets' },
  { key: 'file-upload', label: 'File Upload', category: 'Storage', description: 'Implement file upload functionality' },
  { key: 'image-transformations', label: 'Image Transformations', category: 'Storage', description: 'Configure image processing and transformations' },
  
  // API
  { key: 'api-generation', label: 'API Generation', category: 'API', description: 'Generate REST API endpoints' },
  { key: 'graphql-queries', label: 'GraphQL Queries', category: 'API', description: 'Help with GraphQL query construction' },
  { key: 'realtime-subscriptions', label: 'Realtime Subscriptions', category: 'API', description: 'Set up realtime data subscriptions' },
  
  // Edge Functions
  { key: 'deploy-function', label: 'Deploy Function', category: 'Edge Functions', description: 'Help deploy edge functions' },
  { key: 'debug-function', label: 'Debug Function', category: 'Edge Functions', description: 'Debug edge function issues' },
  { key: 'function-secrets', label: 'Function Secrets', category: 'Edge Functions', description: 'Manage function environment variables and secrets' },
  
  // Analytics
  { key: 'performance-monitoring', label: 'Performance Monitoring', category: 'Analytics', description: 'Set up performance monitoring and alerts' },
  { key: 'usage-analytics', label: 'Usage Analytics', category: 'Analytics', description: 'Analyze project usage and metrics' },
]

interface Chat {
  id: string
  name: string
  createdAt: Date
  lastMessage?: string
}

interface Props {
  isOpen: boolean
  onClose: () => void
  className?: string
}

const CodeBlock = ({ content, language = 'sql' }: { content: string; language?: string }) => {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    await navigator.clipboard.writeText(content)
    setCopied(true)
    toast.success('Copied to clipboard')
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="relative group">
      <UICodeBlock 
        language={language as CodeBlockLang} 
        className="!my-3"
      >
        {content.trim()}
      </UICodeBlock>
    </div>
  )
}

export const AIAgentSidebar: FC<Props> = ({ isOpen, onClose, className }) => {
  const router = useRouter()
  const { project } = useProjectContext()
  const [messages, setMessages] = useState<Message[]>([])
  const [inputValue, setInputValue] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [selectedModel, setSelectedModel] = useState(AI_MODELS[0].key)
  const [selectedFunctions, setSelectedFunctions] = useState<string[]>([])
  const [functionSearch, setFunctionSearch] = useState('')
  const [isFunctionDropdownOpen, setIsFunctionDropdownOpen] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [width, setWidth] = useState(400)
  const [error, setError] = useState<string | null>(null)
  
  const sidebarRef = useRef<HTMLDivElement>(null)
  const resizeRef = useRef<HTMLDivElement>(null)
  const scrollAreaRef = useRef<HTMLDivElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const assistantRef = useRef<AIAssistantService | null>(null)

  // Load messages from localStorage on mount
  useEffect(() => {
    const savedMessages = localStorage.getItem('aiAssistantMessages')
    if (savedMessages) {
      const parsedMessages = JSON.parse(savedMessages)
      // Convert string dates back to Date objects
      const messagesWithDates = parsedMessages.map((msg: any) => ({
        ...msg,
        createdAt: new Date(msg.createdAt)
      }))
      setMessages(messagesWithDates)
    }
  }, [])

  // Save messages to localStorage whenever they change
  useEffect(() => {
    if (messages.length > 0) {
      localStorage.setItem('aiAssistantMessages', JSON.stringify(messages))
    }
  }, [messages])

  // Clear messages when sidebar is closed
  useEffect(() => {
    if (!isOpen) {
      localStorage.removeItem('aiAssistantMessages')
      setMessages([])
    }
  }, [isOpen])

  // Scroll to bottom when new messages arrive
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  // Initialize assistant
  const initializeAssistant = async () => {
    try {
      const apiKey = process.env.NEXT_PUBLIC_OPENAI_API_KEY
      
      if (!apiKey) {
        throw new Error(JSON.stringify({
          message: 'API key not found in environment variables. Please add NEXT_PUBLIC_OPENAI_API_KEY to your .env.local file.'
        }))
      }
      
      assistantRef.current = new AIAssistantService(apiKey)
      await assistantRef.current.initialize()

      // Only add initial greeting if there are no existing messages
      if (messages.length === 0) {
        const initialMessage: Message = {
          id: 'initial',
          role: 'assistant',
          content: `Hi! I'm your Supabase AI assistant. I can help you with:
- SQL queries and database operations
- Row Level Security (RLS) policies
- Authentication setup
- Storage configurations
- API integrations

What would you like help with?`,
          createdAt: new Date()
        }
        setMessages([initialMessage])
      }
    } catch (error: any) {
      console.error('Failed to initialize assistant:', error)
      const errorMessage = error?.message ? JSON.parse(error.message).message : 'Failed to initialize AI Assistant'
      setError(errorMessage)
      toast.error(errorMessage)
    }
  }

  // Get current context
  const getContextInfo = () => {
    const path = router.pathname
    if (path.includes('/sql')) return 'SQL Editor'
    if (path.includes('/database')) return 'Database'
    if (path.includes('/auth')) return 'Authentication'
    if (path.includes('/storage')) return 'Storage'
    if (path.includes('/functions')) return 'Edge Functions'
    if (path.includes('/settings')) return 'Project Settings'
    return 'General'
  }

  const currentContext = getContextInfo()

  // Handle resize functionality
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isDragging) return
      
      const sidebarElement = sidebarRef.current
      if (!sidebarElement) return

      const rect = sidebarElement.getBoundingClientRect()
      const newWidth = window.innerWidth - e.clientX
      const clampedWidth = Math.min(Math.max(newWidth, 320), 600)
      setWidth(clampedWidth)
    },
    [isDragging]
  )

  const handleMouseUp = useCallback(() => {
    setIsDragging(false)
  }, [])

  // Add event listeners for resize
  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove)
      window.addEventListener('mouseup', handleMouseUp)
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isDragging, handleMouseMove, handleMouseUp])

  // Initialize assistant when sidebar is opened
  useEffect(() => {
    if (isOpen) {
      initializeAssistant()
    }

    return () => {
      if (assistantRef.current) {
        assistantRef.current.cleanup()
        assistantRef.current = null
      }
    }
  }, [isOpen])

  // Handle message sending
  const handleSendMessage = async () => {
    if (!inputValue.trim() || isLoading) return

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: inputValue,
      createdAt: new Date()
    }

    setMessages(prev => [...prev, userMessage])
    setInputValue('')
    setIsLoading(true)
    setError(null) // Clear any previous errors

    try {
      const assistantMessage = await assistantRef.current?.sendMessage(inputValue)
      if (assistantMessage) {
        setMessages(prev => [...prev, {
          ...assistantMessage,
          id: Date.now().toString(),
          createdAt: new Date()
        }])
      }
    } catch (error: any) {
      console.error('Error sending message:', error)
      const errorMessage = error?.message ? JSON.parse(error.message).message : 'Failed to send message'
      setError(errorMessage)
      toast.error(errorMessage)
    } finally {
      setIsLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  const handleSettings = () => {
    // TODO: Implement settings modal
    toast.info('Settings coming soon!')
  }

  const handleClose = () => {
    onClose()
  }

  if (!isOpen) return null

  return (
    <AnimatePresence>
      <motion.div
        ref={sidebarRef}
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
        className={cn(
          'fixed right-0 top-0 z-40 flex h-full bg-background border-l border-border shadow-xl',
          className
        )}
        style={{ width }}
      >
        {/* Resize Handle */}
        <div
          ref={resizeRef}
          className={cn(
            'absolute left-0 top-0 bottom-0 w-1 cursor-col-resize bg-border hover:bg-border-strong transition-colors',
            isDragging && 'bg-brand-600'
          )}
          onMouseDown={handleMouseDown}
        >
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
            <GripVertical size={12} className="text-foreground-light" />
          </div>
        </div>

        {/* Sidebar Content */}
        <div className="flex flex-col w-full ml-1">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-border">
            <div className="flex items-center gap-2">
              <Bot size={18} className="text-brand-600" />
              <div>
                <h2 className="text-sm font-medium">AI Assistant</h2>
                <p className="text-xs text-foreground-light">{currentContext}</p>
              </div>
            </div>
            
            <div className="flex items-center gap-1">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button 
                    type="text" 
                    size="tiny" 
                    icon={<ChevronDown size={14} />}
                  >
                    Current Chat
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem>Current Chat</DropdownMenuItem>
                  <DropdownMenuItem>New Chat</DropdownMenuItem>
                  <DropdownMenuItem>Clear History</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              
              <Button
                type="text"
                size="tiny"
                icon={<Settings size={14} />}
                onClick={handleSettings}
              />
              
              <Button
                type="text"
                size="tiny"
                icon={<X size={14} />}
                onClick={handleClose}
              />
            </div>
          </div>

          {/* Chat Messages */}
          <ScrollArea 
            ref={scrollAreaRef} 
            className="flex-1 px-4"
          >
            <div className="py-4 space-y-6">
              {error && (
                <Alert variant="danger" title="Error">
                  {error}
                </Alert>
              )}
              
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={cn(
                    'flex gap-3 w-full',
                    message.role === 'user' ? 'justify-end' : 'justify-start'
                  )}
                >
                  {message.role === 'assistant' && (
                    <div className="flex-shrink-0 w-6 h-6 rounded-full bg-brand-600 flex items-center justify-center">
                      <Bot size={12} className="text-white" />
                    </div>
                  )}
                  
                  <div
                    className={cn(
                      'rounded-lg px-4 py-3 text-sm w-full max-w-[85%]',
                      message.role === 'user'
                        ? 'bg-brand-600 text-white ml-auto'
                        : 'bg-surface-200 text-foreground'
                    )}
                  >
                    {message.role === 'assistant' ? (
                      <div className="prose prose-sm dark:prose-dark max-w-none relative">
                        <Markdown 
                          content={message.content}
                          className="!leading-normal [&_pre]:!bg-background [&_pre]:!border [&_pre]:!border-border [&_pre]:!rounded-md [&_pre]:!p-4 [&_pre]:!my-3 [&_code]:!text-brand-600 [&_code]:!text-xs [&_code]:!font-mono"
                        />
                        {message.content.includes('```') && (
                          <button
                            className="absolute top-[3.25rem] right-2 p-1.5 rounded bg-surface-100 hover:bg-surface-200 transition-colors"
                            onClick={() => {
                              const code = message.content.match(/```[\s\S]*?\n([\s\S]*?)```/)?.[1] || ''
                              navigator.clipboard.writeText(code)
                              toast.success('Code copied to clipboard')
                            }}
                          >
                            <Copy size={14} className="text-foreground-light" />
                          </button>
                        )}
                      </div>
                    ) : (
                      <div className="whitespace-pre-wrap">{message.content}</div>
                    )}
                    
                    <div className="text-xs opacity-70 mt-2">
                      {message.createdAt.toLocaleTimeString([], { 
                        hour: '2-digit', 
                        minute: '2-digit' 
                      })}
                    </div>
                  </div>
                  
                  {message.role === 'user' && (
                    <div className="flex-shrink-0 w-6 h-6 rounded-full bg-surface-200 flex items-center justify-center">
                      <span className="text-xs font-medium">U</span>
                    </div>
                  )}
                </div>
              ))}
              
              {isLoading && (
                <div className="flex gap-3 justify-start">
                  <div className="flex-shrink-0 w-6 h-6 rounded-full bg-brand-600 flex items-center justify-center">
                    <Bot size={12} className="text-white" />
                  </div>
                  <div className="bg-surface-200 rounded-lg px-4 py-3 max-w-[85%]">
                    <div className="flex space-x-2">
                      <div className="w-2 h-2 bg-foreground-light rounded-full animate-bounce"></div>
                      <div className="w-2 h-2 bg-foreground-light rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                      <div className="w-2 h-2 bg-foreground-light rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div>
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          </ScrollArea>

          {/* Footer Input */}
          <div className="p-4 border-t border-border">
            <div className="space-y-3">
              {/* Quick Actions */}
              <div className="flex flex-wrap gap-2">
                <Button
                  type="outline"
                  size="tiny"
                  onClick={() => setInputValue('How can I optimize this query?')}
                  disabled={isLoading}
                >
                  Optimize Query
                </Button>
                <Button
                  type="outline"
                  size="tiny"
                  onClick={() => setInputValue('Help me create an RLS policy')}
                  disabled={isLoading}
                >
                  RLS Policy
                </Button>
                <Button
                  type="outline"
                  size="tiny"
                  onClick={() => setInputValue('How do I set up authentication?')}
                  disabled={isLoading}
                >
                  Auth Setup
                </Button>
              </div>
              
              <Separator />
              
              {/* Message Input */}
              <div className="flex gap-2">
                <Textarea
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Type your question..."
                  className="min-h-[60px] resize-none"
                  disabled={isLoading}
                />
                <Button
                  type="primary"
                  size="medium"
                  onClick={handleSendMessage}
                  loading={isLoading}
                  disabled={!inputValue.trim()}
                  className="self-end"
                >
                  Send
                </Button>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  )
} 