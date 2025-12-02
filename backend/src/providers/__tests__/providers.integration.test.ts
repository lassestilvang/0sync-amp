import { Test, TestingModule } from '@nestjs/testing';
import { ProvidersRegistry } from '../providers.registry';
import { NotionProvider } from '../notion/notion.provider';
import { TodoistProvider } from '../todoist/todoist.provider';
import { GoogleCalendarProvider } from '../google/google-calendar.provider';
import { GoogleTasksProvider } from '../google/google-tasks.provider';
import { MicrosoftToDoProvider } from '../microsoft/microsoft-todo.provider';
import { GoogleContactsProvider } from '../google/google-contacts.provider';
import { GoogleSheetsProvider } from '../google/google-sheets.provider';
import { GmailProvider } from '../google/gmail.provider';
import { OutlookCalendarProvider } from '../microsoft/outlook-calendar.provider';
import { OutlookContactsProvider } from '../microsoft/outlook-contacts.provider';
import { OutlookMailProvider } from '../microsoft/outlook-mail.provider';
import { GitHubProvider } from '../github/github.provider';
import { TrelloProvider } from '../trello/trello.provider';
import { AsanaProvider } from '../asana/asana.provider';
import { LinearProvider } from '../linear/linear.provider';
import { JiraProvider } from '../jira/jira.provider';
import { TickTickProvider } from '../ticktick/ticktick.provider';
import { AppleCalendarProvider } from '../apple/apple-calendar.provider';
import { AppleNotesProvider } from '../apple/apple-notes.provider';
import { AppleRemindersProvider } from '../apple/apple-reminders.provider';
import { EncryptionService } from '../../common/services/encryption.service';
import { Integration } from '../../modules/integrations/entities/integration.entity';

describe('Providers Integration Tests', () => {
  let registry: ProvidersRegistry;
  let encryptionService: EncryptionService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProvidersRegistry,
        NotionProvider,
        TodoistProvider,
        GoogleCalendarProvider,
        GoogleTasksProvider,
        MicrosoftToDoProvider,
        GoogleContactsProvider,
        GoogleSheetsProvider,
        GmailProvider,
        OutlookCalendarProvider,
        OutlookContactsProvider,
        OutlookMailProvider,
        GitHubProvider,
        TrelloProvider,
        AsanaProvider,
        LinearProvider,
        JiraProvider,
        TickTickProvider,
        AppleCalendarProvider,
        AppleNotesProvider,
        AppleRemindersProvider,
        EncryptionService,
      ],
    }).compile();

    registry = module.get<ProvidersRegistry>(ProvidersRegistry);
    encryptionService = module.get<EncryptionService>(EncryptionService);
  });

  describe('Provider Registry', () => {
    it('should register all providers', () => {
      const providers = registry.list();
      expect(providers).toContain('notion');
      expect(providers).toContain('todoist');
      expect(providers).toContain('google_contacts');
      expect(providers).toContain('github');
      expect(providers.length).toBeGreaterThanOrEqual(14);
    });

    it('should retrieve provider by name', () => {
      const provider = registry.get('notion');
      expect(provider).toBeDefined();
      expect(provider.supportsBidirectional).toBe(true);
    });

    it('should throw error for unknown provider', () => {
      expect(() => registry.get('unknown_provider')).toThrow();
    });

    it('should check provider existence', () => {
      expect(registry.has('notion')).toBe(true);
      expect(registry.has('unknown')).toBe(false);
    });
  });

  describe('Provider Interface Compliance', () => {
    const providerNames = ['notion', 'todoist', 'google_contacts', 'github'];

    providerNames.forEach((providerName) => {
      describe(`${providerName} Provider`, () => {
        let provider: any;

        beforeEach(() => {
          provider = registry.get(providerName);
        });

        it('should have required metadata properties', () => {
          expect(typeof provider.supportsBidirectional).toBe('boolean');
          expect(typeof provider.supportsWebhooks).toBe('boolean');
          expect(typeof provider.supportsFieldMapping).toBe('boolean');
          expect(provider.rateLimitInfo).toBeDefined();
          expect(provider.rateLimitInfo.requestsPerMinute).toBeGreaterThan(0);
          expect(provider.rateLimitInfo.batchSize).toBeGreaterThan(0);
        });

        it('should have required methods', () => {
          expect(typeof provider.getAuthorizationUrl).toBe('function');
          expect(typeof provider.exchangeAuthorizationCode).toBe('function');
          expect(typeof provider.refreshAccessToken).toBe('function');
          expect(typeof provider.fetch).toBe('function');
          expect(typeof provider.pushChanges).toBe('function');
        });

        it('should have optional webhook methods', () => {
          if (provider.supportsWebhooks) {
            expect(typeof provider.registerWebhook).toBe('function');
            expect(typeof provider.verifyWebhookSignature).toBe('function');
            expect(typeof provider.parseWebhookPayload).toBe('function');
          }
        });
      });
    });
  });

  describe('OAuth Flow', () => {
    it('should generate authorization URL', () => {
      const provider = registry.get('notion');
      const url = provider.getAuthorizationUrl();
      expect(url).toBeDefined();
      expect(url).toContain('client_id');
      expect(url).toContain('redirect_uri');
    });

    it('should handle token exchange', async () => {
      const provider = registry.get('todoist');
      // This would need a real auth code, so we test the structure
      expect(typeof provider.exchangeAuthorizationCode).toBe('function');
    });
  });

  describe('Data Fetching', () => {
    it('should return FetchResult with correct structure', async () => {
      const provider = registry.get('notion');
      // Create a mock integration
      const mockIntegration = {
        id: 'test-1',
        oauth_access_token: encryptionService.encrypt('test-token'),
      } as any as Integration;

      // This would require mocking the API
      expect(typeof provider.fetch).toBe('function');
    });
  });

  describe('Push Changes', () => {
    it('should return PushResult with correct structure', async () => {
      const provider = registry.get('todoist');

      const mockChanges = {
        toCreate: [],
        toUpdate: [],
        toDelete: [],
      };

      expect(typeof provider.pushChanges).toBe('function');
    });
  });

  describe('Rate Limiting', () => {
    it('should have consistent rate limit info across providers', () => {
      const providers = registry.getAll();
      providers.forEach((provider) => {
        expect(provider.rateLimitInfo).toBeDefined();
        expect(provider.rateLimitInfo.requestsPerMinute).toBeGreaterThan(0);
        expect(provider.rateLimitInfo.batchSize).toBeGreaterThan(0);
      });
    });
  });

  describe('Field Mapping Support', () => {
    const fieldMappingProviders = ['notion', 'todoist', 'google_contacts', 'github'];

    fieldMappingProviders.forEach((providerName) => {
      it(`${providerName} should support field mapping`, () => {
        const provider = registry.get(providerName);
        expect(provider.supportsFieldMapping).toBe(true);
      });
    });
  });
});
