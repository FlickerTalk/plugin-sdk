/** `data` is base64. */
export interface PluginFile {
  name: string;
  mime: string;
  data: string;
}

export interface PluginLocale {
  name?: string;
  summary?: string;
  hooks?: { message?: string; composer?: string; settings?: { label?: string; fields?: Record<string, string>; note?: string } };
}

/** By the app's language code (`es`, `zh-CN`…), with the English top-level fields as fallback. */
export type PluginLocales = Record<string, PluginLocale>;

/** An Ionicon name, used only when the package has no `icon.svg`. */
export type PluginManifestIcon = string;

export type PluginHookName = "message" | "composer" | "settings";

export interface PluginHookDeclaration {
  label: string;
  icon: string;
}

export interface PluginSettingsField {
  key: string;
  /** A select gets its choices from `options` in the hook result. */
  type: "select" | "toggle";
  label: string;
}

export interface PluginSettingsDeclaration extends PluginHookDeclaration {
  fields: PluginSettingsField[];
  note?: string;
}

/** Tools only, app 1.7.0+. `message` and `composer` need `messages: "given"`, `composer` also `send: "propose"`. */
export interface PluginManifestHooks {
  message?: PluginHookDeclaration;
  composer?: PluginHookDeclaration;
  settings?: PluginSettingsDeclaration;
}

export interface PluginOpen {
  /** Empty unless the plugin was granted `messages`. */
  text: string;
  /** Always false before app 1.3.0. */
  dark: boolean;
  /** The app's `--ion-*` colours as they were at open, for canvas drawing. CSS should use live `var()`s. */
  theme?: Record<string, string>;
  lang: string;
  /** Set when opened with a file of a kind the manifest `opens`. Up to 32 MB. */
  file: PluginFile | null;
  /** Opaque, for `openChat`. */
  ref: string | null;
  reminder: string | null;
  /** True when `live` is granted and the plugin is open in a conversation. */
  live: boolean;
  /** Opaque, stable for this plugin on this phone, same as `PluginHook.chat`. Never send it. */
  chat?: string;
  /** In a call, `"lead"` on the presenting phone and `"follow"` on the other, talking over `live`. */
  presenting?: "lead" | "follow";
  /** The running hook's name, once `show()` brought the window up. */
  hook?: PluginHookName;
  /** The Ionic the app lends, also in `data-ionic` on the root. */
  ionic?: PluginIonic;
}

export interface PluginHook {
  name: PluginHookName;
  /** The message or draft. On a hidden `settings` run, the last 5 texts received if `messages: "given"`. */
  text: string;
  /** Same key as `PluginOpen.chat`. */
  chat: string;
  /** `message` only, as `PluginOpen.ref`. */
  ref: string | null;
  lang: string;
  manual: boolean;
  /** `ios` includes iPad. iOS shows its own sheet before a language download, Android does not. */
  platform: "android" | "ios" | "desktop";
  /** True on the rerun after the user said yes to `ask`. */
  answer?: boolean;
  /** On a manual `settings` run, the values the user changed, by field key. */
  values?: Record<string, string | boolean>;
}

/** `text` replaces a `message` or is what a `composer` sends. `settings` returns its whole state each run. */
export interface PluginHookResult {
  text?: string;
  /** The chat's language tag, or null if it has none. */
  lang?: string | null;
  /** Which hooks the app runs by itself in this conversation. */
  auto?: { message?: boolean; composer?: boolean };
  /** Shown in an OK / Cancel alert. On OK the hook runs again with `answer: true`. */
  ask?: { text: string };
  values?: Record<string, string | boolean>;
  /** Each select field's choices by key, in order, labelled in the app's language. */
  options?: Record<string, { value: string; label: string }[]>;
}

/** The app's own `@ionic/core`, every component registered. A package must not bundle Ionic. */
export interface PluginIonic {
  /** Target the major (`9` of `9.0.4`), not the exact version. */
  version: string;
}

export interface FtIonicController {
  create(options?: Record<string, unknown>): Promise<HTMLElement & { present(): Promise<void>; dismiss(data?: unknown, role?: string): Promise<boolean>; onDidDismiss(): Promise<{ data?: unknown; role?: string }> }>;
  dismiss(data?: unknown, role?: string, id?: string): Promise<boolean>;
  getTop(): Promise<HTMLElement | undefined>;
}

