import { useState } from 'react'
import AccountLayout from 'components/layouts/AccountLayout/AccountLayout'
import { AccountSettingsLayout } from 'components/layouts/AccountLayout/AccountSettingsLayout'
import AppLayout from 'components/layouts/AppLayout/AppLayout'
import DefaultLayout from 'components/layouts/DefaultLayout'
import OrganizationLayout from 'components/layouts/OrganizationLayout'
import Panel from 'components/ui/Panel'
import { 
  Button,
  Switch,
  Input,
  Separator
} from 'ui'
import { Brain, MessageSquare, Zap, Database, Shield, Clock, Trash2, Plus } from 'lucide-react'
import type { NextPageWithLayout } from 'types'

const AIAgentSettings: NextPageWithLayout = () => {
  return <AIAgentSettingsCard />
}

AIAgentSettings.getLayout = (page) => (
  <AppLayout>
    <DefaultLayout headerTitle="Account">
      <OrganizationLayout>
        <AccountLayout title="AI Agent Settings">
          <AccountSettingsLayout>{page}</AccountSettingsLayout>
        </AccountLayout>
      </OrganizationLayout>
    </DefaultLayout>
  </AppLayout>
)

export default AIAgentSettings

const AIAgentSettingsCard = () => {
  const [defaultModel, setDefaultModel] = useState('gpt-4')
  const [autoSaveChats, setAutoSaveChats] = useState(true)
  const [enableMemories, setEnableMemories] = useState(true)
  const [contextWindow, setContextWindow] = useState('4000')
  const [maxMemories, setMaxMemories] = useState('50')
  const [enableKeyboardShortcuts, setEnableKeyboardShortcuts] = useState(true)
  const [enableAnalytics, setEnableAnalytics] = useState(true)
  const [chatRetentionDays, setChatRetentionDays] = useState('30')

  return (
    <article className="space-y-6">
      {/* AI Model Preferences */}
      <Panel>
        <Panel.Content>
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <Brain className="h-5 w-5 text-foreground-light" />
              <div>
                <h3 className="text-lg font-medium">AI Model Preferences</h3>
                <p className="text-sm text-foreground-light">Configure your default AI model and behavior settings</p>
              </div>
            </div>

            <Separator />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-3">
                <label htmlFor="default-model" className="text-sm font-medium">Default AI Model</label>
                <select
                  id="default-model"
                  value={defaultModel}
                  onChange={(e) => setDefaultModel(e.target.value)}
                  className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground"
                >
                  <option value="gpt-4">GPT-4 - Most capable, slower</option>
                  <option value="gpt-3.5-turbo">GPT-3.5 Turbo - Fast and efficient</option>
                  <option value="claude-3-sonnet">Claude 3 Sonnet - Balanced performance</option>
                  <option value="claude-3-haiku">Claude 3 Haiku - Fastest responses</option>
                </select>
              </div>

              <div className="space-y-3">
                <label htmlFor="context-window" className="text-sm font-medium">Context Window (tokens)</label>
                <Input
                  id="context-window"
                  type="number"
                  value={contextWindow}
                  onChange={(e) => setContextWindow(e.target.value)}
                />
                <p className="text-xs text-foreground-light">Maximum number of tokens to include in context</p>
              </div>
            </div>
          </div>
        </Panel.Content>
      </Panel>

      {/* Chat Management */}
      <Panel>
        <Panel.Content>
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <MessageSquare className="h-5 w-5 text-foreground-light" />
              <div>
                <h3 className="text-lg font-medium">Chat Management</h3>
                <p className="text-sm text-foreground-light">Control how your conversations are saved and managed</p>
              </div>
            </div>

            <Separator />

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <label htmlFor="auto-save-chats" className="text-sm font-medium">Auto-save conversations</label>
                  <p className="text-sm text-foreground-light">Automatically save chat history for future reference</p>
                </div>
                <Switch
                  id="auto-save-chats"
                  checked={autoSaveChats}
                  onCheckedChange={setAutoSaveChats}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-3">
                  <label htmlFor="chat-retention" className="text-sm font-medium">Chat retention (days)</label>
                  <select
                    id="chat-retention"
                    value={chatRetentionDays}
                    onChange={(e) => setChatRetentionDays(e.target.value)}
                    className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground"
                  >
                    <option value="7">7 days</option>
                    <option value="30">30 days</option>
                    <option value="90">90 days</option>
                    <option value="365">1 year</option>
                    <option value="0">Keep forever</option>
                  </select>
                </div>

                <div className="space-y-3">
                  <label className="text-sm font-medium">Chat Statistics</label>
                  <div className="text-sm text-foreground-light space-y-1">
                    <p>Total conversations: 47</p>
                    <p>Messages sent: 342</p>
                    <p>Storage used: 2.3 MB</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Panel.Content>
      </Panel>

      {/* Memory Management */}
      <Panel>
        <Panel.Content>
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <Database className="h-5 w-5 text-foreground-light" />
              <div>
                <h3 className="text-lg font-medium">Memory Management</h3>
                <p className="text-sm text-foreground-light">Configure how the AI learns from your interactions</p>
              </div>
            </div>

            <Separator />

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <label htmlFor="enable-memories" className="text-sm font-medium">Enable AI memories</label>
                  <p className="text-sm text-foreground-light">Allow the AI to remember your preferences and past interactions</p>
                </div>
                <Switch
                  id="enable-memories"
                  checked={enableMemories}
                  onCheckedChange={setEnableMemories}
                />
              </div>

              {enableMemories && (
                <div className="space-y-4 pt-4 border-t border-border">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-3">
                      <label htmlFor="max-memories" className="text-sm font-medium">Maximum memories</label>
                      <Input
                        id="max-memories"
                        type="number"
                        value={maxMemories}
                        onChange={(e) => setMaxMemories(e.target.value)}
                      />
                    </div>

                    <div className="space-y-3">
                      <label className="text-sm font-medium">Memory Statistics</label>
                      <div className="text-sm text-foreground-light space-y-1">
                        <p>Active memories: 23</p>
                        <p>Last updated: 2 hours ago</p>
                        <p>Storage used: 145 KB</p>
                      </div>
                    </div>
                  </div>

                  <div className="border border-border rounded-md p-4 bg-surface-100">
                    <div className="flex items-center gap-2">
                      <Shield className="h-4 w-4 text-foreground-light" />
                      <p className="text-sm text-foreground-light">
                        Memories are stored locally and never shared. You can view and edit them in the AI agent sidebar.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </Panel.Content>
      </Panel>

      {/* System Preferences */}
      <Panel>
        <Panel.Content>
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <Clock className="h-5 w-5 text-foreground-light" />
              <div>
                <h3 className="text-lg font-medium">System Preferences</h3>
                <p className="text-sm text-foreground-light">General settings and preferences</p>
              </div>
            </div>

            <Separator />

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <label htmlFor="keyboard-shortcuts" className="text-sm font-medium">Enable keyboard shortcuts</label>
                  <p className="text-sm text-foreground-light">Use Cmd+Shift+A to open AI agent</p>
                </div>
                <Switch
                  id="keyboard-shortcuts"
                  checked={enableKeyboardShortcuts}
                  onCheckedChange={setEnableKeyboardShortcuts}
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <label htmlFor="enable-analytics" className="text-sm font-medium">Usage analytics</label>
                  <p className="text-sm text-foreground-light">Help improve the AI agent by sharing anonymous usage data</p>
                </div>
                <Switch
                  id="enable-analytics"
                  checked={enableAnalytics}
                  onCheckedChange={setEnableAnalytics}
                />
              </div>
            </div>
          </div>
        </Panel.Content>
      </Panel>

      {/* Data Management */}
      <Panel>
        <Panel.Content>
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <Trash2 className="h-5 w-5 text-foreground-light" />
              <div>
                <h3 className="text-lg font-medium">Data Management</h3>
                <p className="text-sm text-foreground-light">Manage your AI agent data and preferences</p>
              </div>
            </div>

            <Separator />

            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Button type="outline" size="medium">
                  Export Chat History
                </Button>
                <Button type="outline" size="medium">
                  Export Memories
                </Button>
                <Button type="outline" size="medium">
                  Clear Chat History
                </Button>
                <Button type="danger" size="medium">
                  Reset All Settings
                </Button>
              </div>

              <div className="border border-border rounded-md p-4 bg-surface-100">
                <p className="text-sm text-foreground-light">
                  These actions cannot be undone. Please make sure to export your data before clearing or resetting.
                </p>
              </div>
            </div>
          </div>
        </Panel.Content>
      </Panel>
    </article>
  )
} 