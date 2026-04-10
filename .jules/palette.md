## 2024-04-07 - Icon-only Controls and Interactive Divs\n**Learning:** This application heavily relies on icon-only buttons (like refresh, settings) and `<div class="mx">` elements for modal close actions, lacking proper `aria-label`, `title`, `role="button"`, and `tabindex="0"`.\n**Action:** Always check interactive elements in `index.html` to ensure they have appropriate ARIA attributes and keyboard accessibility when adding new controls or modifying existing ones.

## 2024-10-27 - Dynamic Strings and Settings Modals
**Learning:** Found an accessibility issue pattern specific to this app's components: string-concatenated UI templates (e.g. `renderStreamItem` and multiview controls) often have a `title` attribute for visual hover but forget the `aria-label` for screen readers. Also, informational text near inputs is often just a `<div>` instead of a semantic `<label>`.
**Action:** Always check dynamically generated HTML strings for `aria-label` when `title` is present, and ensure all `<input>` elements in custom modals have a `for` linked semantic `<label>`.

## 2026-04-10 - Grid View and Button Filter Refactor
**Learning:** A standard dropdown (<select>) for primary filtering isn't as touch-friendly or modern-looking as an overflow-x scroll container of pill buttons on mobile/TV interfaces. Also, mixed rendering (Timeline vs Grid) requires strict condition branching based on the active tab state.
**Action:** I converted the sport filter into scrollable buttons and split `buildEPG` rendering logic to return a flex-grid of cards if the filter is "live" or "upcoming", while preserving the strict EPG timeline if the filter is "all" (now renamed "GUIDE").
