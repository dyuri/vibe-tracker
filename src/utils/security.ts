/**
 * Security utilities and Content Security Policy optimization
 * Provides security hardening and CSP management for the application
 */

export interface SecurityConfig {
  csp: {
    enabled: boolean;
    reportOnly: boolean;
    directives: Record<string, string[]>;
  };
  headers: Record<string, string>;
  features: {
    xssProtection: boolean;
    nosniff: boolean;
    frameOptions: boolean;
    httpsRedirect: boolean;
  };
}

export interface SecurityAuditResult {
  score: number;
  issues: SecurityIssue[];
  recommendations: string[];
  cspAnalysis: CSPAnalysis;
}

export interface SecurityIssue {
  severity: 'low' | 'medium' | 'high' | 'critical';
  category: string;
  description: string;
  recommendation: string;
}

export interface CSPAnalysis {
  hasCSP: boolean;
  isReportOnly: boolean;
  directives: Record<string, string[]>;
  violations: string[];
  suggestions: string[];
}

/**
 * Default security configuration
 */
const DEFAULT_SECURITY_CONFIG: SecurityConfig = {
  csp: {
    enabled: true,
    reportOnly: false,
    directives: {
      'default-src': ["'self'"],
      'script-src': ["'self'", "'unsafe-inline'", 'https://unpkg.com'],
      'style-src': ["'self'", "'unsafe-inline'"],
      'img-src': ["'self'", 'data:', 'blob:', 'https:'],
      'font-src': ["'self'", 'data:', 'https:'],
      'connect-src': ["'self'", 'ws:', 'wss:'],
      'media-src': ["'self'"],
      'object-src': ["'none'"],
      'frame-src': ["'none'"],
      'worker-src': ["'self'"],
      'manifest-src': ["'self'"],
      'base-uri': ["'self'"],
      'form-action': ["'self'"],
      'frame-ancestors': ["'none'"],
      'upgrade-insecure-requests': [],
    },
  },
  headers: {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'geolocation=(self), camera=(), microphone=()',
  },
  features: {
    xssProtection: true,
    nosniff: true,
    frameOptions: true,
    httpsRedirect: true,
  },
};

/**
 * Security manager for runtime security features
 */
class SecurityManager {
  private static instance: SecurityManager;
  private config: SecurityConfig;
  private cspViolations: string[] = [];

  private constructor() {
    this.config = { ...DEFAULT_SECURITY_CONFIG };
    this.initializeSecurity();
  }

  static getInstance(): SecurityManager {
    if (!SecurityManager.instance) {
      SecurityManager.instance = new SecurityManager();
    }
    return SecurityManager.instance;
  }

  /**
   * Initialize security features
   */
  private initializeSecurity(): void {
    // Set up CSP violation reporting
    this.setupCSPReporting();

    // Sanitize DOM on load
    this.setupDOMSanitization();

    // Monitor for potential XSS attempts
    this.setupXSSMonitoring();

    console.log('🔒 Security manager initialized');
  }

  /**
   * Set up CSP violation reporting
   */
  private setupCSPReporting(): void {
    document.addEventListener('securitypolicyviolation', e => {
      const violation = {
        directive: e.violatedDirective,
        blockedURI: e.blockedURI,
        lineNumber: e.lineNumber,
        columnNumber: e.columnNumber,
        sourceFile: e.sourceFile,
        timestamp: Date.now(),
      };

      console.warn('🚨 CSP Violation:', violation);
      this.cspViolations.push(JSON.stringify(violation));

      // Store violations for analysis
      this.storeCSPViolation(violation);

      // Report critical violations immediately
      if (
        e.violatedDirective.includes('script-src') ||
        e.violatedDirective.includes('object-src')
      ) {
        this.reportSecurityIncident('csp-violation', violation);
      }
    });
  }

  /**
   * Set up DOM sanitization monitoring
   */
  private setupDOMSanitization(): void {
    // Monitor for potentially dangerous innerHTML updates
    const originalInnerHTML = Object.getOwnPropertyDescriptor(Element.prototype, 'innerHTML');

    if (originalInnerHTML) {
      Object.defineProperty(Element.prototype, 'innerHTML', {
        set: function (value: string) {
          // Check for potentially dangerous content
          if (this.sanitizeHTML && typeof value === 'string') {
            const sanitized = this.sanitizeHTML(value);
            if (sanitized !== value) {
              console.warn('🧽 HTML content sanitized:', {
                original: value.length,
                sanitized: sanitized.length,
                element: this.tagName,
              });
            }
            value = sanitized;
          }

          if (originalInnerHTML.set) {
            originalInnerHTML.set.call(this, value);
          }
        },
        get: originalInnerHTML.get,
        configurable: true,
      });
    }
  }

