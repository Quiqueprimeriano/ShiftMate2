# ShiftMate - Design Guidelines

## Design Approach
**Reference-Based**: Google Calendar-inspired with Material Design principles - clean, efficient, and professional. Focus on clarity, data visualization, and professional aesthetics.

## Layout Architecture

**Split-Screen Design** (Desktop):
- Left panel (40% width): Brand identity zone with subtle blue gradient background
- Right panel (60% width): White authentication area with centered login container (max-width: 480px)
- Mobile: Stack vertically, brand section collapses to compact header

**Vertical Structure**:
- Brand logo + tagline (top of right panel or left panel)
- Primary heading: "Welcome to ShiftMate"
- Subheading: "Manage your team's shifts with ease"
- Google OAuth button (prominent)
- Visual divider with "OR" text
- Email/name login form
- Footer links (Help, Privacy, Terms)

## Typography System

**Font Stack**: Inter (Google Fonts) for clean, professional readability
- Page Heading: 32px/40px, Semi-bold (font-semibold)
- Subheading: 16px/24px, Regular, 60% opacity
- Button Text: 15px/20px, Medium (font-medium)
- Form Labels: 14px/20px, Medium
- Input Text: 15px/22px, Regular
- Footer Links: 13px/20px, Regular

## Spacing Framework

**Core Units**: Tailwind scale of 4, 6, 8, 12, 16, 24
- Form field vertical spacing: 16 (mb-4)
- Section separation: 24 (mb-6)
- Container padding: 32-48 (p-8 to p-12)
- Button height: 44px (h-11) for touch-friendly targets
- Input height: 48px (h-12)

## Component Specifications

### Google OAuth Button
- Full width within container
- White background with subtle border (1px, gray-300)
- Google "G" icon (20px) on left with 12px spacing
- Text: "Continue with Google"
- Drop shadow: subtle elevation (shadow-sm)
- Height: 48px with rounded corners (rounded-lg)

### Visual Divider
- Horizontal line with centered text overlay
- Line: 1px gray-300, spans container width
- "OR" text: small caps, gray-500, white background padding
- Vertical spacing: 24px above and below

### Email/Name Login Form
- Name input field (full width)
- Email input field (full width)
- Both fields: 48px height, rounded-md, gray-300 border
- Focus state: blue border highlight (2px border width)
- Label position: above input with 6px spacing
- Primary CTA: "Continue with Email" button (blue background, white text, full width, 48px height)

### Left Panel Brand Section
- Gradient background: Blue tones (light to medium saturation)
- Centered content vertically and horizontally
- Large ShiftMate logo/icon (64-80px)
- Brand tagline below logo
- Optional: Subtle geometric pattern or shift calendar visualization

### Trust Indicators
- Below login form: "Trusted by 5,000+ teams" with small icon
- Subtle security badge or SSL indicator near footer

### Footer Navigation
- Horizontal link list: Help Center • Privacy Policy • Terms of Service
- Positioned at bottom with 24px margin
- Text size: 13px, gray-600 color
- Links separated by bullet points

## Interaction Patterns

**Button States** (all buttons):
- Default: Solid background with subtle shadow
- Hover: Slight brightness increase (105%)
- Active: Pressed effect (scale 98%)
- Google button hover: Light gray background tint

**Input Field States**:
- Default: Gray border, white background
- Focus: Blue border (2px), subtle blue glow
- Error: Red border with error message below (text-sm, red-600)
- Filled: Maintain focus border color until blur

## Images Section

**Left Panel Background**: 
- Subtle abstract geometric pattern suggesting calendar grids or shift schedules
- Low opacity (10-15%) blue-tinted overlay
- Alternatively: Illustrated scene of team collaboration or calendar interface
- Image should reinforce productivity and organization themes
- If photo: Professional office/team environment with blue color grading

**No large hero image** - This is a focused login page prioritizing conversion over storytelling.

## Accessibility Requirements

- All inputs include visible labels (no placeholder-only patterns)
- Form validation messages appear below inputs with appropriate ARIA attributes
- Focus indicators are prominent (2px blue outline)
- Color contrast meets WCAG AA standards (4.5:1 minimum)
- Touch targets minimum 44x44px for mobile
- Keyboard navigation flows logically: Logo → Google button → Name → Email → Submit

## Responsive Behavior

**Desktop (1024px+)**: Split-screen layout as described
**Tablet (768-1023px)**: Reduce left panel to 35%, adjust container padding
**Mobile (<768px)**: 
- Stack layout with compressed brand header (logo + name only)
- Full-width container with 16px horizontal padding
- Maintain all spacing ratios but scale down container max-width
- Footer links stack vertically with 8px spacing

---

# Dashboard Design Guidelines

## Color Palette

### Shift Type Colors (Vibrant & Distinct)
- **Morning Shifts**: `#F59E0B` (Amber 500) - Warm sunrise tones
- **Afternoon/Evening Shifts**: `#3B82F6` (Blue 500) - Professional daytime blue
- **Night Shifts**: `#6366F1` (Indigo 500) - Deep evening purple-blue
- **Mixed/Double Shifts**: Gradient combination of relevant shift types

### Status & Indicator Colors
- **Success/Approved**: `#10B981` (Emerald 500)
- **Warning/Pending**: `#F59E0B` (Amber 500)
- **Error/Declined**: `#EF4444` (Red 500)
- **Info/Neutral**: `#6B7280` (Gray 500)

### Background Gradients
- **Primary Gradient**: From `#3B82F6` to `#2563EB` (Blue 500 to Blue 600)
- **Accent Gradient**: From `#8B5CF6` to `#7C3AED` (Purple 500 to Purple 600)
- **Subtle Background**: From `#F9FAFB` to `#F3F4F6` (Gray 50 to Gray 100)

