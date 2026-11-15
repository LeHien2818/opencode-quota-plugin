/**
 * Renders the plugin UI through OpenTUI's test renderer.
 *
 *   bun test/render.tsx
 *
 * Bun compiles JSX eagerly, so unlike OpenCode's Solid build these frames do not
 * update when state changes. This suite therefore checks layout and content at
 * mount time; live updates are covered by the smoke test at the state layer.
 */
import { testRender } from "@opentui/solid"
import plugin from "../src/tui.js"
import { createMock, fixture } from "./mock.js"

const failures: string[] = []
function check(name: string, ok: boolean, detail?: string) {
  console.log(`${ok ? "ok  " : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`)
  if (!ok) failures.push(name)
}

const mock = createMock({ usage: fixture({ rolling: 3, weekly: 46, monthly: 2 }) })
const cleanup = await plugin.setup(mock.context)
await new Promise((resolve) => setTimeout(resolve, 10))

for (const slot of mock.state.slots) check(`slot ${slot.path} is registered`, typeof slot.render === "function")

await mock.command("opencode-usage.show")!.run()
check("dialog was requested", Boolean(mock.state.render))

const dialog = await testRender(() => mock.state.render!() as any, { width: 100, height: 26 })
await dialog.renderOnce()
let frame = dialog.captureCharFrame()

check("dialog names the workspace", frame.includes("Personal"))
check("dialog lists every meter", ["Rolling", "Weekly", "Monthly"].every((label) => frame.includes(label)))
check("dialog shows the rolling percent", frame.includes("3%"))
check("dialog shows reset countdowns", frame.includes("resets in"))
check("dialog shows the budget", frame.includes("$12.40 / $50.00"))
check("dialog shows the refresh hint", frame.includes("r refresh"))
check("dialog footer shows the update time", frame.includes("Updated"))
check("dialog draws progress bars", frame.includes("█") && frame.includes("░"))

await dialog.dispose()

const footerSlot = mock.state.slots.find((slot) => slot.path === "home.footer.status")!
const footer = await testRender(() => footerSlot.render({}) as any, { width: 100, height: 4 })
await footer.renderOnce()
frame = footer.captureCharFrame()
check("footer shows the labeled summary", /usage\s+roll\s+\d+%/.test(frame), frame.trim())
check("footer keeps all three meters", ["roll", "week", "month"].every((label) => frame.includes(label)))
await footer.dispose()

const promptSlot = mock.state.slots.find((slot) => slot.path === "prompt.footer.status")!
const prompt = await testRender(
  () => promptSlot.render({ mode: "normal", showDetails: false }) as any,
  { width: 100, height: 4 },
)
await prompt.renderOnce()
frame = prompt.captureCharFrame()
check("prompt footer shows the compact summary", /usage\s+\d+%·\d+%·\d+%/.test(frame), frame.trim())
check("compact mode drops the labels", !frame.includes("roll"))
await prompt.dispose()

// A limited allowance replaces the numbers with one clear warning.
const limitedMock = createMock({ usage: fixture() })
limitedMock.state.usage!.go!.rolling.limited = true
const limitedCleanup = await plugin.setup(limitedMock.context)
await new Promise((resolve) => setTimeout(resolve, 10))
const limitedSlot = limitedMock.state.slots.find((slot) => slot.path === "home.footer.status")!
const limited = await testRender(() => limitedSlot.render({}) as any, { width: 60, height: 2 })
await limited.renderOnce()
frame = limited.captureCharFrame()
check("limited allowance is announced", frame.includes("usage limited"), frame.trim())
await limited.dispose()
if (typeof limitedCleanup === "function") await limitedCleanup()

// Nothing to show until a workspace is signed in.
const emptyMock = createMock({ usage: null })
const emptyCleanup = await plugin.setup(emptyMock.context)
await new Promise((resolve) => setTimeout(resolve, 10))
const emptySlot = emptyMock.state.slots.find((slot) => slot.path === "home.footer.status")!
const empty = await testRender(() => emptySlot.render({}) as any, { width: 60, height: 2 })
await empty.renderOnce()
frame = empty.captureCharFrame()
check("signed-out stays quiet in the footer", frame.trim() === "", JSON.stringify(frame))
await empty.dispose()
if (typeof emptyCleanup === "function") await emptyCleanup()

if (typeof cleanup === "function") await cleanup()

if (failures.length > 0) {
  console.error(`\n${failures.length} check(s) failed`)
  process.exit(1)
}
console.log("\nall render checks passed")
