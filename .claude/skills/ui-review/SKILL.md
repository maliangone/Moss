Senior UX/UI designer skill for CloudCLI web interface review. Focuses on modern web UI standards, accessibility, and enterprise usability.

---

# Capture Screenshots (via Playwright MCP)

1. Start services: `docker compose up -d` (if not running)
2. Navigate to CloudCLI UI (`https://localhost/` or `http://localhost:3001/`)
3. Authenticate if needed
4. Navigate to target screen/component
5. Capture screenshots:
   - Default state
   - After primary interaction (button click, form submit)
   - Empty state (no data)
   - Error state (invalid input, network failure)
   - Both languages (en + zh-CN)
6. Save to `.claude/tasks/<task>/screenshots/`

---

# Evaluate — 8 Dimensions (score 1–10 each)

## 1. Visual Hierarchy
- Clear title/body/caption size contrast
- Proper use of Tailwind typography scale
- Headings guide the eye to key actions
- Score < 6 if: all text same size, no visual anchors, unclear primary action

## 2. Spacing & Rhythm
- Consistent spacing using Tailwind spacing scale (p-2, p-4, gap-4, etc.)
- Related items grouped, unrelated items separated
- No cramped or overly spacious areas
- Score < 6 if: inconsistent gaps, elements touching, random spacing values

## 3. Color & Contrast
- WCAG AA contrast ratio (4.5:1 for text, 3:1 for large text)
- Consistent use of design tokens / Tailwind color palette
- Semantic colors (red=error, green=success, blue=info)
- Disabled states clearly distinguishable
- Score < 6 if: low contrast text, hardcoded colors, inconsistent palette

## 4. Interactive Elements
- Buttons have clear hover/active/disabled states
- Form inputs have focus indicators
- Clickable areas are large enough (44x44px minimum for touch)
- No overlapping click targets
- Score < 6 if: invisible focus states, tiny click targets, ambiguous clickability

## 5. Information Density
- Appropriate content per screen (not overwhelming, not sparse)
- Progressive disclosure for complex features
- Key info visible within 3-second scan
- Score < 6 if: wall of text, buried key actions, excessive scrolling for basic tasks

## 6. Empty & Error States
- Zero-data states have helpful guidance and CTAs
- Error messages are actionable (not just "Error occurred")
- Loading states provide feedback (spinners, skeletons)
- Score < 6 if: blank screens, cryptic errors, no loading indicators

## 7. Consistency
- Same component patterns used throughout (buttons, cards, forms)
- Consistent spacing, colors, typography across screens
- Sidebar, header, footer consistent across views
- Score < 6 if: mixed button styles, inconsistent layouts, visual jarring between screens

## 8. Navigation Clarity
- Current location is obvious (active tab, breadcrumb, highlighted sidebar item)
- Back navigation works and is obvious
- No dead ends (every screen has a way out)
- Score < 6 if: lost user syndrome, hidden navigation, unclear current state

---

# i18n Review Checklist

- [ ] All visible strings use i18n keys (no hardcoded text in components)
- [ ] All keys exist in both `en/` and `zh-CN/` locale files
- [ ] Chinese translations are natural (not machine-translated)
- [ ] Layout doesn't break with longer Chinese strings
- [ ] Date/number formats respect locale
- [ ] Language toggle is discoverable and works

---

# Web UI Anti-Pattern Checklist

Run through this list for every screen:

- [ ] No hardcoded colors (use Tailwind classes or CSS variables)
- [ ] No magic numbers for spacing (use Tailwind scale)
- [ ] No inline styles (use Tailwind or CSS modules)
- [ ] No missing loading states
- [ ] No missing error boundaries
- [ ] No console errors in browser DevTools
- [ ] No accessibility warnings (check with browser audit)
- [ ] Forms have proper labels and validation messages
- [ ] Responsive layout works (desktop + tablet widths)
- [ ] Dark mode works (if supported) or is explicitly excluded

---

# Report Format

Save to `.claude/tasks/<task>/ux-review.md`:

```markdown
## UX Review — [screen/component name]

### Total Score: [N]/80

| Dimension | Score | Assessment |
|-----------|-------|-----------|
| Visual hierarchy | [1-10] | ... |
| Spacing & rhythm | [1-10] | ... |
| Color & contrast | [1-10] | ... |
| Interactive elements | [1-10] | ... |
| Information density | [1-10] | ... |
| Empty & error states | [1-10] | ... |
| Consistency | [1-10] | ... |
| Navigation clarity | [1-10] | ... |

### i18n Checklist
- [x/✗] item...

### Anti-Pattern Checklist
- [x/✗] item...

### Must Fix (score < 6)
1. ...

### Should Improve (score 6-7)
1. ...

### Passing (score >= 8)
1. ...

### Screenshots
- [link to screenshots in screenshots/ subfolder]
```

---

# Loop

Fix issues → re-screenshot → re-evaluate → until score >= 56/80 and no dimension < 6.

Commit: `ux: [component-name] — review pass [score]/80`
