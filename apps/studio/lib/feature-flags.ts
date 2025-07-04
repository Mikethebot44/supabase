import { IS_PLATFORM, CUSTOM_AUTH_ENABLED } from './constants'

/**
 * Feature Flags for Supabase Studio
 * Controls which features are available based on the deployment mode
 */

export interface FeatureFlags {
  // Authentication features
  authentication: boolean
  userManagement: boolean
  mfaAuthentication: boolean
  
  // Organization features
  organizations: boolean
  teamManagement: boolean
  inviteMembers: boolean
  
  // Billing and subscription features
  billing: boolean
  subscriptions: boolean
  paymentMethods: boolean
  usageReports: boolean
  spendCap: boolean
  
  // Project features
  projectCreation: boolean
  projectSettings: boolean
  projectDeletion: boolean
  projectRestore: boolean
  
  // Database features
  databaseManagement: boolean
  sqlEditor: boolean
  tableEditor: boolean
  backups: boolean
  
  // Storage features
  storageManagement: boolean
  fileUpload: boolean
  
  // API features
  apiKeys: boolean
  apiDocs: boolean
  
  // Integration features
  integrations: boolean
  webhooks: boolean
  edgeFunctions: boolean
  queues: boolean
  cronJobs: boolean
  
  // Monitoring features
  logs: boolean
  analytics: boolean
  reports: boolean
  
  // Support features
  support: boolean
  documentation: boolean
  
  // AI features
  aiAssistant: boolean
  sqlGeneration: boolean
}

/**
 * Get feature flags based on current deployment mode
 */
export function getFeatureFlags(): FeatureFlags {
  // Platform mode (IS_PLATFORM=true) - all features enabled
  if (IS_PLATFORM) {
    return {
      authentication: true,
      userManagement: true,
      mfaAuthentication: true,
      organizations: true,
      teamManagement: true,
      inviteMembers: true,
      billing: true,
      subscriptions: true,
      paymentMethods: true,
      usageReports: true,
      spendCap: true,
      projectCreation: true,
      projectSettings: true,
      projectDeletion: true,
      projectRestore: true,
      databaseManagement: true,
      sqlEditor: true,
      tableEditor: true,
      backups: true,
      storageManagement: true,
      fileUpload: true,
      apiKeys: true,
      apiDocs: true,
      integrations: true,
      webhooks: true,
      edgeFunctions: true,
      queues: true,
      cronJobs: true,
      logs: true,
      analytics: true,
      reports: true,
      support: true,
      documentation: true,
      aiAssistant: true,
      sqlGeneration: true,
    }
  }

  // Custom auth mode (CUSTOM_AUTH_ENABLED=true) - core features with authentication
  if (CUSTOM_AUTH_ENABLED) {
    return {
      authentication: true,
      userManagement: true,
      mfaAuthentication: false, // Simplified auth, no MFA
      organizations: false, // Simplified - no organizations
      teamManagement: false,
      inviteMembers: false,
      billing: false, // No billing features
      subscriptions: false,
      paymentMethods: false,
      usageReports: false,
      spendCap: false,
      projectCreation: false, // Single project mode
      projectSettings: true,
      projectDeletion: false, // Safety - no deletion
      projectRestore: false,
      databaseManagement: true, // Core database features
      sqlEditor: true,
      tableEditor: true,
      backups: true,
      storageManagement: true, // Core storage features
      fileUpload: true,
      apiKeys: true, // Core API features
      apiDocs: true,
      integrations: true, // Core integrations
      webhooks: true,
      edgeFunctions: true,
      queues: true,
      cronJobs: true,
      logs: true, // Basic monitoring
      analytics: false, // No advanced analytics
      reports: false,
      support: false, // No integrated support
      documentation: true,
      aiAssistant: true, // AI features enabled
      sqlGeneration: true,
    }
  }

  // Self-hosted mode (both false) - all core features, no auth
  return {
    authentication: false, // No authentication required
    userManagement: false,
    mfaAuthentication: false,
    organizations: false,
    teamManagement: false,
    inviteMembers: false,
    billing: false,
    subscriptions: false,
    paymentMethods: false,
    usageReports: false,
    spendCap: false,
    projectCreation: false, // Single project mode
    projectSettings: true,
    projectDeletion: false,
    projectRestore: false,
    databaseManagement: true, // Core database features
    sqlEditor: true,
    tableEditor: true,
    backups: true,
    storageManagement: true, // Core storage features
    fileUpload: true,
    apiKeys: true, // Core API features
    apiDocs: true,
    integrations: true, // Core integrations
    webhooks: true,
    edgeFunctions: true,
    queues: true,
    cronJobs: true,
    logs: true, // Basic monitoring
    analytics: false,
    reports: false,
    support: false,
    documentation: true,
    aiAssistant: true, // AI features enabled
    sqlGeneration: true,
  }
}

// Export singleton instance
export const featureFlags = getFeatureFlags()

/**
 * Helper functions for checking specific features
 */
export const hasFeature = (feature: keyof FeatureFlags): boolean => {
  return featureFlags[feature]
}

export const requiresAuth = (): boolean => {
  return featureFlags.authentication
}

export const supportsOrganizations = (): boolean => {
  return featureFlags.organizations
}

export const supportsBilling = (): boolean => {
  return featureFlags.billing
}

/**
 * Get deployment mode description
 */
export const getDeploymentMode = (): string => {
  if (IS_PLATFORM) return 'Platform Mode'
  if (CUSTOM_AUTH_ENABLED) return 'Custom Auth Mode'
  return 'Self-Hosted Mode'
}