import { AnimatePresence, motion } from 'framer-motion'
import { Bot, ChevronDown, GripVertical, Settings, X } from 'lucide-react'
import { useRouter } from 'next/router'
import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'

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

export const AIAgentSidebar = ({ className }: AIAgentSidebarProps) => {
  const router = useRouter()
  const snap = useAiAssistantStateSnapshot()
  const appSnap = useAppStateSnapshot()
  
  const [width, setWidth] = useState(400)
  const [isDragging, setIsDragging] = useState(false)
  const [inputValue, setInputValue] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  
  const sidebarRef = useRef<HTMLDivElement>(null)
  const resizeRef = useRef<HTMLDivElement>(null)
  const scrollAreaRef = useRef<HTMLDivElement>(null)

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
          <ScrollArea ref={scrollAreaRef} className="flex-1 p-4">
            <div className="space-y-4">
              {MOCK_MESSAGES.map((message) => (
                <div
                  key={message.id}
                  className={cn(
                    'flex gap-3',
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
                      'max-w-[80%] rounded-lg px-3 py-2 text-sm',
                      message.role === 'user'
                        ? 'bg-brand-600 text-white ml-auto'
                        : 'bg-surface-200 text-foreground'
                    )}
                  >
                    <div className="whitespace-pre-wrap">{message.content}</div>
                    <div className="text-xs opacity-70 mt-1">
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
                  <div className="bg-surface-200 rounded-lg px-3 py-2">
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
                  onClick={() => setInputValue('Help me debug this error')}
                  disabled={isLoading}
                >
                  Debug Error
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