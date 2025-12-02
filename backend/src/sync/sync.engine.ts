import { Injectable, OnModuleInit } from '@nestjs/common';
import { Queue, Job } from 'bull';
import { InjectQueue } from '@nestjs/bull';
import { Repository, IsNull } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import * as crypto from 'crypto';
import { SyncsService } from '../modules/syncs/syncs.service';
import { IntegrationsService } from '../modules/integrations/integrations.service';
import { SyncStateService } from '../modules/syncs/services/sync-state.service';
import { Sync } from '../modules/syncs/entities/sync.entity';
import { ObjectMapping } from '../modules/syncs/entities/object-mapping.entity';
import { ProvidersRegistry } from '../providers/providers.registry';
import { createChildLogger } from '../common/logger';

const logger = createChildLogger('SyncEngine');

@Injectable()
export class SyncEngine implements OnModuleInit {
  constructor(
    @InjectQueue('sync-processor')
    private syncQueue: Queue,
    @InjectQueue('webhook-processor')
    private webhookQueue: Queue,
    @InjectRepository(Sync)
    private syncsRepository: Repository<Sync>,
    @InjectRepository(ObjectMapping)
    private objectMappingRepository: Repository<ObjectMapping>,
    private syncsService: SyncsService,
    private integrationsService: IntegrationsService,
    private syncStateService: SyncStateService,
    private providersRegistry: ProvidersRegistry,
  ) {}

  onModuleInit(): void {
    logger.info('Initializing sync engine');
    this.setupWorkers();
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    this.schedulePolling();
  }

  private setupWorkers(): void {
    // Sync processor worker
    void this.syncQueue.process(
      5,
      async (job: Job<{ syncId: string }>) =>
        this.processSyncJob(job),
    );

    // Webhook processor worker
    void this.webhookQueue.process(
      10,
      async (job: Job<Record<string, unknown>>) =>
        this.processWebhookJob(job),
    );

    logger.info('Workers initialized');
  }

  private async processSyncJob(job: Job<{ syncId: string }>) {
    const { syncId } = job.data;
    logger.info(`Processing sync job: ${syncId}`);

    try {
      const sync = await this.syncsService.findById(syncId);
      if (!sync) {
        throw new Error('Sync not found');
      }

      const state = await this.syncStateService.getOrCreate(syncId);

      // Get integrations
      const sourceInteg = await this.integrationsService.findById(
        sync.source_integration_id,
      );
      const destInteg = await this.integrationsService.findById(
        sync.destination_integration_id,
      );

      if (!sourceInteg || !destInteg) {
        throw new Error('Integration not found');
      }

      // Get providers
      const sourceProvider = this.providersRegistry.get(sourceInteg.provider);
      const destProvider = this.providersRegistry.get(destInteg.provider);

      // Step 1: Fetch from source
      logger.info(`Fetching from ${sourceInteg.provider}`);
      const sourceData = await sourceProvider.fetch(
        sourceInteg,
        sync.source_config,
        state.source_cursor ?? undefined,
      );

      // Step 2: Fetch from destination (for conflict detection)
      logger.info(`Fetching from ${destInteg.provider}`);
      const destData = await destProvider.fetch(
        destInteg,
        sync.destination_config,
        state.destination_cursor ?? undefined,
      );

      // Step 3: Detect changes
      const { toCreate, toUpdate, toDelete } = await this.detectChanges(
        sync,
        sourceData.objects,
      );

      logger.info(
        `Detected changes: ${toCreate.length} create, ${toUpdate.length} update, ${toDelete.length} delete`,
      );

      // Step 4: Push to destination
      if (sync.direction !== 'one_way' || sync.source_integration_id === sync.destination_integration_id) {
        await destProvider.pushChanges(destInteg, sync.destination_config, {
          toCreate,
          toUpdate,
          toDelete,
        });
      }

      // Step 5: Update sync state
      await this.syncStateService.update(syncId, {
        source_cursor: sourceData.nextCursor,
        destination_cursor: destData.nextCursor,
        last_sync_at: new Date(),
        retry_count: 0,
      });

      logger.info(`Sync completed: ${syncId}`);
      return { success: true };
    } catch (error) {
      logger.error(error, `Sync job failed: ${syncId}`);
      await this.syncStateService.incrementRetryCount(syncId);
      throw error;
    }
  }

  private processWebhookJob(
    job: Job<Record<string, unknown>>,
  ): Promise<{ success: boolean }> {
    const jobData = job.data;
    const webhookId = jobData.webhookId as string | undefined;
    logger.info(`Processing webhook job: ${webhookId}`);

    return new Promise<{ success: boolean }>((resolve) => {
      // TODO: Route webhook to appropriate sync processor
      resolve({ success: true });
    });
  }

  private async detectChanges(
    sync: Sync,
    sourceObjects: Array<Record<string, unknown>>,
  ): Promise<{
    toCreate: Array<Record<string, unknown>>;
    toUpdate: Array<Record<string, unknown>>;
    toDelete: Array<Record<string, unknown>>;
  }> {
    const toCreate: Array<Record<string, unknown>> = [];
    const toUpdate: Array<Record<string, unknown>> = [];
    const toDelete: Array<Record<string, unknown>> = [];

    for (const sourceObj of sourceObjects) {
      const mapping = await this.objectMappingRepository.findOneBy({
        sync_id: sync.id,
        source_object_id: (sourceObj.id as string) || '',
      });

      if (!mapping) {
        // New object - create mapping and add to create list
        toCreate.push(sourceObj);
      } else {
        // Check if source changed
        const sourceChecksum = this.hashObject(sourceObj);
        if (sourceChecksum !== mapping.source_checksum) {
          toUpdate.push(sourceObj);
        }
      }
    }

    // Check for deletions
    const sourceIds = new Set(sourceObjects.map((o) => o.id as string));
    const mappings = await this.objectMappingRepository.find({
      where: { sync_id: sync.id },
    });

    for (const mapping of mappings) {
      if (!sourceIds.has(mapping.source_object_id)) {
        toDelete.push({ id: mapping.destination_object_id });
      }
    }

    return { toCreate, toUpdate, toDelete };
  }

  private hashObject(obj: Record<string, unknown>): string {
    const str = JSON.stringify(obj);
    return crypto.createHash('sha256').update(str).digest('hex');
  }

  private schedulePolling(): void {
    // Schedule polling every 5 minutes
    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    setInterval(async () => {
      try {
        logger.debug('Polling for syncs to run');

        const syncs = await this.syncsRepository.find({
          where: { status: 'active' as const, deleted_at: IsNull() },
        });

        for (const sync of syncs) {
          // Add slight random delay to spread load
          void this.queueSync(sync.id, 'normal');
        }

        logger.debug(`Queued ${syncs.length} syncs for polling`);
      } catch (error) {
        logger.error(error, 'Polling error');
      }
    }, 300000); // 5 minutes
  }

  async queueSync(syncId: string, priority: 'high' | 'normal' = 'normal') {
    const priorityValue = priority === 'high' ? 10 : 5;
    await this.syncQueue.add(
      { syncId },
      {
        priority: priorityValue,
        attempts: 5,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
      },
    );
  }

  async queueWebhook(
    webhookId: string,
    eventType: string,
    payload: Record<string, unknown>,
  ) {
    await this.webhookQueue.add(
      { webhookId, eventType, payload },
      {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 1000,
        },
      },
    );
  }
}
