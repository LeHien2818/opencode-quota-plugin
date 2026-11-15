import type { RGBA } from "@opentui/core"
import type { JSX } from "solid-js"

/**
 * Inline text with its own foreground color.
 *
 * `@opentui/solid` types `<span>` without style props, but the runtime builds a
 * `TextNodeRenderable`, which accepts `fg` like `<text>` does. This wrapper
 * keeps that working without sprinkling casts through the UI code.
 */
export function Span(props: { fg?: string | RGBA; children?: JSX.Element }) {
  return <span {...(props as Record<string, unknown>)} />
}
