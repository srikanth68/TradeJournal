# TradeJournal — Design Specification

> Source of truth for designers building the Figma file.
> All values map directly to `src/theme/index.ts` and the app's StyleSheet constants.

---

## 1. Color Tokens

### 1.1 Surface & Background

| Token | Light | Dark | Usage |
|-------|-------|------|-------|
| `background` | `#F2F2F7` | `#000000` | Screen/page background |
| `surface` | `#FFFFFF` | `#1C1C1E` | Cards, rows, inputs, modals |
| `surfaceHigh` | `#F2F2F7` | `#2C2C2E` | Elevated surfaces (toggle bg, avatar fallback) |
| `overlay` | `rgba(0,0,0,0.35)` | `rgba(0,0,0,0.6)` | Modal backdrop |

### 1.2 Text

| Token | Light | Dark | Usage |
|-------|-------|------|-------|
| `textPrimary` | `#1C1C1E` | `#FFFFFF` | Headlines, ticker, primary values |
| `textSecondary` | `#8E8E93` | `#8E8E93` | Subtitles, labels, descriptions |
| `textTertiary` | `#C7C7CC` | `#48484A` | Placeholders, disabled, future dates |
| `sectionHeader` | `#6D6D72` | `#8E8E93` | Uppercased section labels |

### 1.3 Borders & Separators

| Token | Light | Dark | Usage |
|-------|-------|------|-------|
| `border` | `#E5E5EA` | `#38383A` | Card borders, input outlines |
| `separator` | `#E5E5EA` | `#38383A` | Hairline row dividers |

### 1.4 Semantic / Status Colors

| Token | Light | Dark | Usage |
|-------|-------|------|-------|
| `profit` | `#34C759` | `#30D158` | Positive P&L, win days, profit accent |
| `loss` | `#FF3B30` | `#FF453A` | Negative P&L, loss days, short badge text |
| `open` | `#FF9500` | `#FF9F0A` | Open positions, pending status |
| `primary` | `#007AFF` | `#0A84FF` | CTA buttons, links, selected state, today ring |
| `purple` | `#5856D6` | `#5E5CE6` | Strategy/analytics accent |

### 1.5 Badge Backgrounds

| Token | Light | Dark | Usage |
|-------|-------|------|-------|
| `longBadgeBg` | `#E5F1FF` | `#0A2A50` | LONG direction badge |
| `shortBadgeBg` | `#FFE5E5` | `#3D0A0A` | SHORT direction badge |
| `openBadgeBg` | `#FFF3E0` | `#3D2000` | Open status badge |
| `closedBadgeBg` | `#E8F5E9` | `#0A2A0A` | Closed status badge |
| `selectedRowBg` | `#EBF5FF` | `#0A2840` | Selected/active list row |

### 1.6 Grade Colors (fixed — not theme-sensitive)

| Grade | Color | Usage |
|-------|-------|-------|
| A | `#34C759` | Excellent trade execution |
| B | `#30B0C7` | Good execution |
| C | `#FF9500` | Average |
| D | `#FF6B00` | Below average |
| F | `#FF3B30` | Poor execution |

---

## 2. Typography

All fonts are **San Francisco** (iOS system default). No custom typefaces.

| Role | Size | Weight | Color Token | Notes |
|------|------|--------|-------------|-------|
| Screen title (nav) | 17 | 600 | `textPrimary` | Header bar |
| Section header | 13 | 600 | `sectionHeader` | ALL CAPS, letter-spacing 0.5 |
| Card headline | 17–18 | 700 | `textPrimary` | Summary values, month title |
| Row primary | 16 | 700 | `textPrimary` | Ticker symbol |
| Row secondary | 16 | 500 | `textPrimary` | Strategy name, item name |
| Row sub | 12 | 400 | `textSecondary` | Avg price, shares, company |
| P&L value | 15–17 | 600–700 | `profit` / `loss` | No sign prefix; color = direction |
| Label | 12 | 500 | `textSecondary` | Field labels inside cards |
| Badge | 10–11 | 700 | `primary` / `loss` | LONG / SHORT |
| Caption / sub | 11 | 400 | `textSecondary` | Stats sub-lines |
| Placeholder | 15–16 | 400 | `textTertiary` | Input placeholders |

---

## 3. Spacing & Layout

| Name | Value | Usage |
|------|-------|-------|
| Screen H-Pad | 16 | Horizontal padding on all screens |
| Card Padding | 14–16 | Internal padding for surface cards |
| Card Radius | 12–14 | Border radius on cards |
| Row V-Pad | 12–14 | Vertical padding on list rows |
| Gap (inline) | 6–12 | Gap between inline elements |
| Section gap | 20 | Margin above section headers |
| Bottom safe | 24–40 | ScrollView/FlatList bottom padding |
| Separator | hairlineWidth | `StyleSheet.hairlineWidth` (~0.5px) |

