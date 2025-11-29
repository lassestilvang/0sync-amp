import { Module } from '@nestjs/common';
import { ProvidersRegistry } from './providers.registry';
import { NotionProvider } from './notion/notion.provider';
import { TodoistProvider } from './todoist/todoist.provider';
import { GoogleCalendarProvider } from './google/google-calendar.provider';
import { GoogleTasksProvider } from './google/google-tasks.provider';
import { MicrosoftToDoProvider } from './microsoft/microsoft-todo.provider';
import { EncryptionService } from '../common/services/encryption.service';

@Module({
  providers: [
    ProvidersRegistry,
    NotionProvider,
    TodoistProvider,
    GoogleCalendarProvider,
    GoogleTasksProvider,
    MicrosoftToDoProvider,
    EncryptionService,
  ],
  exports: [
    ProvidersRegistry,
    NotionProvider,
    TodoistProvider,
    GoogleCalendarProvider,
    GoogleTasksProvider,
    MicrosoftToDoProvider,
    EncryptionService,
  ],
})
export class ProvidersModule {}
