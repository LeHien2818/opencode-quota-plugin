import { Plugin } from "@opencode/plugin/tui"
import type { Context } from "@opencode/plugin/tui/context"
import type { UsageLimitsInfo } from "@opencode/client"
import type { JSX } from "solid-js"
import { Span } from "./span.js"
import {
  METERS,
  bar,
  describeError,
  formatPercent,
  limited,
  money,
  resetsIn,
  severity,
  type Severity,
} from "./usage.js"

const BAR = 18

type Status = "loading" | "ready" | "signed-out" | "error"

type State = {
  status: Status
  data: UsageLimitsInfo | null
  error: string | null
  updatedAt: number
  refreshing: boolean
  dialogOpen: boolean
}

const DEFAULTS = {
  /** Show the allowance in the home footer. */
  home: true,
  /** Show the allowance in the session prompt footer. */
  prompt: true,
  /** Auto-refresh interval in milliseconds. Set to 0 to only refresh on demand. */
  interval: 60_000,
}

function options(context: Context) {
  return {
    home: context.options.home !== false,
    prompt: context.options.prompt !== false,
    interval:
      typeof context.options.interval === "number" && context.options.interval >= 0
        ? context.options.interval
        : DEFAULTS.interval,
  }
}

const padEnd = (value: string, width: number) => (value.length >= width ? value : value + " ".repeat(width - value.length))
const padStart = (value: string, width: number) => (value.length >= width ? value : " ".repeat(width - value.length) + value)

