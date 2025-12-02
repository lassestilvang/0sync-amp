import { Injectable } from '@nestjs/common';
import { IProvider } from './provider.interface';
// Wave 1
import { NotionProvider } from './notion/notion.provider';
import { TodoistProvider } from './todoist/todoist.provider';
import { GoogleCalendarProvider } from './google/google-calendar.provider';
import { GoogleTasksProvider } from './google/google-tasks.provider';
import { MicrosoftToDoProvider } from './microsoft/microsoft-todo.provider';
// Wave 2: Google
import { GoogleContactsProvider } from './google/google-contacts.provider';
import { GoogleSheetsProvider } from './google/google-sheets.provider';
import { GmailProvider } from './google/gmail.provider';
// Wave 2: Microsoft
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
import { createChildLogger } from '../common/logger';

const logger = createChildLogger('ProvidersRegistry');

@Injectable()
export class ProvidersRegistry {
  private providers: Map<string, IProvider> = new Map();

  constructor(
    private notionProvider: NotionProvider,
    private todoistProvider: TodoistProvider,
    private googleCalendarProvider: GoogleCalendarProvider,
    private googleTasksProvider: GoogleTasksProvider,
    private microsoftToDoProvider: MicrosoftToDoProvider,
    private googleContactsProvider: GoogleContactsProvider,
    private googleSheetsProvider: GoogleSheetsProvider,
    private gmailProvider: GmailProvider,
    private outlookCalendarProvider: OutlookCalendarProvider,
    private outlookContactsProvider: OutlookContactsProvider,
    private outlookMailProvider: OutlookMailProvider,
    private githubProvider: GitHubProvider,
    private trelloProvider: TrelloProvider,
    private asanaProvider: AsanaProvider,
    private linearProvider: LinearProvider,
    private jiraProvider: JiraProvider,
    private ticktickProvider: TickTickProvider,
    private appleCalendarProvider: AppleCalendarProvider,
    private appleNotesProvider: AppleNotesProvider,
    private appleRemindersProvider: AppleRemindersProvider,
  ) {
    this.registerProviders();
  }

  private registerProviders() {
    // Wave 1
    this.register('notion', this.notionProvider);
    this.register('todoist', this.todoistProvider);
    this.register('google_calendar', this.googleCalendarProvider);
    this.register('google_tasks', this.googleTasksProvider);
    this.register('microsoft_todo', this.microsoftToDoProvider);
    
    // Wave 2: Google
    this.register('google_contacts', this.googleContactsProvider);
    this.register('google_sheets', this.googleSheetsProvider);
    this.register('gmail', this.gmailProvider);
    
    // Wave 2: Microsoft
    this.register('outlook_calendar', this.outlookCalendarProvider);
    this.register('outlook_contacts', this.outlookContactsProvider);
    this.register('outlook_mail', this.outlookMailProvider);
    
    // Wave 2: Services
    this.register('github', this.githubProvider);
    this.register('trello', this.trelloProvider);
    this.register('asana', this.asanaProvider);

    // Wave 3: Extended services
    this.register('linear', this.linearProvider);
    this.register('jira', this.jiraProvider);
    this.register('ticktick', this.ticktickProvider);

    // Wave 3: Apple
    this.register('apple_calendar', this.appleCalendarProvider);
    this.register('apple_notes', this.appleNotesProvider);
    this.register('apple_reminders', this.appleRemindersProvider);

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
