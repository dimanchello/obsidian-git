import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GitCommandType, PullStrategy } from '../src/git/git-constants';
import { GitExecutableLocator } from '../src/git/git-executable-locator';
import {
  NodeProcessRunner,
  ProcessTermination,
  type ProcessRequest,
  type ProcessResult,
} from '../src/git/process-runner';
import { PLUGIN_TEST_FILE_FIXTURES, PLUGIN_TEST_VALUES } from './plugin.fixtures';

const {
  MockElement,
  MockFileSystemAdapter,
  MockMarkdownView,
  MockMenu,
  MockMenuItem,
  MockModal,
  MockNotice,
  openedModals,
  recordedNotices,
  registeredCommands,
  registeredRibbonIcons,
  shownMenusAtMouse,
  shownMenusAtPosition,
  mockSetIcon,
} = vi.hoisted(() => {
  const HOISTED_CONSTANTS = {
    emptyString: '',
    whitespacePattern: /\s+/,
    tagDiv: 'div',
    tagSpan: 'span',
    clickEvent: 'click',
    keydownEvent: 'keydown',
    titleAttr: 'title',
    placeholderAttr: 'placeholder',
    typeString: 'string',
    rectLeft: 120,
    rectTop: 480,
    zeroCount: 0,
  } as const;

  interface MockDomEvent {
    key?: string;
    ctrlKey?: boolean;
    metaKey?: boolean;
    stopPropagation: () => void;
    preventDefault: () => void;
  }

  function isStringInfo(value: unknown): value is string {
    return typeof value === HOISTED_CONSTANTS.typeString;
  }

  type MockDomListener = (event: MockDomEvent) => void;

  class MockElement {
    public readonly children: MockElement[] = [];
    public readonly classList = new Set<string>();
    public readonly attributes = new Map<string, string>();
    public readonly listeners = new Map<string, MockDomListener[]>();
    public parentElement: MockElement | null = null;
    public textContent: string = HOISTED_CONSTANTS.emptyString;
    public value: string = HOISTED_CONSTANTS.emptyString;
    public placeholder: string = HOISTED_CONSTANTS.emptyString;
    public disabled = false;
    public removed = false;

    public constructor(public readonly tagName: string) {}

    public addClass(...classes: string[]): void {
      for (const token of classes) {
        for (const cls of token.split(HOISTED_CONSTANTS.whitespacePattern)) {
          if (cls.length > HOISTED_CONSTANTS.zeroCount) {
            this.classList.add(cls);
          }
        }
      }
    }

    public removeClass(...classes: string[]): void {
      for (const token of classes) {
        this.classList.delete(token);
      }
    }

    public hasClass(cls: string): boolean {
      return this.classList.has(cls);
    }

    public setText(text: string): void {
      this.children.length = HOISTED_CONSTANTS.zeroCount;
      this.textContent = text;
    }

    public setAttribute(name: string, value: string): void {
      this.attributes.set(name, value);
    }

    public getAttribute(name: string): string | null {
      return this.attributes.get(name) ?? null;
    }

    public empty(): void {
      this.children.length = HOISTED_CONSTANTS.zeroCount;
      this.textContent = HOISTED_CONSTANTS.emptyString;
    }

    public remove(): void {
      this.removed = true;
    }

    public getBoundingClientRect(): { left: number; top: number } {
      return { left: HOISTED_CONSTANTS.rectLeft, top: HOISTED_CONSTANTS.rectTop };
    }

    public createEl(
      tag: string,
      info?:
        | string
        | {
            cls?: string | string[];
            text?: string;
            title?: string;
            placeholder?: string;
            value?: string;
            prepend?: boolean;
          },
      callback?: (el: MockElement) => void,
    ): MockElement {
      const child = new MockElement(tag);
      child.parentElement = this;

      if (isStringInfo(info)) {
        child.addClass(info);
      } else if (info !== undefined) {
        if (info.cls !== undefined) {
          const classes = Array.isArray(info.cls) ? info.cls : [info.cls];
          child.addClass(...classes);
        }
        if (info.text !== undefined) {
          child.textContent = info.text;
        }
        if (info.title !== undefined) {
          child.setAttribute(HOISTED_CONSTANTS.titleAttr, info.title);
        }
        if (info.placeholder !== undefined) {
          child.placeholder = info.placeholder;
          child.setAttribute(HOISTED_CONSTANTS.placeholderAttr, info.placeholder);
        }
        if (info.value !== undefined) {
          child.value = info.value;
        }
      }

      if (!isStringInfo(info) && info?.prepend === true) {
        this.children.unshift(child);
      } else {
        this.children.push(child);
      }

      callback?.(child);
      return child;
    }

    public createDiv(
      info?: string | Record<string, unknown>,
      callback?: (el: MockElement) => void,
    ): MockElement {
      return this.createEl(HOISTED_CONSTANTS.tagDiv, info as never, callback);
    }

    public createSpan(
      info?: string | Record<string, unknown>,
      callback?: (el: MockElement) => void,
    ): MockElement {
      return this.createEl(HOISTED_CONSTANTS.tagSpan, info as never, callback);
    }

    public addEventListener(type: string, listener: MockDomListener): void {
      const existing = this.listeners.get(type) ?? [];
      existing.push(listener);
      this.listeners.set(type, existing);
    }

    public focus = vi.fn();

    public getFullText(): string {
      if (this.children.length === HOISTED_CONSTANTS.zeroCount) {
        return this.textContent;
      }
      return (
        this.textContent +
        this.children.map((child) => child.getFullText()).join(HOISTED_CONSTANTS.emptyString)
      );
    }

    public findAllByTag(tagName: string): MockElement[] {
      const matches: MockElement[] = [];
      if (this.tagName === tagName) {
        matches.push(this);
      }
      for (const child of this.children) {
        matches.push(...child.findAllByTag(tagName));
      }
      return matches;
    }

    public findByClass(cls: string): MockElement | undefined {
      if (this.hasClass(cls)) {
        return this;
      }
      for (const child of this.children) {
        const match = child.findByClass(cls);
        if (match !== undefined) {
          return match;
        }
      }
      return undefined;
    }

    public findByText(text: string): MockElement | undefined {
      if (this.getFullText() === text) {
        return this;
      }
      for (const child of this.children) {
        const match = child.findByText(text);
        if (match !== undefined) {
          return match;
        }
      }
      return undefined;
    }

    public click(): void {
      this.dispatchDomEvent(HOISTED_CONSTANTS.clickEvent, {});
    }

    public keydown(key: string): { defaultPrevented: boolean } {
      return this.dispatchDomEvent(HOISTED_CONSTANTS.keydownEvent, { key });
    }

    private dispatchDomEvent(
      type: string,
      init: { key?: string; ctrlKey?: boolean; metaKey?: boolean },
    ): { defaultPrevented: boolean } {
      let stopped = false;
      let defaultPrevented = false;
      const event: MockDomEvent = {
        ...init,
        stopPropagation: () => {
          stopped = true;
        },
        preventDefault: () => {
          defaultPrevented = true;
        },
      };

      let current: MockElement | null = this;
      while (current !== null && !stopped) {
        const listeners = current.listeners.get(type) ?? [];
        for (const listener of listeners) {
          listener(event);
        }
        current = current.parentElement;
      }
      return { defaultPrevented };
    }
  }

  class MockMenuItem {
    public title: string = HOISTED_CONSTANTS.emptyString;
    public icon: string = HOISTED_CONSTANTS.emptyString;
    public disabled = false;
    public clickCallback: ((evt: MouseEvent) => unknown) | null = null;

    public setTitle(title: string): this {
      this.title = title;
      return this;
    }

    public setIcon(icon: string): this {
      this.icon = icon;
      return this;
    }

    public setDisabled(disabled: boolean): this {
      this.disabled = disabled;
      return this;
    }

    public onClick(callback: (evt: MouseEvent) => unknown): this {
      this.clickCallback = callback;
      return this;
    }
  }

  const shownMenusAtMouse: MockMenu[] = [];
  const shownMenusAtPosition: { menu: MockMenu; position: { x: number; y: number } }[] = [];

  class MockMenu {
    public static instances: MockMenu[] = [];
    public readonly items: MockMenuItem[] = [];
    public readonly separators: number[] = [];

    public constructor() {
      MockMenu.instances.push(this);
    }

    public addItem(cb: (item: MockMenuItem) => unknown): this {
      const item = new MockMenuItem();
      cb(item);
      this.items.push(item);
      return this;
    }

    public addSeparator(): this {
      this.separators.push(this.items.length);
      return this;
    }

    public showAtMouseEvent(_event: MouseEvent): this {
      shownMenusAtMouse.push(this);
      return this;
    }

    public showAtPosition(position: { x: number; y: number }): this {
      shownMenusAtPosition.push({ menu: this, position });
      return this;
    }
  }

  interface MockCommand {
    id: string;
    name: string;
    callback?: () => unknown;
    checkCallback?: (checking: boolean) => boolean | void;
  }

  const registeredCommands: MockCommand[] = [];
  const recordedNotices: { message: string; duration?: number }[] = [];

  class MockNotice {
    public constructor(message: string, duration?: number) {
      recordedNotices.push(duration === undefined ? { message } : { message, duration });
    }
  }

  const openedModals: MockModal[] = [];

  class MockModal {
    public app: unknown;
    public modalEl = new MockElement(HOISTED_CONSTANTS.tagDiv);
    public titleEl = new MockElement(HOISTED_CONSTANTS.tagDiv);
    public contentEl = new MockElement(HOISTED_CONSTANTS.tagDiv);
    public isOpen = false;

    public constructor(app: unknown) {
      this.app = app;
    }

    public open(): void {
      this.isOpen = true;
      openedModals.push(this);
      (this as unknown as { onOpen?: () => void }).onOpen?.();
    }

    public close(): void {
      this.isOpen = false;
      (this as unknown as { onClose?: () => void }).onClose?.();
    }
  }

  class MockFileSystemAdapter {
    public constructor(private readonly basePath: string) {}
    public getBasePath(): string {
      return this.basePath;
    }
  }

  class MockMarkdownView {
    public save = vi.fn(async () => {});
  }

  const registeredRibbonIcons: {
    icon: string;
    title: string;
    callback: (evt: MouseEvent) => unknown;
    element: MockElement;
  }[] = [];

  const mockSetIcon = vi.fn();

  return {
    MockElement,
    MockFileSystemAdapter,
    MockMarkdownView,
    MockMenu,
    MockMenuItem,
    MockModal,
    MockNotice,
    openedModals,
    recordedNotices,
    registeredCommands,
    registeredRibbonIcons,
    shownMenusAtMouse,
    shownMenusAtPosition,
    mockSetIcon,
  };
});

