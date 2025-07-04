import { ReactNode } from 'react'
import { useConditionalRender } from 'hooks/auth/useUserManagement'

interface ConditionalRenderProps {
  /**
   * Required permission to render children
   */
  permission?: string
  /**
   * Required role to render children
   */
  role?: string
  /**
   * Organization ID for permission checking
   */
  organizationId?: string
  /**
   * Content to render when user has permissions
   */
  children: ReactNode
  /**
   * Optional fallback content when user doesn't have permissions
   */
  fallback?: ReactNode
  /**
   * Custom condition function (overrides permission/role checking)
   */
  condition?: () => boolean
}

/**
 * Conditionally render content based on user permissions or roles
 * 
 * @example
 * ```tsx
 * // Only show to users with PROJECT_CREATE permission
 * <ConditionalRender permission="project.create" organizationId={orgId}>
 *   <CreateProjectButton />
 * </ConditionalRender>
 * 
 * // Only show to organization owners
 * <ConditionalRender role="owner" organizationId={orgId}>
 *   <DeleteOrganizationButton />
 * </ConditionalRender>
 * 
 * // Show different content for unauthorized users
 * <ConditionalRender 
 *   permission="billing.update" 
 *   organizationId={orgId}
 *   fallback={<UpgradePrompt />}
 * >
 *   <BillingSettings />
 * </ConditionalRender>
 * 
 * // Custom condition
 * <ConditionalRender condition={() => user.email.endsWith('@company.com')}>
 *   <InternalOnlyFeature />
 * </ConditionalRender>
 * ```
 */
export function ConditionalRender({
  permission,
  role,
  organizationId,
  children,
  fallback = null,
  condition,
}: ConditionalRenderProps) {
  const shouldRenderFromPermissions = useConditionalRender(permission, role, organizationId)
  
  // Use custom condition if provided, otherwise use permission/role checking
  const shouldRender = condition ? condition() : shouldRenderFromPermissions

  if (shouldRender) {
    return <>{children}</>
  }

  return <>{fallback}</>
}

/**
 * Higher-order component version of ConditionalRender
 */
export function withPermissions<T extends Record<string, any>>(
  Component: React.ComponentType<T>,
  options: {
    permission?: string
    role?: string
    organizationId?: string
    fallback?: ReactNode
  }
) {
  return function PermissionWrappedComponent(props: T) {
    return (
      <ConditionalRender {...options}>
        <Component {...props} />
      </ConditionalRender>
    )
  }
}