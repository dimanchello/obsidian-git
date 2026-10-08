import type { GitAction } from '../plugin-constants';
import type { ChangeKind } from '../git/status-parser';

export interface PluginMessages {
  readonly actions: {
    readonly labels: Readonly<Record<GitAction, string>>;
    readonly progress: Readonly<Record<GitAction, string>>;
    readonly success: Readonly<Record<GitAction, string>>;
  };
  readonly ui: {
    readonly commandNamePrefix: string;
    readonly noChangesToCommit: string;
    readonly localVaultRequired: string;
    readonly gitExecutableNotFound: string;
    readonly statusBarAriaLabel: string;
    readonly statusBarTitle: string;
    readonly statusBarLoading: string;
    readonly statusBarUnavailable: string;
    readonly statusBarBrand: string;
    readonly statusBarDetachedBranch: string;
    readonly statusBarChangeSuffix: string;
    readonly statusBarClean: string;
    readonly statusBarAheadPrefix: string;
    readonly statusBarBehindPrefix: string;
    readonly statusBarSeparator: string;
    readonly busyNotice: string;
    readonly autoFetchErrorPrefix: string;
    readonly autoSyncErrorPrefix: string;
    readonly gitErrorPrefix: string;
    readonly gitErrorConsoleLabel: string;
    readonly errorFallback: string;
    readonly errorEllipsis: string;
  };
  readonly settings: {
    readonly executableName: string;
    readonly executableDescription: string;
    readonly fetchIntervalName: string;
    readonly fetchIntervalDescription: string;
    readonly syncIntervalName: string;
    readonly syncIntervalDescription: string;
    readonly commitTemplateName: string;
    readonly commitTemplateDescription: string;
  };
  readonly statusModal: {
    readonly title: string;
    readonly detachedBranch: string;
    readonly branchPrefix: string;
    readonly aheadPrefix: string;
    readonly behindPrefix: string;
    readonly separator: string;
    readonly cleanWorkingTree: string;
    readonly cleanWorkingTreeDescription: string;
    readonly pathSeparator: string;
    readonly stagedSuffix: string;
    readonly fallbackChangeLabel: string;
    readonly upToDate: string;
    readonly sectionConflicts: string;
    readonly sectionStaged: string;
    readonly sectionUnstaged: string;
    readonly sectionUntracked: string;
    readonly openFileTooltip: string;
    readonly closeButton: string;
    readonly syncButton: string;
    readonly commitButton: string;
    readonly changesCountSuffix: string;
    readonly stagedSummarySuffix: string;
  };
  readonly changeLabels: Readonly<Record<ChangeKind, string>>;
  readonly defaultCommitMessageTemplate: string;
}
