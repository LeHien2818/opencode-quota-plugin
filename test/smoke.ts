/**
 * Smoke test for the TUI plugin without starting OpenCode.
 *
 *   bun test/smoke.ts
 *
 * Mounts the plugin against a mock host context and checks the commands, slots,
 * and formatting it registers. Rendering is covered by `bun test/render.tsx`.
 */
import plugin from "../src/tui.js"
import { barText, duration, formatPercent, limited, money, resetsIn, severity, summary, worst } from "../src/usage.js"
import { createMock, fixture } from "./mock.js"

const failures: string[] = []
function check(name: string, ok: boolean, detail?: string) {
  console.log(`${ok ? "ok  " : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`)
  if (!ok) failures.push(name)
}

const mock = createMock()
const cleanup = await plugin.setup(mock.context)
await new Promise((resolve) => setTimeout(resolve, 10))

const show = mock.command("opencode-usage.show")

check("plugin exposes a show command", Boolean(show))
check("show command is in the palette", show?.palette === true)
check("show command has a slash alias", show?.slash?.name === "usage")
check("show command has a default key", show?.bind === "alt+u")
check("registers home footer slot", mock.state.slots.some((slot) => slot.path === "home.footer.status"))
check("registers prompt footer slot", mock.state.slots.some((slot) => slot.path === "prompt.footer.status"))
check("registers a refresh command", Boolean(mock.command("opencode-usage.refresh")))
check("fetched usage once", mock.state.calls === 1, `${mock.state.calls} call(s)`)

await show?.run()
check("opens a dialog", mock.state.dialogs === 1)
check("refreshes when opened", mock.state.calls === 2, `${mock.state.calls} call(s)`)

const usage = fixture({ rolling: 12, weekly: 47.5, monthly: 91 })
check("summary reads all meters", summary(usage) === "12%·47.5%·91%", summary(usage))
check("worst meter drives the footer color", worst(usage) === 91, String(worst(usage)))
check("limited flag comes from meters", limited({ ...usage, go: { ...usage.go!, monthly: { ...usage.go!.monthly, limited: true } } }) === true)
check("bar renders cells", barText(50, 10) === "█████░░░░░", barText(50, 10))
check("percent clamps", formatPercent(140) === "100%" && formatPercent(-1) === "0%")
check("severity thresholds", severity(10) === "ok" && severity(75) === "warn" && severity(95) === "high")
check("money formats cents", money(12.4) === "$12.40")
check("duration keeps two units", duration(2 * 86400_000 + 4 * 3600_000) === "2d 4h", duration(2 * 86400_000 + 4 * 3600_000))
check("reset text is human", resetsIn(Date.now() + 90 * 60_000) === "1h 30m", resetsIn(Date.now() + 90 * 60_000))

if (typeof cleanup === "function") await cleanup()

if (failures.length > 0) {
  console.error(`\n${failures.length} check(s) failed`)
  process.exit(1)
}
console.log("\nall checks passed")
