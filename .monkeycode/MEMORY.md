# User Instruction Memory

This file records user instructions, preferences, and teachings for reference in future interactions.

## Format

### User Instruction Entry
User instruction entries should follow this format:

[User Instruction Summary]
- Date: [YYYY-MM-DD]
- Context: [Mentioned scenario or time]
- Instructions:
  - [Content of user teaching or instruction, described line by line]

### Project Knowledge Entry
Entries discovered by the Agent while performing [specific task description] should follow this format:

[Project Knowledge Summary]
- Date: [YYYY-MM-DD]
- Context: Discovered by Agent while performing [specific task description]
- Category: [Operations & Deployment|Build Methods|Testing Methods|Troubleshooting & Debugging|Workflow & Collaboration|Environment Configuration]
- Instructions:
  - [Specific knowledge points, described line by line]

## Deduplication Strategy
- Before adding a new entry, check for similar or identical instructions.
- If a duplicate is found, skip the new entry or merge it with the existing one.
- When merging, update the context or date information.
- This helps avoid redundant entries and keeps the memory file tidy.

## Entries

[Project Knowledge Summary]
- Date: 2026-02-04
- Context: Discovered by Agent while implementing cross-device video player UI show/hide toggle feature
- Category: Troubleshooting & Debugging
- Instructions:
  - When implementing UI auto-hide functionality in video players, pointermove events can interfere with click handlers due to event timing
  - Solution: pointermove should only add 'ui-visible' class without setting auto-hide timer; timer only set by click/toggle actions
  - When overlay elements block click events, move overlay to DOM end and ensure z-index hierarchy is correct
  - Spinner/loading elements with z-index can intercept clicks; add pointer-events: none to fix
  - Test on multiple devices (iPad Mini 768x1024, iPhone 12, Pixel 5) to verify touch interaction works correctly
  - Playwright mouse.click() coordinates should match actual element center position, not viewport center
