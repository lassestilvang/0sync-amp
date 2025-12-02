# 0Sync Testing Guide

Comprehensive testing strategy for the 0Sync platform across all layers.

## Test Structure

```
backend/
├── src/
│   ├── providers/__tests__/
│   │   └── providers.integration.test.ts      # Provider registry & compliance
│   ├── sync/__tests__/
│   │   └── sync-engine.test.ts               # Sync engine core logic
│   ├── modules/*/tests/                      # Unit tests per module
│   └── __tests__/
│       ├── e2e/
│       │   └── sync-flow.e2e.test.ts        # End-to-end flow tests
│       └── performance/
│           └── load.test.ts                  # Load & stress tests
```

## Running Tests

### Unit Tests
```bash
# Run all unit tests
npm test

# Run specific test file
npm test -- providers.integration.test.ts

# Watch mode
npm test -- --watch

# Coverage report
npm test -- --coverage
```

### Integration Tests
```bash
# Run provider integration tests
npm test -- providers.integration.test.ts

# Run sync engine tests
npm test -- sync-engine.test.ts
```

### End-to-End Tests
```bash
# Run full sync flow E2E test
npm run test:e2e

# Run with specific provider
npm run test:e2e -- --provider=notion
```

### Performance Tests
```bash
# Run load tests
npm run test:performance

# Run with detailed metrics
npm run test:performance -- --verbose

# Generate performance report
npm run test:performance -- --report
```

## Test Coverage Goals

| Layer | Target | Current |
|-------|--------|---------|
| Providers | 85% | ~80% |
| Sync Engine | 90% | ~85% |
| API Endpoints | 80% | ~75% |
| Database Layer | 85% | ~80% |
| Overall | 85% | ~80% |

## Phase 7: Testing Implementation

### 1. Unit Tests

**Provider Tests** (`providers.integration.test.ts`):
- ✅ Registry functionality (registration, retrieval, listing)
- ✅ Provider interface compliance
- ✅ OAuth flow implementation
- ✅ Data fetch/push structure
- ✅ Rate limit configuration
- ✅ Field mapping support

**Sync Engine Tests** (`sync-engine.test.ts`):
- ✅ Job queuing (normal & high priority)
- ✅ Change detection (new, updated, deleted objects)
- ✅ Hash generation consistency
- ✅ Error handling & retry logic
- ✅ Exponential backoff configuration
- ✅ Cursor management
- ✅ Provider integration

**Module Tests** (per module):
- Authentication & JWT validation
- User management & permissions
- Integration CRUD operations
- Sync CRUD & state management
- Webhook ingestion & validation
- Database transaction handling

### 2. Integration Tests

**Provider Integration Tests**:
```typescript
// Test OAuth flow with real provider API
async testNotionOAuthFlow() {
  const authUrl = notionProvider.getAuthorizationUrl();
  const response = await exchangeCodeForToken(testAuthCode);
  expect(response.accessToken).toBeDefined();
  expect(response.expiresIn).toBeDefined();
}

// Test data fetch
async testFetchData() {
  const result = await notionProvider.fetch(integration, config);
  expect(result.objects).toBeArray();
  expect(result.nextCursor).toBeDefined();
}

// Test push changes
async testPushChanges() {
  const result = await notionProvider.pushChanges(integration, config, changes);
  expect(result.created + result.updated + result.deleted).toBeGreaterThan(0);
}
```

**Sync Flow Tests**:
- Source & destination provider integration
- Bi-directional change detection
- Conflict detection & resolution
- Field mapping transformation
- Cursor/state tracking across syncs

### 3. End-to-End Tests

**Complete Sync Flow** (`sync-flow.e2e.test.ts`):
- User signup & login
- OAuth integration connection
- Multiple provider integration
- Sync configuration
- Sync job execution
- Change detection & data pushing
- Conflict resolution
- Log retrieval & export
- Sync pause/resume

**Test Workflow**:
```
1. User Auth → 2. Provider Connect → 3. Sync Config 
→ 4. Trigger Sync → 5. Verify Changes → 6. Check Logs 
→ 7. Resolve Conflicts → 8. Cleanup
```

### 4. Performance Tests

**Load Testing Scenarios**:

| Scenario | Target | Metric |
|----------|--------|--------|
| Provider lookup (1000x) | <10ms | Registry speed |
| Concurrent sync access (100x) | <50ms | Concurrency |
| Queue 1000 jobs | <50ms | Job queueing |
| Hash 10,000 objects | <1s | Change detection |
| Transform 10,000 objects | <100ms | Data transformation |
| Concurrent syncs (10x) | <5s | Sync concurrency |

**API Response Time Targets**:
- List Integrations: <100ms
- Get Sync Status: <50ms
- Create Sync: <200ms
- Trigger Sync: <150ms
- Resolve Conflict: <100ms
- Export Logs: <500ms

### 5. Security Testing