/** Ionic's controllers and helpers. The components themselves are already defined. */
export interface FtIonic {
  readonly version: string;
  /** Version of `ionicons`. */
  readonly ionicons: string;
  readonly components: readonly string[];
  /** The names `<ion-icon name="…">` can draw. Register others with `addIcons`. */
  readonly icons: readonly string[];
  readonly actionSheetController: FtIonicController;
  readonly alertController: FtIonicController;
  readonly loadingController: FtIonicController;
  readonly modalController: FtIonicController;
  readonly popoverController: FtIonicController;
  readonly toastController: FtIonicController;
  readonly menuController: Record<string, (...args: unknown[]) => unknown>;
  /** Values are SVG `data:` URLs. */
  readonly addIcons: (icons: Record<string, string>) => void;
  readonly createAnimation: (...args: unknown[]) => unknown;
  readonly createGesture: (...args: unknown[]) => unknown;
  readonly getMode: () => "ios" | "md";
  readonly isPlatform: (platform: string) => boolean;
  readonly getPlatforms: () => string[];
}

export type RecordKey = string;

/** In bytes. */
export interface RecordUsage {
  used: number;
  quota: number;
}

/** Room from the `storage` permission: 4 MB, or 256 MB with `large`. 16 MB at most per value. */
export interface PluginRecords {
  get(key: string): Promise<string | null>;
  /** Resolves false when there is no room left. */
  set(key: string, value: string): Promise<boolean>;
  forget(key: string): Promise<boolean>;
  /** Keys starting with `prefix`, in order. */
  keys(prefix?: string): Promise<RecordKey[]>;
  usage(): Promise<RecordUsage>;
}

export interface PluginReminder {
  plugin: string;
  id: string;
  /** ms since the epoch */
  at: number;
  text: string;
}

/** Needs `remind`. Kept across reboots. Tapping one opens the plugin with `reminder` set. */
export interface PluginReminders {
  /** Sets or moves reminder `id`. `text` may show on the lock screen. */
  set(id: string, at: number, text?: string): Promise<boolean>;
  cancel(id: string): Promise<boolean>;
  list(): Promise<PluginReminder[]>;
}

/** Direct connection only, never stored. Needs `live` on both phones. Base64, 48 KB at most. */
export interface PluginLive {
  /** False when there is no direct connection right now. */
  send(data: string): Promise<boolean>;
  onMessage(handler: (data: string) => void): void;
}

export interface DriveStatus {
  /** `empty` means signed in with no drive yet. The user fixes `locked` and `outdated` in Settings. */
  state: "none" | "empty" | "locked" | "outdated" | "ready";
  provider: string | null;
  drive: {
    files: number;
    folders: number;
    /** Bytes. */
    used: number;
    pending: number;
    quota: { used: number; total: number } | null;
    backupAt: number | null;
  } | null;
  problem: string | null;
}

export interface DriveFolder {
  id: string;
  name: string;
  parent: string | null;
  modified: number;
}

export interface DriveFile {
  id: string;
  name: string;
  parent: string | null;
  size: number;
  mime: string;
  modified: number;
}

export interface DrivePending {
  blob: string;
  name: string;
  parent: string | null;
  size: number;
  mime: string;
  error: string;
}

export interface DriveListing {
  folders: DriveFolder[];
  files: DriveFile[];
  pending: DrivePending[];
}

export interface DriveBackup {
  at: number;
  files: number;
  dbSize: number;
}

/** Needs `drive`, else every call resolves `false`. Plugins never see bytes, tokens or the recovery code. */
export interface PluginDrive {
  status(): Promise<DriveStatus | false>;
  /** Signs in through the system browser. */
  connect(provider?: "google"): Promise<DriveStatus | false>;
  // No setup or unlock, because the recovery phrase must never reach a plugin's frame.
  /** The drive stays in the cloud. */
  disconnect(): Promise<boolean>;
  /** `null` or nothing lists the root. */
  list(parent?: string | null): Promise<DriveListing | false>;
  mkdir(name: string, parent?: string | null): Promise<string | false>;
  rename(id: string, name: string): Promise<boolean>;
  move(id: string, parent?: string | null): Promise<boolean>;
  /** A folder goes with everything in it. */
  remove(id: string): Promise<boolean>;
  /** Opens the app's picker. Resolves with how many files went up. */
  upload(parent?: string | null): Promise<number | false>;
  /** Stores the file the plugin was opened with (`PluginOpen.ref`) without handing over its bytes. */
  keep(parent?: string | null): Promise<boolean>;
  open(id: string): Promise<boolean>;
  /** Copies it to the phone's Downloads. */
  save(id: string): Promise<boolean>;
  /** Needs the `send` permission. */
  send(id: string): Promise<boolean>;
  /** Resolves with how many uploads still wait. */
  retry(): Promise<number | false>;
  cancel(blob: string): Promise<boolean>;
  /** An encrypted copy of the phone, keys included. */
  backup(): Promise<DriveBackup | false>;
  backupInfo(): Promise<DriveBackup | null | false>;
  /** The app restarts to swap the backup in. */
  restore(): Promise<DriveBackup | false>;
}