vi.mock('obsidian', () => {
  class MockPlugin {
    public app: unknown;
    public manifest: unknown;
    public readonly cleanups: (() => void)[] = [];
    public readonly statusBarElements: InstanceType<typeof MockElement>[] = [];

    public constructor(app: unknown, manifest: unknown) {
      this.app = app;
      this.manifest = manifest;
    }

    public addCommand(command: unknown): unknown {
      registeredCommands.push(command as never);
      return command;
    }

    public addSettingTab(): void {}

    public addStatusBarItem(): HTMLElement {
      const element = new MockElement(PLUGIN_TEST_VALUES.domTagDiv);
      this.statusBarElements.push(element);
      return element as unknown as HTMLElement;
    }

    public addRibbonIcon(
      icon: string,
      title: string,
      callback: (evt: MouseEvent) => unknown,
    ): HTMLElement {
      const element = new MockElement(PLUGIN_TEST_VALUES.domTagDiv);
      registeredRibbonIcons.push({ icon, title, callback, element });
      return element as unknown as HTMLElement;
    }

    public registerDomEvent(
      element: HTMLElement,
      event: string,
      callback: (evt: never) => void,
    ): void {
      (element as unknown as InstanceType<typeof MockElement>).addEventListener(
        event,
        callback as never,
      );
    }

    public registerInterval(): void {}
    public registerEvent(): void {}

    public register(callback: () => void): void {
      this.cleanups.push(callback);
    }

    public loadData(): Promise<unknown> {
      return Promise.resolve({});
    }

    public saveData(): Promise<void> {
      return Promise.resolve();
    }
  }

  return {
    Plugin: MockPlugin,
    PluginSettingTab: class {},
    Setting: class {},
    Modal: MockModal,
    Menu: MockMenu,
    Notice: MockNotice,
    setIcon: mockSetIcon,
    getLanguage: vi.fn(() => PLUGIN_TEST_VALUES.englishLanguage),
    FileSystemAdapter: MockFileSystemAdapter,
    MarkdownView: MockMarkdownView,
    TextFileView: class {},
    TFile: class {},
  };
});

import GitCommandsPlugin from '../src/main';
import {
  CommitMessageModal,
  GitDiffModal,
  GitErrorModal,
  GitHistoryModal,
} from '../src/git-modals';
import {
  GIT_ACTION_COMMAND_IDS,
  GIT_ACTION_ORDER,
  GitAction,
  PLUGIN_DOM_NAMES,
  STATUS_BAR_ICONS,
  STATUS_BAR_KEYBOARD_KEYS,
} from '../src/plugin-constants';
import { AutoSyncNotificationMode, StatusBarClickAction, type GitPluginSettings } from '../src/settings';
import { GitStatusModal } from '../src/status-modal';

interface Deferred<T> {
  readonly promise: Promise<T>;
  readonly resolve: (value: T) => void;
  readonly reject: (reason?: unknown) => void;
}

function createDeferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function successResult(stdout: string = PLUGIN_TEST_VALUES.emptyString): ProcessResult {
  return {
    exitCode: PLUGIN_TEST_VALUES.exitCodeSuccess,
    stdout,
    stderr: PLUGIN_TEST_VALUES.emptyString,
    termination: ProcessTermination.Exited,
  };
}

function failureResult(
  exitCode: number | null,
  stderr: string = PLUGIN_TEST_VALUES.emptyString,
  stdout: string = PLUGIN_TEST_VALUES.emptyString,
  termination: ProcessTermination = ProcessTermination.Exited,
): ProcessResult {
  return {
    exitCode,
    stdout,
    stderr,
    termination,
  };
}