## Dashboard Layout

### Grid Structure
- **Desktop (1280px+)**: 3-column grid for metric cards, 2-column for detailed sections
- **Tablet (768-1279px)**: 2-column grid adapting to single column for charts
- **Mobile (<768px)**: Single column, full-width cards with touch-optimized spacing

### Card Design
- **Border Radius**: `rounded-xl` (12px) for modern feel
- **Shadow**: `shadow-sm` default, `shadow-md` on hover for depth
- **Padding**: `p-6` (24px) for comfortable content spacing
- **Background**: White with subtle hover transition to `bg-gray-50`
- **Border**: Subtle `border border-gray-200` for definition

### Metric Cards
- **Large Number**: `text-3xl font-bold` (30px) with gradient text option
- **Label**: `text-sm text-gray-600` (14px) above the number
- **Icon**: 40px circle with gradient background, white icon inside
- **Trend Indicator**: Small arrow with percentage, color-coded (green up, red down)
- **Spacing**: Icon left, content center-left, trend right

## Typography Hierarchy

### Dashboard Headings
- **Page Title**: `text-2xl font-bold text-gray-900` (24px, bold)
- **Section Heading**: `text-lg font-semibold text-gray-800` (18px, semi-bold)
- **Card Title**: `text-base font-medium text-gray-700` (16px, medium)
- **Metric Value**: `text-3xl font-bold` (30px, bold) with color coding
- **Body Text**: `text-sm text-gray-600` (14px, regular)
- **Caption/Hint**: `text-xs text-gray-500` (12px, regular)

## Chart Specifications

### Bar Charts
- **Bar Color**: Use shift type colors with 80% opacity
- **Bar Radius**: Rounded top corners (`radius: [8, 8, 0, 0]`)
- **Grid**: Light gray (`#F3F4F6`) horizontal lines only
- **Axes**: Gray-600 labels, no axis lines
- **Tooltip**: White background, shadow-lg, rounded-lg, padding 12px
- **Hover Effect**: Increase opacity to 100%, slight scale (102%)

### Line Charts
- **Line Color**: Primary blue (#3B82F6) with 2px stroke
- **Gradient Fill**: Blue with opacity gradient from 20% to 0%
- **Data Points**: 6px circles, white fill, blue stroke
- **Area**: Subtle fill under line for emphasis

### Pie/Donut Charts
- **Segment Colors**: Rotation through shift type palette
- **Inner Radius**: 60% for donut effect
- **Label**: Outside with connecting lines
- **Hover**: Subtle scale increase (105%)

## Spacing System

### Card Spacing
- **Between Cards**: `gap-6` (24px) in grid layouts
- **Card Internal Padding**: `p-6` (24px)
- **Section Margins**: `mb-8` (32px) between major sections
- **Component Spacing**: `space-y-4` (16px) for related items

### Content Spacing
- **Icon to Text**: `gap-3` or `ml-3` (12px)
- **Label to Value**: `gap-1` (4px vertical)
- **Button Spacing**: `gap-2` (8px) in button groups
- **Form Fields**: `gap-4` (16px) between fields

## Interactive Elements

### Buttons
- **Primary**: Blue gradient background, white text, `shadow-md hover:shadow-lg`
- **Secondary**: White background, gray border, gray text, hover subtle gray fill
- **Sizes**: `h-10 px-4` (40px height) for standard, `h-9 px-3` for compact
- **Icons**: 20px with 8px spacing from text
- **Disabled**: 50% opacity, no hover effects

### Tables
- **Header**: `bg-gray-50` background, `font-medium` text, sticky on scroll
- **Row**: Hover `bg-gray-50`, border-bottom `border-gray-200`
- **Cell Padding**: `px-6 py-4` (24px horizontal, 16px vertical)
- **Zebra Stripes**: Optional `even:bg-gray-50` for long tables
- **Action Buttons**: Icon-only, 36px touch target, hover background

### Loading States
- **Skeleton**: Gray-200 background with shimmer animation
- **Spinner**: Blue primary color, 24px for inline, 40px for full-page
- **Progressive**: Show layout first, populate with skeletons, fade in data

## Empty States
- **Icon**: 64px gray-400 icon centered
- **Heading**: "No [items] yet" in gray-900
- **Description**: Helpful text in gray-600 explaining why empty
- **Action Button**: Primary CTA to add first item
- **Illustration**: Optional subtle background graphic

## Responsive Behavior

### Breakpoints
- **Mobile First**: Base styles for 320px+
- **sm (640px)**: Tablet portrait adjustments
- **md (768px)**: Tablet landscape, small desktop
- **lg (1024px)**: Desktop standard
- **xl (1280px)**: Large desktop with max-width containers
- **2xl (1536px)**: Extra large screens

### Mobile Optimizations
- **Cards**: Full width with reduced padding (`p-4`)
- **Charts**: Shorter height (240px vs 320px), responsive axes
- **Tables**: Horizontal scroll or card transformation
- **Navigation**: Bottom tab bar or hamburger menu
- **Touch Targets**: Minimum 44x44px for all interactive elements

## Accessibility

### Color Contrast
- **Text on White**: Minimum 4.5:1 ratio (WCAG AA)
- **Interactive Elements**: Clear visual indicators for focus/hover
- **Charts**: Not solely color-dependent, use patterns or labels

### Keyboard Navigation
- **Focus Indicators**: 2px blue ring with offset
- **Tab Order**: Logical flow top to bottom, left to right
- **Skip Links**: For bypassing navigation to main content

### Screen Readers
- **ARIA Labels**: For icon-only buttons and interactive charts
- **Live Regions**: For dynamic updates (new shifts, notifications)
- **Semantic HTML**: Proper heading hierarchy, landmark regions