---

## 4. Component Specs

### 4.1 Navigation / Tab Bar

```
Tab bar bg:        surface
Tab bar border:    border (top, hairline)
Active icon/label: primary
Inactive icon:     textSecondary
Header bg:         surface
Header title:      textPrimary, 17, weight 600
Header border:     border (bottom, hairline)
```

**Tabs:** Trades · Dashboard · + (Add) · Calendar · Journal *(placeholder)*

---

### 4.2 Summary Strip / Stats Card

Three-column horizontal card, full-width minus 16px padding each side.

```
bg:           surface
radius:       14
padding:      16
shadow:       0 2px 6px rgba(0,0,0,0.07) [light] / none [dark]

Column layout:
  label:  11px, textSecondary, ALL CAPS, letter-spacing 0.3, mb 4
  value:  17–18px, weight 700, textPrimary (or profit/loss)
  divider: hairline, separator, vertical, mx 4
```

---

### 4.3 Position / Trade Row

```
Container (rowWrapper):
  bg:       surface
  radius:   12
  mx:       16
  mb:       8
  shadow:   0 1px 3px rgba(0,0,0,0.05)
  overflow: hidden

Left accent bar:
  width:  4
  height: stretch
  color:  profit | loss | open

Avatar (44×44, radius 10):
  - If logo URL: Image, resizeMode contain
  - Fallback: surfaceHigh bg (long) | loss bg (short), 2-char ticker, white bold 14

Row body (flex: 1):
  Ticker:       16, weight 700, textPrimary
  Direction badge: see §4.5
  Sub line:     12, textSecondary — "Avg $X.XX · N sh · Company Name"

Row right (minWidth 70, align end):
  Closed:  P&L value (profit/loss color, 15, 600) + "Realized" (11, textTertiary)
  Open:    "Open" (13, open color, 600) + "N entries" (11, textTertiary)
```

---

### 4.4 Section Header

```
fontSize:       13
fontWeight:     600
color:          sectionHeader
textTransform:  uppercase
letterSpacing:  0.5
mt: 20, mb: 8, ml: 20
```

---

### 4.5 Badges

**Direction (LONG / SHORT):**
```
radius:         4
px: 6, py: 2
LONG:   bg longBadgeBg, text primary, 10px weight 700
SHORT:  bg shortBadgeBg, text loss, 10px weight 700
```

**Status (OPEN / CLOSED):**
```
radius:         6
px: 8, py: 3
OPEN:   bg openBadgeBg, text open, 12px weight 600
CLOSED: bg closedBadgeBg, text profit, 12px weight 600
```

**Custom (strategy picker):**
```
bg:     surfaceHigh
radius: 4
px: 6, py: 2
text:   11px, textSecondary, weight 500
```

---

### 4.6 Input Field (inside card)

```
Card bg:     surface, radius 12, overflow hidden
Field row:   px 16, py 12
Label:       12px, textSecondary, weight 500, mb 4
Input text:  16px, textPrimary
Placeholder: textTertiary
Separator:   hairline, separator, ml 16
```

---

### 4.7 Primary Button (Save / CTA)

```
bg:           primary
radius:       12
py:           14
text:         16px, weight 600, #FFFFFF
disabled:     opacity 0.6
```

**Secondary / Outline Button (Cancel):**
```
bg:           surface
border:       1px, border
radius:       12
py:           14
text:         16px, weight 600, textSecondary
```

**Tertiary / Ghost Button (Create Custom Strategy):**
```
bg:           surface
border:       1px, primary
radius:       12
py:           14
icon + text:  20px icon + 16px text, both primary, gap 8
```

---

### 4.8 Calendar Day Cell

```
Size:           42×42
Radius:         8
No-trade cell:  transparent bg, textPrimary day number
Trade cell bg:  rgb() interpolated green↔red by P&L magnitude
  - Profitable:  rgb(20–80, 180–255, 20–80)  (soft-caps at $500)
  - Loss:        rgb(180–255, 20–80, 20–80)
Active day number: #FFFFFF, weight 700, 13px
Trade count:    9px, rgba(255,255,255,0.85), below day number
Today ring:     2px border, primary
Future cells:   opacity 0.3
```

---

### 4.9 Bar Chart (Dashboard)

```
Library:   react-native-gifted-charts
Bar:       profit → colors.profit | loss → colors.loss
Bar width: 18, spacing 4
Rules color: background
Y-axis color: border
X-axis color: border
Label text: 11px, textSecondary
Top value label: 11px, profit/loss color (no sign prefix)
```

