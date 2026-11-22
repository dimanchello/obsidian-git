import { describe, expect, it, vi } from 'vitest';

const { MockMenu, MockMenuItem, registeredCommands } = vi.hoisted(() => {
  class MockMenuItem {
    public title = '';
    public icon = '';
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

    public showAtMouseEvent(_event: MouseEvent): void {}
  }

  interface MockCommand {
    id: string;
    name: string;
    callback?: () => unknown;
    checkCallback?: (checking: boolean) => boolean | void;
  }

  const registeredCommands: MockCommand[] = [];

  return { MockMenu, MockMenuItem, registeredCommands };
});

vi.mock('obsidian', () => {
  class MockPlugin {
    public app: unknown;
    public manifest: unknown;
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
      return {
        addClass: vi.fn(),
        removeClass: vi.fn(),
        setAttribute: vi.fn(),
        createSpan: vi.fn(() => ({ textContent: '' })),
      } as unknown as HTMLElement;
    }
    public registerDomEvent(): void {}
    public registerInterval(): void {}
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
    Modal: class {},
    Menu: MockMenu,
    Notice: vi.fn(),
    setIcon: vi.fn(),
    getLanguage: vi.fn(() => 'en'),
    FileSystemAdapter: class {},
  };
});

import GitCommandsPlugin from '../src/main';
import { GitAction, GIT_ACTION_COMMAND_IDS } from '../src/plugin-constants';
import { PLUGIN_TEST_VALUES } from './plugin.fixtures';

describe('GitCommandsPlugin menu and abort action', () => {
  it('configures menu with abort item disabled when no operation is running', () => {
    const plugin = new GitCommandsPlugin({} as never, {} as never);
    MockMenu.instances.length = 0;

    (plugin as unknown as { openMenu: (event: MouseEvent) => void })['openMenu']({} as MouseEvent);

    const latestMenu = MockMenu.instances[0];
    expect(latestMenu).toBeDefined();
    expect(latestMenu?.items).toHaveLength(PLUGIN_TEST_VALUES.actionCount);
    expect(latestMenu?.separators).toHaveLength(PLUGIN_TEST_VALUES.expectedSeparatorsCount);

    const abortItem = latestMenu?.items[PLUGIN_TEST_VALUES.menuItemAbortIndex];
    expect(abortItem?.title).toBe(plugin.messages.actions.labels[GitAction.Abort]);
    expect(abortItem?.disabled).toBe(true);
  });

  it('sets abort item to active (disabled=false) when an operation is running', () => {
    const plugin = new GitCommandsPlugin({} as never, {} as never);
    MockMenu.instances.length = 0;

    (plugin as unknown as { operationRunning: boolean })['operationRunning'] = true;
    (plugin as unknown as { openMenu: (event: MouseEvent) => void })['openMenu']({} as MouseEvent);

    const latestMenu = MockMenu.instances[0];
    expect(latestMenu).toBeDefined();
    const abortItem = latestMenu?.items[PLUGIN_TEST_VALUES.menuItemAbortIndex];
    expect(abortItem?.disabled).toBe(false);
  });

  it('aborts active AbortController when abortCurrentOperation is invoked', () => {
    const plugin = new GitCommandsPlugin({} as never, {} as never);
    const controller = new AbortController();

    (plugin as unknown as { operationRunning: boolean })['operationRunning'] = true;
    (plugin as unknown as { activeAbortController: AbortController | null })[
      'activeAbortController'
    ] = controller;

    expect(controller.signal.aborted).toBe(false);
    plugin.abortCurrentOperation();
    expect(controller.signal.aborted).toBe(true);
  });

  it('safely handles abortCurrentOperation when no operation is running', () => {
    const plugin = new GitCommandsPlugin({} as never, {} as never);
    expect(plugin.isOperationRunning()).toBe(false);
    expect(() => plugin.abortCurrentOperation()).not.toThrow();
  });

  it('registers commands including abort with conditional checkCallback', () => {
    registeredCommands.length = 0;
    const plugin = new GitCommandsPlugin({} as never, {} as never);

    (plugin as unknown as { registerCommands: () => void })['registerCommands']();

    const abortCommand = registeredCommands.find(
      (cmd) => cmd.id === GIT_ACTION_COMMAND_IDS[GitAction.Abort],
    );
    expect(abortCommand).toBeDefined();
    expect(abortCommand?.checkCallback).toBeDefined();

    // When idle: checkCallback(true) is false
    expect(abortCommand?.checkCallback?.(true)).toBe(false);

    // When running: checkCallback(true) is true
    (plugin as unknown as { operationRunning: boolean })['operationRunning'] = true;
    expect(abortCommand?.checkCallback?.(true)).toBe(true);
  });
});
