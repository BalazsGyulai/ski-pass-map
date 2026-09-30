# Extractable components

Custom CSS, not a component library. Pass colours are data (`config/pass-colors.json`) and must not become button colours.

## Layout

## Chrome
- Source: `src/components/Chrome.tsx`
- Category: layout
- Description: Chooses the desktop header, the phone bar, the tab bar, and the footer.
- Extractable props: none (reads the URL and the phone breakpoint)
- Hardcoded: class names `site`, `site-map`, `site-tabs`

## Header
- Source: `src/components/Header.tsx`
- Category: layout
- Description: Desktop bar with brand and Map / Passes / Plan.
- Extractable props: none
- Hardcoded: brand text from the site name, tab destinations

## MobileTopBar
- Source: `src/components/MobileTopBar.tsx`
- Category: layout
- Description: Phone bar with the name, language, and settings.
- Extractable props: none
- Hardcoded: brand text

## BottomTabBar
- Source: `src/components/BottomTabBar.tsx`
- Category: layout
- Description: Three phone tabs. Plan shows how many resort-days are saved.
- Extractable props: none (the badge count comes from saved days)
- Hardcoded: three destinations, icons

## Footer
- Source: `src/components/Footer.tsx`
- Category: layout
- Description: Legal links and cookie settings.
- Extractable props: none
- Hardcoded: link list from `legal-links.ts`

## ExplorerFrame
- Source: `src/components/ExplorerFrame.tsx`
- Category: layout
- Description: Map page: search, map, chips, tools, sheet.
- Extractable props: none
- Hardcoded: sheet snaps peek / half / full

## Basic

## ToggleSwitch
- Source: `src/components/ui/SettingsControls.tsx`
- Category: basic
- Description: On/off switch.
- Extractable props: checked (boolean), label (string)
- Hardcoded: knob span, class `toggle-switch`

## SegmentedControl
- Source: `src/components/ui/SettingsControls.tsx`
- Category: basic
- Description: A row of radio buttons, used for theme and units.
- Extractable props: value (string), options (array), ariaLabel (string)
- Hardcoded: class `seg-control`

## StyledSelect
- Source: `src/components/ui/SettingsControls.tsx`
- Category: basic
- Description: Native select with a custom caret.
- Extractable props: value (string), options (array), ariaLabel (string)
- Hardcoded: caret character

## SettingsRow
- Source: `src/components/ui/SettingsControls.tsx`
- Category: basic
- Description: Label, hint, and a control on one row.
- Extractable props: label (string), hint (string, optional)
- Hardcoded: class names

## ToastHost
- Source: `src/components/Toast.tsx`
- Category: basic
- Description: One short status message.
- Extractable props: none
- Hardcoded: role status
