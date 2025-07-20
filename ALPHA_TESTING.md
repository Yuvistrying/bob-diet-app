# Alpha Testing Guide - Bob Diet Coach 🧪

Welcome to the Bob Diet Coach alpha test! This guide will help you get started testing and providing valuable feedback.

## 🎯 Alpha Testing Goals

1. **Identify bugs** and usability issues
2. **Test core features** across different devices
3. **Evaluate the onboarding experience**
4. **Assess Bob's conversation quality**
5. **Provide feedback** on missing features

## 🚀 Getting Started

### Option 1: Use the Staging Environment (Recommended)

- URL: `https://staging.bobdietcoach.com` (will be provided)
- Use your own email or test credentials
- All data is isolated from production

### Option 2: Run Locally

Follow the setup instructions in the main README.md

## 📝 Test Scenarios

### 1. New User Onboarding

**Goal**: Test the conversational onboarding flow

1. Sign up with a new account
2. Complete the onboarding conversation with Bob
3. Verify your profile was created correctly

**What to check**:

- [ ] Bob's welcome message appears
- [ ] UI cards show for each onboarding step
- [ ] Input validation works (weight, height, age)
- [ ] Profile page shows correct information after completion
- [ ] Calorie targets seem reasonable

### 2. Food Logging via Text

**Goal**: Test natural language food logging

Try these examples:

- "I had 2 scrambled eggs and whole wheat toast for breakfast"
- "Just ate a large chicken caesar salad"
- "Snacked on an apple and 20 almonds"
- "Dinner was grilled salmon with rice and broccoli"

**What to check**:

- [ ] Bob understands the food items
- [ ] Confirmation bubble shows with reasonable nutrition estimates
- [ ] You can edit portions and macros before confirming
- [ ] Food appears in your diary after confirming
- [ ] Daily totals update correctly

### 3. Food Logging via Photo

**Goal**: Test photo analysis feature

1. Take or upload photos of real meals
2. Wait for Bob's analysis
3. Review and confirm the suggestions

**What to check**:

- [ ] Photo uploads successfully
- [ ] Analysis takes reasonable time (5-10 seconds)
- [ ] Food identification is accurate
- [ ] Portion estimates are reasonable
- [ ] You can edit before confirming

### 4. Weight Tracking

**Goal**: Test weight logging and responses

1. Log your weight: "I weigh 175 lbs today"
2. Try different formats: "75kg", "165.5 pounds"
3. Log weight on consecutive days

**What to check**:

- [ ] Bob responds encouragingly
- [ ] Weight is saved correctly
- [ ] Progress is visible in diary
- [ ] Unit conversion works (kg/lbs)

### 5. Dietary Preferences

**Goal**: Test dietary restriction features

1. Go to Settings > Dietary Preferences
2. Add restrictions (vegetarian, gluten-free, etc.)
3. Set intermittent fasting window
4. Try logging foods that violate restrictions

**What to check**:

- [ ] Preferences save correctly
- [ ] Bob warns about restricted foods
- [ ] Fasting window reminders work
- [ ] Can update preferences via chat

### 6. Similar Meals

**Goal**: Test the meal suggestion feature

1. Log a specific meal (e.g., "chicken breast with sweet potato")
2. Later, say something similar: "I had chicken again"
3. Check if Bob suggests your previous meal

**What to check**:

- [ ] Bob recognizes similar meals
- [ ] Suggestions are relevant
- [ ] Can quickly log repeated meals

### 7. Mobile Experience

**Goal**: Test on mobile devices

Test all above scenarios on:

- [ ] iPhone Safari
- [ ] Android Chrome
- [ ] Tablet (if available)

**What to check**:

- [ ] Chat interface is usable
- [ ] Keyboard doesn't cover input
- [ ] Photo upload works
- [ ] Navigation is smooth
- [ ] Text is readable

### 8. Cross-Device Sync

**Goal**: Test real-time synchronization

1. Log in on two devices
2. Log food on device A
3. Check if it appears on device B immediately

**What to check**:

- [ ] Data syncs in real-time
- [ ] No duplicate entries
- [ ] Conversation state is maintained

## 🐛 Bug Reporting

When you find an issue, please note:

1. **What happened**: Describe the bug
2. **What you expected**: What should have happened
3. **Steps to reproduce**: How can we recreate it
4. **Environment**:
   - Browser and version
   - Device type (desktop/mobile)
   - Operating system
5. **Screenshots**: If applicable

### Bug Report Template

```
**Bug Description**:
[What went wrong]

**Expected Behavior**:
[What should happen]

**Steps to Reproduce**:
1. Go to...
2. Click on...
3. Type...

**Environment**:
- Browser: Chrome 121
- Device: iPhone 13
- OS: iOS 17.2

**Screenshot**:
[Attach if relevant]
```

## 💡 Feature Feedback

We also want to hear about:

- Missing features you expected
- Confusing user experiences
- Suggestions for improvement
- Things you particularly liked

## 📊 Performance Issues

Please report if you experience:

- Slow loading times (> 3 seconds)
- Laggy chat responses
- Failed photo uploads
- Sync issues
- App crashes

## 🔒 Security & Privacy

During alpha testing:

- Use test data when possible
- Don't share real sensitive health information
- Report any security concerns immediately
- Your test data may be deleted after alpha

## 📤 Submitting Feedback

### Option 1: GitHub Issues (Preferred)

Create issues at: `https://github.com/yourusername/bob-diet-coach/issues`

### Option 2: Feedback Form

Use our Google Form: [Link to be provided]

### Option 3: Direct Communication

Email: alpha@bobdietcoach.com

## 🎁 Alpha Tester Perks

As a thank you for helping test Bob:

- 3 months free Pro subscription when we launch
- Early access to new features
- Your name in the credits (optional)
- Direct input on product direction

## ⚠️ Known Issues

Before reporting, check these known issues:

1. **Photo analysis**: May occasionally misidentify exotic foods
2. **Weekly summaries**: Only show on Sundays
3. **Data export**: Not yet implemented
4. **Voice input**: Not supported
5. **Offline mode**: Requires internet connection

## 🤔 Frequently Asked Questions

**Q: Can I use my real data?**
A: Yes, but remember this is alpha software. We recommend using test data.

**Q: Will my data transfer to production?**
A: No, alpha data will be separate from the production launch.

**Q: How long is the alpha test?**
A: Approximately 2-4 weeks, depending on feedback.

**Q: Can I invite others to test?**
A: Please check with us first - we're limiting alpha access.

**Q: What happens after alpha?**
A: We'll move to beta testing with a larger group before public launch.

## 📞 Need Help?

- **Technical issues**: alpha-support@bobdietcoach.com
- **General questions**: Join our Discord [link]
- **Urgent problems**: DM on Twitter @bobdietcoach

---

Thank you for being part of Bob's journey! Your feedback is invaluable in making Bob the best diet coach possible. 🙏

Happy testing! 🚀