function createVaultTestHarness(options?: {
  readonly storedSettings?: Partial<GitPluginSettings>;
  readonly leaves?: readonly unknown[];
  readonly configDir?: string;
}) {
  const vaultListeners = new Map<string, (() => void)[]>();
  const savedSettingsHistory: unknown[] = [];
  let currentData: unknown = options?.storedSettings ?? {};

  const app = {
    vault: {
      adapter: new MockFileSystemAdapter(PLUGIN_TEST_VALUES.vaultPath),
      configDir: options?.configDir ?? PLUGIN_TEST_VALUES.defaultConfigDir,
      on: vi.fn((eventName: string, cb: () => void) => {
        const list = vaultListeners.get(eventName) ?? [];
        list.push(cb);
        vaultListeners.set(eventName, list);
        return { eventName, cb };
      }),
      getAbstractFileByPath: vi.fn(() => null),
    },
    workspace: {
      iterateAllLeaves: vi.fn((cb: (leaf: { view: unknown }) => void) => {
        for (const view of options?.leaves ?? []) {
          cb({ view });
        }
      }),
      openLinkText: vi.fn(async () => {}),
    },
  };

  const plugin = new GitCommandsPlugin(app as never, {} as never);
  vi.spyOn(plugin, 'loadData').mockImplementation(async () => currentData);
  vi.spyOn(plugin, 'saveData').mockImplementation(async (data: unknown) => {
    currentData = data;
    savedSettingsHistory.push(data);
  });

  const emitVaultEvent = (eventName: string): void => {
    for (const cb of vaultListeners.get(eventName) ?? []) {
      cb();
    }
  };

  const setStoredData = (nextData: unknown): void => {
    currentData = nextData;
  };

  const getStatusBarElement = (): InstanceType<typeof MockElement> => {
    const elements = (
      plugin as unknown as { statusBarElements: InstanceType<typeof MockElement>[] }
    ).statusBarElements;
    const item = elements[PLUGIN_TEST_VALUES.firstIndex];
    if (item === undefined) {
      throw new Error(PLUGIN_TEST_VALUES.missingStatusBarElementError);
    }
    return item;
  };

  return {
    app,
    plugin,
    savedSettingsHistory,
    emitVaultEvent,
    setStoredData,
    getStatusBarElement,
  };
}

async function flushMicrotasks(): Promise<void> {
  for (let tick = PLUGIN_TEST_VALUES.zeroCount; tick < PLUGIN_TEST_VALUES.microtaskTicks; tick++) {
    await Promise.resolve();
  }
}

function findCommand(action: GitAction) {
  return registeredCommands.find((cmd) => cmd.id === GIT_ACTION_COMMAND_IDS[action]);
}

function isStatusInvocation(args: readonly string[]): boolean {
  return args.includes(GitCommandType.Status);
}

function isRevParsePrefixInvocation(args: readonly string[]): boolean {
  return args.includes(PLUGIN_TEST_VALUES.revParseShowPrefixFlag);
}

function isRevParseGitPathInvocation(args: readonly string[]): boolean {
  return args.includes(PLUGIN_TEST_VALUES.revParseGitPathFlag);
}

function isCachedDiffInvocation(args: readonly string[]): boolean {
  return (
    args.includes(PLUGIN_TEST_VALUES.cachedFlag) && args.includes(PLUGIN_TEST_VALUES.quietFlag)
  );
}

function isLsFilesInvocation(args: readonly string[]): boolean {
  return args[PLUGIN_TEST_VALUES.firstIndex] === GitCommandType.LsFiles;
}

