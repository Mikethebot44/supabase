import { useState } from 'react'
import { useParams } from 'common'
import DefaultLayout from 'components/layouts/DefaultLayout'
import ProjectLayout from 'components/layouts/ProjectLayout/ProjectLayout'
import type { NextPageWithLayout } from 'types'
import { Button, SidePanel, Input, Tabs, cn } from 'ui'
import Table from 'components/to-be-cleaned/Table'
import { Plus, Edit, Trash, ExternalLink } from 'lucide-react'

// Mock data for workflows - in real implementation this would come from API
const mockWorkflows = [
  {
    id: 1,
    name: 'User Registration Webhook',
    table: 'users',
    event: 'INSERT',
    action: 'Webhook',
    actionDetails: 'https://api.example.com/webhook',
    lastRun: '2024-01-15 10:30:00',
    status: 'Active'
  },
  {
    id: 2,
    name: 'Order Confirmation Email',
    table: 'orders',
    event: 'INSERT',
    action: 'Email',
    actionDetails: 'customer_email',
    lastRun: '2024-01-15 09:15:00',
    status: 'Active'
  },
  {
    id: 3,
    name: 'Audit Log Entry',
    table: 'products',
    event: 'UPDATE',
    action: 'Insert into Table',
    actionDetails: 'audit_logs',
    lastRun: '2024-01-14 16:45:00',
    status: 'Inactive'
  }
]

// Mock data for tables - in real implementation this would come from API
const mockTables = [
  { id: 1, name: 'users', schema: 'public' },
  { id: 2, name: 'orders', schema: 'public' },
  { id: 3, name: 'products', schema: 'public' },
  { id: 4, name: 'customers', schema: 'public' },
]

const eventTypes = [
  { value: 'INSERT', label: 'INSERT - When a new row is added' },
  { value: 'UPDATE', label: 'UPDATE - When a row is modified' },
  { value: 'DELETE', label: 'DELETE - When a row is removed' },
]

const emailFields = [
  { value: 'email', label: 'email' },
  { value: 'user_email', label: 'user_email' },
  { value: 'customer_email', label: 'customer_email' },
]

