import { User } from '@supabase/auth-js'
import { AuthService } from './auth-service'
import { USER_ROLES, PERMISSIONS, ROLE_PERMISSIONS } from './auth-config'
import { IS_PLATFORM } from './constants'

/**
 * User management service for platform mode
 * Handles user roles, permissions, and organization membership
 */

export interface Organization {
  id: string
  slug: string
  name: string
  created_at: string
  updated_at: string
  subscription_tier: 'free' | 'pro' | 'team' | 'enterprise'
  billing_email?: string
}

export interface OrganizationMember {
  id: string
  user_id: string
  organization_id: string
  role: keyof typeof USER_ROLES
  invited_at: string
  joined_at?: string
  status: 'pending' | 'active' | 'inactive'
  user: {
    id: string
    email: string
    full_name?: string
    avatar_url?: string
  }
}

export interface Project {
  id: string
  ref: string
  name: string
  organization_id: string
  status: string
  region: string
  created_at: string
  updated_at: string
}

export interface UserProfile {
  id: string
  email: string
  full_name?: string
  avatar_url?: string
  created_at: string
  updated_at: string
  organizations: Array<{
    organization: Organization
    role: keyof typeof USER_ROLES
    status: string
  }>
}

/**
 * User Management Service
 */
export class UserManagementService {
  /**
   * Get current user profile with organization memberships
   */
  static async getUserProfile(): Promise<UserProfile | null> {
    if (!IS_PLATFORM) return null

    try {
      const { data, error } = await AuthService.getUser()
      
      if (error || !data.user) {
        return null
      }

      const user = data.user
      
      // Extract organization memberships from user metadata
      const organizations = user.user_metadata?.organizations || []

      return {
        id: user.id,
        email: user.email!,
        full_name: user.user_metadata?.full_name,
        avatar_url: user.user_metadata?.avatar_url,
        created_at: user.created_at,
        updated_at: user.updated_at!,
        organizations,
      }
    } catch (error) {
      console.error('Failed to get user profile:', error)
      return null
    }
  }

  /**
   * Check if user can perform action in organization
   */
  static canPerformAction(
    user: User | null,
    organizationId: string,
    action: string
  ): boolean {
    if (!IS_PLATFORM || !user) return true // Allow all in self-hosted mode

    const organizations = user.user_metadata?.organizations || []
    const membership = organizations.find((org: any) => org.organization.id === organizationId)
    
    if (!membership) return false

    const userRole = membership.role
    const allowedPermissions = ROLE_PERMISSIONS[userRole] || []
    
    return allowedPermissions.includes(action)
  }

  /**
   * Get user role in organization
   */
  static getUserRoleInOrganization(
    user: User | null,
    organizationId: string
  ): keyof typeof USER_ROLES | null {
    if (!IS_PLATFORM || !user) return 'OWNER' // Default role in self-hosted mode

    const organizations = user.user_metadata?.organizations || []
    const membership = organizations.find((org: any) => org.organization.id === organizationId)
    
    return membership?.role || null
  }

  /**
   * Check if user is organization owner
   */
  static isOrganizationOwner(user: User | null, organizationId: string): boolean {
    const role = this.getUserRoleInOrganization(user, organizationId)
    return role === USER_ROLES.OWNER
  }

  /**
   * Check if user is organization admin or owner
   */
  static isOrganizationAdmin(user: User | null, organizationId: string): boolean {
    const role = this.getUserRoleInOrganization(user, organizationId)
    return role === USER_ROLES.OWNER || role === USER_ROLES.ADMIN
  }

  /**
   * Get user's accessible organizations
   */
  static getUserOrganizations(user: User | null): Organization[] {
    if (!IS_PLATFORM || !user) return []

    const organizations = user.user_metadata?.organizations || []
    return organizations.map((membership: any) => membership.organization)
  }

  /**
   * Get user permissions for organization
   */
  static getUserPermissions(user: User | null, organizationId: string): string[] {
    if (!IS_PLATFORM || !user) return Object.values(PERMISSIONS)

    const role = this.getUserRoleInOrganization(user, organizationId)
    return role ? ROLE_PERMISSIONS[role] || [] : []
  }

