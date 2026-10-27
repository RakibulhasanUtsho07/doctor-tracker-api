# UI/UX and Motion Specification
## Information architecture
Sign-in; dashboard; doctors list with search/filter/pagination; doctor detail with patient list; dedicated patients list/edit/delete/filter; shared responsive navigation.
## Visual system
Define reusable spacing, typography, color, radius, elevation and focus tokens. Preserve readable hierarchy and contrast. Never encode status by color alone. Use consistent icons and accessible chart labels.
## Motion rules
Use restrained, quick transitions and opacity/transform where possible. Do not animate every row in large lists, delay critical actions, create flashing effects or rely on motion alone for feedback. Respect prefers-reduced-motion.
## Functional states
Each data view covers loading, populated, empty, error/retry and permission-denied states. Forms handle inline validation, server errors, pending/disabled submit, double-submit prevention and success feedback. Destructive actions require explicit confirmation.
## Accessibility
Semantic structure, keyboard operation, visible focus, labelled inputs, dialog focus management, touch-sized controls and chart text alternatives. Check mobile/tablet/desktop, keyboard-only and reduced-motion. Screenshots use synthetic data only.
