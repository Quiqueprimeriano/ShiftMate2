# ShiftMate Login Page - Design Guidelines

## Design Approach
**Reference-Based**: Google Calendar-inspired with Material Design principles - clean, efficient, and professional. Focus on clarity and trust-building for authentication.

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