const WorkflowsPage: NextPageWithLayout = () => {
  const { ref } = useParams()
  const [showCreatePanel, setShowCreatePanel] = useState(false)
  const [editingWorkflow, setEditingWorkflow] = useState<any>(null)
  
  // Form state for create/edit workflow
  const [workflowName, setWorkflowName] = useState('')
  const [selectedTable, setSelectedTable] = useState('')
  const [selectedEvent, setSelectedEvent] = useState('')
  const [selectedActionType, setSelectedActionType] = useState('webhook')
  const [webhookUrl, setWebhookUrl] = useState('')
  const [emailRecipient, setEmailRecipient] = useState('')
  const [emailSubject, setEmailSubject] = useState('')
  const [emailBody, setEmailBody] = useState('')
  const [destinationTable, setDestinationTable] = useState('')

  const handleCreateWorkflow = () => {
    setEditingWorkflow(null)
    resetForm()
    setShowCreatePanel(true)
  }

  const handleEditWorkflow = (workflow: any) => {
    setEditingWorkflow(workflow)
    setWorkflowName(workflow.name)
    setSelectedTable(workflow.table)
    setSelectedEvent(workflow.event)
    // Set other form fields based on workflow data
    setShowCreatePanel(true)
  }

  const resetForm = () => {
    setWorkflowName('')
    setSelectedTable('')
    setSelectedEvent('')
    setSelectedActionType('webhook')
    setWebhookUrl('')
    setEmailRecipient('')
    setEmailSubject('')
    setEmailBody('')
    setDestinationTable('')
  }

  const handleSaveWorkflow = () => {
    // In real implementation, this would save to API
    console.log('Saving workflow:', {
      name: workflowName,
      table: selectedTable,
      event: selectedEvent,
      actionType: selectedActionType,
      webhookUrl,
      emailRecipient,
      emailSubject,
      emailBody,
      destinationTable
    })
    setShowCreatePanel(false)
    resetForm()
  }

  const handleDeleteWorkflow = (workflowId: number) => {
    // In real implementation, this would delete via API
    console.log('Deleting workflow:', workflowId)
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="border-b border-default bg-studio">
        <div className="flex items-center justify-between px-6 py-4">
          <div>
            <h1 className="text-xl text-foreground mb-2">Database Workflows</h1>
            <p className="text-sm text-foreground-light mb-3">
              Create automated workflows triggered by database events
            </p>
            <Button
              type="default"
              size="tiny"
              icon={<ExternalLink size={14} />}
            >
              View documentation
            </Button>
          </div>
          <Button
            type="primary"
            icon={<Plus />}
            onClick={handleCreateWorkflow}
          >
            New Workflow
          </Button>
        </div>
      </div>

      {/* Workflows Table */}
      <div className="flex-1 p-6">
        <div className="bg-surface-100 border border-default rounded-md overflow-hidden">
          <Table
            head={[
              <Table.th key="name">Name</Table.th>,
              <Table.th key="table">Table</Table.th>,
              <Table.th key="event">Event Type</Table.th>,
              <Table.th key="action">Action Type</Table.th>,
              <Table.th key="lastRun">Last Run</Table.th>,
              <Table.th key="status">Status</Table.th>,
              <Table.th key="actions" className="text-right">Actions</Table.th>,
            ]}
            body={mockWorkflows.map((workflow) => (
              <Table.tr key={workflow.id}>
                <Table.td className="font-medium">{workflow.name}</Table.td>
                <Table.td>
                  <code className="text-sm bg-surface-200 px-1 py-0.5 rounded">
                    {workflow.table}
                  </code>
                </Table.td>
                <Table.td>
                  <span className={cn(
                    "inline-flex items-center px-2 py-1 rounded-full text-xs font-medium",
                    workflow.event === 'INSERT' && "bg-green-300 text-green-900",
                    workflow.event === 'UPDATE' && "bg-blue-300 text-blue-900",
                    workflow.event === 'DELETE' && "bg-red-300 text-red-900"
                  )}>
                    {workflow.event}
                  </span>
                </Table.td>
                <Table.td>{workflow.action}</Table.td>
                <Table.td className="text-foreground-light">{workflow.lastRun}</Table.td>
                <Table.td>
                  <span className={cn(
                    "inline-flex items-center px-2 py-1 rounded-full text-xs font-medium",
                    workflow.status === 'Active' && "bg-green-300 text-green-900",
                    workflow.status === 'Inactive' && "bg-gray-300 text-gray-900"
                  )}>
                    {workflow.status}
                  </span>
                </Table.td>
                <Table.td className="text-right">
                  <div className="flex items-center justify-end gap-2">
                    <Button
                      type="default"
                      size="tiny"
                      icon={<Edit />}
                      onClick={() => handleEditWorkflow(workflow)}
                    >
                      Edit
                    </Button>
                    <Button
                      type="default"
                      size="tiny"
                      icon={<Trash />}
                      onClick={() => handleDeleteWorkflow(workflow.id)}
                    >
                      Delete
                    </Button>
                  </div>
                </Table.td>
              </Table.tr>
            ))}
          />
          {mockWorkflows.length === 0 && (
            <div className="p-8 text-center">
              <p className="text-foreground-light">No workflows created yet</p>
              <p className="text-sm text-foreground-lighter mt-1">
                Create your first workflow to automate database events
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Create/Edit Workflow Side Panel */}
      <SidePanel
        size="large"
        visible={showCreatePanel}
        align="right"
        header={editingWorkflow ? 'Edit Workflow' : 'Create New Workflow'}
        onCancel={() => {
          setShowCreatePanel(false)
          resetForm()
        }}
        customFooter={
          <div className="flex items-center gap-2 px-6 py-4 border-t border-default">
            <Button
              type="default"
              onClick={() => {
                setShowCreatePanel(false)
                resetForm()
              }}
            >
              Cancel
            </Button>
            <Button
              type="primary"
              onClick={handleSaveWorkflow}
              disabled={!workflowName || !selectedTable || !selectedEvent}
            >
              {editingWorkflow ? 'Update Workflow' : 'Create Workflow'}
            </Button>
          </div>
        }
      >
        <SidePanel.Content>
          <div className="space-y-6 py-6">
            {/* Workflow Name */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Workflow Name
              </label>
              <Input
                placeholder="e.g., User Registration Webhook"
                value={workflowName}
                onChange={(e) => setWorkflowName(e.target.value)}
              />
            </div>

            {/* Table Selector */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Table
              </label>
              <select
                className="w-full px-3 py-2 border border-control rounded-md bg-surface-75 text-foreground text-sm"
                value={selectedTable}
                onChange={(e) => setSelectedTable(e.target.value)}
              >
                <option value="">Select a table</option>
                {mockTables.map((table) => (
                  <option key={table.id} value={table.name}>
                    {table.schema}.{table.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Event Type */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Event Type
              </label>
              <select
                className="w-full px-3 py-2 border border-control rounded-md bg-surface-75 text-foreground text-sm"
                value={selectedEvent}
                onChange={(e) => setSelectedEvent(e.target.value)}
              >
                <option value="">Select event type</option>
                {eventTypes.map((event) => (
                  <option key={event.value} value={event.value}>
                    {event.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Action Type Tabs */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Action Type
              </label>
              <Tabs block type="pills" activeId={selectedActionType} onChange={setSelectedActionType}>
                <Tabs.Panel id="webhook" label="Webhook">
                  <div className="space-y-4 mt-4">
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-2">
                        Webhook URL
                      </label>
                      <Input
                        placeholder="https://api.example.com/webhook"
                        value={webhookUrl}
                        onChange={(e) => setWebhookUrl(e.target.value)}
                      />
                      <p className="text-xs text-foreground-light mt-1">
                        The webhook will receive a POST request with the row data
                      </p>
                    </div>
                  </div>
                </Tabs.Panel>

                <Tabs.Panel id="email" label="Send Email">
                  <div className="space-y-4 mt-4">
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-2">
                        Email Recipient Field
                      </label>
                      <select
                        className="w-full px-3 py-2 border border-control rounded-md bg-surface-75 text-foreground text-sm"
                        value={emailRecipient}
                        onChange={(e) => setEmailRecipient(e.target.value)}
                      >
                        <option value="">Select email field</option>
                        {emailFields.map((field) => (
                          <option key={field.value} value={field.value}>
                            {field.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-2">
                        Subject Line
                      </label>
                      <Input
                        placeholder="Welcome to our platform!"
                        value={emailSubject}
                        onChange={(e) => setEmailSubject(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-2">
                        Email Body
                      </label>
                      <textarea
                        className="w-full px-3 py-2 border border-control rounded-md bg-surface-75 text-foreground text-sm"
                        rows={4}
                        placeholder="Hello {{name}}, welcome to our platform..."
                        value={emailBody}
                        onChange={(e) => setEmailBody(e.target.value)}
                      />
                      <p className="text-xs text-foreground-light mt-1">
                        Use {`{{field_name}}`} to insert values from the row
                      </p>
                    </div>
                  </div>
                </Tabs.Panel>

                <Tabs.Panel id="insert" label="Insert into Table">
                  <div className="space-y-4 mt-4">
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-2">
                        Destination Table
                      </label>
                      <select
                        className="w-full px-3 py-2 border border-control rounded-md bg-surface-75 text-foreground text-sm"
                        value={destinationTable}
                        onChange={(e) => setDestinationTable(e.target.value)}
                      >
                        <option value="">Select destination table</option>
                        {mockTables.map((table) => (
                          <option key={table.id} value={table.name}>
                            {table.schema}.{table.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="bg-surface-200 p-4 rounded border">
                      <p className="text-sm text-foreground-light">
                        Configure field mappings between source and destination tables.
                        This feature will copy data from the triggered table to the selected destination.
                      </p>
                    </div>
                  </div>
                </Tabs.Panel>
              </Tabs>
            </div>
          </div>
        </SidePanel.Content>
      </SidePanel>
    </div>
  )
}

WorkflowsPage.getLayout = (page) => (
  <DefaultLayout>
    <ProjectLayout product="Workflows">
      {page}
    </ProjectLayout>
  </DefaultLayout>
)

export default WorkflowsPage 