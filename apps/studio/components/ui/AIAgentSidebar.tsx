import { AnimatePresence, motion } from 'framer-motion'
import { Bot, ChevronDown, ChevronRight, Code, Edit, GripVertical, Plus, Search, Settings, Trash2, X } from 'lucide-react'
import { useRouter } from 'next/router'
import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'

import { EnhancedMarkdown } from './EnhancedMarkdown'
import { useAiAssistantStateSnapshot } from 'state/ai-assistant-state'
import { useUser } from 'lib/auth'
import { useIsUserLoading } from 'common'
import {
  Button,
  cn,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogSection,
  DialogTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Input,
  ScrollArea,
  Separator,
  Textarea,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from 'ui'
import { useAppStateSnapshot } from 'state/app-state'

// AI Model options
const AI_MODELS = [
  { key: 'gpt-4', label: 'GPT-4', description: 'Most capable, slower' },
  { key: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo', description: 'Fast and efficient' },
  { key: 'claude-3-sonnet', label: 'Claude 3 Sonnet', description: 'Balanced performance' },
  { key: 'claude-3-haiku', label: 'Claude 3 Haiku', description: 'Fastest responses' },
]

// Database Assistant Functions
const DATABASE_FUNCTIONS = [
  { key: 'run_sql', label: 'Run SQL Query', category: 'Database', description: 'Execute read-only SQL queries to analyze data' },
  { key: 'get_schema', label: 'Get Table Schema', category: 'Database', description: 'Get detailed information about table structure and columns' },
  { key: 'create_table', label: 'Create Table', category: 'Database', description: 'Create new database tables with proper schema and constraints' },
  { key: 'list_tables', label: 'List Tables', category: 'Database', description: 'List all tables and views in the database with metadata' },
  { key: 'drop_table', label: 'Drop Table', category: 'Database', description: 'Safely drop tables with confirmation checks' },
]

// Hardcoded test values for Assistant API (for testing without real project context)
const TEST_PROJECT_REF = 'test-project-123'
const TEST_CONNECTION_STRING = 'postgresql://postgres:test-password@localhost:54322/postgres'

// FunctionCall Component
const FunctionCallComponent = ({ functionCall }: { functionCall: FunctionCall }) => {
  const [isExpanded, setIsExpanded] = useState(false)

  return (
    <div className="my-2 border border-border rounded-lg overflow-hidden bg-surface-100">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-3 hover:bg-surface-200 transition-colors text-left"
      >
        <div className="flex items-center gap-2">
          <Code size={14} className="text-brand-600" />
          <span className="text-sm font-medium text-foreground">
            {functionCall.name}
          </span>
          <span className="text-xs text-foreground-light bg-surface-200 px-2 py-0.5 rounded">
            Function Called
          </span>
        </div>
        <ChevronRight 
          size={14} 
          className={cn(
            'text-foreground-light transition-transform',
            isExpanded && 'rotate-90'
          )} 
        />
      </button>
      
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: 'auto' }}
            exit={{ height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-3 pb-3">
              <p className="text-xs text-foreground-light mb-2">
                {functionCall.description}
              </p>
              <div className="bg-background border border-border rounded p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-foreground-light uppercase tracking-wide">
                    {functionCall.language}
                  </span>
                </div>
                <pre className="text-xs text-foreground overflow-x-auto">
                  <code>{functionCall.code}</code>
                </pre>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

interface Chat {
  id: string
  name: string
  createdAt: Date
  lastMessage?: string
}

interface Memory {
  id: string
  text: string
  createdAt: Date
  lastModified: Date
}

interface FunctionCall {
  id: string
  name: string
  description: string
  code: string
  language: string
}

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  createdAt: Date
  functionCalls?: FunctionCall[]
}

interface AIAgentSidebarProps {
  className?: string
}

// Mock messages for demonstration
const MOCK_MESSAGES: Message[] = [
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
    content: 'Can you create a table for storing user profiles with proper indexes?',
    createdAt: new Date(Date.now() - 180000), // 3 minutes ago
  },
  {
    id: '4',
    role: 'assistant' as const,
    content: `I'll create a well-structured user profiles table with optimized indexes for you.`,
    createdAt: new Date(Date.now() - 170000), // 2 minutes 50 seconds ago
    functionCalls: [
      {
        id: 'create_table_1',
        name: 'create_table',
        description: 'Created a user_profiles table with proper schema and indexes',
        language: 'sql',
        code: `-- Create user_profiles table
CREATE TABLE user_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  username TEXT UNIQUE,
  full_name TEXT,
  avatar_url TEXT,
  bio TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for optimal performance
CREATE INDEX idx_user_profiles_user_id ON user_profiles(user_id);
CREATE INDEX idx_user_profiles_username ON user_profiles(username);
CREATE INDEX idx_user_profiles_email ON user_profiles(email);
CREATE INDEX idx_user_profiles_created_at ON user_profiles(created_at);`
      },
      {
        id: 'create_rls_1',
        name: 'enable_rls',
        description: 'Enabled Row Level Security and created policies for the table',
        language: 'sql',
        code: `-- Enable RLS
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own profile
CREATE POLICY "Users can view own profile" ON user_profiles
  FOR SELECT USING (auth.uid() = user_id);

-- Policy: Users can update their own profile  
CREATE POLICY "Users can update own profile" ON user_profiles
  FOR UPDATE USING (auth.uid() = user_id);

-- Policy: Users can insert their own profile
CREATE POLICY "Users can insert own profile" ON user_profiles
  FOR INSERT WITH CHECK (auth.uid() = user_id);`
      }
    ]
  },
  {
    id: '5',
    role: 'user' as const,
    content: 'Can you help me create a RLS policy for user data?',
    createdAt: new Date(Date.now() - 120000), // 2 minutes ago
  },
  {
    id: '6',
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

## Client Implementation

Here's how to use this in your JavaScript/TypeScript code:

\`\`\`typescript
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(url, anonKey)

// This will automatically respect RLS policies
const { data, error } = await supabase
  .from('user_profiles')
  .select('*')
  .eq('user_id', user.id)
\`\`\`

## Key Points

- Use \`auth.uid()\` to get the current user's ID
- Create separate policies for SELECT, INSERT, UPDATE, DELETE  
- Test your policies thoroughly before deploying

Would you like me to help you create a policy for a specific table structure?`,
    createdAt: new Date(Date.now() - 60000), // 1 minute ago
  },
]

// Mock memories for AI assistant
const MOCK_MEMORIES: Memory[] = [
  {
    id: '1',
    text: 'User prefers using Row Level Security (RLS) policies for data protection instead of application-level security.',
    createdAt: new Date(Date.now() - 604800000), // 1 week ago
    lastModified: new Date(Date.now() - 604800000),
  },
  {
    id: '2', 
    text: 'User\'s main project uses TypeScript with Next.js 14 App Router and Supabase for the backend.',
    createdAt: new Date(Date.now() - 345600000), // 4 days ago
    lastModified: new Date(Date.now() - 345600000),
  },
  {
    id: '3',
    text: 'User frequently asks about SQL query optimization and prefers detailed explanations with code examples.',
    createdAt: new Date(Date.now() - 259200000), // 3 days ago  
    lastModified: new Date(Date.now() - 86400000), // 1 day ago
  },
  {
    id: '4',
    text: 'User works with real-time subscriptions and needs help with PostgreSQL triggers and functions.',
    createdAt: new Date(Date.now() - 172800000), // 2 days ago
    lastModified: new Date(Date.now() - 172800000),
  },
  {
    id: '5',
    text: 'User prefers minimal comments in generated code and clean, readable implementations.',
    createdAt: new Date(Date.now() - 86400000), // 1 day ago
    lastModified: new Date(Date.now() - 86400000),
  },
  {
    id: '6',
    text: 'User\'s team uses Shadcn UI components and Tailwind CSS for styling. Follows design system patterns.',
    createdAt: new Date(Date.now() - 43200000), // 12 hours ago
    lastModified: new Date(Date.now() - 43200000),
  },
]

// Extended chat history (includes both open and closed chats)
const ALL_CHATS: Chat[] = [
  // Current open chats
  { id: '1', name: 'Database Optimization', createdAt: new Date(), lastMessage: 'How can I optimize this query?' },
  { id: '2', name: 'Auth Setup', createdAt: new Date(Date.now() - 3600000), lastMessage: 'Help with user authentication' },
  { id: '3', name: 'RLS Policies', createdAt: new Date(Date.now() - 7200000), lastMessage: 'Create Row Level Security policies' },
  
  // Previous chats
  { id: '4', name: 'Plan UI components for AI agent sidebar', createdAt: new Date(Date.now() - 14400000), lastMessage: 'Need to design the sidebar interface' },
  { id: '5', name: 'Identify and list supabase branding', createdAt: new Date(Date.now() - 86400000), lastMessage: 'Looking for brand guidelines' },
  { id: '6', name: 'Database Migration Issues', createdAt: new Date(Date.now() - 172800000), lastMessage: 'Having trouble with migration files' },
  { id: '7', name: 'Edge Functions Deployment', createdAt: new Date(Date.now() - 259200000), lastMessage: 'Deploy function not working' },
  { id: '8', name: 'Storage Bucket Configuration', createdAt: new Date(Date.now() - 345600000), lastMessage: 'Setting up file uploads' },
  { id: '9', name: 'GraphQL API Integration', createdAt: new Date(Date.now() - 432000000), lastMessage: 'Help with GraphQL queries' },
  { id: '10', name: 'Real-time Subscriptions', createdAt: new Date(Date.now() - 518400000), lastMessage: 'Setting up real-time data' },
]

export const AIAgentSidebar = ({ className }: AIAgentSidebarProps) => {
  const router = useRouter()
  const snap = useAiAssistantStateSnapshot()
  const appSnap = useAppStateSnapshot()
  const user = useUser()
  const isUserLoading = useIsUserLoading()
  
  const [width, setWidth] = useState(400)
  const [isDragging, setIsDragging] = useState(false)
  const [inputValue, setInputValue] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [selectedModel, setSelectedModel] = useState(AI_MODELS[0].key)
  const [selectedFunctions, setSelectedFunctions] = useState<string[]>([])
  const [functionSearch, setFunctionSearch] = useState('')
  const [isFunctionDropdownOpen, setIsFunctionDropdownOpen] = useState(false)
  
  // Chat management
  const [openChats, setOpenChats] = useState<Chat[]>([
    { id: 'chat-1', name: 'Database Assistant', createdAt: new Date(), lastMessage: 'Ready to help with your database queries!' },
  ])
  const [activeChatId, setActiveChatId] = useState<string>('chat-1')

  // Assistant API Integration
  const [assistantMessages, setAssistantMessages] = useState<Message[]>([])
  const [assistantLoading, setAssistantLoading] = useState(false)
  const [threadId, setThreadId] = useState<string | null>(null)
  
  // Edit mode state
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null)
  const [editContent, setEditContent] = useState('')
  const [editSelectedFunctions, setEditSelectedFunctions] = useState<string[]>([])
  const [editSelectedModel, setEditSelectedModel] = useState(AI_MODELS[0].key)
  const [editFunctionSearch, setEditFunctionSearch] = useState('')
  const [isEditFunctionDropdownOpen, setIsEditFunctionDropdownOpen] = useState(false)
  
  // Dialog states
  const [isPastChatsDialogOpen, setIsPastChatsDialogOpen] = useState(false)
  const [isEditMemoriesDialogOpen, setIsEditMemoriesDialogOpen] = useState(false)
  
  // Past chats dialog states
  const [chatSearch, setChatSearch] = useState('')
  const [editingChatId, setEditingChatId] = useState<string | null>(null)
  const [editingChatName, setEditingChatName] = useState('')
  const [allChats, setAllChats] = useState<Chat[]>(ALL_CHATS)
  
  // Memories dialog states  
  const [memorySearch, setMemorySearch] = useState('')
  const [editingMemoryId, setEditingMemoryId] = useState<string | null>(null)
  const [editingMemoryText, setEditingMemoryText] = useState('')
  const [memories, setMemories] = useState<Memory[]>(MOCK_MEMORIES)
  
  const sidebarRef = useRef<HTMLDivElement>(null)
  const resizeRef = useRef<HTMLDivElement>(null)
  const scrollAreaRef = useRef<HTMLDivElement>(null)

  // Function management
  const filteredFunctions = DATABASE_FUNCTIONS.filter(func =>
    func.label.toLowerCase().includes(functionSearch.toLowerCase()) ||
    func.category.toLowerCase().includes(functionSearch.toLowerCase()) ||
    func.description.toLowerCase().includes(functionSearch.toLowerCase())
  )

  const selectedFunctionObjects = selectedFunctions.map(key => 
    DATABASE_FUNCTIONS.find(func => func.key === key)
  ).filter(Boolean) as typeof DATABASE_FUNCTIONS

  const addFunction = (functionKey: string) => {
    if (!selectedFunctions.includes(functionKey)) {
      setSelectedFunctions([...selectedFunctions, functionKey])
    }
    setIsFunctionDropdownOpen(false)
    setFunctionSearch('')
  }

  const removeFunction = (functionKey: string) => {
    setSelectedFunctions(selectedFunctions.filter(key => key !== functionKey))
  }

  // Chat management functions
  const activeChat = openChats.find(chat => chat.id === activeChatId)
  
  const switchToChat = (chatId: string) => {
    setActiveChatId(chatId)
    // Clear assistant messages and reset thread when switching chats
    setAssistantMessages([])
    setThreadId(null)
  }
  
  const closeChat = (chatId: string) => {
    const updatedChats = openChats.filter(chat => chat.id !== chatId)
    setOpenChats(updatedChats)
    
    // If closing the active chat, switch to another chat
    if (chatId === activeChatId && updatedChats.length > 0) {
      setActiveChatId(updatedChats[0].id)
    }
  }
  
  const createNewChat = () => {
    const newChat: Chat = {
      id: Date.now().toString(),
      name: 'New Chat',
      createdAt: new Date(),
    }
    setOpenChats([...openChats, newChat])
    setActiveChatId(newChat.id)
    // Clear messages and reset thread for new chat
    setAssistantMessages([])
    setThreadId(null)
  }

  // Edit mode functions
  const editFilteredFunctions = DATABASE_FUNCTIONS.filter(func =>
    func.label.toLowerCase().includes(editFunctionSearch.toLowerCase()) ||
    func.category.toLowerCase().includes(editFunctionSearch.toLowerCase()) ||
    func.description.toLowerCase().includes(editFunctionSearch.toLowerCase())
  )

  const editSelectedFunctionObjects = editSelectedFunctions.map(key => 
    DATABASE_FUNCTIONS.find(func => func.key === key)
  ).filter(Boolean) as typeof DATABASE_FUNCTIONS

  const addEditFunction = (functionKey: string) => {
    if (!editSelectedFunctions.includes(functionKey)) {
      setEditSelectedFunctions([...editSelectedFunctions, functionKey])
    }
    setIsEditFunctionDropdownOpen(false)
    setEditFunctionSearch('')
  }

  const removeEditFunction = (functionKey: string) => {
    setEditSelectedFunctions(editSelectedFunctions.filter(key => key !== functionKey))
  }

  const startEditing = (messageId: string, content: string) => {
    setEditingMessageId(messageId)
    setEditContent(content)
    setEditSelectedFunctions([]) // TODO: Parse existing functions from message if needed
    setEditSelectedModel(selectedModel)
  }

  const cancelEditing = () => {
    setEditingMessageId(null)
    setEditContent('')
    setEditSelectedFunctions([])
    setEditFunctionSearch('')
    setIsEditFunctionDropdownOpen(false)
  }

  const saveEdit = async () => {
    if (!editContent.trim()) return
    
    // TODO: Update the message in the chat history
    // For now, just show a toast
    toast.success('Message updated! (This is a mock response)')
    cancelEditing()
  }

  const handleEditKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      saveEdit()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      cancelEditing()
    }
  }

  // Get current context
  const getContextInfo = () => {
    const path = router.pathname
    if (path.includes('/sql')) return 'SQL Editor'
    if (path.includes('/database')) return 'Database'
    if (path.includes('/auth')) return 'Authentication' 
    if (path.includes('/storage')) return 'Storage'
    return 'Supabase'
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

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
      return () => {
        document.removeEventListener('mousemove', handleMouseMove)
        document.removeEventListener('mouseup', handleMouseUp)
      }
    }
  }, [isDragging, handleMouseMove, handleMouseUp])

  // Handle clicking outside to cancel edit mode
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!editingMessageId || !sidebarRef.current) return
      
      const target = event.target as Node
      
      // Don't cancel if clicking within the sidebar
      if (sidebarRef.current.contains(target)) return
      
      // Don't cancel if clicking on dropdown menu items (Radix UI portals)
      const clickedElement = target as Element
      if (clickedElement.closest && (
        clickedElement.closest('[data-radix-popper-content-wrapper]') ||
        clickedElement.closest('[data-radix-dropdown-menu-content]') ||
        clickedElement.closest('[data-radix-tooltip-content]') ||
        clickedElement.closest('.radix-dropdown-menu') ||
        clickedElement.closest('.radix-tooltip')
      )) {
        return
      }
      
      cancelEditing()
    }

    if (editingMessageId) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => {
        document.removeEventListener('mousedown', handleClickOutside)
      }
    }
  }, [editingMessageId])

  // Initialize thread for the chat
  const initializeThread = async () => {
    if (threadId) {
      console.log('Using existing thread:', threadId)
      return threadId
    }

    console.log('Creating new thread...')
    console.log('User loading state:', isUserLoading)
    console.log('User object:', user)
    console.log('User ID:', user?.id)
    console.log('🧪 TESTING MODE: Using hardcoded project values')
    console.log('Test project ref:', TEST_PROJECT_REF)
    console.log('Test connectionString: ***REDACTED***')
    
    // TESTING BYPASS - Use fallback user ID when authentication fails
    let userId = user?.id
    if (!userId) {
      userId = 'test-user-' + Date.now() // Generate a unique test user ID
      console.log('🧪 TESTING MODE: Using fallback user ID:', userId)
    }
    
    try {
      const response = await fetch(`/api/ai/assistant/thread?userId=${userId}&projectRef=${TEST_PROJECT_REF}&connectionString=${encodeURIComponent(TEST_CONNECTION_STRING)}`)
      console.log('Thread creation response:', {
        status: response.status,
        statusText: response.statusText,
        ok: response.ok,
        url: response.url,
        userId: userId,
        projectRef: TEST_PROJECT_REF,
        connectionString: 'test connection (redacted)'
      })
      
      if (!response.ok) {
        const errorText = await response.text()
        console.error('Thread creation failed:', {
          status: response.status,
          statusText: response.statusText,
          errorText
        })
        throw new Error(`Failed to create thread: ${response.status} ${response.statusText} - ${errorText}`)
      }
      
      const data = await response.json()
      console.log('Thread creation success:', data)
      setThreadId(data.threadId)
      return data.threadId
    } catch (error) {
      console.error('Error creating thread:', error)
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      toast.error(`Failed to initialize chat: ${errorMessage}`)
      return null
    }
  }

  // Handle message sending to Assistant API
  const handleSendMessage = async () => {
    if (!inputValue.trim() || isLoading || assistantLoading) return

    console.log('Starting message send process...')
    console.log('🧪 TESTING MODE: Using hardcoded project values for message')
    
    setAssistantLoading(true)
    try {
      // Initialize thread if needed
      console.log('Initializing thread...')
      const currentThreadId = await initializeThread()
      if (!currentThreadId) {
        console.error('Failed to get thread ID, aborting message send')
        return
      }
      console.log('Using thread ID:', currentThreadId)

      // Add user message to UI immediately
      const userMessage: Message = {
        id: Date.now().toString(),
        role: 'user',
        content: inputValue.trim(),
        createdAt: new Date(),
      }
      
      setAssistantMessages(prev => [...prev, userMessage])
      const messageContent = inputValue.trim()
      setInputValue('')

      // TESTING BYPASS - Use fallback user ID when authentication fails
      let userId = user?.id
      if (!userId) {
        userId = 'test-user-' + Date.now() // Generate a unique test user ID
        console.log('🧪 TESTING MODE: Using fallback user ID for message:', userId)
      }

      // Prepare request payload
      const requestPayload = {
        message: messageContent,
        threadId: currentThreadId,
        functions: selectedFunctions.length > 0 ? selectedFunctions : undefined,
        projectRef: TEST_PROJECT_REF,
        connectionString: TEST_CONNECTION_STRING,
        userId: userId,
      }
      console.log('Sending message with payload:', {
        ...requestPayload,
        connectionString: 'test connection (redacted)'
      })

      // Send to Assistant API
      const response = await fetch('/api/ai/assistant/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestPayload),
      })

      console.log('Assistant API response:', {
        status: response.status,
        statusText: response.statusText,
        ok: response.ok,
        url: response.url
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error('Assistant API failed:', {
          status: response.status,
          statusText: response.statusText,
          errorText
        })
        throw new Error(`Failed to send message: ${response.status} ${response.statusText} - ${errorText}`)
      }
      
      const data = await response.json()
      console.log('Assistant API success response:', data)
      
      // Add assistant response to UI
      const assistantMessage: Message = {
        id: data.messageId || (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.response || data.content || 'Sorry, I encountered an error processing your request.',
        createdAt: new Date(),
        functionCalls: data.toolCalls ? data.toolCalls.map((tool: any) => ({
          id: tool.id,
          name: tool.function.name,
          description: `Executed ${tool.function.name}`,
          code: JSON.stringify(tool.function.arguments, null, 2),
          language: 'json'
        })) : undefined,
      }
      
      console.log('Adding assistant message to UI:', assistantMessage)
      setAssistantMessages(prev => [...prev, assistantMessage])
      
    } catch (error) {
      console.error('Error sending message:', error)
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      toast.error(`Failed to send message: ${errorMessage}`)
    } finally {
      setAssistantLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  const handleClose = () => {
    snap.closeAssistant()
  }

  const handleSettings = () => {
    router.push('/account/ai-agent-settings')
  }

  // Helper functions for date grouping
  const getRelativeDate = (date: Date) => {
    const now = new Date()
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60)
    
    if (diffInHours < 24) return 'Today'
    if (diffInHours < 48) return 'Yesterday'
    if (diffInHours < 168) return 'This Week' // 7 days
    if (diffInHours < 720) return 'This Month' // 30 days
    return 'Older'
  }

  const groupChatsByDate = (chats: Chat[]) => {
    const groups: { [key: string]: Chat[] } = {}
    
    chats.forEach(chat => {
      const group = getRelativeDate(chat.createdAt)
      if (!groups[group]) groups[group] = []
      groups[group].push(chat)
    })
    
    // Sort groups by recency
    const sortedGroups: { [key: string]: Chat[] } = {}
    const order = ['Today', 'Yesterday', 'This Week', 'This Month', 'Older']
    
    order.forEach(group => {
      if (groups[group]) {
        sortedGroups[group] = groups[group].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      }
    })
    
    return sortedGroups
  }

  // Chat management functions
  const filteredChats = allChats.filter(chat =>
    chat.name.toLowerCase().includes(chatSearch.toLowerCase()) ||
    (chat.lastMessage && chat.lastMessage.toLowerCase().includes(chatSearch.toLowerCase()))
  )

  const startEditingChat = (chatId: string, currentName: string) => {
    setEditingChatId(chatId)
    setEditingChatName(currentName)
  }

  const saveEditingChat = () => {
    if (editingChatId && editingChatName.trim()) {
      setAllChats(prev => prev.map(chat => 
        chat.id === editingChatId 
          ? { ...chat, name: editingChatName.trim() }
          : chat
      ))
      
      // Also update openChats if this chat is open
      setOpenChats(prev => prev.map(chat =>
        chat.id === editingChatId
          ? { ...chat, name: editingChatName.trim() }
          : chat
      ))
    }
    setEditingChatId(null)
    setEditingChatName('')
  }

  const cancelEditingChat = () => {
    setEditingChatId(null)
    setEditingChatName('')
  }

  const deleteChat = (chatId: string) => {
    setAllChats(prev => prev.filter(chat => chat.id !== chatId))
    
    // Remove from open chats if it exists there
    if (openChats.some(chat => chat.id === chatId)) {
      closeChat(chatId)
    }
  }

  const openChatFromHistory = (chat: Chat) => {
    // Add to open chats if not already open
    if (!openChats.some(openChat => openChat.id === chat.id)) {
      setOpenChats(prev => [...prev, chat])
    }
    
    // Switch to this chat
    switchToChat(chat.id)
    
    // Close the dialog
    setIsPastChatsDialogOpen(false)
  }

  // Memory management functions
  const filteredMemories = memories.filter(memory =>
    memory.text.toLowerCase().includes(memorySearch.toLowerCase())
  )

  const startEditingMemory = (memoryId: string, currentText: string) => {
    setEditingMemoryId(memoryId)
    setEditingMemoryText(currentText)
  }

  const saveEditingMemory = () => {
    if (editingMemoryId && editingMemoryText.trim()) {
      setMemories(prev => prev.map(memory =>
        memory.id === editingMemoryId
          ? { ...memory, text: editingMemoryText.trim(), lastModified: new Date() }
          : memory
      ))
    }
    setEditingMemoryId(null)
    setEditingMemoryText('')
  }

  const cancelEditingMemory = () => {
    setEditingMemoryId(null)
    setEditingMemoryText('')
  }

  const deleteMemory = (memoryId: string) => {
    setMemories(prev => prev.filter(memory => memory.id !== memoryId))
  }

  const addNewMemory = () => {
    const newMemory: Memory = {
      id: Date.now().toString(),
      text: 'New memory...',
      createdAt: new Date(),
      lastModified: new Date(),
    }
    setMemories(prev => [newMemory, ...prev])
    startEditingMemory(newMemory.id, newMemory.text)
  }

  if (!snap.open) return null



  return (
    <AnimatePresence>
      <motion.div
        ref={sidebarRef}
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
        className={cn(
          'flex h-full bg-background',
          className
        )}
      >
        {/* Sidebar Content */}
        <div className="flex flex-col w-full">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-border">
            {/* Chat Tabs - Left Side */}
            <div className="flex items-center gap-1 flex-1 min-w-0">
              <div className="flex items-center gap-1 overflow-x-auto max-w-full">
                {openChats.map((chat) => (
                  <div
                    key={chat.id}
                    className={cn(
                      'flex items-center gap-1 px-2 py-1 rounded text-xs border transition-colors cursor-pointer group',
                      chat.id === activeChatId
                        ? 'bg-surface-200 border-border-strong text-foreground flex-shrink-0'
                        : 'bg-surface-100 border-border text-foreground-light hover:bg-surface-200 hover:text-foreground min-w-0 flex-shrink'
                    )}
                    onClick={() => switchToChat(chat.id)}
                  >
                    <span 
                      className={cn(
                        'truncate',
                        chat.id === activeChatId 
                          ? 'max-w-[120px]' 
                          : 'max-w-[60px]'
                      )} 
                      title={chat.name}
                    >
                      {chat.name}
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        closeChat(chat.id)
                      }}
                      className="opacity-0 group-hover:opacity-100 hover:text-foreground transition-opacity p-0.5 rounded flex-shrink-0"
                      disabled={openChats.length === 1}
                    >
                      <X size={10} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
            
            {/* Controls - Right Side */}
            <div className="flex items-center gap-1 flex-shrink-0">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button 
                    type="text" 
                    size="tiny" 
                    icon={<ChevronDown size={14} />}
                  >
                    Options
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={createNewChat}>New Chat</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setIsPastChatsDialogOpen(true)}>View Past Chats</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setIsEditMemoriesDialogOpen(true)}>Edit Memories</DropdownMenuItem>
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
          <ScrollArea ref={scrollAreaRef} className="flex-1 p-4">
            <div className="space-y-4">
              {/* Show assistant messages */}
              {assistantMessages.length > 0 ? (
                assistantMessages.map((message) => (
                  <div key={message.id} className="w-full px-2">
                  {message.role === 'user' ? (
                      <div className="bg-surface-200 text-foreground rounded-lg px-4 py-3 mb-2 ml-0">
                        <div className="whitespace-pre-wrap text-sm">{message.content}</div>
                        <div className="text-xs opacity-70 mt-2">
                          {message.createdAt.toLocaleTimeString([], { 
                            hour: '2-digit', 
                            minute: '2-digit' 
                          })}
                        </div>
                      </div>
                  ) : (
                    <div className="text-foreground mb-4">
                      <EnhancedMarkdown 
                        content={message.content}
                        className="text-sm prose-sm max-w-none"
                        extLinks={true}
                      />
                      
                      {/* Function Calls */}
                      {message.functionCalls && message.functionCalls.length > 0 && (
                        <div className="mt-3">
                          {message.functionCalls.map((functionCall) => (
                            <FunctionCallComponent 
                              key={functionCall.id} 
                              functionCall={functionCall} 
                            />
                          ))}
                        </div>
                      )}
                      
                      <div className="text-xs opacity-70 mt-2">
                        {message.createdAt.toLocaleTimeString([], { 
                          hour: '2-digit', 
                          minute: '2-digit' 
                        })}
                      </div>
                    </div>
                  )}
                </div>
              ))
              ) : (
                // Empty state
                <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
                  <Bot size={48} className="text-muted-foreground/50 mb-4" />
                  <h3 className="text-lg font-medium text-foreground mb-2">Database Assistant</h3>
                  <p className="text-sm text-muted-foreground mb-4 max-w-sm">
                    I'm your AI database assistant. I can help you with SQL queries, table schemas, and database operations.
                  </p>
                  <div className="text-xs text-muted-foreground space-y-1">
                    <p>Try asking me to:</p>
                    <p>• "Show me all tables in the database"</p>
                    <p>• "Get the schema for the users table"</p>
                    <p>• "Run a query to find active users"</p>
                        </div>
                      </div>
              )}
              
              {(isLoading || assistantLoading) && (
                <div className="w-full px-4">
                  <div className="text-foreground mb-4">
                    <div className="flex space-x-1">
                      <div className="w-2 h-2 bg-foreground-light rounded-full animate-bounce"></div>
                      <div className="w-2 h-2 bg-foreground-light rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                      <div className="w-2 h-2 bg-foreground-light rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>

          {/* Footer Input */}
          <div className="p-4 border-t border-border">
            <div className="space-y-3">
                            {/* Function Selector and Tags */}
              <div className="flex items-center gap-2 flex-wrap">
                <DropdownMenu open={isFunctionDropdownOpen} onOpenChange={setIsFunctionDropdownOpen}>
                  <DropdownMenuTrigger asChild>
                    <Button
                      type="outline"
                      size="tiny"
                      iconRight={<ChevronDown size={12} />}
                      disabled={isLoading || assistantLoading}
                      className="text-xs h-7"
                    >
                      Add Function
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-80">
                    {/* Search Input */}
                    <div className="p-2 border-b border-border">
                      <input
                        type="text"
                        placeholder="Search functions..."
                        value={functionSearch}
                        onChange={(e) => setFunctionSearch(e.target.value)}
                        className="w-full px-2 py-1 text-sm bg-transparent border border-border rounded focus:outline-none focus:border-brand-600"
                        autoFocus
                      />
                    </div>
                    
                    {/* Function List */}
                    <div className="max-h-64 overflow-y-auto">
                      {filteredFunctions.length === 0 ? (
                        <div className="p-2 text-sm text-foreground-light">
                          No functions found
                        </div>
                      ) : (
                        filteredFunctions.map((func) => (
                          <Tooltip key={func.key} delayDuration={500}>
                            <TooltipTrigger asChild>
                              <DropdownMenuItem
                                onClick={() => addFunction(func.key)}
                                className="cursor-pointer p-3"
                                disabled={selectedFunctions.includes(func.key)}
                              >
                                <div className="flex items-center justify-between w-full">
                                  <span className="font-medium text-sm">{func.label}</span>
                                  <span className="text-xs text-foreground-light bg-surface-100 px-1.5 py-0.5 rounded">
                                    {func.category}
                                  </span>
                                </div>
                              </DropdownMenuItem>
                            </TooltipTrigger>
                            <TooltipContent side="left">
                              <p className="text-xs max-w-48">{func.description}</p>
                            </TooltipContent>
                          </Tooltip>
                        ))
                      )}
                    </div>
                  </DropdownMenuContent>
                </DropdownMenu>

                {/* Selected Functions Tags - Inline */}
                {selectedFunctionObjects.map((func) => (
                  <div
                    key={func.key}
                    className="inline-flex items-center gap-1 bg-surface-100 text-foreground-light px-2 py-1 rounded-md text-xs"
                  >
                    <span>{func.label}</span>
                    <button
                      onClick={() => removeFunction(func.key)}
                      className="hover:text-foreground ml-1"
                      disabled={isLoading || assistantLoading}
                    >
                      <X size={12} />
                    </button>
                  </div>
                ))}
              </div>

              {/* Separator only if functions are selected */}
              {selectedFunctionObjects.length > 0 && <Separator />}
              
              {/* Message Input Container */}
              <div className="relative">
                <Textarea
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Type your question... (🧪 Testing mode - auth bypassed)"
                  className="min-h-[80px] resize-none pr-20 pb-12"
                  disabled={isLoading || assistantLoading}
                />
                
                {/* AI Model Dropdown - Bottom Left */}
                <div className="absolute bottom-2 left-2">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        type="outline"
                        size="tiny"
                        iconRight={<ChevronDown size={12} />}
                        disabled={isLoading || assistantLoading}
                        className="text-xs h-7"
                      >
                        {AI_MODELS.find(model => model.key === selectedModel)?.label}
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="w-48">
                      {AI_MODELS.map((model) => (
                        <Tooltip key={model.key} delayDuration={500}>
                          <TooltipTrigger asChild>
                            <DropdownMenuItem
                              onClick={() => setSelectedModel(model.key)}
                              className="cursor-pointer"
                            >
                              <span className="font-medium">{model.label}</span>
                            </DropdownMenuItem>
                          </TooltipTrigger>
                          <TooltipContent side="right">
                            <p className="text-xs">{model.description}</p>
                          </TooltipContent>
                        </Tooltip>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                
                {/* Send Button - Bottom Right */}
                <div className="absolute bottom-2 right-2">
                  <Button
                    type="primary"
                    size="tiny"
                    onClick={handleSendMessage}
                    loading={isLoading || assistantLoading}
                    disabled={!inputValue.trim()}
                    className="h-7"
                  >
                    Send
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
      
      {/* View Past Chats Dialog */}
      <Dialog open={isPastChatsDialogOpen} onOpenChange={setIsPastChatsDialogOpen}>
        <DialogContent className="sm:max-w-[500px] h-[600px] flex flex-col">
          <DialogHeader>
            <DialogTitle>Past Chats</DialogTitle>
            <DialogDescription>
              View and manage your previous chat conversations.
            </DialogDescription>
          </DialogHeader>
          
          <DialogSection className="flex-1 overflow-hidden flex flex-col">
            {/* Search Bar */}
            <div className="mb-4">
              <Input
                placeholder="Search chats..."
                value={chatSearch}
                onChange={(e) => setChatSearch(e.target.value)}
              />
            </div>
            
            {/* Chat List */}
            <ScrollArea className="flex-1">
              <div className="space-y-1">
                {Object.entries(groupChatsByDate(filteredChats)).map(([group, chats]) => (
                  <div key={group}>
                    {/* Group Header */}
                    <div className="px-2 py-1 text-xs font-medium text-foreground-light uppercase tracking-wider">
                      {group}
                    </div>
                    
                    {/* Chat Items */}
                    {chats.map((chat) => (
                      <div
                        key={chat.id}
                        className="group flex items-center justify-between p-2 rounded hover:bg-surface-100 cursor-pointer"
                        onClick={() => !editingChatId ? openChatFromHistory(chat) : undefined}
                      >
                        <div className="flex-1 min-w-0">
                          {editingChatId === chat.id ? (
                            <Input
                              value={editingChatName}
                              onChange={(e) => setEditingChatName(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') saveEditingChat()
                                if (e.key === 'Escape') cancelEditingChat()
                              }}
                              onBlur={saveEditingChat}
                              className="text-sm h-8"
                              autoFocus
                            />
                          ) : (
                            <div className="text-sm font-medium text-foreground truncate">
                              {chat.name}
                            </div>
                          )}
                        </div>
                        
                        {editingChatId !== chat.id && (
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button
                              type="text"
                              size="tiny"
                              icon={<Edit size={14} />}
                              onClick={(e) => {
                                e.stopPropagation()
                                startEditingChat(chat.id, chat.name)
                              }}
                            />
                            <Button
                              type="text"
                              size="tiny"
                              icon={<Trash2 size={14} />}
                              onClick={(e) => {
                                e.stopPropagation()
                                deleteChat(chat.id)
                              }}
                            />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ))}
                
                {filteredChats.length === 0 && (
                  <div className="text-center py-8 text-foreground-light">
                    {chatSearch ? 'No chats found matching your search.' : 'No chat history yet.'}
                  </div>
                )}
              </div>
            </ScrollArea>
            
            {/* New Chat Button */}
            <div className="mt-4 pt-4 border-t border-border">
              <Button
                type="default"
                size="medium"
                icon={<Plus size={16} />}
                onClick={() => {
                  createNewChat()
                  setIsPastChatsDialogOpen(false)
                }}
                className="w-full"
              >
                New Chat
              </Button>
            </div>
          </DialogSection>
        </DialogContent>
      </Dialog>
      
      {/* Edit Memories Dialog */}
      <Dialog open={isEditMemoriesDialogOpen} onOpenChange={setIsEditMemoriesDialogOpen}>
        <DialogContent className="sm:max-w-[600px] h-[700px] flex flex-col">
          <DialogHeader>
            <DialogTitle>Edit Memories</DialogTitle>
            <DialogDescription>
              Manage your AI assistant's memory and stored information.
            </DialogDescription>
          </DialogHeader>
          
          <DialogSection className="flex-1 overflow-hidden flex flex-col">
            {/* Search Bar and Add Button */}
            <div className="flex gap-2 mb-4">
              <div className="flex-1">
                <Input
                  placeholder="Search memories..."
                  value={memorySearch}
                  onChange={(e) => setMemorySearch(e.target.value)}
                />
              </div>
              <Button
                type="default"
                size="medium"
                icon={<Plus size={16} />}
                onClick={addNewMemory}
              >
                Add Memory
              </Button>
            </div>
            
            {/* Memory List */}
            <ScrollArea className="flex-1">
              <div className="space-y-3">
                {filteredMemories.map((memory) => (
                  <div
                    key={memory.id}
                    className="group border border-border rounded-lg p-4 hover:border-border-strong transition-colors"
                  >
                    {editingMemoryId === memory.id ? (
                      /* Edit Mode */
                      <div className="space-y-3">
                        <Textarea
                          value={editingMemoryText}
                          onChange={(e) => setEditingMemoryText(e.target.value)}
                          className="min-h-[80px] resize-none"
                          placeholder="Enter memory text..."
                          autoFocus
                        />
                        <div className="flex justify-end gap-2">
                          <Button
                            type="text"
                            size="tiny"
                            onClick={cancelEditingMemory}
                          >
                            Cancel
                          </Button>
                          <Button
                            type="primary"
                            size="tiny"
                            onClick={saveEditingMemory}
                            disabled={!editingMemoryText.trim()}
                          >
                            Save
                          </Button>
                        </div>
                      </div>
                    ) : (
                      /* Display Mode */
                      <>
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-foreground leading-relaxed">
                              {memory.text}
                            </p>
                            <div className="flex items-center gap-2 mt-2 text-xs text-foreground-light">
                              <span>Created {memory.createdAt.toLocaleDateString()}</span>
                              {memory.lastModified.getTime() !== memory.createdAt.getTime() && (
                                <>
                                  <span>•</span>
                                  <span>Modified {memory.lastModified.toLocaleDateString()}</span>
                                </>
                              )}
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button
                              type="text"
                              size="tiny"
                              icon={<Edit size={14} />}
                              onClick={() => startEditingMemory(memory.id, memory.text)}
                            />
                            <Button
                              type="text"
                              size="tiny"
                              icon={<Trash2 size={14} />}
                              onClick={() => deleteMemory(memory.id)}
                            />
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                ))}
                
                {filteredMemories.length === 0 && (
                  <div className="text-center py-8 text-foreground-light">
                    {memorySearch ? 'No memories found matching your search.' : 'No memories stored yet.'}
                  </div>
                )}
              </div>
            </ScrollArea>
          </DialogSection>
        </DialogContent>
      </Dialog>
    </AnimatePresence>
  )
} 