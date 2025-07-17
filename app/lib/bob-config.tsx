import {
  BrainIcon,
  MessageCircleIcon,
  TrendingUpIcon,
  HeartIcon,
  SmileIcon,
  CameraIcon,
  ChartBarIcon,
  RocketIcon,
} from "lucide-react";

export const BLUR_FADE_DELAY = 0.15;

export const bobConfig = {
  name: "Bob Diet Coach",
  tagline: "Your Body Isn't Broken. Generic Diets Are.",
  description:
    "Meet Bob – the AI diet coach who learns YOUR unique metabolism through friendly conversation. No more failing at one-size-fits-all calorie math.",
  cta: "Start Your Free Chat with Bob",
  ctaSubtext: "No credit card needed. Chat naturally. See results.",
  url: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:5174",

  hero: {
    headline: "Your Body Isn't Broken. Generic Diets Are.",
    subheadline:
      "Meet Bob – the AI diet coach who learns YOUR unique metabolism through friendly conversation. No more failing at one-size-fits-all calorie math.",
    trustIndicator: {
      rating: "⭐⭐⭐⭐⭐",
      quote: '"Bob finally understood why other diets failed me"',
      author: "Sarah M., lost 12 lbs",
    },
  },

  valueProposition: {
    header: "Why 47,000+ People Trust Bob Over Traditional Diet Apps",
    benefits: [
      {
        icon: <BrainIcon className="h-6 w-6" />,
        title: "Bob Learns YOUR Metabolism",
        description:
          "Studies show calorie tracking is 20-30% inaccurate – even with perfect logging. Bob's AI adjusts for this reality, learning YOUR actual metabolism from scale results. The difference? Finally breaking through plateaus instead of spinning your wheels.",
      },
      {
        icon: <MessageCircleIcon className="h-6 w-6" />,
        title: "Just Chat Naturally",
        description:
          "No tedious food databases or barcode scanning. Tell Bob what you ate like you'd text a friend. He'll ask smart follow-up questions to catch hidden calories.",
      },
      {
        icon: <TrendingUpIcon className="h-6 w-6" />,
        title: "Adapts From Your Scale",
        description:
          "Bob adjusts your targets based on actual weight changes, not calculators. Finally, a coach that admits when the math is wrong.",
      },
      {
        icon: <CameraIcon className="h-6 w-6" />,
        title: "Snap a Photo, Get Instant Analysis",
        description:
          "Can't describe your meal? Just take a photo! Bob's AI instantly analyzes your food, estimates portions, and tracks everything - even that sauce on the side.",
      },
      {
        icon: <HeartIcon className="h-6 w-6" />,
        title: "Fits YOUR Crazy Life",
        description:
          "Stress-eating Thursdays? Late-night parent snacks? Bob plans for reality, not perfection. He works WITH your patterns, not against them.",
      },
      {
        icon: <SmileIcon className="h-6 w-6" />,
        title: "Zero Judgment Zone",
        description:
          "Bob celebrates your Saturday pancakes and helps you navigate pizza night. Because sustainable weight loss includes the foods you love.",
      },
    ],
  },

  testimonials: [
    {
      id: 1,
      text: "I deleted 47 diet app bookmarks after finding Bob. For the first time in 5 years, I'm not at war with my body. Down 12 pounds and actually enjoying meals with my family again.",
      name: "Sarah T.",
      role: "Marketing Manager & Mom of 2",
      image:
        "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=500&auto=format&fit=crop&q=60",
    },
    {
      id: 2,
      text: "Bob noticed I always overeat on Thursdays (deadline days). Instead of shaming me, he helped me plan for it. Game changer.",
      name: "Jennifer K.",
      role: "Freelance Designer",
      image:
        "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=500&auto=format&fit=crop&q=60",
    },
    {
      id: 3,
      text: "Other apps gave me 1,200 calories and called it science. Bob figured out I actually lose weight on 1,600. That 20-30% tracking error everyone ignores? Bob adjusts for it. Game changer.",
      name: "Rachel M.",
      role: "Nurse Practitioner",
      image:
        "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=500&auto=format&fit=crop&q=60",
    },
    {
      id: 4,
      text: "As a night shift worker, standard diet apps were useless. Bob learned my weird eating schedule and actually made it work for weight loss.",
      name: "Marcus D.",
      role: "ER Nurse",
      image:
        "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=500&auto=format&fit=crop&q=60",
    },
    {
      id: 5,
      text: "I've tried everything - keto, intermittent fasting, you name it. Bob is the first 'diet' that doesn't feel like a diet. Down 18 lbs in 3 months.",
      name: "Lisa P.",
      role: "Teacher",
      image:
        "https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=500&auto=format&fit=crop&q=60",
    },
    {
      id: 6,
      text: "Bob's photo analysis is magic. I just snap my plate and he knows. No more lying to myself about portion sizes!",
      name: "David R.",
      role: "Software Engineer",
      image:
        "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=500&auto=format&fit=crop&q=60",
    },
  ],

  stats: {
    items: [
      { label: "Avg. weight loss", value: "0.5-1kg/week", icon: "📉" },
      { label: "Reach their goals", value: "70%", icon: "🎯" },
      { label: "User satisfaction", value: "4.8/5", icon: "💚" },
      { label: "Still active after 6mo", value: "89%", icon: "🔄" },
    ],
  },

  features: [
    {
      title: "AI-Powered Metabolism Learning",
      description:
        "Bob's AI watches how YOUR body responds to food and adjusts your plan accordingly. No more generic formulas that don't work for you.",
      icon: <BrainIcon className="h-5 w-5" />,
    },
    {
      title: "Natural Conversation Logging",
      description:
        "Just tell Bob what you ate like you'd text a friend. No databases, no scanning, no hassle.",
      icon: <MessageCircleIcon className="h-5 w-5" />,
    },
    {
      title: "Photo Analysis",
      description:
        "Snap a photo of your meal and Bob figures out the rest. Perfect for when you're out or just don't know what to call that dish.",
      icon: <CameraIcon className="h-5 w-5" />,
    },
    {
      title: "Weekly Calibration",
      description:
        "Bob adjusts your targets based on your actual weight changes, not what some calculator says should happen.",
      icon: <ChartBarIcon className="h-5 w-5" />,
    },
    {
      title: "Real Life Planning",
      description:
        "Bob learns your patterns - late dinners, stress eating, weekend indulgences - and plans around them.",
      icon: <HeartIcon className="h-5 w-5" />,
    },
    {
      title: "Progress Insights",
      description:
        "See exactly how your body responds to different foods and habits with Bob's intelligent analysis.",
      icon: <RocketIcon className="h-5 w-5" />,
    },
  ],

  productShowcase: {
    title: "See How Natural Weight Loss Feels",
    scenes: [
      {
        time: "Morning",
        scenario: "Woman rushes through morning, grabs kid's leftover toast",
        chat: "Stole Emma's toast again 😅",
        response: "Morning chaos! That's about 180 cal. How's your energy?",
      },
      {
        time: "Afternoon",
        scenario: "Stress-eating at desk",
        chat: "[Photo of salad + candy bar]",
        response: "Tough day? Let's track both - no judgment, just data.",
      },
      {
        time: "Evening",
        scenario: "Family pizza night",
        chat: "Pizza night with the fam",
        response:
          "Enjoy it! Family time matters. I'll adjust tomorrow's targets.",
      },
      {
        time: "Results",
        scenario: "Morning weigh-in, woman smiling",
        overlay: "Bob learns what works for YOU",
        result: "2 months later: -12 lbs, +100% confidence",
      },
    ],
  },

  pricing: [
    {
      name: "Free Trial",
      price: "$0",
      period: "7 days",
      description: "Try Bob risk-free and see if he's right for you",
      features: [
        "Full access to Bob's AI coaching",
        "Natural conversation logging",
        "Photo meal analysis",
        "Daily calorie & macro tracking",
        "Weekly insights & calibration",
      ],
      buttonText: "Start Free Trial",
      isPopular: false,
    },
    {
      name: "Pro",
      price: "$9.99",
      period: "month",
      description: "Full access after your free trial",
      features: [
        "Everything in Free Trial",
        "Unlimited photo analyses",
        "Priority AI responses",
        "Export your data anytime",
        "Email & chat support",
      ],
      buttonText: "Start Free, Then $9.99/mo",
      isPopular: true,
    },
  ],

  faqs: [
    {
      question: "Is this just another calorie counting app?",
      answer:
        "Nope! Bob's built on research showing even perfect calorie tracking is 20-30% off. Instead of pretending this doesn't exist, Bob watches how YOUR body actually responds and adjusts. He's like having a coach who fixes the math when reality doesn't match the textbook.",
    },
    {
      question: "Do I have to log every bite perfectly?",
      answer:
        'Just tell Bob what you ate like you\'d tell a friend. Say "Grabbed McDonald\'s" and he\'ll ask smart follow-ups like "What did you order? Any sauces?" Bob catches the details like oils and dressings you might miss.',
    },
    {
      question: "What if I have crazy work hours / kids / real life?",
      answer:
        "Bob's literally designed for real life! He learns YOUR patterns – whether that's shift work, parent life, or travel chaos. He plans around your reality, not some perfect world.",
    },
    {
      question: "Can I still eat foods I love?",
      answer:
        "Absolutely! Bob believes in pizza nights and birthday cake. He'll help you fit favorites into your goals because permanent weight loss includes joy, not just salads.",
    },
    {
      question: "Is my chat with Bob private?",
      answer:
        "100% private and secure. Your conversations are encrypted and never shared. Bob's like a diary that talks back (helpfully).",
    },
    {
      question: "Can I cancel anytime?",
      answer:
        "Yes! No contracts, no hassle. Though 89% of users stick around because Bob actually works. 😊",
    },
  ],

  finalCTA: {
    headline: "Your Last 'Diet' Starts with One Honest Conversation",
    subtext:
      "No more generic formulas. No more feeling broken. Just you, Bob, and a plan that actually fits your life.",
    visualText: "Hi! Tell me about your day - what did you have for breakfast?",
    pricing: "Spring pricing: $9.99/month after trial (save $5/month!)",
    trustElements: [
      "No credit card required",
      "Cancel anytime",
      "30-day money-back guarantee",
      "Your data is always private",
    ],
    emotionalHook:
      "P.S. – Still researching? Sarah spent 5 years and hundreds of dollars trying everything else. Don't wait for the 'perfect' time. Your metabolism is ready to be understood today.",
  },
};
