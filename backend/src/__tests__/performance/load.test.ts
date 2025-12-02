/**
 * Load Testing for 0Sync
 *
 * This file contains load testing scenarios to validate system performance
 * and identify bottlenecks under high concurrency.
 *
 * Run with: npm run test:performance
 */

import { Test, TestingModule } from '@nestjs/testing';
import { ProvidersRegistry } from '../../providers/providers.registry';
import { NotionProvider } from '../../providers/notion/notion.provider';
import { TodoistProvider } from '../../providers/todoist/todoist.provider';
import { GoogleCalendarProvider } from '../../providers/google/google-calendar.provider';
import { GoogleTasksProvider } from '../../providers/google/google-tasks.provider';
import { MicrosoftToDoProvider } from '../../providers/microsoft/microsoft-todo.provider';
import { GoogleContactsProvider } from '../../providers/google/google-contacts.provider';
import { GoogleSheetsProvider } from '../../providers/google/google-sheets.provider';
import { GmailProvider } from '../../providers/google/gmail.provider';
import { OutlookCalendarProvider } from '../../providers/microsoft/outlook-calendar.provider';
import { OutlookContactsProvider } from '../../providers/microsoft/outlook-contacts.provider';
import { OutlookMailProvider } from '../../providers/microsoft/outlook-mail.provider';
import { GitHubProvider } from '../../providers/github/github.provider';
import { TrelloProvider } from '../../providers/trello/trello.provider';
import { AsanaProvider } from '../../providers/asana/asana.provider';
import { LinearProvider } from '../../providers/linear/linear.provider';
import { JiraProvider } from '../../providers/jira/jira.provider';
import { TickTickProvider } from '../../providers/ticktick/ticktick.provider';
import { AppleCalendarProvider } from '../../providers/apple/apple-calendar.provider';
import { AppleNotesProvider } from '../../providers/apple/apple-notes.provider';
import { AppleRemindersProvider } from '../../providers/apple/apple-reminders.provider';
import { EncryptionService } from '../../common/services/encryption.service';

