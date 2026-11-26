import { setIcon } from 'obsidian';
import { PLUGIN_DOM_NAMES, PLUGIN_FORMAT } from './plugin-constants';

export const JAVASCRIPT_TYPE_NAMES = {
  function: 'function',
  undefined: 'undefined',
} as const;

export const MODAL_SHARED_TAGS = {
  button: 'button',
  paragraph: 'p',
  heading: 'h2',
  pre: 'pre',
} as const;

export const MODAL_BUTTON_CLASSES = {
  cta: 'mod-cta',
  warning: 'mod-warning',
} as const;

export const ARIA_BOOLEAN_VALUES = {
  true: 'true',
  false: 'false',
} as const;

export interface ModalButtonOptions {
  readonly text?: string;
  readonly cls?: string;
  readonly title?: string;
  readonly ariaLabel?: string;
  readonly icon?: string;
  readonly iconCls?: string;
  readonly disabled?: boolean;
  readonly stopPropagation?: boolean;
  readonly onClick: () => void;
}

/** Invoke Obsidian `setIcon` only when the icon helper is available in the current runtime. */
export function safeSetIcon(element: HTMLElement, iconId: string): void {
  if (typeof setIcon === JAVASCRIPT_TYPE_NAMES.function) {
    setIcon(element, iconId);
  }
}

/** Create a non-submitting modal button with consistent disabled and event-propagation handling. */
export function createModalButton(
  container: HTMLElement,
  options: ModalButtonOptions,
): HTMLButtonElement {
  const buttonInfo: DomElementInfo = {};
  if (options.cls !== undefined) {
    buttonInfo.cls = options.cls;
  }
  if (options.title !== undefined) {
    buttonInfo.title = options.title;
  }
  if (options.icon === undefined && options.text !== undefined) {
    buttonInfo.text = options.text;
  }

  const button = container.createEl(MODAL_SHARED_TAGS.button, buttonInfo);
  button.setAttribute(PLUGIN_DOM_NAMES.typeAttribute, PLUGIN_DOM_NAMES.buttonType);

  if (options.icon !== undefined) {
    const iconEl = button.createSpan(
      options.iconCls === undefined ? undefined : { cls: options.iconCls },
    );
    safeSetIcon(iconEl, options.icon);
    if (options.text !== undefined) {
      button.createSpan({ text: options.text });
    }
  }

  if (options.ariaLabel !== undefined) {
    button.setAttribute(PLUGIN_DOM_NAMES.ariaLabelAttribute, options.ariaLabel);
  }

  if (options.disabled === true) {
    button.disabled = true;
    button.setAttribute(PLUGIN_DOM_NAMES.disabledAttribute, PLUGIN_FORMAT.emptyString);
    button.setAttribute(PLUGIN_DOM_NAMES.ariaDisabledAttribute, ARIA_BOOLEAN_VALUES.true);
  }

  button.addEventListener(PLUGIN_DOM_NAMES.clickEvent, (event) => {
    if (options.stopPropagation === true) {
      event.stopPropagation();
    }
    if (options.disabled === true) {
      return;
    }
    options.onClick();
  });

  if (options.stopPropagation === true) {
    button.addEventListener(PLUGIN_DOM_NAMES.keydownEvent, (event) => {
      if (isActivationKey(event.key)) {
        event.stopPropagation();
      }
    });
  }

  return button;
}

/** Attach click and Enter/Space keyboard activation handlers to a custom interactive element. */
export function bindKeyboardActivation(element: HTMLElement, onActivate: () => void): void {
  element.addEventListener(PLUGIN_DOM_NAMES.clickEvent, () => {
    onActivate();
  });
  element.addEventListener(PLUGIN_DOM_NAMES.keydownEvent, (event) => {
    if (isActivationKey(event.key)) {
      event.preventDefault();
      onActivate();
    }
  });
}

const PATH_DELIMITER = '/';

const PATH_SPLIT_INDICES = {
  firstIndex: 0,
  notFoundIndex: -1,
  separatorOffset: 1,
} as const;

export interface SplitPathResult {
  readonly folder: string;
  readonly name: string;
}

/** Split a repository-relative path into its directory prefix (with trailing slash) and filename. */
export function splitFilePath(filePath: string): SplitPathResult {
  const lastSlashIndex = filePath.lastIndexOf(PATH_DELIMITER);
  if (lastSlashIndex === PATH_SPLIT_INDICES.notFoundIndex) {
    return { folder: PLUGIN_FORMAT.emptyString, name: filePath };
  }
  return {
    folder: filePath.slice(
      PATH_SPLIT_INDICES.firstIndex,
      lastSlashIndex + PATH_SPLIT_INDICES.separatorOffset,
    ),
    name: filePath.slice(lastSlashIndex + PATH_SPLIT_INDICES.separatorOffset),
  };
}

function isActivationKey(key: string): boolean {
  return key === PLUGIN_DOM_NAMES.keyEnter || key === PLUGIN_DOM_NAMES.keySpace;
}
