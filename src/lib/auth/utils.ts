/**
 * Auth utility functions
 */

/**
 * Check if email is already registered
 */
export async function checkEmailAvailability(email: string): Promise<boolean> {
  // In production, this would check against database
  // For now, return true (available) for all emails
  return true;
}

/**
 * Get domain from email address
 */
export function getEmailDomain(email: string): string {
  const parts = email.split('@');
  return parts.length === 2 ? parts[1] : '';
}

/**
 * Check if user has admin privileges
 */
export function isAdminUser(email: string): boolean {
  // In production, check against admin list or database
  const adminDomains = ['admin.com', 'company.com'];
  const domain = getEmailDomain(email);
  return adminDomains.includes(domain);
}