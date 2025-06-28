export interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  createdAt: Date
}

export interface AIAssistantConfig {
  apiKey: string
  organizationId?: string
} 