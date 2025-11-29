import { Injectable } from '@nestjs/common';
import { IProvider } from './provider.interface';
import { NotionProvider } from './notion/notion.provider';
import { createChildLogger } from '../common/logger';

const logger = createChildLogger('ProvidersRegistry');

@Injectable()
export class ProvidersRegistry {
  private providers: Map<string, IProvider> = new Map();

  constructor(
    private notionProvider: NotionProvider,
    private todoistProvider: any,
    private googleCalendarProvider: any,
  ) {
    this.registerProviders();
  }

  private registerProviders() {
    this.register('notion', this.notionProvider);
    this.register('todoist', this.todoistProvider);
    this.register('google_calendar', this.googleCalendarProvider);
    // More providers to be registered as they are implemented

    logger.info(`Registered ${this.providers.size} providers`);
  }

  register(name: string, provider: IProvider) {
    this.providers.set(name, provider);
    logger.info(`Registered provider: ${name}`);
  }

  get(name: string): IProvider {
    const provider = this.providers.get(name);
    if (!provider) {
      throw new Error(`Provider not found: ${name}`);
    }
    return provider;
  }

  has(name: string): boolean {
    return this.providers.has(name);
  }

  getAll(): Map<string, IProvider> {
    return this.providers;
  }

  list(): string[] {
    return Array.from(this.providers.keys());
  }
}
