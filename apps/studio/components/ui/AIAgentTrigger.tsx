import { Bot, MessageSquare, Sparkles } from 'lucide-react'
import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'

import { useAiAssistantStateSnapshot } from 'state/ai-assistant-state'
import { Button, cn, Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from 'ui'

interface AIAgentTriggerProps {
  className?: string
}

export const AIAgentTrigger = ({ className }: AIAgentTriggerProps) => {
  const router = useRouter()
  const snap = useAiAssistantStateSnapshot()
  const [isAnimating, setIsAnimating] = useState(false)

  // Determine context based on current route
  const getContextInfo = () => {
    const path = router.pathname
    if (path.includes('/sql')) return { context: 'SQL Editor', icon: MessageSquare }
    if (path.includes('/database')) return { context: 'Database', icon: Bot }
    if (path.includes('/auth')) return { context: 'Authentication', icon: Bot }
    if (path.includes('/storage')) return { context: 'Storage', icon: Bot }
    return { context: 'Supabase', icon: Sparkles }
  }

  const { context, icon: ContextIcon } = getContextInfo()

  // Animate the button periodically to draw attention
  useEffect(() => {
    if (!snap.open) {
      const interval = setInterval(() => {
        setIsAnimating(true)
        setTimeout(() => setIsAnimating(false), 2000)
      }, 30000) // Every 30 seconds

      return () => clearInterval(interval)
    }
  }, [snap.open])

  const handleClick = () => {
    snap.toggleAssistant()
  }

  if (snap.open) return null

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="primary"
            size="medium"
            onClick={handleClick}
            className={cn(
              'fixed bottom-6 right-6 z-50 h-14 w-14 rounded-full shadow-lg transition-all duration-300 hover:scale-105',
              'bg-brand-600 hover:bg-brand-700 border-brand-600 hover:border-brand-700',
              isAnimating && 'animate-pulse',
              className
            )}
            icon={<ContextIcon size={20} />}
          />
        </TooltipTrigger>
        <TooltipContent side="left" className="max-w-xs">
          <p className="text-sm font-medium">AI Assistant</p>
          <p className="text-xs text-foreground-light">Get help with {context}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
} 