export default Plugin.define({
  id: "opencode-usage",
  async setup(context) {
    const settings = options(context)
    const [state, update] = context.storage.memory<State>("opencode-usage", {
      initial: {
        status: "loading",
        data: null,
        error: null,
        updatedAt: 0,
        refreshing: false,
        dialogOpen: false,
      },
    })

    const theme = context.theme
    const muted = theme.text.muted
    const faint = theme.text.faint
    const base = theme.text.base
    const color = (level: Severity) =>
      level === "high" ? theme.text.feedback.error.base : level === "warn" ? theme.text.feedback.warning.base : theme.text.feedback.success.base

    const location = () => context.location ?? context.data.location.default()
    let inFlight: Promise<void> | undefined
    let timer: ReturnType<typeof setInterval> | undefined

    const refresh = async () => {
      if (inFlight) return inFlight
      update((draft) => {
        draft.refreshing = true
      })
      inFlight = (async () => {
        try {
          const response = await context.client.experimental.usage.limits({ location: location() })
          update((draft) => {
            draft.data = response.data
            draft.status = response.data ? "ready" : "signed-out"
            draft.error = null
            draft.updatedAt = Date.now()
          })
        } catch (error) {
          update((draft) => {
            draft.status = "error"
            draft.error = describeError(error)
          })
        } finally {
          update((draft) => {
            draft.refreshing = false
          })
          inFlight = undefined
        }
      })()
      return inFlight
    }

    const Indicator = (props: { compact: boolean }) => {
      // The component body runs once, so every read of reactive state lives in
      // this function, which JSX evaluates reactively.
      const view = (): JSX.Element | null => {
        if (state.status === "loading" || state.status === "signed-out") return null
        if (state.status === "error") return <text fg={faint}>usage n/a</text>
        const usage = state.data
        if (!usage) return null
        if (limited(usage)) return <text fg={theme.text.feedback.error.base}>usage limited</text>
        if (!usage.go) {
          const spent = usage.budgets.reduce((total, budget) => total + budget.spent, 0)
          const limit = usage.budgets.reduce((total, budget) => total + budget.limit, 0)
          if (limit <= 0) return null
          const used = (spent / limit) * 100
          return (
            <text fg={color(severity(used))}>
              <Span fg={faint}>usage </Span>
              {formatPercent(used)}
            </text>
          )
        }
        const go = usage.go
        return (
          <text>
            <Span fg={faint}>usage </Span>
            {METERS.map((meter, index) => (
              <>
                {index > 0 ? <Span fg={faint}>{props.compact ? "·" : " · "}</Span> : null}
                {props.compact ? null : <Span fg={faint}>{meter.short} </Span>}
                <Span fg={color(severity(go[meter.key].percent))}>{formatPercent(go[meter.key].percent)}</Span>
              </>
            ))}
          </text>
        )
      }
      return <>{view()}</>
    }

    const MeterRow = (props: { label: string; percent: number; limited: boolean; resetsAt: number }) => {
      const cells = () => bar(props.percent, BAR)
      return (
        <box flexDirection="row">
          <text fg={muted}>{padEnd(props.label, 9)}</text>
          <text>
            <Span fg={color(severity(props.percent))}>{"█".repeat(cells().filled)}</Span>
            <Span fg={faint}>{"░".repeat(cells().empty)}</Span>
          </text>
          <text fg={color(severity(props.percent))}>{padStart(formatPercent(props.percent), 6)}</text>
          <text fg={faint}>
            {"  "}
            {props.limited ? "LIMITED" : `resets in ${resetsIn(props.resetsAt)}`}
          </text>
        </box>
      )
    }

    const BudgetRow = (props: { label: string; spent: number; limit: number; resetsAt: number }) => {
      const used = () => (props.limit > 0 ? (props.spent / props.limit) * 100 : 0)
      const cells = () => bar(used(), BAR)
      return (
        <box flexDirection="column">
          <box flexDirection="row">
            <text fg={muted}>{padEnd(props.label, 9)}</text>
            <text>
              <Span fg={color(severity(used()))}>{"█".repeat(cells().filled)}</Span>
              <Span fg={faint}>{"░".repeat(cells().empty)}</Span>
            </text>
            <text fg={base}>
              {"  "}
              {money(props.spent)} / {money(props.limit)}
            </text>
          </box>
          <text fg={faint}>
            {" ".repeat(9)}
            resets in {resetsIn(props.resetsAt)}
          </text>
        </box>
      )
    }

    const body = (): JSX.Element => {
      if (state.status === "loading") return <text fg={muted}>Loading usage…</text>
      if (state.status === "signed-out")
        return (
          <box flexDirection="column">
            <text fg={muted}>This location is not signed in to an OpenCode Console workspace.</text>
            <text fg={faint}>Usage limits appear here once the console connection is active.</text>
          </box>
        )
      if (state.status === "error")
        return (
          <box flexDirection="column">
            <text fg={theme.text.feedback.error.base}>{state.error ?? "Could not load usage limits."}</text>
            <text fg={faint}>Press r to retry.</text>
          </box>
        )
      const usage = state.data
      if (!usage) return <text fg={muted}>No usage limits reported.</text>
      return (
        <box flexDirection="column" gap={1}>
          {usage.go ? (
            <box flexDirection="column">
              <text fg={muted}>OpenCode Go allowance</text>
              {METERS.map((meter) => (
                <MeterRow
                  label={meter.label}
                  percent={usage.go![meter.key].percent}
                  limited={usage.go![meter.key].limited}
                  resetsAt={usage.go![meter.key].resetsAt}
                />
              ))}
            </box>
          ) : null}
          {usage.budgets.length > 0 ? (
            <box flexDirection="column" gap={1}>
              <text fg={muted}>Console budgets</text>
              {usage.budgets.map((budget) => (
                <BudgetRow
                  label={budget.id.charAt(0).toUpperCase() + budget.id.slice(1)}
                  spent={budget.spent}
                  limit={budget.limit}
                  resetsAt={budget.resetsAt}
                />
              ))}
            </box>
          ) : null}
          {!usage.go && usage.budgets.length === 0 ? (
            <text fg={muted}>This workspace reports no allowance or budgets.</text>
          ) : null}
        </box>
      )
    }

    const showDialog = async () => {
      await refresh()
      context.ui.dialog.set({ size: "medium" })
      context.ui.dialog.show(
        () => (
          <box flexDirection="column" gap={1} paddingLeft={1} paddingRight={1}>
            <text fg={base}>
              <b>Usage</b>
              {state.data?.workspace.name ? <Span fg={muted}>{`  ${state.data.workspace.name}`}</Span> : null}
            </text>
            {body()}
            <text fg={faint}>
              {state.refreshing
                ? "Refreshing…"
                : state.updatedAt > 0
                  ? `Updated ${new Date(state.updatedAt).toLocaleTimeString()}`
                  : ""}
              {"  ·  r refresh  ·  esc close"}
            </text>
          </box>
        ),
        () => {
          update((draft) => {
            draft.dialogOpen = false
          })
        },
      )
      update((draft) => {
        draft.dialogOpen = true
      })
    }

    context.keymap.layer(() => ({
      mode: "global",
      priority: 20,
      commands: [
        {
          id: "opencode-usage.show",
          title: "Show usage limits",
          description: "OpenCode Go allowance and Console budgets",
          group: "Usage",
          palette: true,
          bind: "alt+u",
          slash: { name: "usage", aliases: ["quota"] },
          run: () => showDialog(),
        },
      ],
    }))

    context.keymap.layer(() => ({
      mode: "global",
      priority: 20,
      enabled: () => state.dialogOpen,
      commands: [
        {
          id: "opencode-usage.refresh",
          title: "Refresh usage limits",
          bind: "r",
          run: () => refresh(),
        },
      ],
    }))

    const disposers: Array<() => void> = []

    if (settings.home) {
      disposers.push(
        context.ui.slot({
          append: "home.footer.status",
          render: () => <Indicator compact={false} />,
        }),
      )
    }

    if (settings.prompt) {
      disposers.push(
        context.ui.slot({
          append: "prompt.footer.status",
          render: () => <Indicator compact />,
        }),
      )
    }

    let eventRefreshAt = 0
    const refreshAfterEvent = () => {
      const now = Date.now()
      if (now - eventRefreshAt < 5_000) return
      eventRefreshAt = now
      void refresh()
    }

    disposers.push(
      context.data.on("session.usage.updated", refreshAfterEvent),
      context.data.on("credential.updated", refreshAfterEvent),
    )

    if (settings.interval > 0) {
      timer = setInterval(() => {
        void refresh()
      }, settings.interval)
    }

    void refresh()

    return () => {
      if (timer) clearInterval(timer)
      for (const dispose of disposers) dispose()
    }
  },
})