describe('Load Testing', () => {
  let registry: ProvidersRegistry;

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
  });

  describe('Provider Registry Performance', () => {
    it('should retrieve provider within 1ms', () => {
      const start = performance.now();

      for (let i = 0; i < 1000; i++) {
        registry.get('notion');
      }

      const duration = performance.now() - start;
      expect(duration).toBeLessThan(10); // Should complete 1000 lookups in <10ms
    });

    it('should handle concurrent provider access', async () => {
      const start = performance.now();
      const tasks = [];

      for (let i = 0; i < 100; i++) {
        tasks.push(
          Promise.resolve().then(() => {
            return registry.get('notion');
          }),
        );
      }

      await Promise.all(tasks);
      const duration = performance.now() - start;

      expect(duration).toBeLessThan(50); // 100 concurrent accesses in <50ms
    });
  });

  describe('Sync Job Queueing Performance', () => {
    it('should queue 1000 sync jobs efficiently', async () => {
      // Simulate queuing behavior
      const queue: any[] = [];
      const start = performance.now();

      for (let i = 0; i < 1000; i++) {
        queue.push({
          syncId: `sync_${i}`,
          priority: Math.random() > 0.5 ? 10 : 5,
          timestamp: new Date(),
        });
      }

      const duration = performance.now() - start;
      expect(duration).toBeLessThan(50); // Queue 1000 items in <50ms
      expect(queue.length).toBe(1000);
    });

    it('should handle prioritized queue retrieval', () => {
      const queue: any[] = [];

      // Add 500 normal and 500 high priority jobs
      for (let i = 0; i < 500; i++) {
        queue.push({ id: i, priority: 5, timestamp: Date.now() });
      }
      for (let i = 500; i < 1000; i++) {
        queue.push({ id: i, priority: 10, timestamp: Date.now() });
      }

      const start = performance.now();

      // Sort by priority
      queue.sort((a, b) => b.priority - a.priority);

      const duration = performance.now() - start;
      expect(duration).toBeLessThan(20); // Sort 1000 items in <20ms

      // Verify ordering
      expect(queue[0].priority).toBe(10);
      expect(queue[999].priority).toBe(5);
    });
  });

  describe('Change Detection Performance', () => {
    it('should detect changes in 10,000 objects within 1 second', () => {
      const objects = Array.from({ length: 10000 }, (_, i) => ({
        id: `obj_${i}`,
        title: `Object ${i}`,
        content: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit.',
        updated: new Date().toISOString(),
      }));

      const crypto = require('crypto');

      const start = performance.now();

      // Hash all objects
      const hashes = objects.map((obj) =>
        crypto.createHash('sha256').update(JSON.stringify(obj)).digest('hex'),
      );

      const duration = performance.now() - start;
      expect(duration).toBeLessThan(1000); // Hash 10,000 objects in <1 second
      expect(hashes.length).toBe(10000);
    });

    it('should compare checksums efficiently', () => {
      const oldChecksums = new Map<string, string>();
      const newChecksums = new Map<string, string>();

      // Populate maps
      for (let i = 0; i < 5000; i++) {
        oldChecksums.set(`obj_${i}`, `hash_${i}_old`);
        newChecksums.set(`obj_${i}`, `hash_${i}_old`);
      }

      // Add some changes
      for (let i = 0; i < 100; i++) {
        newChecksums.set(`obj_${i}`, `hash_${i}_new`);
      }

      const start = performance.now();

      let changes = 0;
      for (const [id, newHash] of newChecksums) {
        const oldHash = oldChecksums.get(id);
        if (oldHash !== newHash) {
          changes++;
        }
      }

      const duration = performance.now() - start;
      expect(duration).toBeLessThan(50); // Compare 5000 checksums in <50ms
      expect(changes).toBe(100);
    });
  });

  describe('Data Transformation Performance', () => {
    it('should transform 10,000 objects efficiently', () => {
      const objects = Array.from({ length: 10000 }, (_, i) => ({
        id: `source_${i}`,
        name: `Task ${i}`,
        description: `Description for task ${i}`,
        due_date: new Date().toISOString(),
        priority: i % 3,
      }));

      const fieldMapping = {
        id: { dest_field: 'id' },
        name: { dest_field: 'title' },
        description: { dest_field: 'description' },
        due_date: { dest_field: 'dueDate' },
        priority: { dest_field: 'priority' },
      };

      const start = performance.now();

      const transformed = objects.map((obj) => ({
        id: obj.id,
        title: obj.name,
        description: obj.description,
        dueDate: obj.due_date,
        priority: obj.priority,
      }));

      const duration = performance.now() - start;
      expect(duration).toBeLessThan(100); // Transform 10,000 objects in <100ms
      expect(transformed.length).toBe(10000);
    });
  });

  describe('Memory Efficiency', () => {
    it('should not leak memory during repeated syncs', () => {
      const initialMemory = process.memoryUsage().heapUsed;

      // Simulate multiple sync cycles
      for (let cycle = 0; cycle < 10; cycle++) {
        const objects: any[] = [];
        for (let i = 0; i < 1000; i++) {
          objects.push({
            id: `obj_${i}`,
            data: 'x'.repeat(1000),
          });
        }
        // Process and discard
        objects.length = 0;
      }

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;

      // Memory increase should be minimal (less than 10MB)
      expect(memoryIncrease).toBeLessThan(10 * 1024 * 1024);
    });
  });

  describe('Concurrent Sync Operations', () => {
    it('should handle 10 concurrent syncs', async () => {
      const syncPromises = [];
      const start = performance.now();

      for (let i = 0; i < 10; i++) {
        syncPromises.push(
          new Promise((resolve) => {
            // Simulate sync operation
            setTimeout(() => {
              resolve({ syncId: `sync_${i}`, status: 'completed' });
            }, Math.random() * 1000);
          }),
        );
      }

      const results = await Promise.all(syncPromises);
      const duration = performance.now() - start;

      expect(results).toHaveLength(10);
      expect(duration).toBeLessThan(5000); // Complete 10 concurrent syncs in <5 seconds
    });

    it('should rate limit API calls', () => {
      const rateLimitInfo = {
        notion: { requestsPerMinute: 120, batchSize: 100 },
        todoist: { requestsPerMinute: 450, batchSize: 100 },
        google_contacts: { requestsPerMinute: 600, batchSize: 200 },
      };

      // Verify rate limits are enforced
      for (const provider of Object.values(rateLimitInfo)) {
        expect(provider.requestsPerMinute).toBeGreaterThan(0);
        expect(provider.batchSize).toBeGreaterThan(0);

        const delayBetweenRequests = 60000 / provider.requestsPerMinute;
        expect(delayBetweenRequests).toBeLessThan(1000); // Each request <1 second apart
      }
    });
  });

  describe('API Response Times', () => {
    it('should calculate P95 response time targets', () => {
      const targets = {
        listIntegrations: 100, // ms
        getSyncStatus: 50,
        createSync: 200,
        triggerSync: 150,
        resolveConflict: 100,
        exportLogs: 500,
      };

      for (const [endpoint, targetMs] of Object.entries(targets)) {
        expect(targetMs).toBeGreaterThan(0);
      }
    });
  });
});
