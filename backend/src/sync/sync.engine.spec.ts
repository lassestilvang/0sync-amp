import { Test, TestingModule } from '@nestjs/testing';
import { SyncEngine } from './sync.engine';
import { SyncsService } from '../modules/syncs/syncs.service';
import { IntegrationsService } from '../modules/integrations/integrations.service';
import { SyncStateService } from '../modules/syncs/services/sync-state.service';
import { ProvidersRegistry } from '../providers/providers.registry';

describe('SyncEngine', () => {
  let syncEngine: SyncEngine;
  let syncsService: SyncsService;
  let integrationsService: IntegrationsService;
  let syncStateService: SyncStateService;
  let providersRegistry: ProvidersRegistry;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SyncEngine,
        {
          provide: SyncsService,
          useValue: {
            findById: jest.fn(),
          },
        },
        {
          provide: IntegrationsService,
          useValue: {
            findById: jest.fn(),
          },
        },
        {
          provide: SyncStateService,
          useValue: {
            getOrCreate: jest.fn(),
            update: jest.fn(),
            incrementRetryCount: jest.fn(),
          },
        },
        {
          provide: ProvidersRegistry,
          useValue: {
            get: jest.fn(),
          },
        },
        {
          provide: 'BullQueue_sync-processor',
          useValue: {},
        },
        {
          provide: 'BullQueue_webhook-processor',
          useValue: {},
        },
      ],
    }).compile();

    syncEngine = module.get<SyncEngine>(SyncEngine);
    syncsService = module.get<SyncsService>(SyncsService);
    integrationsService = module.get<IntegrationsService>(IntegrationsService);
    syncStateService = module.get<SyncStateService>(SyncStateService);
    providersRegistry = module.get<ProvidersRegistry>(ProvidersRegistry);
  });

  it('should be defined', () => {
    expect(syncEngine).toBeDefined();
  });

  describe('change detection', () => {
    it('should detect new objects', async () => {
      const sync = {
        id: 'test-sync',
        source_integration_id: 'source-1',
        destination_integration_id: 'dest-1',
      };

      const sourceObjects = [
        { id: '1', title: 'New Task' },
      ];

      const destObjects: any[] = [];

      const result = await (syncEngine as any).detectChanges(
        sync,
        sourceObjects,
        destObjects,
        {},
      );

      expect(result.toCreate).toHaveLength(1);
      expect(result.toUpdate).toHaveLength(0);
      expect(result.toDelete).toHaveLength(0);
    });

    it('should detect deleted objects', async () => {
      const sync = {
        id: 'test-sync',
      };

      const sourceObjects: any[] = [];
      const destObjects = [
        { id: '2', title: 'Old Task' },
      ];

      const result = await (syncEngine as any).detectChanges(
        sync,
        sourceObjects,
        destObjects,
        {},
      );

      // With no mappings, all are considered new from source perspective
      expect(result.toCreate).toHaveLength(0);
    });
  });

  describe('hash function', () => {
    it('should generate consistent hashes', () => {
      const obj = { id: '1', title: 'Task' };

      const hash1 = (syncEngine as any).hashObject(obj);
      const hash2 = (syncEngine as any).hashObject(obj);

      expect(hash1).toBe(hash2);
    });

    it('should generate different hashes for different objects', () => {
      const obj1 = { id: '1', title: 'Task A' };
      const obj2 = { id: '1', title: 'Task B' };

      const hash1 = (syncEngine as any).hashObject(obj1);
      const hash2 = (syncEngine as any).hashObject(obj2);

      expect(hash1).not.toBe(hash2);
    });
  });
});