describe('GitCommandsPlugin', () => {
  beforeEach(() => {
    MockMenu.instances.length = PLUGIN_TEST_VALUES.zeroCount;
    openedModals.length = PLUGIN_TEST_VALUES.zeroCount;
    recordedNotices.length = PLUGIN_TEST_VALUES.zeroCount;
    registeredCommands.length = PLUGIN_TEST_VALUES.zeroCount;
    registeredRibbonIcons.length = PLUGIN_TEST_VALUES.zeroCount;
    shownMenusAtMouse.length = PLUGIN_TEST_VALUES.zeroCount;
    shownMenusAtPosition.length = PLUGIN_TEST_VALUES.zeroCount;

    vi.stubGlobal(PLUGIN_TEST_VALUES.windowGlobalName, {
      setInterval: (...args: Parameters<typeof setInterval>) => globalThis.setInterval(...args),
      clearInterval: (...args: Parameters<typeof clearInterval>) => globalThis.clearInterval(...args),
      setTimeout: (...args: Parameters<typeof setTimeout>) => globalThis.setTimeout(...args),
      clearTimeout: (...args: Parameters<typeof clearTimeout>) => globalThis.clearTimeout(...args),
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('loads without blocking on git executable discovery or status and warns once when workspace files are tracked', async () => {
    const locateDeferred = createDeferred<string | null>();
    const statusDeferred = createDeferred<ProcessResult>();
    const lsFilesRequests: ProcessRequest[] = [];
    vi.spyOn(GitExecutableLocator.prototype, 'locate').mockReturnValue(locateDeferred.promise);
    vi.spyOn(NodeProcessRunner.prototype, 'run').mockImplementation(async (request) => {
      if (isStatusInvocation(request.args)) {
        return statusDeferred.promise;
      }
      if (isLsFilesInvocation(request.args)) {
        lsFilesRequests.push(request);
        return successResult(PLUGIN_TEST_VALUES.trackedWorkspaceOutput);
      }
      return successResult();
    });

    const { plugin, getStatusBarElement } = createVaultTestHarness();
    let onloadResolved = false;
    const onloadPromise = plugin.onload().then(() => {
      onloadResolved = true;
    });
    await flushMicrotasks();

    expect(onloadResolved).toBe(true);
    await onloadPromise;
    expect(getStatusBarElement().textContent || getStatusBarElement().getFullText()).toBe(
      plugin.messages.ui.statusBarLoading,
    );
    expect(registeredCommands).toHaveLength(PLUGIN_TEST_VALUES.actionCount);
    for (const action of GIT_ACTION_ORDER) {
      const command = findCommand(action);
      expect(command).toBeDefined();
      expect(command?.name).toBe(PLUGIN_TEST_VALUES.commandPrefix + plugin.messages.actions.labels[action]);
    }

    locateDeferred.resolve(PLUGIN_TEST_VALUES.resolvedGitExecutable);
    await flushMicrotasks();
    statusDeferred.resolve(successResult(PLUGIN_TEST_VALUES.statusCleanOutput));
    await flushMicrotasks();

    expect(getStatusBarElement().getFullText()).toBe(PLUGIN_TEST_VALUES.expectedCleanStatusText);
    expect(lsFilesRequests).toHaveLength(PLUGIN_TEST_VALUES.oneCount);
    expect(lsFilesRequests[PLUGIN_TEST_VALUES.firstIndex]?.args).toEqual(
      expect.arrayContaining([...PLUGIN_TEST_VALUES.expectedDefaultWorkspacePaths]),
    );
    expect(
      recordedNotices.some((n) => n.message === plugin.messages.ui.workspaceFileTrackedWarning),
    ).toBe(true);

    plugin.onunload();
  });

  it('uses Vault#configDir when checking for tracked Obsidian workspace files', async () => {
    const lsFilesRequests: ProcessRequest[] = [];
    vi.spyOn(GitExecutableLocator.prototype, 'locate').mockResolvedValue(
      PLUGIN_TEST_VALUES.resolvedGitExecutable,
    );
    vi.spyOn(NodeProcessRunner.prototype, 'run').mockImplementation(async (request) => {
      if (isStatusInvocation(request.args)) {
        return successResult(PLUGIN_TEST_VALUES.statusCleanOutput);
      }
      if (isLsFilesInvocation(request.args)) {
        lsFilesRequests.push(request);
        return successResult(PLUGIN_TEST_VALUES.customTrackedWorkspaceOutput);
      }
      return successResult();
    });

    const { plugin } = createVaultTestHarness({
      configDir: PLUGIN_TEST_VALUES.customConfigDir,
    });
    await plugin.onload();
    await flushMicrotasks();

    expect(lsFilesRequests).toHaveLength(PLUGIN_TEST_VALUES.oneCount);
    expect(lsFilesRequests[PLUGIN_TEST_VALUES.firstIndex]?.args).toEqual(
      expect.arrayContaining([...PLUGIN_TEST_VALUES.expectedCustomWorkspacePaths]),
    );
    expect(
      recordedNotices.some((n) => n.message === plugin.messages.ui.workspaceFileTrackedWarning),
    ).toBe(true);

    plugin.onunload();
  });

  it('configures status bar click and keyboard actions consistently for Menu and StatusModal modes', async () => {
    vi.spyOn(GitExecutableLocator.prototype, 'locate').mockResolvedValue(
      PLUGIN_TEST_VALUES.resolvedGitExecutable,
    );
    vi.spyOn(NodeProcessRunner.prototype, 'run').mockImplementation(async (request) => {
      if (isStatusInvocation(request.args)) {
        return successResult(PLUGIN_TEST_VALUES.statusCleanOutput);
      }
      return successResult();
    });

    const { plugin, getStatusBarElement } = createVaultTestHarness();
    await plugin.onload();
    await flushMicrotasks();

    const statusBar = getStatusBarElement();
    statusBar.click();
    expect(shownMenusAtMouse).toHaveLength(PLUGIN_TEST_VALUES.oneCount);
    const menu = shownMenusAtMouse[PLUGIN_TEST_VALUES.firstIndex];
    expect(menu?.items).toHaveLength(PLUGIN_TEST_VALUES.actionCount);
    expect(menu?.separators).toHaveLength(PLUGIN_TEST_VALUES.expectedSeparatorsCount);
    expect(menu?.items[PLUGIN_TEST_VALUES.menuItemAbortIndex]?.title).toBe(
      plugin.messages.actions.labels[GitAction.Abort],
    );
    expect(menu?.items[PLUGIN_TEST_VALUES.menuItemAbortIndex]?.disabled).toBe(true);

    const keyResult = statusBar.keydown(STATUS_BAR_KEYBOARD_KEYS.Enter);
    expect(keyResult.defaultPrevented).toBe(true);
    expect(shownMenusAtPosition).toHaveLength(PLUGIN_TEST_VALUES.oneCount);
    expect(shownMenusAtPosition[PLUGIN_TEST_VALUES.firstIndex]?.position).toEqual({
      x: PLUGIN_TEST_VALUES.statusBarRectLeft,
      y: PLUGIN_TEST_VALUES.statusBarRectTop,
    });

    plugin.settings.statusBarClickAction = StatusBarClickAction.StatusModal;
    statusBar.click();
    await flushMicrotasks();
    expect(openedModals.filter((m) => m instanceof GitStatusModal)).toHaveLength(
      PLUGIN_TEST_VALUES.oneCount,
    );

    const spaceResult = statusBar.keydown(STATUS_BAR_KEYBOARD_KEYS.Space);
    expect(spaceResult.defaultPrevented).toBe(true);
    await flushMicrotasks();
    const statusModals = openedModals.filter((m) => m instanceof GitStatusModal);
    expect(statusModals).toHaveLength(PLUGIN_TEST_VALUES.twoCount);
    expect(statusModals[PLUGIN_TEST_VALUES.firstIndex]?.isOpen).toBe(false);
    expect(statusModals[PLUGIN_TEST_VALUES.secondIndex]?.isOpen).toBe(true);

    plugin.onunload();
  });

  it('keeps operationRunning locked during refreshStatus and enables abort menu and command while running', async () => {
    vi.spyOn(GitExecutableLocator.prototype, 'locate').mockResolvedValue(
      PLUGIN_TEST_VALUES.resolvedGitExecutable,
    );

    const fetchDeferred = createDeferred<ProcessResult>();
    const postFetchStatusDeferred = createDeferred<ProcessResult>();
    let fetchAttempted = false;

    vi.spyOn(NodeProcessRunner.prototype, 'run').mockImplementation(async (request) => {
      if (isStatusInvocation(request.args)) {
        if (!fetchAttempted) {
          return successResult(PLUGIN_TEST_VALUES.statusCleanOutput);
        }
        return postFetchStatusDeferred.promise;
      }
      if (request.args.includes(GitCommandType.Fetch)) {
        fetchAttempted = true;
        return fetchDeferred.promise;
      }
      return successResult();
    });

    const { plugin, getStatusBarElement } = createVaultTestHarness();
    await plugin.onload();
    await flushMicrotasks();

    const abortCmd = findCommand(GitAction.Abort);
    expect(abortCmd?.checkCallback?.(true)).toBe(false);

    findCommand(GitAction.Fetch)?.callback?.();
    await flushMicrotasks();

    expect(plugin.isOperationRunning()).toBe(true);
    expect(abortCmd?.checkCallback?.(true)).toBe(true);

    getStatusBarElement().click();
    const runningMenu = MockMenu.instances[MockMenu.instances.length - PLUGIN_TEST_VALUES.oneCount];
    expect(runningMenu?.items[PLUGIN_TEST_VALUES.menuItemAbortIndex]?.disabled).toBe(false);

    fetchDeferred.resolve(successResult());
    await flushMicrotasks();

    expect(plugin.isOperationRunning()).toBe(true);
    findCommand(GitAction.Pull)?.callback?.();
    await flushMicrotasks();
    expect(recordedNotices.some((n) => n.message === plugin.messages.ui.busyNotice)).toBe(true);

    postFetchStatusDeferred.resolve(successResult(PLUGIN_TEST_VALUES.statusCleanOutput));
    await flushMicrotasks();

    expect(plugin.isOperationRunning()).toBe(false);
    expect(abortCmd?.checkCallback?.(true)).toBe(false);

    plugin.onunload();
  });

  it('executes PushOnly without committing, Push after flushing editors, and Sync with configured PullStrategy', async () => {
    vi.spyOn(GitExecutableLocator.prototype, 'locate').mockResolvedValue(
      PLUGIN_TEST_VALUES.resolvedGitExecutable,
    );
    const requests: ProcessRequest[] = [];
    vi.spyOn(NodeProcessRunner.prototype, 'run').mockImplementation(async (request) => {
      requests.push(request);
      if (isStatusInvocation(request.args)) {
        return successResult(PLUGIN_TEST_VALUES.statusModifiedOutput);
      }
      if (isCachedDiffInvocation(request.args)) {
        return failureResult(PLUGIN_TEST_VALUES.exitCodeOne);
      }
      return successResult();
    });

    const markdownView = new MockMarkdownView();
    const { plugin } = createVaultTestHarness({
      leaves: [markdownView],
      storedSettings: {
        pullStrategy: PullStrategy.Rebase,
        processTimeoutSeconds: PLUGIN_TEST_VALUES.customTimeoutSeconds,
      },
    });
    await plugin.onload();
    await flushMicrotasks();

    requests.length = PLUGIN_TEST_VALUES.zeroCount;
    findCommand(GitAction.PushOnly)?.callback?.();
    await flushMicrotasks();

    expect(markdownView.save).not.toHaveBeenCalled();
    expect(requests.map((r) => r.args)).toContainEqual([GitCommandType.Push]);
    expect(requests.some((r) => r.args.includes(GitCommandType.Commit))).toBe(false);
    expect(requests[PLUGIN_TEST_VALUES.firstIndex]?.timeoutMs).toBe(
      PLUGIN_TEST_VALUES.expectedTimeoutMs,
    );

    requests.length = PLUGIN_TEST_VALUES.zeroCount;
    findCommand(GitAction.Push)?.callback?.();
    await flushMicrotasks();

    expect(markdownView.save).toHaveBeenCalledTimes(PLUGIN_TEST_VALUES.oneCount);
    expect(requests.some((r) => r.args.includes(GitCommandType.Commit))).toBe(true);
    expect(requests.some((r) => r.args.includes(GitCommandType.Push))).toBe(true);

    requests.length = PLUGIN_TEST_VALUES.zeroCount;
    findCommand(GitAction.Sync)?.callback?.();
    await flushMicrotasks();

    expect(markdownView.save).toHaveBeenCalledTimes(PLUGIN_TEST_VALUES.twoCount);
    expect(requests.some((r) => r.args.includes(PLUGIN_TEST_VALUES.rebaseFlag))).toBe(true);

    plugin.onunload();
  });

  it('replaces all {datetime} tokens in commit messages and supports CommitWithMessage modal', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(PLUGIN_TEST_VALUES.testDateIso));

    vi.spyOn(GitExecutableLocator.prototype, 'locate').mockResolvedValue(
      PLUGIN_TEST_VALUES.resolvedGitExecutable,
    );
    const commitMessages: string[] = [];
    vi.spyOn(NodeProcessRunner.prototype, 'run').mockImplementation(async (request) => {
      if (isStatusInvocation(request.args)) {
        return successResult(PLUGIN_TEST_VALUES.statusModifiedOutput);
      }
      if (isCachedDiffInvocation(request.args)) {
        return failureResult(PLUGIN_TEST_VALUES.exitCodeOne);
      }
      if (request.args[PLUGIN_TEST_VALUES.firstIndex] === GitCommandType.Commit) {
        const msg = request.args[PLUGIN_TEST_VALUES.thirdIndex];
        if (msg !== undefined) {
          commitMessages.push(msg);
        }
      }
      return successResult();
    });

    const { plugin } = createVaultTestHarness({
      storedSettings: {
        commitMessageTemplate: PLUGIN_TEST_VALUES.repeatedDatetimeTemplate,
      },
    });
    await plugin.onload();
    await flushMicrotasks();

    findCommand(GitAction.CommitAll)?.callback?.();
    await flushMicrotasks();

    expect(commitMessages).toEqual([PLUGIN_TEST_VALUES.expectedRepeatedCommitMessage]);

    findCommand(GitAction.CommitWithMessage)?.callback?.();
    const commitModal = openedModals.find((m) => m instanceof CommitMessageModal);
    expect(commitModal).toBeDefined();
    const textarea = commitModal?.contentEl.findAllByTag(PLUGIN_TEST_VALUES.domTagTextarea)[
      PLUGIN_TEST_VALUES.firstIndex
    ];
    expect(textarea).toBeDefined();
    if (textarea !== undefined) {
      textarea.value = PLUGIN_TEST_VALUES.customCommitMessage;
    }
    commitModal?.contentEl
      .findByText(plugin.messages.modals.commitMessage.submitButton)
      ?.click();
    await flushMicrotasks();

    expect(commitMessages[PLUGIN_TEST_VALUES.secondIndex]).toBe(
      PLUGIN_TEST_VALUES.customCommitMessage,
    );

    plugin.onunload();
  });

  it('renders conflict status bar state, formats conflict and empty-output errors, and opens GitErrorModal or noLastError', async () => {
    const consoleErrorSpy = vi
      .spyOn(console, PLUGIN_TEST_VALUES.consoleErrorMethod)
      .mockImplementation(() => {});
    vi.spyOn(GitExecutableLocator.prototype, 'locate').mockResolvedValue(
      PLUGIN_TEST_VALUES.resolvedGitExecutable,
    );
    let failPushWithEmptyOutput = false;
    let failPullWithRemoteError = false;

    vi.spyOn(NodeProcessRunner.prototype, 'run').mockImplementation(async (request) => {
      if (isStatusInvocation(request.args)) {
        return successResult(PLUGIN_TEST_VALUES.statusConflictOutput);
      }
      if (isRevParseGitPathInvocation(request.args)) {
        return successResult();
      }
      if (request.args[PLUGIN_TEST_VALUES.firstIndex] === GitCommandType.Push && failPushWithEmptyOutput) {
        return failureResult(PLUGIN_TEST_VALUES.exitCodeFatal);
      }
      if (request.args[PLUGIN_TEST_VALUES.firstIndex] === GitCommandType.Pull && failPullWithRemoteError) {
        return failureResult(
          PLUGIN_TEST_VALUES.exitCodeOne,
          PLUGIN_TEST_VALUES.sampleStderr,
          PLUGIN_TEST_VALUES.sampleStdout,
        );
      }
      return successResult();
    });

    const { plugin, getStatusBarElement } = createVaultTestHarness();
    await plugin.onload();
    await flushMicrotasks();

    const statusBar = getStatusBarElement();
    expect(statusBar.hasClass(PLUGIN_DOM_NAMES.statusBarConflictClass)).toBe(true);
    expect(statusBar.getFullText()).toBe(PLUGIN_TEST_VALUES.expectedConflictStatusText);
    expect(mockSetIcon).toHaveBeenCalledWith(expect.anything(), STATUS_BAR_ICONS.warning);

    findCommand(GitAction.ShowLastError)?.callback?.();
    expect(recordedNotices.some((n) => n.message === plugin.messages.ui.noLastError)).toBe(true);

    findCommand(GitAction.CommitAll)?.callback?.();
    await flushMicrotasks();
    expect(
      recordedNotices.some(
        (n) =>
          n.message ===
          plugin.messages.ui.gitErrorPrefix + plugin.messages.ui.conflictInProgressError,
      ),
    ).toBe(true);

    failPushWithEmptyOutput = true;
    findCommand(GitAction.PushOnly)?.callback?.();
    await flushMicrotasks();
    expect(
      recordedNotices.some(
        (n) =>
          n.message ===
          plugin.messages.ui.gitErrorPrefix +
            plugin.messages.ui.exitCodeFallback +
            String(PLUGIN_TEST_VALUES.exitCodeFatal),
      ),
    ).toBe(true);

    failPushWithEmptyOutput = false;
    failPullWithRemoteError = true;
    findCommand(GitAction.Pull)?.callback?.();
    await flushMicrotasks();

    findCommand(GitAction.ShowLastError)?.callback?.();
    const errorModal = openedModals.find((m) => m instanceof GitErrorModal);
    expect(errorModal).toBeDefined();
    expect(errorModal?.contentEl.getFullText()).toContain(PLUGIN_TEST_VALUES.sampleStderr);
    expect(errorModal?.contentEl.getFullText()).toContain(PLUGIN_TEST_VALUES.sampleStdout);
    expect(consoleErrorSpy).toHaveBeenCalled();

    plugin.onunload();
  });

  it('honors AutoSyncNotificationMode for autoSync, autoBackup, and autoPullOnLoad', async () => {
    vi.useFakeTimers();
    const consoleErrorSpy = vi
      .spyOn(console, PLUGIN_TEST_VALUES.consoleErrorMethod)
      .mockImplementation(() => {});
    vi.spyOn(GitExecutableLocator.prototype, 'locate').mockResolvedValue(
      PLUGIN_TEST_VALUES.resolvedGitExecutable,
    );

    let pullFails = true;
    let pushFails = false;
    vi.spyOn(NodeProcessRunner.prototype, 'run').mockImplementation(async (request) => {
      if (isStatusInvocation(request.args)) {
        return successResult(PLUGIN_TEST_VALUES.statusModifiedOutput);
      }
      if (isRevParsePrefixInvocation(request.args) || isRevParseGitPathInvocation(request.args)) {
        return successResult();
      }
      if (isCachedDiffInvocation(request.args)) {
        return failureResult(PLUGIN_TEST_VALUES.exitCodeOne);
      }
      if (request.args[PLUGIN_TEST_VALUES.firstIndex] === GitCommandType.Pull && pullFails) {
        return failureResult(PLUGIN_TEST_VALUES.exitCodeOne, PLUGIN_TEST_VALUES.sampleStderr);
      }
      if (request.args[PLUGIN_TEST_VALUES.firstIndex] === GitCommandType.Push && pushFails) {
        return failureResult(PLUGIN_TEST_VALUES.exitCodeOne, PLUGIN_TEST_VALUES.sampleStderr);
      }
      return successResult();
    });

    const { plugin, emitVaultEvent, getStatusBarElement } = createVaultTestHarness({
      storedSettings: {
        autoPullOnLoad: true,
        autoSyncIntervalMinutes: PLUGIN_TEST_VALUES.syncIntervalMinutes,
        autoBackupAfterEditMinutes: PLUGIN_TEST_VALUES.autoBackupMinutes,
        autoSyncNotificationMode: AutoSyncNotificationMode.ErrorsOnly,
      },
    });
    await plugin.onload();
    await flushMicrotasks();

    expect(
      recordedNotices.some(
        (n) =>
          n.message === plugin.messages.ui.autoPullErrorPrefix + PLUGIN_TEST_VALUES.sampleStderr,
      ),
    ).toBe(true);

    recordedNotices.length = PLUGIN_TEST_VALUES.zeroCount;
    pullFails = false;
    await vi.advanceTimersByTimeAsync(
      PLUGIN_TEST_VALUES.syncIntervalMinutes *
        PLUGIN_TEST_VALUES.secondsPerMinute *
        PLUGIN_TEST_VALUES.millisecondsPerSecond,
    );
    await flushMicrotasks();
    expect(recordedNotices).toHaveLength(PLUGIN_TEST_VALUES.zeroCount);

    plugin.settings.autoSyncNotificationMode = AutoSyncNotificationMode.All;
    await vi.advanceTimersByTimeAsync(
      PLUGIN_TEST_VALUES.syncIntervalMinutes *
        PLUGIN_TEST_VALUES.secondsPerMinute *
        PLUGIN_TEST_VALUES.millisecondsPerSecond,
    );
    await flushMicrotasks();
    expect(recordedNotices.some((n) => n.message === plugin.messages.ui.autoSyncSuccess)).toBe(true);

    recordedNotices.length = PLUGIN_TEST_VALUES.zeroCount;
    emitVaultEvent(PLUGIN_TEST_VALUES.vaultEventModify);
    await vi.advanceTimersByTimeAsync(
      PLUGIN_TEST_VALUES.autoBackupMinutes *
        PLUGIN_TEST_VALUES.secondsPerMinute *
        PLUGIN_TEST_VALUES.millisecondsPerSecond,
    );
    await flushMicrotasks();
    expect(recordedNotices.some((n) => n.message === plugin.messages.ui.autoBackupSuccess)).toBe(
      true,
    );

    recordedNotices.length = PLUGIN_TEST_VALUES.zeroCount;
    plugin.settings.autoSyncNotificationMode = AutoSyncNotificationMode.Silent;
    pushFails = true;
    emitVaultEvent(PLUGIN_TEST_VALUES.vaultEventModify);
    await vi.advanceTimersByTimeAsync(
      PLUGIN_TEST_VALUES.autoBackupMinutes *
        PLUGIN_TEST_VALUES.secondsPerMinute *
        PLUGIN_TEST_VALUES.millisecondsPerSecond,
    );
    await flushMicrotasks();
    expect(recordedNotices).toHaveLength(PLUGIN_TEST_VALUES.zeroCount);
    expect(consoleErrorSpy).toHaveBeenCalled();
    expect(getStatusBarElement().getAttribute(PLUGIN_TEST_VALUES.titleAttr)).toBe(
      plugin.messages.ui.autoBackupErrorPrefix + PLUGIN_TEST_VALUES.sampleStderr,
    );

    plugin.onunload();
  });

  it('aborts active operation and clears all scheduled timers on onunload', async () => {
    vi.useFakeTimers();
    vi.spyOn(GitExecutableLocator.prototype, 'locate').mockResolvedValue(
      PLUGIN_TEST_VALUES.resolvedGitExecutable,
    );

    let activeSignal: AbortSignal | undefined;
    let fetchCount = PLUGIN_TEST_VALUES.zeroCount;
    const pendingSync = createDeferred<ProcessResult>();

    vi.spyOn(NodeProcessRunner.prototype, 'run').mockImplementation(async (request) => {
      if (isStatusInvocation(request.args)) {
        return successResult(PLUGIN_TEST_VALUES.statusCleanOutput);
      }
      if (request.args[PLUGIN_TEST_VALUES.firstIndex] === GitCommandType.Fetch) {
        fetchCount++;
        return successResult();
      }
      if (request.args[PLUGIN_TEST_VALUES.firstIndex] === GitCommandType.Pull) {
        activeSignal = request.signal;
        return pendingSync.promise;
      }
      return successResult();
    });

    const { plugin, emitVaultEvent } = createVaultTestHarness({
      storedSettings: {
        autoFetchIntervalSeconds: PLUGIN_TEST_VALUES.fetchIntervalSeconds,
        autoSyncIntervalMinutes: PLUGIN_TEST_VALUES.syncIntervalMinutes,
        autoBackupAfterEditMinutes: PLUGIN_TEST_VALUES.autoBackupMinutes,
      },
    });
    await plugin.onload();
    await flushMicrotasks();

    emitVaultEvent(PLUGIN_TEST_VALUES.vaultEventModify);
    findCommand(GitAction.Pull)?.callback?.();
    await flushMicrotasks();

    expect(plugin.isOperationRunning()).toBe(true);
    expect(activeSignal?.aborted).toBe(false);

    plugin.onunload();
    expect(activeSignal?.aborted).toBe(true);

    pendingSync.resolve(
      failureResult(
        null,
        PLUGIN_TEST_VALUES.emptyString,
        PLUGIN_TEST_VALUES.emptyString,
        ProcessTermination.Aborted,
      ),
    );
    await flushMicrotasks();

    const fetchCountAtUnload = fetchCount;
    await vi.advanceTimersByTimeAsync(
      PLUGIN_TEST_VALUES.autoBackupMinutes *
        PLUGIN_TEST_VALUES.secondsPerMinute *
        PLUGIN_TEST_VALUES.millisecondsPerSecond,
    );
    await flushMicrotasks();

    expect(fetchCount).toBe(fetchCountAtUnload);
  });

  it('guards updateGitExecutable against stale concurrent resolutions and tests executable via testGitExecutable', async () => {
    const initialDeferred = createDeferred<string | null>();
    const staleDeferred = createDeferred<string | null>();
    const freshDeferred = createDeferred<string | null>();

    vi.spyOn(GitExecutableLocator.prototype, 'locate')
      .mockReturnValueOnce(initialDeferred.promise)
      .mockReturnValueOnce(staleDeferred.promise)
      .mockReturnValueOnce(freshDeferred.promise);
    const locateWithVersionSpy = vi.spyOn(GitExecutableLocator.prototype, 'locateWithVersion');

    vi.spyOn(NodeProcessRunner.prototype, 'run').mockImplementation(async (request) => {
      if (isStatusInvocation(request.args)) {
        return successResult(PLUGIN_TEST_VALUES.statusCleanOutput);
      }
      return successResult();
    });

    const { plugin, savedSettingsHistory, getStatusBarElement } = createVaultTestHarness();
    await plugin.onload();
    initialDeferred.resolve(PLUGIN_TEST_VALUES.resolvedGitExecutable);
    await flushMicrotasks();

    const stalePromise = plugin.updateGitExecutable(PLUGIN_TEST_VALUES.staleExecutable);
    const freshPromise = plugin.updateGitExecutable(PLUGIN_TEST_VALUES.customExecutable);

    freshDeferred.resolve(PLUGIN_TEST_VALUES.customExecutable);
    await freshPromise;
    expect(savedSettingsHistory).toHaveLength(PLUGIN_TEST_VALUES.oneCount);
    expect(getStatusBarElement().getFullText()).toBe(PLUGIN_TEST_VALUES.expectedCleanStatusText);

    staleDeferred.resolve(null);
    await stalePromise;
    expect(savedSettingsHistory).toHaveLength(PLUGIN_TEST_VALUES.oneCount);
    expect(getStatusBarElement().getFullText()).toBe(PLUGIN_TEST_VALUES.expectedCleanStatusText);

    locateWithVersionSpy.mockResolvedValueOnce({
      executable: PLUGIN_TEST_VALUES.customExecutable,
      version: PLUGIN_TEST_VALUES.gitVersion,
    });
    await plugin.testGitExecutable();
    expect(
      recordedNotices.some(
        (n) =>
          n.message ===
          plugin.messages.ui.gitTestSuccessPrefix +
            PLUGIN_TEST_VALUES.customExecutable +
            PLUGIN_TEST_VALUES.versionPrefix +
            PLUGIN_TEST_VALUES.gitVersion +
            PLUGIN_TEST_VALUES.versionSuffix,
      ),
    ).toBe(true);

    locateWithVersionSpy.mockResolvedValueOnce(null);
    await plugin.testGitExecutable();
    expect(
      recordedNotices.some(
        (n) =>
          n.message ===
          plugin.messages.ui.gitTestFailedPrefix + plugin.messages.ui.gitExecutableNotFound,
      ),
    ).toBe(true);

    plugin.onunload();
  });

  it('handles Init, History, onExternalSettingsChange, ribbon icon toggling, and modal callbacks cleanly', async () => {
    vi.spyOn(GitExecutableLocator.prototype, 'locate').mockResolvedValue(
      PLUGIN_TEST_VALUES.resolvedGitExecutable,
    );
    let initialized = false;
    const requests: ProcessRequest[] = [];

    vi.spyOn(NodeProcessRunner.prototype, 'run').mockImplementation(async (request) => {
      requests.push(request);
      if (isStatusInvocation(request.args)) {
        return initialized
          ? successResult(PLUGIN_TEST_VALUES.statusModifiedOutput)
          : failureResult(PLUGIN_TEST_VALUES.exitCodeFatal, PLUGIN_TEST_VALUES.notRepoStderr);
      }
      if (request.args[PLUGIN_TEST_VALUES.firstIndex] === GitCommandType.Init) {
        initialized = true;
        return successResult();
      }
      if (request.args[PLUGIN_TEST_VALUES.firstIndex] === GitCommandType.Log) {
        return successResult(PLUGIN_TEST_VALUES.logOutput);
      }
      if (request.args[PLUGIN_TEST_VALUES.firstIndex] === GitCommandType.Diff) {
        return successResult(PLUGIN_TEST_VALUES.sampleDiffText);
      }
      return successResult();
    });

    const { plugin, setStoredData, getStatusBarElement } = createVaultTestHarness();
    await plugin.onload();
    await flushMicrotasks();

    expect(getStatusBarElement().getFullText()).toBe(plugin.messages.ui.statusBarNotRepo);

    findCommand(GitAction.Init)?.callback?.();
    await flushMicrotasks();
    expect(
      recordedNotices.some((n) => n.message === plugin.messages.actions.success[GitAction.Init]),
    ).toBe(true);

    findCommand(GitAction.History)?.callback?.();
    await flushMicrotasks();
    const historyModal = openedModals.find((m) => m instanceof GitHistoryModal);
    expect(historyModal).toBeDefined();
    expect(historyModal?.contentEl.getFullText()).toContain(PLUGIN_TEST_VALUES.sampleCommitSubject);

    findCommand(GitAction.Status)?.callback?.();
    await flushMicrotasks();
    const statusModal = openedModals.find((m) => m instanceof GitStatusModal);
    expect(statusModal).toBeDefined();

    statusModal?.contentEl.findByText(plugin.messages.statusModal.diffButton)?.click();
    await flushMicrotasks();
    expect(openedModals.some((m) => m instanceof GitDiffModal)).toBe(true);

    statusModal?.contentEl.findByText(plugin.messages.statusModal.stageButton)?.click();
    await flushMicrotasks();
    expect(
      requests.some(
        (r) =>
          r.args.includes(PLUGIN_TEST_VALUES.addSubcommand) &&
          r.args.includes(PLUGIN_TEST_VALUES.sampleNotePath),
      ),
    ).toBe(true);

    setStoredData({
      showRibbonIcon: true,
      gitExecutable: PLUGIN_TEST_VALUES.customExecutable,
    });
    await plugin.onExternalSettingsChange();
    expect(registeredRibbonIcons).toHaveLength(PLUGIN_TEST_VALUES.oneCount);

    setStoredData({ showRibbonIcon: false });
    await plugin.onExternalSettingsChange();
    expect(registeredRibbonIcons[PLUGIN_TEST_VALUES.firstIndex]?.element.removed).toBe(true);

    expect(PLUGIN_TEST_FILE_FIXTURES.modifiedInVault.path).toBe(PLUGIN_TEST_VALUES.sampleNotePath);
    plugin.onunload();
  });

  it('keeps status bar error state consistent across autoFetch failures and skips push on clean autoBackup', async () => {
    vi.useFakeTimers();
    vi.spyOn(GitExecutableLocator.prototype, 'locate').mockResolvedValue(
      PLUGIN_TEST_VALUES.resolvedGitExecutable,
    );

    let isRepo = true;
    let fetchFails = true;
    let hasChanges = false;
    const requests: ProcessRequest[] = [];

    vi.spyOn(NodeProcessRunner.prototype, 'run').mockImplementation(async (request) => {
      requests.push(request);
      if (isStatusInvocation(request.args)) {
        return isRepo
          ? successResult(PLUGIN_TEST_VALUES.statusCleanOutput)
          : failureResult(PLUGIN_TEST_VALUES.exitCodeFatal, PLUGIN_TEST_VALUES.notRepoStderr);
      }
      if (isRevParsePrefixInvocation(request.args) || isRevParseGitPathInvocation(request.args)) {
        return successResult();
      }
      if (isCachedDiffInvocation(request.args)) {
        return hasChanges
          ? failureResult(PLUGIN_TEST_VALUES.exitCodeOne)
          : successResult();
      }
      if (request.args[PLUGIN_TEST_VALUES.firstIndex] === GitCommandType.Fetch && fetchFails) {
        return failureResult(
          PLUGIN_TEST_VALUES.exitCodeFatal,
          PLUGIN_TEST_VALUES.networkErrorStderr,
        );
      }
      return successResult();
    });

    const { plugin, emitVaultEvent, getStatusBarElement } = createVaultTestHarness({
      storedSettings: {
        autoFetchIntervalSeconds: PLUGIN_TEST_VALUES.fetchIntervalSeconds,
        autoBackupAfterEditMinutes: PLUGIN_TEST_VALUES.autoBackupMinutes,
        autoSyncNotificationMode: AutoSyncNotificationMode.All,
      },
    });
    await plugin.onload();
    await flushMicrotasks();

    await vi.advanceTimersByTimeAsync(
      PLUGIN_TEST_VALUES.fetchIntervalSeconds * PLUGIN_TEST_VALUES.millisecondsPerSecond,
    );
    await flushMicrotasks();

    const statusBar = getStatusBarElement();
    expect(statusBar.hasClass(PLUGIN_DOM_NAMES.statusBarErrorClass)).toBe(false);
    expect(statusBar.getAttribute(PLUGIN_TEST_VALUES.titleAttr)).toBe(
      plugin.messages.ui.autoFetchErrorPrefix + PLUGIN_TEST_VALUES.networkErrorStderr,
    );

    isRepo = false;
    await vi.advanceTimersByTimeAsync(
      PLUGIN_TEST_VALUES.fetchIntervalSeconds * PLUGIN_TEST_VALUES.millisecondsPerSecond,
    );
    await flushMicrotasks();

    expect(statusBar.hasClass(PLUGIN_DOM_NAMES.statusBarErrorClass)).toBe(true);
    expect(statusBar.getFullText()).toBe(plugin.messages.ui.statusBarNotRepo);

    isRepo = true;
    fetchFails = false;
    requests.length = PLUGIN_TEST_VALUES.zeroCount;
    recordedNotices.length = PLUGIN_TEST_VALUES.zeroCount;
    emitVaultEvent(PLUGIN_TEST_VALUES.vaultEventModify);
    await vi.advanceTimersByTimeAsync(
      PLUGIN_TEST_VALUES.autoBackupMinutes *
        PLUGIN_TEST_VALUES.secondsPerMinute *
        PLUGIN_TEST_VALUES.millisecondsPerSecond,
    );
    await flushMicrotasks();

    expect(requests.some((r) => r.args[PLUGIN_TEST_VALUES.firstIndex] === GitCommandType.Push)).toBe(
      false,
    );
    expect(recordedNotices.some((n) => n.message === plugin.messages.ui.autoBackupSuccess)).toBe(
      false,
    );

    plugin.onunload();
  });

  it('supports unstage, discard, stageAll, unstageAll, refresh, and external file pathspecs from GitStatusModal', async () => {
    vi.spyOn(GitExecutableLocator.prototype, 'locate').mockResolvedValue(
      PLUGIN_TEST_VALUES.resolvedGitExecutable,
    );
    const requests: ProcessRequest[] = [];

    vi.spyOn(NodeProcessRunner.prototype, 'run').mockImplementation(async (request) => {
      requests.push(request);
      if (isStatusInvocation(request.args)) {
        return successResult(PLUGIN_TEST_VALUES.statusWithRenamedAndExternalOutput);
      }
      if (isRevParsePrefixInvocation(request.args)) {
        return successResult(PLUGIN_TEST_VALUES.vaultSubdirPrefix);
      }
      return successResult();
    });

    const { plugin } = createVaultTestHarness();
    await plugin.onload();
    await flushMicrotasks();

    findCommand(GitAction.Status)?.callback?.();
    await flushMicrotasks();
    const statusModal = openedModals.find((m) => m instanceof GitStatusModal);
    expect(statusModal).toBeDefined();

    requests.length = PLUGIN_TEST_VALUES.zeroCount;
    statusModal?.contentEl.findByText(plugin.messages.statusModal.unstageButton)?.click();
    await flushMicrotasks();
    expect(
      requests.some(
        (r) =>
          r.args.includes(PLUGIN_TEST_VALUES.resetSubcommand) &&
          r.args.includes(PLUGIN_TEST_VALUES.renamedNewPath) &&
          r.args.includes(PLUGIN_TEST_VALUES.renamedOrigPath),
      ),
    ).toBe(true);

    requests.length = PLUGIN_TEST_VALUES.zeroCount;
    statusModal?.contentEl.findByText(plugin.messages.statusModal.discardButton)?.click();
    const confirmModal = openedModals[openedModals.length - PLUGIN_TEST_VALUES.oneCount];
    confirmModal?.contentEl.findByClass(PLUGIN_TEST_VALUES.confirmDiscardWarningClass)?.click();
    await flushMicrotasks();
    expect(
      requests.some(
        (r) =>
          r.args.includes(PLUGIN_TEST_VALUES.checkoutSubcommand) &&
          r.args.includes(PLUGIN_TEST_VALUES.repoRootExternalPathspec),
      ),
    ).toBe(true);
    expect(recordedNotices.some((n) => n.message === plugin.messages.ui.discardSuccess)).toBe(true);

    requests.length = PLUGIN_TEST_VALUES.zeroCount;
    statusModal?.contentEl.findByText(plugin.messages.statusModal.stageAllButton)?.click();
    await flushMicrotasks();
    expect(
      requests.some(
        (r) =>
          r.args.includes(PLUGIN_TEST_VALUES.addSubcommand) &&
          r.args.includes(PLUGIN_TEST_VALUES.repoRootExternalPathspec) &&
          r.args.includes(PLUGIN_TEST_VALUES.untrackedNotePath),
      ),
    ).toBe(true);

    requests.length = PLUGIN_TEST_VALUES.zeroCount;
    statusModal?.contentEl.findByText(plugin.messages.statusModal.unstageAllButton)?.click();
    await flushMicrotasks();
    expect(
      requests.some((r) => r.args.includes(PLUGIN_TEST_VALUES.resetSubcommand)),
    ).toBe(true);

    requests.length = PLUGIN_TEST_VALUES.zeroCount;
    statusModal?.contentEl.findByClass(PLUGIN_TEST_VALUES.statusModalRefreshClass)?.click();
    await flushMicrotasks();
    expect(requests.some((r) => isStatusInvocation(r.args))).toBe(true);

    expect(PLUGIN_TEST_FILE_FIXTURES.stagedRenamedInVault.origPath).toBe(
      PLUGIN_TEST_VALUES.renamedOrigPath,
    );
    expect(PLUGIN_TEST_FILE_FIXTURES.externalModified.inVault).toBe(false);

    plugin.onunload();
  });
});
