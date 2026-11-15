import { createStore, produce } from "solid-js/store"
import type { Context } from "@opencode/plugin/tui/context"

/** Usage fixture shaped like `/api/experimental/usage/limits`. */
export function fixture(overrides: { rolling?: number; weekly?: number; monthly?: number } = {}) {
  return {
    workspace: {
      id: "org_test",
      name: "Personal",
      usageURL: "https://opencode.ai/console/org_test/activity/overview",
    },
    go: {
      rolling: { percent: overrides.rolling ?? 3, limited: false, resetsAt: Date.now() + 4.6 * 3600_000 },
      weekly: { percent: overrides.weekly ?? 46, limited: false, resetsAt: Date.now() + 18 * 86400_000 },
      monthly: { percent: overrides.monthly ?? 2, limited: false, resetsAt: Date.now() + 23 * 86400_000 },
    },
    budgets: [
      {
        id: "monthly",
        limit: 50,
        spent: 12.4,
        scope: "combined",
        per: "set",
        coverage: "all",
        models: [],
        vendors: [],
        picked: true,
        shared: false,
        resetsAt: Date.now() + 23 * 86400_000,
      },
    ],
  }
}

const theme = {
  text: {
    base: "#eeeeee",
    muted: "#808080",
    faint: "#484848",
    feedback: {
      error: { base: "#ff0000", muted: "#900000" },
      warning: { base: "#ffaa00", muted: "#aa7000" },
      success: { base: "#00ff00", muted: "#009000" },
      info: { base: "#0099ff", muted: "#0066aa" },
    },
  },
  border: { base: "#444444" },
  surface: () => theme,
}

export type Mock = ReturnType<typeof createMock>

/**
 * Host context stub for the TUI plugin API this plugin actually uses. Anything
 * the plugin does not call is left out so the stub cannot drift from reality.
 */
export function createMock(options: { usage?: ReturnType<typeof fixture> | null } = {}) {
  const state = {
    usage: options.usage === undefined ? fixture() : options.usage,
    calls: 0,
    dialogs: 0,
    slots: [] as Array<{ path: string; render: (input: any) => unknown }>,
    layers: [] as Array<() => any>,
    render: undefined as (() => unknown) | undefined,
    stores: new Map<string, { store: any; set: (mutation: (draft: any) => void) => Promise<void> }>(),
  }

  const context = {
    options: {},
    location: { directory: "C:\\hienlt\\studymes" },
    app: { version: "test", channel: "dev" },
    renderer: {},
    client: {
      experimental: {
        usage: {
          limits: async ({ location }: any) => {
            state.calls++
            return { location, data: state.usage }
          },
        },
      },
    },
    data: {
      on: () => () => {},
      listen: () => () => {},
      location: { default: () => ({ directory: "C:\\hienlt\\studymes" }) },
    },
    attention: { notify: async () => ({ ok: true, notification: false, sound: false }) },
    theme,
    themeMode: "dark" as const,
    markdown: { registerCodeBlockRenderer: () => () => {} },
    keymap: {
      layer: (factory: () => any) => {
        state.layers.push(factory)
      },
      dispatch: () => {},
      shortcuts: () => [],
      commands: () => [],
      pending: () => [],
      active: () => [],
      mode: { current: () => "base", push: () => () => {} },
    },
    storage: {
      memory: <Value extends object>(key: string, opts: { initial: Value }) => {
        const [store, set] = createStore<Value>(opts.initial)
        const update = async (mutation: (draft: Value) => void) => {
          set(produce(mutation))
        }
        state.stores.set(key, { store, set: update })
        return [store, update] as const
      },
      store: <Value extends object>(key: string, opts: { initial: Value }) => {
        const [store, set] = createStore<Value>(opts.initial)
        const update = async (mutation: (draft: Value) => void) => {
          set(produce(mutation))
        }
        state.stores.set(key, { store, set: update })
        return [store, update] as const
      },
    },
    ui: {
      dialog: {
        show: (render: () => unknown) => {
          state.dialogs++
          state.render = render
        },
        set: () => {},
        clear: () => {},
        alert: async () => {},
        confirm: async () => true,
        prompt: async () => "",
        select: async () => undefined,
      },
      toast: { show: () => {} },
      format: { path: (value: string) => value },
      router: { register: () => () => {}, navigate: () => {}, current: () => ({ type: "home" }) },
      panel: { open: () => false, close: () => {}, current: () => undefined },
      tabs: {
        enabled: () => false,
        list: () => [],
        open: () => false,
        focus: () => false,
        move: () => false,
        close: () => false,
      },
      model: { current: () => undefined, variant: { list: () => [], set: () => false } },
      slot: (claim: any) => {
        const path = claim.append ?? claim.prepend ?? claim.before ?? claim.after ?? claim.replace
        state.slots.push({ path, render: claim.render })
        return () => {}
      },
    },
  } as unknown as Context

  return {
    context,
    state,
    commands: () => state.layers.flatMap((factory) => factory().commands ?? []),
    command: (id: string) => state.layers.flatMap((factory) => factory().commands ?? []).find((item) => item.id === id),
    store: () => state.stores.get("opencode-usage")!.store,
  }
}