export interface PluginLocation {
  /** Degrees, WGS 84. */
  lat: number;
  /** Degrees, WGS 84. */
  lon: number;
  /** Metres. */
  accuracy: number;
  /** ms since the epoch */
  at: number;
}

export type PluginTranslationStatus = "installed" | "downloadable" | "unsupported";

/** Text never leaves the phone. Status is per language pair, 1 to 5 000 characters, never throws. */
export interface PluginTranslator {
  /** BCP-47 tags. Empty when the phone cannot translate. */
  languages(): Promise<string[]>;
  detect(text: string): Promise<string | null>;
  status(from: string, to: string): Promise<PluginTranslationStatus>;
  /** May show a system sheet. */
  prepare(from: string, to: string): Promise<boolean>;
  /** Android only, false elsewhere. */
  remove(from: string, to: string): Promise<boolean>;
  translate(text: string, from: string, to: string): Promise<string | null>;
}

/** `body` is base64. */
export interface PluginAnswer {
  status: number;
  body: string;
}

export interface PluginFetchOptions {
  method?: string;
  headers?: Record<string, string>;
  /** Base64. */
  body?: string | null;
}

/** 64 KB per key. */
export interface PluginStore {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<boolean>;
  forget(key: string): Promise<boolean>;
}

/** An icon the app lends at `./icon/<name>.svg`. Paint it with `mask-image` and `currentColor`. */
export type PluginIcon = string;

export interface FlickerTalk {
  /** Register it while the module loads. */
  onOpen(handler: (opened: PluginOpen) => void): void;

  /** Register while the module loads. Resolve null to change nothing. The app waits 5 minutes at most. */
  onHook(handler: (hook: PluginHook) => Promise<PluginHookResult | null>): void;

  /** Shows the window of a hidden hook run, a no-op otherwise. It closes when the result arrives. */
  show(): void;

  /** Opens the system picker. Resolves `null` if the user picks nothing. */
  pickFile(accept?: string): Promise<PluginFile | null>;

  /** Opens the camera app, or resolves `null`. From app 1.4.1, so check `typeof ft.takePhoto` first. */
  takePhoto?(): Promise<PluginFile | null>;

  /** Needs the `send` permission. */
  send(name: string, mime: string, data: string): void;

  /** Fills the composer, and the user presses send. Needs `send: propose`. */
  say(text: string): void;

  /** Replaces the current toast. `sticky` stays until `notify("")`. App 1.4.1+, check `typeof ft.notify`. */
  notify?(text: string, options?: { sticky?: boolean }): void;

  /** The user picks where. */
  save(name: string, mime: string, data: string): Promise<boolean>;

  /** Needs the `print` permission. */
  print(name: string, mime: string, data: string): Promise<boolean>;

  /** `https` only, to the hosts in `permissions.network`. No identity, key or cookie is sent. */
  fetch(url: string, options?: PluginFetchOptions): Promise<PluginAnswer | false>;

  /** The frame has no origin, so the browser gives it no storage. */
  store: PluginStore;

  records: PluginRecords;

  remind: PluginReminders;

  live: PluginLive;

  /** Resolves false if the message or the contact is gone. */
  openChat(ref: string): Promise<boolean>;

  /** Needs `location`. One fix, only while the app is open. `null` if refused or no fix in about 15 s. */
  location(): Promise<PluginLocation | null>;

  /** Needs the `translate` permission, from app 1.7.0. */
  translate: PluginTranslator;

  close(): void;

  /** Register while the module loads. It gets a few tenths of a second, so save as you go.
   *  From app 1.3.0, so guard it with `if (ft.onClose)`. */
  onClose?(handler: () => void | Promise<void>): void;
}

declare global {
  // eslint-disable-next-line no-var
  var ft: FlickerTalk;
  // eslint-disable-next-line no-var
  var ftIonic: FtIonic | undefined;
}

export {};
