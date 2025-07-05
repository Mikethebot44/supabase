import { useCallback } from 'react'
import { useAuth } from "lib/auth-client"
import { UserManagementService, UserProfile } from 'lib/user-management'
import { PERMISSIONS } from 'lib/auth-config'
import { IS_PLATFORM } from 'lib/constants'

/**
 * Custom hooks for user management in platform mode
 */

/**
 * Hook to get current user profile with organization memberships
 */
export function useUserProfile() {
  const { session } = useAuth()
  const user = session?.user

  return {
    user,
    profile: user ? {
      id: user.id,
      email: user.email!,
      full_name: user.user_metadata?.full_name,
      avatar_url: user.user_metadata?.avatar_url,
      created_at: user.created_at,
      updated_at: user.updated_at!,
      organizations: user.user_metadata?.organizations || [],
    } as UserProfile : null,
  }
}

/**
 * Hook to check permissions for current user
 */
export function usePermissions(organizationId?: string) {
  const { session } = useAuth()
  const user = session?.user

  const hasPermission = useCallback((permission: string): boolean => {
    if (!IS_PLATFORM) return true
    if (!organizationId) return false
    
    return UserManagementService.canPerformAction(user || null, organizationId, permission)
  }, [user, organizationId])

  const hasRole = useCallback((role: string): boolean => {
    if (!IS_PLATFORM) return true
    if (!organizationId) return false
    
    const userRole = UserManagementService.getUserRoleInOrganization(user || null, organizationId)
    return userRole === role
  }, [user, organizationId])

  const isOwner = useCallback((): boolean => {
    if (!IS_PLATFORM) return true
    if (!organizationId) return false
    
    return UserManagementService.isOrganizationOwner(user || null, organizationId)
  }, [user, organizationId])

  const isAdmin = useCallback((): boolean => {
    if (!IS_PLATFORM) return true
    if (!organizationId) return false
    
    return UserManagementService.isOrganizationAdmin(user || null, organizationId)
  }, [user, organizationId])

  return {
    hasPermission,
    hasRole,
    isOwner,
    isAdmin,
    // Specific permission checkers
    canCreateProject: hasPermission(PERMISSIONS.PROJECT_CREATE),
    canUpdateProject: hasPermission(PERMISSIONS.PROJECT_UPDATE),
    canDeleteProject: hasPermission(PERMISSIONS.PROJECT_DELETE),
    canManageBilling: hasPermission(PERMISSIONS.BILLING_UPDATE),
    canInviteMembers: hasPermission(PERMISSIONS.ORG_INVITE),
    canManageApiKeys: hasPermission(PERMISSIONS.API_KEYS_CREATE),
    canReadDatabase: hasPermission(PERMISSIONS.DATABASE_READ),
    canUpdateDatabase: hasPermission(PERMISSIONS.DATABASE_UPDATE),
  }
}

/**
 * Hook to get user's organizations
 */
export function useUserOrganizations() {
  const { session } = useAuth()
  const user = session?.user

  const organizations = UserManagementService.getUserOrganizations(user || null)
  
  return {
    organizations,
    hasOrganizations: organizations.length > 0,
  }
}

/**
 * Hook to check project access permissions
 */
export function useProjectPermissions(projectRef?: string, organizationId?: string) {
  const { session } = useAuth()
  const user = session?.user

  const canAccess = useCallback((): boolean => {
    if (!IS_PLATFORM) return true
    if (!projectRef || !organizationId) return false
    
    return UserManagementService.canAccessProject(user || null, projectRef, organizationId)
  }, [user, projectRef, organizationId])

  const canModify = useCallback((): boolean => {
    if (!IS_PLATFORM) return true
    if (!projectRef || !organizationId) return false
    
    return UserManagementService.canModifyProject(user || null, projectRef, organizationId)
  }, [user, projectRef, organizationId])

  const canDelete = useCallback((): boolean => {
    if (!IS_PLATFORM) return true
    if (!projectRef || !organizationId) return false
    
    return UserManagementService.canDeleteProject(user || null, projectRef, organizationId)
  }, [user, projectRef, organizationId])

  return {
    canAccess,
    canModify,
    canDelete,
  }
}

/**
 * Hook for organization member management
 */
export function useOrganizationManagement(organizationId?: string) {
  const { session } = useAuth()
  const user = session?.user

  const getUserRole = useCallback(() => {
    if (!IS_PLATFORM || !organizationId) return 'OWNER'
    
    return UserManagementService.getUserRoleInOrganization(user || null, organizationId)
  }, [user, organizationId])

  const canManageUser = useCallback((targetUserRole: string): boolean => {
    if (!IS_PLATFORM) return true
    
    const currentUserRole = getUserRole()
    if (!currentUserRole) return false
    
    return UserManagementService.canManageUserRole(currentUserRole, targetUserRole as any)
  }, [getUserRole])

  const getAssignableRoles = useCallback(() => {
    if (!IS_PLATFORM) return ['OWNER', 'ADMIN', 'MEMBER', 'VIEWER']
    
    const currentUserRole = getUserRole()
    if (!currentUserRole) return []
    
    return UserManagementService.getAssignableRoles(currentUserRole)
  }, [getUserRole])

  return {
    getUserRole,
    canManageUser,
    getAssignableRoles,
    formatRole: UserManagementService.formatRole,
  }
}

/**
 * Hook for checking subscription limits
 */
export function useSubscriptionLimits(organization?: { subscription_tier: string }) {
  const checkMemberLimit = useCallback((currentMemberCount: number): boolean => {
    if (!IS_PLATFORM || !organization) return false
    
    return UserManagementService.hasReachedMemberLimit(
      organization as any,
      currentMemberCount
    )
  }, [organization])

  const getMemberLimit = useCallback((): number => {
    if (!IS_PLATFORM || !organization) return Infinity
    
    return UserManagementService.getOrganizationMemberLimit(
      organization.subscription_tier as any
    )
  }, [organization])

  return {
    checkMemberLimit,
    getMemberLimit,
    hasReachedMemberLimit: checkMemberLimit,
  }
}

/**
 * Hook to check if component should be visible based on permissions
 */
export function useConditionalRender(
  permission?: string,
  role?: string,
  organizationId?: string
) {
  const { hasPermission, hasRole } = usePermissions(organizationId)

  const shouldRender = useCallback((): boolean => {
    if (!IS_PLATFORM) return true
    
    if (permission && !hasPermission(permission)) return false
    if (role && !hasRole(role)) return false
    
    return true
  }, [permission, role, hasPermission, hasRole])

  return shouldRender()
}