  /**
   * Set up XSS monitoring
   */
  private setupXSSMonitoring(): void {
    // Monitor for suspicious URL parameters
    const urlParams = new URLSearchParams(window.location.search);
    urlParams.forEach((value, key) => {
      if (this.containsSuspiciousContent(value)) {
        console.warn('⚠️ Suspicious URL parameter detected:', { key, value });
        this.reportSecurityIncident('suspicious-param', { key, value });
      }
    });

    // Monitor for suspicious hash content
    if (window.location.hash && this.containsSuspiciousContent(window.location.hash)) {
      console.warn('⚠️ Suspicious hash content detected:', window.location.hash);
      this.reportSecurityIncident('suspicious-hash', { hash: window.location.hash });
    }
  }

  /**
   * Check if content contains suspicious patterns
   */
  private containsSuspiciousContent(content: string): boolean {
    const suspiciousPatterns = [
      /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
      /javascript:/i,
      /on\w+\s*=/i,
      /data:text\/html/i,
      /vbscript:/i,
      /expression\s*\(/i,
    ];

    return suspiciousPatterns.some(pattern => pattern.test(content));
  }

  /**
   * Sanitize HTML content
   */
  private sanitizeHTML(html: string): string {
    // Create a temporary div to parse HTML
    const temp = document.createElement('div');
    temp.innerHTML = html;

    // Remove dangerous elements and attributes
    this.removeDangerousElements(temp);
    this.removeDangerousAttributes(temp);

    return temp.innerHTML;
  }

  /**
   * Remove dangerous HTML elements
   */
  private removeDangerousElements(element: HTMLElement): void {
    const dangerousTags = ['script', 'object', 'embed', 'applet', 'iframe', 'form'];

    dangerousTags.forEach(tag => {
      const elements = element.querySelectorAll(tag);
      elements.forEach(el => el.remove());
    });
  }

  /**
   * Remove dangerous HTML attributes
   */
  private removeDangerousAttributes(element: HTMLElement): void {
    const dangerousAttrs = /^on\w+|javascript:|data:text\/html|vbscript:/i;

    const walker = document.createTreeWalker(element, NodeFilter.SHOW_ELEMENT, null);

    let node;
    while ((node = walker.nextNode())) {
      const elem = node as Element;
      const attrs = Array.from(elem.attributes);

      attrs.forEach(attr => {
        if (dangerousAttrs.test(attr.name) || dangerousAttrs.test(attr.value)) {
          elem.removeAttribute(attr.name);
        }
      });
    }
  }

  /**
   * Store CSP violation for analysis
   */
  private storeCSPViolation(violation: any): void {
    try {
      const stored = this.getStoredViolations();
      stored.push(violation);

      // Keep only last 50 violations
      if (stored.length > 50) {
        stored.splice(0, stored.length - 50);
      }

      localStorage.setItem('vibe_csp_violations', JSON.stringify(stored));
    } catch (_error) {
      console.warn('Failed to store CSP violation');
    }
  }

  /**
   * Get stored CSP violations
   */
  private getStoredViolations(): any[] {
    try {
      const stored = localStorage.getItem('vibe_csp_violations');
      return stored ? JSON.parse(stored) : [];
    } catch (_error) {
      return [];
    }
  }

  /**
   * Report security incident
   */
  private reportSecurityIncident(type: string, data: any): void {
    // In production, this would report to your security monitoring service
    console.warn(`🚨 Security incident: ${type}`, data);

    // Store locally for debugging
    try {
      const incidents = this.getStoredIncidents();
      incidents.push({
        type,
        data,
        timestamp: Date.now(),
        url: window.location.href,
        userAgent: navigator.userAgent,
      });

      // Keep only last 20 incidents
      if (incidents.length > 20) {
        incidents.splice(0, incidents.length - 20);
      }

      localStorage.setItem('vibe_security_incidents', JSON.stringify(incidents));
    } catch (_error) {
      console.warn('Failed to store security incident');
    }
  }

  /**
   * Get stored security incidents
   */
  private getStoredIncidents(): any[] {
    try {
      const stored = localStorage.getItem('vibe_security_incidents');
      return stored ? JSON.parse(stored) : [];
    } catch (_error) {
      return [];
    }
  }

  /**
   * Get security status
   */
  getSecurityStatus(): {
    cspViolations: number;
    securityIncidents: number;
    lastViolation: number | null;
    lastIncident: number | null;
  } {
    const violations = this.getStoredViolations();
    const incidents = this.getStoredIncidents();

    return {
      cspViolations: violations.length,
      securityIncidents: incidents.length,
      lastViolation: violations.length > 0 ? violations[violations.length - 1].timestamp : null,
      lastIncident: incidents.length > 0 ? incidents[incidents.length - 1].timestamp : null,
    };
  }

  /**
   * Clear security logs
   */
  clearSecurityLogs(): void {
    localStorage.removeItem('vibe_csp_violations');
    localStorage.removeItem('vibe_security_incidents');
    this.cspViolations = [];
    console.log('🗑️ Security logs cleared');
  }
}

/**
 * Generate Content Security Policy header value
 */
export function generateCSPHeader(config: SecurityConfig): string {
  const directives = Object.entries(config.csp.directives)
    .map(([key, values]) => {
      if (values.length === 0) {
        return key;
      }
      return `${key} ${values.join(' ')}`;
    })
    .join('; ');

  return directives;
}

/**
 * Audit current security configuration
 */
export function auditSecurity(): SecurityAuditResult {
  const issues: SecurityIssue[] = [];
  const recommendations: string[] = [];

  // Check for CSP
  const cspMeta = document.querySelector('meta[http-equiv="Content-Security-Policy"]');
  const hasCSP = !!cspMeta;

  if (!hasCSP) {
    issues.push({
      severity: 'high',
      category: 'CSP',
      description: 'No Content Security Policy detected',
      recommendation: 'Implement CSP to prevent XSS attacks',
    });
  }

  // Check for HTTPS
  if (location.protocol !== 'https:' && location.hostname !== 'localhost') {
    issues.push({
      severity: 'critical',
      category: 'Transport Security',
      description: 'Site not served over HTTPS',
      recommendation: 'Enable HTTPS to encrypt data in transit',
    });
  }

  // Check for sensitive data in localStorage
  const sensitivePatterns = ['password', 'token', 'key', 'secret'];
  let foundSensitiveData = false;

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && sensitivePatterns.some(pattern => key.toLowerCase().includes(pattern))) {
      foundSensitiveData = true;
      break;
    }
  }

  if (foundSensitiveData) {
    issues.push({
      severity: 'medium',
      category: 'Data Storage',
      description: 'Potentially sensitive data found in localStorage',
      recommendation: 'Use secure storage methods for sensitive data',
    });
  }

  // Check for inline scripts
  const inlineScripts = document.querySelectorAll('script:not([src])');
  if (inlineScripts.length > 0) {
    issues.push({
      severity: 'low',
      category: 'CSP',
      description: `${inlineScripts.length} inline scripts found`,
      recommendation: 'Move scripts to external files to improve CSP security',
    });
  }

  // Calculate security score
  const criticalCount = issues.filter(i => i.severity === 'critical').length;
  const highCount = issues.filter(i => i.severity === 'high').length;
  const mediumCount = issues.filter(i => i.severity === 'medium').length;
  const lowCount = issues.filter(i => i.severity === 'low').length;

  const score = Math.max(
    0,
    100 - criticalCount * 40 - highCount * 20 - mediumCount * 10 - lowCount * 5
  );

  // Generate recommendations
  if (issues.length === 0) {
    recommendations.push('Security configuration looks good!');
  } else {
    recommendations.push('Address security issues in order of severity');
    if (criticalCount > 0) {
      recommendations.push('Priority: Fix critical security issues immediately');
    }
    if (hasCSP) {
      recommendations.push('Consider tightening CSP directives');
    }
    recommendations.push('Regular security audits recommended');
  }

  const cspAnalysis: CSPAnalysis = {
    hasCSP,
    isReportOnly: false,
    directives: hasCSP ? {} : DEFAULT_SECURITY_CONFIG.csp.directives,
    violations: SecurityManager.getInstance()['cspViolations'] || [],
    suggestions: hasCSP ? [] : ['Implement Content Security Policy'],
  };

  return {
    score,
    issues,
    recommendations,
    cspAnalysis,
  };
}

