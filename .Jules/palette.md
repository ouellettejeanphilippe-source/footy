## 2024-05-24 - Accessible Modal Close Buttons
**Learning:** Found non-semantic elements (div) used for modal close actions with click handlers, which lack keyboard accessibility and screen reader support without proper roles and ARIA labels.
**Action:** Always use native <button> elements for interactive actions, stripped of default styling if needed, and ensure they have an aria-label when icon-only.
