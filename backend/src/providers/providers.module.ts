import { Module } from '@nestjs/common';
import { ProvidersRegistry } from './providers.registry';
// Wave 1 providers
import { NotionProvider } from './notion/notion.provider';
import { TodoistProvider } from './todoist/todoist.provider';
import { GoogleCalendarProvider } from './google/google-calendar.provider';
import { GoogleTasksProvider } from './google/google-tasks.provider';
import { MicrosoftToDoProvider } from './microsoft/microsoft-todo.provider';
// Wave 2: Google family
import { GoogleContactsProvider } from './google/google-contacts.provider';
import { GoogleSheetsProvider } from './google/google-sheets.provider';
import { GmailProvider } from './google/gmail.provider';
// Wave 2: Microsoft family
import { OutlookCalendarProvider } from './microsoft/outlook-calendar.provider';
import { OutlookContactsProvider } from './microsoft/outlook-contacts.provider';
import { OutlookMailProvider } from './microsoft/outlook-mail.provider';
// Wave 2: Services
import { GitHubProvider } from './github/github.provider';
import { TrelloProvider } from './trello/trello.provider';
import { AsanaProvider } from './asana/asana.provider';
// Wave 3: Extended services
import { LinearProvider } from './linear/linear.provider';
import { JiraProvider } from './jira/jira.provider';
import { TickTickProvider } from './ticktick/ticktick.provider';
// Wave 3: Apple
import { AppleCalendarProvider } from './apple/apple-calendar.provider';
import { AppleNotesProvider } from './apple/apple-notes.provider';
import { AppleRemindersProvider } from './apple/apple-reminders.provider';
import { EncryptionService } from '../common/services/encryption.service';

const PROVIDERS = [
  // Wave 1
  NotionProvider,
  TodoistProvider,
  GoogleCalendarProvider,
  GoogleTasksProvider,
  MicrosoftToDoProvider,
  // Wave 2: Google
  GoogleContactsProvider,
  GoogleSheetsProvider,
  GmailProvider,
  // Wave 2: Microsoft
  OutlookCalendarProvider,
  OutlookContactsProvider,
  OutlookMailProvider,
  // Wave 2: Services
  GitHubProvider,
  TrelloProvider,
  AsanaProvider,
  // Wave 3: Extended services
  LinearProvider,
  JiraProvider,
  TickTickProvider,
  // Wave 3: Apple
  AppleCalendarProvider,
  AppleNotesProvider,
  AppleRemindersProvider,
];

@Module({
  providers: [ProvidersRegistry, ...PROVIDERS, EncryptionService],
  exports: [ProvidersRegistry, ...PROVIDERS, EncryptionService],
})
export class ProvidersModule {}
