import {
  MessageCircleIcon,
  CameraIcon,
  TrendingUpIcon,
  CalendarIcon,
  HeartHandshakeIcon,
  SparklesIcon,
} from "lucide-react";

export const BLUR_FADE_DELAY = 0.15;

export const siteConfig = {
  name: "Bob Diet Coach",
  description: "Your Personal AI Nutrition Coach. Lose, gain, or maintain weight with an AI that learns YOUR metabolism and guides every food decision in real-time.",
  cta: "Start Your Free Week",
  url: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
  keywords: [
    "AI Diet Coach",
    "AI Nutritionist",
    "Weight Loss",
    "Weight Gain",
    "Meal Planning",
    "Calorie Tracking",
    "Nutrition Coach",
    "Personalized Diet",
  ],
  links: {
    email: "support@bobdietcoach.com",
    twitter: "https://twitter.com/bobdietcoach",
    discord: "https://discord.gg/bobdietcoach",
    github: "https://github.com/bobdietcoach",
    instagram: "https://instagram.com/bobdietcoach",
  },
  features: [
    {
      name: "AI Coach + Tracker in One",
      description:
        "Bob's not just tracking - he's actively coaching. Ask \"What should I eat?\" and get personalized suggestions based on today's intake, your goals, and dietary needs. It's like having a nutritionist who knows everything you've eaten.",
      icon: <MessageCircleIcon className="h-6 w-6" />,
    },
    {
      name: "Smart Photo Analysis",
      description:
        "Snap a photo and Bob analyzes portions and calories. Not sure about dressings or cooking methods? He'll ask follow-up questions to ensure accurate logging. No more guessing games.",
      icon: <CameraIcon className="h-6 w-6" />,
    },
    {
      name: "Learns YOU in One Week",
      description:
        "After just 7 days, Bob starts understanding YOUR metabolism. Losing, gaining, or maintaining - he adjusts targets based on YOUR actual results, not generic formulas that fail.",
      icon: <CalendarIcon className="h-6 w-6" />,
    },
    {
      name: "Real-Time Meal Planning",
      description:
        "4pm and need dinner ideas? Bob knows what you've eaten and suggests meals that fit your remaining calories, macros, and preferences. Diabetic? Vegan? He's got you covered.",
      icon: <TrendingUpIcon className="h-6 w-6" />,
    },
    {
      name: "Works for ANY Goal",
      description:
        "Whether you're losing, gaining, or maintaining weight, Bob adapts. Building muscle? He'll ensure protein targets. Managing diabetes? He tracks carbs carefully. YOUR goals, YOUR way.",
      icon: <HeartHandshakeIcon className="h-6 w-6" />,
    },
    {
      name: "Catches Hidden Calories",
      description:
        'Say "had coffee" and Bob asks "Black or with additions?" These smart follow-ups catch the 200+ hidden calories that sabotage progress. Finally, accurate tracking that works.',
      icon: <SparklesIcon className="h-6 w-6" />,
    },
  ],
  featureHighlight: [
    {
      title: "Your 24/7 Nutrition Consultant",
      description:
        "\"What should I eat for dinner?\" \"Is this protein bar worth the calories?\" \"What can I order at this restaurant?\" Get instant personalized answers based on what you've already eaten today and YOUR specific goals.",
      imageSrc: "/Device-2.png",
      direction: "rtl" as const,
    },
    {
      title: "Daily Weigh-In Reminders",
      description:
        "Bob uses 7-day weight averages to track real progress, not daily fluctuations. Get gentle reminders to weigh in, plus insights like \"Your average is down 0.5kg this week\" or \"Great consistency - you're on track!\"",
      imageSrc: "/Device-3.png",
      direction: "ltr" as const,
    },
    {
      title: "Weekly Insights That Transform",
      description:
        "Every Sunday, Bob compares your actual weight change to predictions. \"Scale didn't move as expected - let's adjust your calories up\" or \"You're losing faster than planned - time to add 200 calories.\" Real adjustments based on real results.",
      imageSrc: "/Device-4.png",
      direction: "rtl" as const,
    },
  ],
  bento: [
    {
      title: "Coach + Tracker = Magic",
      content:
        "Bob isn't just counting - he's coaching. Get meal suggestions, answer food questions, plan your day. It's like having ChatGPT and MyFitnessPal had a baby that actually knows nutrition.",
      imageSrc: "/Device-1.png",
      imageAlt: "Bob giving meal recommendations",
      fullWidth: true,
    },
    {
      title: "Real-Time Decision Making",
      content:
        "At a restaurant? Snap the menu. Bob suggests what fits your day. Grocery shopping? Ask what to buy. Every food decision, guided by AI that knows YOUR history.",
      imageSrc: "/Device-2.png",
      imageAlt: "Bob helping with restaurant choices",
      fullWidth: false,
    },
    {
      title: "Works for Gaining Too",
      content:
        "Building muscle? Bob ensures you hit protein goals and calorie surplus. He'll even remind you to eat more when you're falling short. Finally, an AI that helps you gain weight healthily.",
      imageSrc: "/Device-3.png",
      imageAlt: "Bob helping with muscle gain goals",
      fullWidth: false,
    },
    {
      title: "YOUR Metabolism, Decoded",
      content:
        "Week 1: Bob learns. Week 2: Bob adapts. Week 3: You're amazed. Whether losing, gaining, or maintaining, Bob discovers what works for YOUR unique body.",
      imageSrc: "/Device-4.png",
      imageAlt: "Personalized metabolism insights",
      fullWidth: true,
    },
  ],
  benefits: [
    {
      id: 1,
      text: "Stop guessing what to eat. Get personalized meal suggestions based on what you've already had today.",
      image: "/Device-6.png",
    },
    {
      id: 2,
      text: "Finally understand YOUR body. Bob shows exactly what makes YOUR scale move - up or down as desired.",
      image: "/Device-7.png",
    },
    {
      id: 3,
      text: "Manage any dietary need - diabetic, vegan, keto, allergies. Bob remembers and guides accordingly.",
      image: "/Device-8.png",
    },
    {
      id: 4,
      text: "Get a nutrition coach, meal planner, and accurate tracker all in one AI that learns YOU.",
      image: "/Device-1.png",
    },
  ],
  pricing: [
    {
      name: "Free",
      href: "/sign-up",
      price: "$0",
      period: "forever",
      yearlyPrice: "$0",
      features: [
        "5 coaching conversations per day",
        "2 photo analyses per day",
        "Basic meal suggestions",
        "7-day history",
      ],
      description: "Try Bob's coaching approach",
      buttonText: "Start Free",
      isPopular: false,
    },
    {
      name: "Premium",
      href: "/sign-up",
      price: "$9.99",
      period: "month",
      yearlyPrice: "$99",
      features: [
        "Unlimited AI coaching & consulting",
        "Unlimited photo analysis",
        "Personalized meal planning",
        "Weekly metabolism calibration",
        "Complete history & patterns",
        "Priority support",
      ],
      description: "Your personal AI nutritionist",
      buttonText: "Start Free Week",
      isPopular: true,
    },
  ],
  faqs: [
    {
      question: "How is Bob different from MyFitnessPal or calorie counters?",
      answer: (
        <span>
          Bob is an AI nutrition coach AND tracker in one. While others just count, Bob actively helps you decide what to eat, plans meals, answers food questions, and adjusts based on YOUR results. It's like having a nutritionist who remembers everything you've ever eaten.
        </span>
      ),
    },
    {
      question: "Can Bob help me gain weight or maintain?",
      answer: (
        <span>
          Absolutely! Bob adapts to ANY goal. Building muscle? He'll ensure you hit protein targets and calorie surplus. Maintaining after weight loss? He'll find YOUR perfect balance. Just tell Bob your goal and he guides accordingly.
        </span>
      ),
    },
    {
      question: "What kind of coaching does Bob provide?",
      answer: (
        <span>
          Ask Bob anything! \"What should I eat for dinner?\" gets personalized suggestions based on today's intake. \"Is this restaurant meal worth it?\" gets instant analysis. \"Plan my meals for tomorrow\" gets a full day planned around your preferences and goals.
        </span>
      ),
    },
    {
      question: "How does Bob handle dietary restrictions?",
      answer: (
        <span>
          Bob remembers everything - diabetic needs, vegan choices, keto requirements, allergies. Every suggestion and meal plan respects your restrictions. He'll even warn if something doesn't match your preferences.
        </span>
      ),
    },
    {
      question: "How quickly does Bob learn my metabolism?",
      answer: (
        <span>
          After just one week, Bob starts understanding YOUR patterns. By week two, he's adjusting targets based on YOUR actual results. By week three, you'll be amazed at how accurately he predicts what works for YOUR body.
        </span>
      ),
    },
    {
      question: "Is this just AI hype or does it really work?",
      answer: (
        <span>
          Bob combines proven science (tracking) with AI coaching that adapts to YOU. 47,000+ users see consistent results because Bob learns from YOUR data, not generic formulas. Average loss is 0.5-1kg/week, but Bob works for gaining and maintaining too!
        </span>
      ),
    },
  ],
  footer: [
    {
      id: 1,
      menu: [
        { href: "#features", text: "Features" },
        { href: "#pricing", text: "Pricing" },
        { href: "#", text: "About" },
        { href: "#", text: "Blog" },
        { href: "mailto:support@bobdietcoach.com", text: "Contact" },
      ],
    },
  ],
  testimonials: [
    {
      id: 1,
      text: "Bob's meal suggestions changed everything. Instead of staring at my fridge wondering what fits my calories, I just ask Bob. He knows what I've eaten and what I need. Like having a nutritionist on speed dial!",
      name: "Sarah T.",
      role: "Lost 12 lbs in 2 months",
      image:
        "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=500&auto=format&fit=crop&q=60&ixlib=rb-4.0.3",
    },
    {
      id: 2,
      text: "I'm diabetic and Bob tracks my carbs perfectly. He even suggests meal swaps when I'm getting too high. No other app actively helps me manage my blood sugar while losing weight.",
      name: "Michael R.",
      role: "Lost 22 lbs, A1C improved",
      image:
        "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=500&auto=format&fit=crop&q=60&ixlib=rb-4.0.3",
    },
    {
      id: 3,
      text: "Finally gaining weight healthily! Bob reminds me when I'm under my calorie goal and suggests protein-rich snacks. Gained 8 lbs of muscle with his guidance.",
      name: "Emma L.",
      role: "Gained 8 lbs (muscle)",
      image:
        "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=500&auto=format&fit=crop&q=60&ixlib=rb-4.0.3",
    },
    {
      id: 4,
      text: "The real-time coaching is incredible. At restaurants, I show Bob the menu and he tells me what fits. No more anxiety about eating out!",
      name: "James K.",
      role: "Lost 30 lbs",
      image:
        "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=500&auto=format&fit=crop&q=60&ixlib=rb-4.0.3",
    },
    {
      id: 5,
      text: "Bob learned I actually lose weight better with MORE carbs. Every Sunday's insights blow my mind. It's like having a personal nutrition researcher.",
      name: "Lisa T.",
      role: "Lost 25 lbs",
      image:
        "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=500&auto=format&fit=crop&q=60&ixlib=rb-4.0.3",
    },
    {
      id: 6,
      text: "Maintaining weight after loss was always impossible for me. Bob found my perfect calorie balance and helps me stay there. 6 months stable for the first time in my life!",
      name: "David C.",
      role: "Maintaining after 30 lb loss",
      image:
        "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=500&auto=format&fit=crop&q=60&ixlib=rb-4.0.3",
    },
  ],
};

export type SiteConfig = typeof siteConfig;
