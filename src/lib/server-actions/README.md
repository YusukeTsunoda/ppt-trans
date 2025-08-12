# Server Actions Foundation

## Overview
This directory contains a comprehensive Server Actions foundation for Next.js 14+ applications, providing type-safe, validated, and authenticated server actions with built-in error handling and logging.

## Core Features
- 🔐 **Authentication & Authorization** - Built-in auth checks with role-based access
- ✅ **Zod Validation** - Type-safe FormData validation with Zod schemas
- 🚦 **Rate Limiting** - Protect against abuse with configurable rate limits
- 📊 **Logging & Monitoring** - Structured logging with multiple log levels
- 🔄 **Retry & Caching** - Built-in retry logic and result caching
- 🎯 **Error Handling** - Standardized error states for useActionState

## Quick Start

### Basic Server Action
```typescript
import { createServerAction, commonSchemas } from '@/lib/server-actions';
import { z } from 'zod';

const schema = z.object({
  email: commonSchemas.email,
  message: z.string().min(10).max(1000),
});

export const contactAction = createServerAction(
  'contact',
  {
    requireAuth: false,
    validation: { schema },
    rateLimit: { maxRequests: 5, windowMs: 60000 },
  },
  async (prevState, formData, context) => {
    // Your logic here
    return createSuccessState({ sent: true });
  }
);
```

### Authenticated Action
```typescript
export const updateProfileAction = createServerAction(
  'updateProfile',
  {
    requireAuth: true,
    validation: { schema: profileSchema },
  },
  async (prevState, formData, context) => {
    const userId = context.userId; // Guaranteed to exist
    // Update profile logic
  }
);
```

### Admin-Only Action
```typescript
export const adminAction = createServerAction(
  'adminOperation',
  {
    requireAuth: true,
    requireAdmin: true,
    logging: { enabled: true, logLevel: 'warn' },
  },
  async (prevState, formData, context) => {
    // Admin-only logic
  }
);
```

## Usage in Components

### With useActionState Hook
```tsx
'use client';
import { useActionState } from 'react';
import { contactAction } from '@/actions/contact';

export function ContactForm() {
  const [state, formAction] = useActionState(
    contactAction,
    { success: false, timestamp: Date.now() }
  );

  return (
    <form action={formAction}>
      <input name="email" type="email" required />
      <textarea name="message" required />
      
      {state.errors?.email && (
        <p className="error">{state.errors.email[0]}</p>
      )}
      
      {state.success && (
        <p className="success">Message sent!</p>
      )}
      
      <button type="submit">Send</button>
    </form>
  );
}
```

## Advanced Features

### Sequential Actions
```typescript
const results = await executeSequence(
  {
    upload: uploadAction,
    process: processAction,
    notify: notifyAction,
  },
  formData,
  { stopOnError: true }
);
```

### Parallel Actions
```typescript
const results = await executeParallel(
  {
    stats: getStatsAction,
    files: getFilesAction,
    notifications: getNotificationsAction,
  },
  formData
);
```

### Cached Actions
```typescript
export const getCachedData = createCachedAction(
  getDataAction,
  {
    key: (formData) => `data:${formData.get('id')}`,
    ttl: 300000, // 5 minutes
  }
);
```

### Retry Logic
```typescript
const result = await retryAction(
  unreliableAction,
  formData,
  {
    maxRetries: 3,
    initialDelay: 1000,
    shouldRetry: (error) => !error.errors?.critical,
  }
);
```

## Common Validation Schemas

The library provides pre-built validation schemas:
- `commonSchemas.email` - Email validation
- `commonSchemas.password` - Secure password requirements
- `commonSchemas.uuid` - UUID format validation
- `commonSchemas.pptxFile` - PowerPoint file validation
- `commonSchemas.phoneNumber` - Phone number format
- `commonSchemas.url` - URL validation
- `commonSchemas.pagination` - Pagination parameters

## Error Handling

All actions return a standardized state object:
```typescript
interface ServerActionState<T> {
  success: boolean;
  data?: T;
  errors?: Record<string, string[]>;
  message?: string;
  timestamp: number;
  executionTime?: number;
}
```

## Best Practices

1. **Always validate input** - Use Zod schemas for type-safe validation
2. **Implement rate limiting** - Protect against abuse
3. **Use appropriate log levels** - Debug for dev, info for production
4. **Cache expensive operations** - Use createCachedAction for read operations
5. **Handle errors gracefully** - Provide user-friendly error messages
6. **Track user activity** - Use trackUserActivity for audit logs
7. **Check permissions** - Use isResourceOwner for resource-level auth

## Configuration Options

```typescript
interface ServerActionConfig {
  requireAuth?: boolean;        // Require authenticated user
  requireAdmin?: boolean;       // Require admin role
  rateLimit?: {
    maxRequests: number;        // Max requests per window
    windowMs: number;           // Time window in ms
  };
  validation?: {
    schema: z.ZodSchema;        // Zod validation schema
    transformFormData?: boolean; // Auto-transform FormData
  };
  logging?: {
    enabled: boolean;           // Enable logging
    includeFormData?: boolean;  // Log form data (careful with sensitive data)
    logLevel?: 'debug' | 'info' | 'warn' | 'error';
  };
}
```