---

### 4.10 Modal Sheet (pageSheet)

```
Presentation: pageSheet (iOS-native bottom sheet with handle)
SafeArea:     top + bottom edges
bg:           background

Header:
  bg:           surface
  border-bottom: hairline, border
  Title:        17px, weight 600, textPrimary
  Close button: Ionicons "close-circle", 28px, #8E8E93

Body:
  bg:           background
  padding:      16
```

---

## 5. Screen Layouts

### 5.1 Trades (Trade Log)

```
[ Summary Strip: Open Positions | Total Closed | Realized P&L ]
─────────────────────────────────────────────────────
OPEN POSITIONS
[ Position Row ]
[ Position Row ]
─────────────────────────────────────────────────────
CLOSED POSITIONS
[ Position Row ]
[ Position Row ]
...
```

---

### 5.2 Dashboard

```
[ Period Pills: 1W · 1M · 3M · 6M · YTD · 1Y ]
─────────────────────────────────────────────────────
[ Stats Row: Net P&L | Win Rate | Trades | Avg Win ]
[ Stats Row: Avg Loss | Profit Factor | Best Day | Worst Day ]
─────────────────────────────────────────────────────
DAILY P&L
[ Bar Chart — green/red bars by day ]
─────────────────────────────────────────────────────
BY STRATEGY
[ Strategy Row: name · trade count ]  P&L
[ Strategy Row ]
─────────────────────────────────────────────────────
TIME OF DAY
[ Time Slot Row: Pre-Market / Open / Midday / Close ]
  bar + P&L + win rate
```

---

### 5.3 Calendar

```
[ Summary Strip: Trade Days | Win Days | Loss Days | All-time P&L ]
[ Legend: ● Profitable  ● Loss  ○ No trades ]
─────────────────────────────────────────────────────
[ Month Card: March 2026          $X,XXX  3W/1L ]
  Su  Mo  Tu  We  Th  Fr  Sa
  [ ]  1   2   3   4   5   6
   7   8  [G] 10  [R] 12  13
  ...
─────────────────────────────────────────────────────
[ Month Card: February 2026 ... ]
...
```

---

### 5.4 Add Trade

```
[ Section: TRADE ]
  Ticker *        [_______________]
  Company Name    [_______________]
  Direction       [ LONG ] [ SHORT ]
  Entry Date      [  Mar 31, 2026 ▼ ]
  Entry Price *   [_______________]
  Quantity *      [_______________]
  Stop Loss       [_______________]
  Target Price    [_______________]

[ Section: STRATEGY & NOTES ]
  Strategy        [ Select Strategy  › ]
  Setup Notes     [_______________]

[ CTA: Add Trade ]
```

---

### 5.5 Position Detail

```
[ Header: TICKER  LONG/SHORT  OPEN/CLOSED ]

[ Section: POSITION SUMMARY ]
  Avg Entry · Total Qty · Status
  [ Realized P&L card — profit/loss color, large ]

[ Section: ENTRIES ]
  [ Entry Row: date · price · qty · action ]

[ Section: DETAILS ]
  Exit Date · Realized P&L · Grade
  Strategy · Setup Notes

[ Close Position Button ]  (loss color, destructive-style)
```

---

## 6. P&L Display Rules

> **No sign prefix anywhere in the app.** Color is the sole direction indicator.

| Context | Color | Format |
|---------|-------|--------|
| Profit / positive | `profit` | `$1,234.56` |
| Loss / negative | `loss` | `$234.56` |
| Open / unknown | `open` | — |
| Zero | `profit` | `$0.00` |

---

## 7. Iconography

Library: **`@expo/vector-icons` → Ionicons**

| Icon name | Usage |
|-----------|-------|
| `close-circle` | Modal close button |
| `search` | Search field prefix |
| `checkmark` | Selected row indicator |
| `add-circle-outline` | "Create Custom" CTA |
| `chevron-forward` | Row disclosure (navigation) |
| `pencil` | Edit action |
| `trash-outline` | Delete action |
| `calendar-outline` | Date fields |
| `trending-up` | Dashboard / profit context |
| `trending-down` | Loss context |

---

## 8. Animation & Interaction

| Event | Behavior |
|-------|----------|
| List row tap | `activeOpacity: 0.7` |
| Button tap | `activeOpacity: 0.8` |
| Modal open | `animationType: "slide"` (pageSheet) |
| Screen transition | Default Expo Router stack slide |
| Refresh | Pull-to-refresh on Trade Log |
| Theme switch | Instant — `useColorScheme()` triggers re-render |
