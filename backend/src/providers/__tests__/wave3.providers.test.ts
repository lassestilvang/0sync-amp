import { Test, TestingModule } from '@nestjs/testing';
import { LinearProvider } from '../linear/linear.provider';
import { JiraProvider } from '../jira/jira.provider';
import { TickTickProvider } from '../ticktick/ticktick.provider';
import { AppleCalendarProvider } from '../apple/apple-calendar.provider';
import { AppleNotesProvider } from '../apple/apple-notes.provider';
import { AppleRemindersProvider } from '../apple/apple-reminders.provider';
import { EncryptionService } from '../../common/services/encryption.service';

describe('Wave 3 Providers', () => {
  let linearProvider: LinearProvider;
  let jiraProvider: JiraProvider;
  let ticktickProvider: TickTickProvider;
  let appleCalendarProvider: AppleCalendarProvider;
  let appleNotesProvider: AppleNotesProvider;
  let appleRemindersProvider: AppleRemindersProvider;
  let encryptionService: EncryptionService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LinearProvider,
        JiraProvider,
        TickTickProvider,
        AppleCalendarProvider,
        AppleNotesProvider,
        AppleRemindersProvider,
        EncryptionService,
      ],
    }).compile();

    linearProvider = module.get<LinearProvider>(LinearProvider);
    jiraProvider = module.get<JiraProvider>(JiraProvider);
    ticktickProvider = module.get<TickTickProvider>(TickTickProvider);
    appleCalendarProvider = module.get<AppleCalendarProvider>(AppleCalendarProvider);
    appleNotesProvider = module.get<AppleNotesProvider>(AppleNotesProvider);
    appleRemindersProvider = module.get<AppleRemindersProvider>(AppleRemindersProvider);
    encryptionService = module.get<EncryptionService>(EncryptionService);
  });

  describe('LinearProvider', () => {
    it('should be defined', () => {
      expect(linearProvider).toBeDefined();
    });

    it('should have correct metadata', () => {
      expect(linearProvider.supportsBidirectional).toBe(true);
      expect(linearProvider.supportsWebhooks).toBe(true);
      expect(linearProvider.supportsFieldMapping).toBe(true);
      expect(linearProvider.rateLimitInfo.requestsPerMinute).toBe(1000);
      expect(linearProvider.rateLimitInfo.batchSize).toBe(100);
    });

    it('should generate authorization URL', () => {
      const url = linearProvider.getAuthorizationUrl();
      expect(url).toContain('linear.app');
      expect(url).toContain('client_id');
      expect(url).toContain('response_type=code');
    });

    it('should implement all required methods', () => {
      expect(typeof linearProvider.fetch).toBe('function');
      expect(typeof linearProvider.pushChanges).toBe('function');
      expect(typeof linearProvider.exchangeAuthorizationCode).toBe('function');
      expect(typeof linearProvider.refreshAccessToken).toBe('function');
      expect(typeof linearProvider.registerWebhook).toBe('function');
      expect(typeof linearProvider.verifyWebhookSignature).toBe('function');
      expect(typeof linearProvider.parseWebhookPayload).toBe('function');
    });
  });

  describe('JiraProvider', () => {
    it('should be defined', () => {
      expect(jiraProvider).toBeDefined();
    });

    it('should have correct metadata', () => {
      expect(jiraProvider.supportsBidirectional).toBe(true);
      expect(jiraProvider.supportsWebhooks).toBe(true);
      expect(jiraProvider.supportsFieldMapping).toBe(true);
      expect(jiraProvider.rateLimitInfo.requestsPerMinute).toBe(180);
      expect(jiraProvider.rateLimitInfo.batchSize).toBe(50);
    });

    it('should generate authorization URL for Atlassian', () => {
      const url = jiraProvider.getAuthorizationUrl();
      expect(url).toContain('atlassian.com');
      expect(url).toContain('client_id');
    });

    it('should implement all required methods', () => {
      expect(typeof jiraProvider.fetch).toBe('function');
      expect(typeof jiraProvider.pushChanges).toBe('function');
      expect(typeof jiraProvider.exchangeAuthorizationCode).toBe('function');
      expect(typeof jiraProvider.refreshAccessToken).toBe('function');
    });
  });

  describe('TickTickProvider', () => {
    it('should be defined', () => {
      expect(ticktickProvider).toBeDefined();
    });

    it('should have correct metadata', () => {
      expect(ticktickProvider.supportsBidirectional).toBe(true);
      expect(ticktickProvider.supportsWebhooks).toBe(false);
      expect(ticktickProvider.supportsFieldMapping).toBe(true);
      expect(ticktickProvider.rateLimitInfo.requestsPerMinute).toBe(180);
      expect(ticktickProvider.rateLimitInfo.batchSize).toBe(100);
    });

    it('should generate authorization URL', () => {
      const url = ticktickProvider.getAuthorizationUrl();
      expect(url).toContain('ticktick.com');
      expect(url).toContain('response_type=code');
    });

    it('should implement all required methods', () => {
      expect(typeof ticktickProvider.fetch).toBe('function');
      expect(typeof ticktickProvider.pushChanges).toBe('function');
      expect(typeof ticktickProvider.exchangeAuthorizationCode).toBe('function');
      expect(typeof ticktickProvider.refreshAccessToken).toBe('function');
    });
  });

  describe('AppleCalendarProvider', () => {
    it('should be defined', () => {
      expect(appleCalendarProvider).toBeDefined();
    });

    it('should have correct metadata', () => {
      expect(appleCalendarProvider.supportsBidirectional).toBe(true);
      expect(appleCalendarProvider.supportsWebhooks).toBe(false);
      expect(appleCalendarProvider.supportsFieldMapping).toBe(true);
      expect(appleCalendarProvider.rateLimitInfo.requestsPerMinute).toBe(500);
      expect(appleCalendarProvider.rateLimitInfo.batchSize).toBe(50);
    });

    it('should generate Apple authorization URL', () => {
      const url = appleCalendarProvider.getAuthorizationUrl();
      expect(url).toContain('appleid.apple.com');
      expect(url).toContain('response_type=code');
    });

    it('should implement all required methods', () => {
      expect(typeof appleCalendarProvider.fetch).toBe('function');
      expect(typeof appleCalendarProvider.pushChanges).toBe('function');
      expect(typeof appleCalendarProvider.exchangeAuthorizationCode).toBe('function');
      expect(typeof appleCalendarProvider.refreshAccessToken).toBe('function');
    });
  });

  describe('AppleNotesProvider', () => {
    it('should be defined', () => {
      expect(appleNotesProvider).toBeDefined();
    });

    it('should have correct metadata', () => {
      expect(appleNotesProvider.supportsBidirectional).toBe(true);
      expect(appleNotesProvider.supportsWebhooks).toBe(false);
      expect(appleNotesProvider.supportsFieldMapping).toBe(true);
      expect(appleNotesProvider.rateLimitInfo.requestsPerMinute).toBe(1000);
      expect(appleNotesProvider.rateLimitInfo.batchSize).toBe(100);
    });

    it('should implement all required methods', () => {
      expect(typeof appleNotesProvider.fetch).toBe('function');
      expect(typeof appleNotesProvider.pushChanges).toBe('function');
      expect(typeof appleNotesProvider.exchangeAuthorizationCode).toBe('function');
      expect(typeof appleNotesProvider.refreshAccessToken).toBe('function');
    });
  });

  describe('AppleRemindersProvider', () => {
    it('should be defined', () => {
      expect(appleRemindersProvider).toBeDefined();
    });

    it('should have correct metadata', () => {
      expect(appleRemindersProvider.supportsBidirectional).toBe(true);
      expect(appleRemindersProvider.supportsWebhooks).toBe(false);
      expect(appleRemindersProvider.supportsFieldMapping).toBe(true);
      expect(appleRemindersProvider.rateLimitInfo.requestsPerMinute).toBe(1000);
      expect(appleRemindersProvider.rateLimitInfo.batchSize).toBe(100);
    });

    it('should implement all required methods', () => {
      expect(typeof appleRemindersProvider.fetch).toBe('function');
      expect(typeof appleRemindersProvider.pushChanges).toBe('function');
      expect(typeof appleRemindersProvider.exchangeAuthorizationCode).toBe('function');
      expect(typeof appleRemindersProvider.refreshAccessToken).toBe('function');
    });
  });

  describe('Provider Interface Compliance', () => {
    [
      { name: 'Linear', provider: () => linearProvider },
      { name: 'Jira', provider: () => jiraProvider },
      { name: 'TickTick', provider: () => ticktickProvider },
      { name: 'Apple Calendar', provider: () => appleCalendarProvider },
      { name: 'Apple Notes', provider: () => appleNotesProvider },
      { name: 'Apple Reminders', provider: () => appleRemindersProvider },
    ].forEach(({ name, provider }) => {
      describe(name, () => {
         it(`${name} should implement IProvider interface`, () => {
           const p = provider();
           // Metadata
           expect(typeof p.supportsBidirectional).toBe('boolean');
           expect(typeof p.supportsWebhooks).toBe('boolean');
           expect(typeof p.supportsFieldMapping).toBe('boolean');
           expect(p.rateLimitInfo).toBeDefined();
           expect(p.rateLimitInfo.requestsPerMinute).toBeGreaterThan(0);
           expect(p.rateLimitInfo.batchSize).toBeGreaterThan(0);

           // OAuth methods
           expect(typeof p.getAuthorizationUrl).toBe('function');
           expect(typeof p.exchangeAuthorizationCode).toBe('function');
           expect(typeof p.refreshAccessToken).toBe('function');

           // Data methods
           expect(typeof p.fetch).toBe('function');
           expect(typeof p.pushChanges).toBe('function');
         });
         });
         });
         });

         describe('Webhook Support', () => {
         it('Linear should support webhooks', async () => {
         const registration = await linearProvider.registerWebhook('https://example.com/webhook');
         expect(registration.id).toBeDefined();
         expect(['active', 'pending']).toContain(registration.status);
         });

         it('Jira should support webhooks', async () => {
         const registration = await jiraProvider.registerWebhook('https://example.com/webhook');
         expect(registration.id).toBeDefined();
         expect(['active', 'pending']).toContain(registration.status);
         });

    it('TickTick should not support webhooks', () => {
      expect(ticktickProvider.supportsWebhooks).toBe(false);
    });

    it('Apple providers should not support webhooks', () => {
      expect(appleCalendarProvider.supportsWebhooks).toBe(false);
      expect(appleNotesProvider.supportsWebhooks).toBe(false);
      expect(appleRemindersProvider.supportsWebhooks).toBe(false);
    });
  });
});
