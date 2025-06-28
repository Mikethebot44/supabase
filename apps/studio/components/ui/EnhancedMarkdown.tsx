"use client"

import React from "react"
import { Markdown } from "components/interfaces/Markdown"
import { CodeBlockWithCopy } from "./CodeBlock"
import { CodeBlockLang } from "ui"

interface EnhancedMarkdownProps {
  content: string
  className?: string
  extLinks?: boolean
}

export const EnhancedMarkdown = ({ content, className, extLinks }: EnhancedMarkdownProps) => {
  const components = {
    pre: ({ children, ...props }: any) => {
      // Extract code and language using the exact same pattern as MessageMarkdown
      const language = children[0]?.props?.className?.replace("language-", "") || "text"
      const rawContent = children[0]?.props?.children?.[0] || children[0]?.props?.children || ""
      
      // Handle the content
      const code = typeof rawContent === "string" ? rawContent : 
                  Array.isArray(rawContent) ? rawContent.join("") :
                  rawContent?.toString?.() || ""

      // Check if it's a valid CodeBlockLang
      const validLanguages: CodeBlockLang[] = [
        "js", "jsx", "sql", "py", "bash", "ts", "dart", "json", "csharp", 
        "kotlin", "curl", "http", "php", "python", "go"
      ]
      
      const codeLanguage = validLanguages.includes(language as CodeBlockLang) 
        ? (language as CodeBlockLang) 
        : "js"

      return (
        <CodeBlockWithCopy
          code={code}
          language={codeLanguage}
          showHeader={true}
          className="my-4"
        />
      )
    },
    code: ({ children, className, ...props }: any) => {
      // Handle inline code
      if (!className) {
        return (
          <code
            className="bg-surface-200 text-foreground px-1.5 py-0.5 rounded text-sm font-mono"
            {...props}
          >
            {children}
          </code>
        )
      }
      
      // Handle code blocks (fallback)
      return <code {...props}>{children}</code>
    }
  }

  return (
    <Markdown
      content={content}
      className={className}
      extLinks={extLinks}
      components={components}
    />
  )
} 