**JWT & Authentication**:
```typescript
// Invalid token rejection
expect(() => auth.verifyToken('invalid_token')).toThrow();

// Token expiration handling
const expiredToken = generateToken({ exp: Date.now() - 1000 });
expect(() => auth.verifyToken(expiredToken)).toThrow();

// Permission enforcement
expect(() => user2.accessSync(user1.syncId)).toThrow();
```

**Token Encryption**:
```typescript
// Token encryption/decryption
const plainToken = 'super_secret_token_123';
const encrypted = encryptionService.encrypt(plainToken);
const decrypted = encryptionService.decrypt(encrypted);

expect(encrypted).not.toBe(plainToken);
expect(decrypted).toBe(plainToken);
```

**Input Validation**:
```typescript
// Invalid provider
expect(() => registry.get('invalid_provider')).toThrow();

// Malformed sync config
expect(() => createSync({ invalid: 'config' })).toThrow();

// SQL injection prevention
expect(() => syncService.findBySyncName("'; DROP TABLE syncs; --"))
  .not.toExecuteDangerousSQL();
```

## Mock Data & Fixtures

### Provider Mock Data
```typescript
const mockIntegration = {
  id: 'int_test_123',
  provider: 'notion',
  oauth_access_token: 'encrypted_token',
  status: 'active',
};

const mockSyncConfig = {
  database_id: 'db_test_123',
  filter: { property: 'Status', select: { equals: 'In Progress' } },
};

const mockFetchResult = {
  objects: [
    { id: '1', title: 'Task 1', updated_at: '2025-01-30T10:00:00Z' },
    { id: '2', title: 'Task 2', updated_at: '2025-01-30T10:05:00Z' },
  ],
  nextCursor: 'cursor_abc123',
};
```

### Webhook Mock Data
```typescript
const mockGitHubWebhook = {
  action: 'opened',
  issue: {
    number: 123,
    title: 'Test Issue',
    body: 'Issue description',
    state: 'open',
    updated_at: '2025-01-30T10:00:00Z',
  },
};

const mockTodoistWebhook = {
  events: [
    {
      event_type: 'item:added',
      data: {
        id: 'task_123',
        content: 'New task',
        due: { date: '2025-02-01' },
      },
    },
  ],
};
```

## CI/CD Integration

### GitHub Actions

```yaml
name: Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: postgres
      redis:
        image: redis:7

    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - run: npm install
      - run: npm run test:unit
      - run: npm run test:integration
      - run: npm run test:coverage
      
      - name: Upload coverage
        uses: codecov/codecov-action@v3

  performance:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm install
      - run: npm run test:performance

  e2e:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:15
      redis:
        image: redis:7
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm install
      - run: npm run start:test &
      - run: npm run test:e2e
```

## Testing Best Practices

1. **Isolation**: Each test should be independent
2. **Mocking**: Mock external APIs and databases
3. **Async Handling**: Use proper async/await patterns
4. **Cleanup**: Restore state after each test
5. **Descriptive Names**: Test names should describe behavior
6. **Arrange-Act-Assert**: Follow AAA pattern
7. **One Assertion Per Test**: Or logically related assertions
8. **No Test Dependencies**: Tests shouldn't depend on each other

## Continuous Monitoring

### Metrics to Track

- Test execution time trends
- Code coverage by module
- Flaky test detection
- Performance regression alerts
- Security vulnerability scans

### Performance Baselines

Store performance baselines and alert on regressions:
```json
{
  "provider_lookup": { "baseline": 0.5, "threshold": 2 },
  "sync_creation": { "baseline": 150, "threshold": 300 },
  "change_detection": { "baseline": 50, "threshold": 100 }
}
```

## Security Audit Checklist

- [ ] SQL injection prevention tested
- [ ] XSS protection verified
- [ ] CSRF token validation
- [ ] Rate limiting enforced
- [ ] Token expiration handling
- [ ] Permission enforcement
- [ ] Encryption/decryption verified
- [ ] Webhook signature validation
- [ ] Input sanitization
- [ ] Error message leakage prevention

## Troubleshooting Tests

### Common Issues

**Tests timeout**:
- Increase timeout: `jest.setTimeout(10000)`
- Check database connectivity
- Verify Redis availability

**Flaky tests**:
- Add proper waits/retries
- Use `waitFor` utilities
- Check for race conditions

**Memory leaks**:
- Ensure proper cleanup in afterEach
- Check for circular references
- Monitor heap usage

**Mocking issues**:
- Verify mock implementations match actual API
- Check parameter passing
- Ensure mocks are cleared between tests

## Future Test Enhancements

- [ ] Contract testing with actual provider APIs
- [ ] Chaos engineering tests
- [ ] Load testing with k6 or Locust
- [ ] Visual regression testing
- [ ] Accessibility testing
- [ ] Penetration testing
- [ ] Compliance testing (GDPR, CCPA)