/**
 * Initialize security features
 */
export function initializeSecurity(): void {
  SecurityManager.getInstance();
}

/**
 * Get security manager instance
 */
export function getSecurityManager(): SecurityManager {
  return SecurityManager.getInstance();
}

/**
 * Validate URL for safety
 */
export function validateURL(url: string): boolean {
  try {
    const parsedURL = new URL(url);

    // Block dangerous protocols
    const dangerousProtocols = ['javascript:', 'data:', 'vbscript:', 'file:'];
    if (dangerousProtocols.some(protocol => parsedURL.protocol === protocol)) {
      return false;
    }

    // For development, allow localhost
    if (parsedURL.hostname === 'localhost' || parsedURL.hostname === '127.0.0.1') {
      return true;
    }

    // In production, only allow HTTPS
    if (location.protocol === 'https:' && parsedURL.protocol !== 'https:') {
      return false;
    }

    return true;
  } catch (_error) {
    return false;
  }
}

/**
 * Sanitize user input
 */
export function sanitizeInput(input: string): string {
  return input
    .replace(/[<>]/g, '') // Remove angle brackets
    .replace(/javascript:/gi, '') // Remove javascript: protocol
    .replace(/on\w+=/gi, '') // Remove event handlers
    .trim();
}

/**
 * Generate secure random string
 */
export function generateSecureRandom(length: number = 32): string {
  if (crypto && crypto.getRandomValues) {
    const array = new Uint8Array(length);
    crypto.getRandomValues(array);
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
  }

  // Fallback to Math.random (less secure)
  console.warn('Using fallback random generator - less secure');
  let result = '';
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return result;
}
