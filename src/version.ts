import changelogData from './changelog.json';

export type ChangelogChange = string | {
  type?: 'feature' | 'improvement' | 'fix' | 'balance' | string;
  text: string;
};

export interface ChangelogRelease {
  version: string;
  date?: string;
  title?: string;
  description?: string;
  changes?: ChangelogChange[];
}

export const CHANGELOG_HISTORY: ChangelogRelease[] = changelogData as ChangelogRelease[];

export const APP_VERSION = CHANGELOG_HISTORY[0]?.version || 'v1.0.0';


