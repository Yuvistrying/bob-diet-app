# AI Diet Coach - TODO & Ideas Tracker

## 🐛 Fixes and Bugs

### Critical Issues
- [ ] **Chat history sync issues** - History exists but doesn't sync to latest point across devices
- [ ] **Manual logging impossible** - Can only log through chat, no manual input option
- [ ] **New day recognition** - Bob doesn't consistently ask for weight each new day
- [ ] **Cross-device consistency** - Different sessions/devices don't sync properly
- [ ] **Weight history tool** - Not implemented/functioning properly

### Performance
- [ ] Verify no Next.js routes are being used (might be hurting performance)
- [ ] Check for any "next.js whatever" references that shouldn't be there

## 💬 Chat Features

### Core Functionality
- [ ] Bob should remind users to weigh in every new day (sometimes works, needs consistency)
- [ ] Show moving averages daily for faster calibration and more dynamic insights
- [ ] Add follow-up questions about food preparation (home-cooked vs restaurant) for better calorie estimation
- [ ] Implement weight logging reminders if users forget often
- [ ] Add option to log weight units (kg/lbs) during onboarding chat

### Improvements
- [ ] Bob should understand user's lifestyle and suggest easy food swaps
- [ ] More contextual recommendations based on where food is from (homemade vs restaurant)
- [ ] Smarter logging reminders using embedded features

## 📊 Diary & Tracking

### Features Needed
- [ ] Manual logging capability (not just through chat)
- [ ] Visual weight history with charts
- [ ] Show daily moving averages instead of weekly checkpoints
- [ ] Progress bar from current weight to goal weight (instead of just showing current weight)

## ⚙️ Settings & Profile

### Implementation
- [ ] Change from "stealth" to "standard" mode (both in chat and profile)
- [ ] Currently non-existent - needs full implementation
- [ ] User preferences for units, notifications, etc.
- [ ] dark mode- not functional
- [ ] no option to shift and enetr to do down one row

## 🎨 UI/UX Design

### General
- [ ] Try working with Aura for design
- [ ] Get inspiration from Grok on Mobbin
- [ ] Review everything against original plan
- [ ] Focus on user experience matching the vision before adding more functionality

### Specific Pages
- [ ] Page-by-page UI review and fixes
- [ ] Onboarding flow improvements
- [ ] Landing page design and implementation

## 💰 Payment & Business

### Freemium Model
- [ ] **Must start free without credit card** - Currently requires payment info
- [ ] Plan new payment flow according to freemium model (5 chats + 2 photos daily)
- [ ] Add freemium limits display (e.g., "0/5 messages", "0/2 photo uploads") for users on free tier
- [ ] Trial period implementation
- [ ] Auth flow improvements

### Business Features
- [ ] Create business dashboard for monitoring and analytics
- [ ] Plan B2B offering for businesses
- [ ] Landing page with:
  - Product information
  - Sign-up flow
  - Business/Pro user information
  - Services for business partnerships

## 🚀 Features & Ideas

### Marketing & Growth
- [ ] Document personal fitness journey using the app for marketing
  - Show real results
  - Drive traffic
  - Teach people how to use it

### Future Enhancements
- [ ] WhatsApp integration (later)
- [ ] Email reminders for weak spots
- [ ] Embedded features for smart logging reminders

### Data & Calibration
- [ ] Implement moving averages for faster, more precise calibration
- [ ] Don't wait for exact checkpoints - more dynamic approach
- [ ] More elegant week definition for calibration

## 📝 Development Process

### Immediate Actions
1. [ ] Push to GitHub and update project for Claude context
2. [ ] Ensure design and UX match original vision
3. [ ] Then focus on functionality

### Documentation
- [ ] Keep this document updated for Claude Code and regular Claude context
- [ ] Document all decisions and changes

## 🎯 Priority Order

1. **Critical Fixes** - Chat history, manual logging, consistency
2. **Core UX** - Daily weight reminders, proper calibration
3. **Payment Flow** - True freemium without credit card requirement
4. **UI Polish** - Complete design implementation
5. **Advanced Features** - Business dashboard, B2B, marketing tools

---
*Last Updated: June 17, 2025*