"use client"

import { cn, CodeBlock as UICodeBlock, CodeBlockLang } from "ui"
import React, { useState } from "react"
import { Button } from "ui"
import { Check, Copy } from "lucide-react"

export type CodeBlockProps = {
  children?: React.ReactNode
  className?: string
} & React.HTMLProps<HTMLDivElement>

function CodeBlock({ children, className, ...props }: CodeBlockProps) {
  return (
    <div
      className={cn(
        "not-prose flex w-full flex-col overflow-clip border",
        "border-border bg-surface-100 text-foreground rounded-xl",
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
}

export type CodeBlockGroupProps = React.HTMLAttributes<HTMLDivElement>

function CodeBlockGroup({
  children,
  className,
  ...props
}: CodeBlockGroupProps) {
  return (
    <div
      className={cn("flex items-center justify-between", className)}
      {...props}
    >
      {children}
    </div>
  )
}

export type CodeBlockWithCopyProps = {
  code: string
  language?: CodeBlockLang
  showHeader?: boolean
  className?: string
}

function CodeBlockWithCopy({ 
  code, 
  language = "js", 
  showHeader = true,
  className 
}: CodeBlockWithCopyProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className={cn("w-full", className)}>
      <CodeBlock>
        {showHeader && (
          <CodeBlockGroup className="border-border border-b px-3 py-1.5">
            <div className="flex items-center gap-2">
              {language && (
                <div className="bg-brand-100 text-brand-600 rounded px-1.5 py-0.5 text-xs font-medium">
                  {language.toUpperCase()}
                </div>
              )}
            </div>
            <Button
              type="text"
              size="tiny"
              icon={copied ? <Check className="h-3 w-3 text-brand-600" /> : <Copy className="h-3 w-3" />}
              onClick={handleCopy}
              className="h-6 w-6"
            />
          </CodeBlockGroup>
        )}
        <div className="p-0" spellCheck={false}>
          <UICodeBlock
            language={language}
            value={code}
            hideCopy={true}
            hideLineNumbers={true}
            className="!border-0 !rounded-none !bg-transparent !m-0"
          />
        </div>
      </CodeBlock>
    </div>
  )
}

export { CodeBlockGroup, CodeBlock, CodeBlockWithCopy } 