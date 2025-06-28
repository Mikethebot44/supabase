import { AnimatePresence, motion } from 'framer-motion'
import { Bot, ChevronDown, GripVertical, Settings, X } from 'lucide-react'
import { useRouter } from 'next/router'
import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'

import { Markdown } from 'components/interfaces/Markdown'
import { useAiAssistantStateSnapshot } from 'state/ai-assistant-state'
import {
  Button,
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

export const AIAgentSidebar = ({ className }: AIAgentSidebarProps) => {
  const router = useRouter()
  const snap = useAiAssistantStateSnapshot()
  const appSnap = useAppStateSnapshot()
  
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
    { id: '1', name: 'Database Optimization', createdAt: new Date(), lastMessage: 'How can I optimize this query?' },
    { id: '2', name: 'Auth Setup', createdAt: new Date(Date.now() - 3600000), lastMessage: 'Help with user authentication' },
    { id: '3', name: 'RLS Policies', createdAt: new Date(Date.now() - 7200000), lastMessage: 'Create Row Level Security policies' },
  ])
  const [activeChatId, setActiveChatId] = useState<string>('1')
  
  // Edit mode state
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null)
  const [editContent, setEditContent] = useState('')
  const [editSelectedFunctions, setEditSelectedFunctions] = useState<string[]>([])
  const [editSelectedModel, setEditSelectedModel] = useState(AI_MODELS[0].key)
  const [editFunctionSearch, setEditFunctionSearch] = useState('')
  const [isEditFunctionDropdownOpen, setIsEditFunctionDropdownOpen] = useState(false)
  
  const sidebarRef = useRef<HTMLDivElement>(null)
  const resizeRef = useRef<HTMLDivElement>(null)
  const scrollAreaRef = useRef<HTMLDivElement>(null)

  // Function management
  const filteredFunctions = SUPABASE_FUNCTIONS.filter(func =>
    func.label.toLowerCase().includes(functionSearch.toLowerCase()) ||
    func.category.toLowerCase().includes(functionSearch.toLowerCase()) ||
    func.description.toLowerCase().includes(functionSearch.toLowerCase())
  )

  const selectedFunctionObjects = selectedFunctions.map(key => 
    SUPABASE_FUNCTIONS.find(func => func.key === key)
  ).filter(Boolean) as typeof SUPABASE_FUNCTIONS

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
  }

  // Edit mode functions
  const editFilteredFunctions = SUPABASE_FUNCTIONS.filter(func =>
    func.label.toLowerCase().includes(editFunctionSearch.toLowerCase()) ||
    func.category.toLowerCase().includes(editFunctionSearch.toLowerCase()) ||
    func.description.toLowerCase().includes(editFunctionSearch.toLowerCase())
  )

  const editSelectedFunctionObjects = editSelectedFunctions.map(key => 
    SUPABASE_FUNCTIONS.find(func => func.key === key)
  ).filter(Boolean) as typeof SUPABASE_FUNCTIONS

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

  // Handle message sending
  const handleSendMessage = async () => {
    if (!inputValue.trim() || isLoading) return

    setIsLoading(true)
    try {
      // Simulate API call delay
      await new Promise(resolve => setTimeout(resolve, 1500))
      toast.success('Message sent! (This is a mock response)')
      setInputValue('')
    } catch (error) {
      toast.error('Failed to send message')
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

  const handleClose = () => {
    snap.closeAssistant()
  }

  const handleSettings = () => {
    appSnap.setShowAiSettingsModal(true)
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
          'fixed right-0 top-12 z-40 flex h-[calc(100vh-3rem)] bg-background border-l border-border shadow-xl',
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
                  <DropdownMenuItem>Clear History</DropdownMenuItem>
                  <DropdownMenuItem>Export Chat</DropdownMenuItem>
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
              {MOCK_MESSAGES.map((message) => (
                <div
                  key={message.id}
                  className="w-full px-2"
                >
                  {message.role === 'user' ? (
                    editingMessageId === message.id ? (
                      // Edit Mode
                      <div className="bg-surface-200 text-foreground rounded-lg p-4 mb-2 ml-0">
                        <div className="space-y-3">
                          {/* Function Selector and Tags */}
                          <div className="flex items-center gap-2 flex-wrap">
                            <DropdownMenu open={isEditFunctionDropdownOpen} onOpenChange={setIsEditFunctionDropdownOpen}>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  type="outline"
                                  size="tiny"
                                  iconRight={<ChevronDown size={12} />}
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
                                    value={editFunctionSearch}
                                    onChange={(e) => setEditFunctionSearch(e.target.value)}
                                    className="w-full px-2 py-1 text-sm bg-transparent border border-border rounded focus:outline-none focus:border-brand-600"
                                    autoFocus
                                  />
                                </div>
                                
                                {/* Function List */}
                                <div className="max-h-64 overflow-y-auto">
                                  {editFilteredFunctions.length === 0 ? (
                                    <div className="p-2 text-sm text-foreground-light">
                                      No functions found
                                    </div>
                                  ) : (
                                    editFilteredFunctions.map((func) => (
                                      <Tooltip key={func.key} delayDuration={500}>
                                        <TooltipTrigger asChild>
                                          <DropdownMenuItem
                                            onClick={() => addEditFunction(func.key)}
                                            className="cursor-pointer p-3"
                                            disabled={editSelectedFunctions.includes(func.key)}
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
                            {editSelectedFunctionObjects.map((func) => (
                              <div
                                key={func.key}
                                className="inline-flex items-center gap-1 bg-surface-100 text-foreground-light px-2 py-1 rounded-md text-xs"
                              >
                                <span>{func.label}</span>
                                <button
                                  onClick={() => removeEditFunction(func.key)}
                                  className="hover:text-foreground ml-1"
                                >
                                  <X size={12} />
                                </button>
                              </div>
                            ))}
                          </div>

                          {/* Separator only if functions are selected */}
                          {editSelectedFunctionObjects.length > 0 && <Separator />}
                          
                          {/* Message Input Container */}
                          <div className="relative">
                            <Textarea
                              value={editContent}
                              onChange={(e) => setEditContent(e.target.value)}
                              onKeyDown={handleEditKeyDown}
                              placeholder="Edit your message..."
                              className="min-h-[80px] resize-none pr-20 pb-12"
                              autoFocus
                            />
                            
                            {/* AI Model Dropdown - Bottom Left */}
                            <div className="absolute bottom-2 left-2">
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button
                                    type="outline"
                                    size="tiny"
                                    iconRight={<ChevronDown size={12} />}
                                    className="text-xs h-7"
                                  >
                                    {AI_MODELS.find(model => model.key === editSelectedModel)?.label}
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="start" className="w-48">
                                  {AI_MODELS.map((model) => (
                                    <Tooltip key={model.key} delayDuration={500}>
                                      <TooltipTrigger asChild>
                                        <DropdownMenuItem
                                          onClick={() => setEditSelectedModel(model.key)}
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
                            
                            {/* Save/Cancel Buttons - Bottom Right */}
                            <div className="absolute bottom-2 right-2 flex gap-1">
                              <Button
                                type="text"
                                size="tiny"
                                onClick={cancelEditing}
                                className="h-7 text-xs"
                              >
                                Cancel
                              </Button>
                              <Button
                                type="primary"
                                size="tiny"
                                onClick={saveEdit}
                                disabled={!editContent.trim()}
                                className="h-7"
                              >
                                Save
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : (
                      // Normal Display Mode
                      <div 
                        className="bg-surface-200 text-foreground rounded-lg px-4 py-3 mb-2 ml-0 cursor-pointer hover:bg-surface-300 transition-colors"
                        onClick={() => startEditing(message.id, message.content)}
                      >
                        <div className="whitespace-pre-wrap text-sm">{message.content}</div>
                        <div className="text-xs opacity-70 mt-2">
                          {message.createdAt.toLocaleTimeString([], { 
                            hour: '2-digit', 
                            minute: '2-digit' 
                          })}
                        </div>
                      </div>
                    )
                  ) : (
                    <div className="text-foreground mb-4">
                      <Markdown 
                        content={message.content}
                        className="text-sm prose-sm max-w-none"
                        extLinks={true}
                      />
                      <div className="text-xs opacity-70 mt-2">
                        {message.createdAt.toLocaleTimeString([], { 
                          hour: '2-digit', 
                          minute: '2-digit' 
                        })}
                      </div>
                    </div>
                  )}
                </div>
              ))}
              
              {isLoading && (
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
                      disabled={isLoading}
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
                      disabled={isLoading}
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
                  placeholder="Type your question..."
                  className="min-h-[80px] resize-none pr-20 pb-12"
                  disabled={isLoading}
                />
                
                {/* AI Model Dropdown - Bottom Left */}
                <div className="absolute bottom-2 left-2">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        type="outline"
                        size="tiny"
                        iconRight={<ChevronDown size={12} />}
                        disabled={isLoading}
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
                    loading={isLoading}
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
    </AnimatePresence>
  )
} 