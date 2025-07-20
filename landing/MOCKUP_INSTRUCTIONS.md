# Bob Diet Coach Landing Page Mockup Instructions

## Overview

The landing page currently uses generic calendar app screenshots. We need to replace them with actual Bob Diet Coach app mockups.

## Mockup Generator

1. Open `mockup-generator.html` in a browser
2. You'll see 5 phone mockups showcasing different features:
   - **Mockup 1**: Chat interface with food logging and confirmation bubble
   - **Mockup 2**: Photo analysis feature
   - **Mockup 3**: Weight tracking with progress
   - **Mockup 4**: Weekly insights and calibration
   - **Mockup 5**: Meal suggestions based on remaining calories

## How to Create Screenshots

### Method 1: Browser Dev Tools (Recommended)

1. Open the HTML file in Chrome/Edge
2. Open Developer Tools (F12)
3. Select the phone frame element in Elements tab
4. Right-click on the element → "Capture node screenshot"
5. Save with appropriate filename

### Method 2: Manual Screenshot

1. Take a screenshot of each phone mockup
2. Crop to just the phone frame
3. Ensure dimensions are consistent

## File Naming & Placement

Replace the following files in `/public/`:

- Device-1.png → Chat interface mockup
- Device-2.png → Photo analysis mockup
- Device-3.png → Weight tracking mockup
- Device-4.png → Weekly insights mockup
- Device-5.png → Meal suggestions mockup

## Additional Mockups Needed

For Device-6.png through Device-9.png, create variations showing:

- Device-6.png → Diary/Food log view
- Device-7.png → Profile/Settings with dietary preferences
- Device-8.png → Progress charts/graphs
- Device-9.png → Onboarding conversation

## Landing Page Sections Using Mockups

### Hero Section (hero.tsx)

Uses: Device-1.png through Device-5.png

- 5 phones in a row with parallax scroll effect

### Feature Highlights (feature-highlight.tsx)

Uses: Device-2.png, Device-3.png, Device-4.png

- Paired with feature descriptions

### Bento Grid (bento.tsx)

Uses: Device-1.png through Device-4.png

- Featured in grid layout

### Benefits Section (benefits.tsx)

Uses: Device-6.png through Device-9.png, Device-1.png

- Horizontal scroll carousel

## Next Steps

1. Generate all 9 mockups using the HTML generator
2. Replace existing Device-\*.png files
3. Test the landing page to ensure all images load correctly
4. Adjust mockup content if needed to better match feature descriptions

## Notes

- Keep phone frame styling consistent
- Ensure text is readable at display size
- Use actual app colors (green primary, etc.)
- Show realistic data and conversations