  /**
   * Check if user can access project
   */
  static canAccessProject(user: User | null, projectRef: string, organizationId: string): boolean {
    if (!IS_PLATFORM || !user) return true

    // Check if user has read access to the organization
    return this.canPerformAction(user, organizationId, PERMISSIONS.PROJECT_READ)
  }

  /**
   * Check if user can modify project
   */
  static canModifyProject(user: User | null, projectRef: string, organizationId: string): boolean {
    if (!IS_PLATFORM || !user) return true

    // Check if user has update access to projects
    return this.canPerformAction(user, organizationId, PERMISSIONS.PROJECT_UPDATE)
  }

  /**
   * Check if user can delete project
   */
  static canDeleteProject(user: User | null, projectRef: string, organizationId: string): boolean {
    if (!IS_PLATFORM || !user) return true

    // Only owners and admins can delete projects
    return this.canPerformAction(user, organizationId, PERMISSIONS.PROJECT_DELETE)
  }

  /**
   * Check if user can manage billing
   */
  static canManageBilling(user: User | null, organizationId: string): boolean {
    if (!IS_PLATFORM || !user) return true

    return this.canPerformAction(user, organizationId, PERMISSIONS.BILLING_UPDATE)
  }

  /**
   * Check if user can invite members
   */
  static canInviteMembers(user: User | null, organizationId: string): boolean {
    if (!IS_PLATFORM || !user) return true

    return this.canPerformAction(user, organizationId, PERMISSIONS.ORG_INVITE)
  }

  /**
   * Check if user can manage API keys
   */
  static canManageApiKeys(user: User | null, organizationId: string): boolean {
    if (!IS_PLATFORM || !user) return true

    return this.canPerformAction(user, organizationId, PERMISSIONS.API_KEYS_CREATE)
  }

  /**
   * Format user role for display
   */
  static formatRole(role: keyof typeof USER_ROLES): string {
    const roleDisplayNames = {
      [USER_ROLES.OWNER]: 'Owner',
      [USER_ROLES.ADMIN]: 'Admin',
      [USER_ROLES.MEMBER]: 'Member',
      [USER_ROLES.VIEWER]: 'Viewer',
    }
    
    return roleDisplayNames[role] || role
  }

  /**
   * Get role hierarchy (for determining if role A can manage role B)
   */
  static getRoleHierarchy(): Record<keyof typeof USER_ROLES, number> {
    return {
      [USER_ROLES.OWNER]: 4,
      [USER_ROLES.ADMIN]: 3,
      [USER_ROLES.MEMBER]: 2,
      [USER_ROLES.VIEWER]: 1,
    }
  }

  /**
   * Check if user can manage another user's role
   */
  static canManageUserRole(
    currentUserRole: keyof typeof USER_ROLES,
    targetUserRole: keyof typeof USER_ROLES
  ): boolean {
    const hierarchy = this.getRoleHierarchy()
    return hierarchy[currentUserRole] > hierarchy[targetUserRole]
  }

  /**
   * Get available roles that a user can assign
   */
  static getAssignableRoles(currentUserRole: keyof typeof USER_ROLES): Array<keyof typeof USER_ROLES> {
    const hierarchy = this.getRoleHierarchy()
    const currentLevel = hierarchy[currentUserRole]
    
    return Object.keys(USER_ROLES).filter(role => {
      const roleKey = role as keyof typeof USER_ROLES
      return hierarchy[roleKey] < currentLevel
    }) as Array<keyof typeof USER_ROLES>
  }

  /**
   * Check if organization has reached member limit based on subscription
   */
  static hasReachedMemberLimit(organization: Organization, currentMemberCount: number): boolean {
    const memberLimits = {
      free: 3,
      pro: 10,
      team: 25,
      enterprise: Infinity,
    }
    
    const limit = memberLimits[organization.subscription_tier] || memberLimits.free
    return currentMemberCount >= limit
  }

  /**
   * Get organization member limit based on subscription
   */
  static getOrganizationMemberLimit(subscriptionTier: Organization['subscription_tier']): number {
    const memberLimits = {
      free: 3,
      pro: 10,
      team: 25,
      enterprise: Infinity,
    }
    
    return memberLimits[subscriptionTier] || memberLimits.free
  }
}