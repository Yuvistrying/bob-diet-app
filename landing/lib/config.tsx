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
  description: "Your AI-powered diet coach for sustainable weight loss",
  cta: "Start Your Journey",
  url: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
  keywords: [
    "AI Diet Coach",
    "Weight Loss",
    "Calorie Tracking",
    "Nutrition",
    "Health",
    "AI Fitness",
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
      name: "Just Chat Naturally",
      description:
        "No tedious food databases or barcode scanning. Tell Bob what you ate like you'd text a friend. He'll ask smart follow-up questions to catch hidden calories.",
      icon: <MessageCircleIcon className="h-6 w-6" />,
    },
    {
      name: "Photo Analysis",
      description:
        "Snap a photo of your meal and Bob analyzes everything - portions, calories, even hidden ingredients you might miss.",
      icon: <CameraIcon className="h-6 w-6" />,
    },
    {
      name: "Weekly Insights",
      description:
        "Every Sunday, get personalized insights about your progress and smart adjustments for the week ahead.",
      icon: <CalendarIcon className="h-6 w-6" />,
    },
    {
      name: "Progress Tracking",
      description:
        "Beautiful charts show your weight trend and help you stay motivated on your journey.",
      icon: <TrendingUpIcon className="h-6 w-6" />,
    },
    {
      name: "Dietary Preferences",
      description:
        "Vegan? Keto? Allergies? Bob remembers and adjusts all recommendations to fit your lifestyle.",
      icon: <HeartHandshakeIcon className="h-6 w-6" />,
    },
    {
      name: "Smart Questions",
      description:
        'Say "had McDonald\'s" and Bob asks "What did you order? Any sauces?" - catching calories you might miss.',
      icon: <SparklesIcon className="h-6 w-6" />,
    },
  ],
  featureHighlight: [
    {
      title: "Photo Analysis",
      description:
        "Snap your meal, get instant breakdown. Bob analyzes portions, calories, and hidden ingredients with AI precision.",
      imageSrc: "/Device-2.png",
      direction: "rtl" as const,
    },
    {
      title: "Morning Greetings",
      description:
        "Start your day with personalized insights and reminders tailored to your progress and goals.",
      imageSrc: "/Device-3.png",
      direction: "ltr" as const,
    },
    {
      title: "Weekly Insights",
      description:
        "Get Sunday summaries with progress metrics and smart calibration adjustments for the week ahead.",
      imageSrc: "/Device-4.png",
      direction: "rtl" as const,
    },
  ],
  bento: [
    {
      title: "Natural Conversation",
      content:
        "Just tell Bob what you ate like you'd text a friend. No databases, no scanning - just chat naturally and Bob understands.",
      imageSrc: "/Device-1.png",
      imageAlt: "Chat interface illustration",
      fullWidth: true,
    },
    {
      title: "Smart Follow-ups",
      content:
        'Bob asks the right questions to catch hidden calories. "What size fries?" "Any dressing on that salad?"',
      imageSrc: "/Device-2.png",
      imageAlt: "Smart questions illustration",
      fullWidth: false,
    },
    {
      title: "Photo Analysis",
      content:
        "Take a photo and Bob does the rest. Accurate portion sizes, complete nutritional breakdown, nothing missed.",
      imageSrc: "/Device-3.png",
      imageAlt: "Photo analysis illustration",
      fullWidth: false,
    },
    {
      title: "Adaptive Coaching",
      content:
        "Bob learns your patterns and adjusts recommendations. Weekly calibrations ensure you're always on the optimal path.",
      imageSrc: "/Device-4.png",
      imageAlt: "Adaptive coaching illustration",
      fullWidth: true,
    },
  ],
  benefits: [
    {
      id: 1,
      text: "Track calories without the tedious work of databases and barcode scanning.",
      image: "/Device-6.png",
    },
    {
      id: 2,
      text: "Never miss hidden calories - Bob asks about sauces, oils, and portions.",
      image: "/Device-7.png",
    },
    {
      id: 3,
      text: "Get personalized insights that adapt to your actual progress each week.",
      image: "/Device-8.png",
    },
    {
      id: 4,
      text: "Stay motivated with beautiful progress charts and encouraging messages.",
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
        "5 food logs per day",
        "2 photo analyses per day",
        "Basic progress tracking",
        "7-day history",
      ],
      description: "Perfect to try Bob out",
      buttonText: "Start Free",
      isPopular: false,
    },
    {
      name: "Premium",
      href: "/sign-up",
      price: "$24.99",
      period: "month",
      yearlyPrice: "$239",
      features: [
        "Unlimited food logging",
        "Unlimited photo analysis",
        "Weekly AI insights & calibration",
        "Complete history & export",
        "Priority support",
        "Dietary preferences",
      ],
      description: "Everything you need to succeed",
      buttonText: "Start Premium",
      isPopular: true,
    },
  ],
  faqs: [
    {
      question: "How is Bob different from MyFitnessPal?",
      answer: (
        <span>
          Bob uses AI to understand natural language. Instead of searching
          databases, just tell Bob "had a cheeseburger and fries" and he'll ask
          follow-up questions to get accurate calories. It's like texting a
          knowledgeable friend vs filling out forms.
        </span>
      ),
    },
    {
      question: "How accurate is the photo analysis?",
      answer: (
        <span>
          Bob uses Claude 3.5 Vision AI to analyze your photos. He can identify
          foods, estimate portions, and even spot hidden calories like oils or
          dressings. While not 100% perfect, he's remarkably accurate and always
          asks clarifying questions when unsure.
        </span>
      ),
    },
    {
      question: "What makes the weekly calibration special?",
      answer: (
        <span>
          Every Sunday, Bob analyzes your actual weight change vs expected
          results and adjusts your calorie targets. This adaptive approach means
          you're always on the optimal path, not stuck with generic calculations
          that don't match your metabolism.
        </span>
      ),
    },
    {
      question: "Can Bob handle my dietary restrictions?",
      answer: (
        <span>
          Absolutely! Bob remembers if you're vegan, keto, gluten-free, or have
          any allergies. He'll adjust all recommendations and even warn you if
          something you're logging doesn't match your preferences.
        </span>
      ),
    },
    {
      question: "Do I need to log everything perfectly?",
      answer: (
        <span>
          No! Bob is designed for real life. Forgot to log lunch? Just tell him
          later. Not sure about portions? Give your best guess and Bob will help
          refine it. The goal is consistency, not perfection.
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
      text: "Bob changed everything. No more database searching - I just tell him what I ate and he gets it. Down 15 lbs in 2 months!",
      name: "Sarah M.",
      role: "Lost 15 lbs",
      image:
        "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=500&auto=format&fit=crop&q=60&ixlib=rb-4.0.3",
    },
    {
      id: 2,
      text: "The photo feature is incredible. I snap my lunch and Bob tells me everything, even catches the olive oil I forgot about.",
      name: "Mike R.",
      role: "Lost 22 lbs",
      image:
        "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=500&auto=format&fit=crop&q=60&ixlib=rb-4.0.3",
    },
    {
      id: 3,
      text: "Love the morning messages! Bob remembers my progress and gives me tips that actually work for my lifestyle.",
      name: "Emma L.",
      role: "Lost 18 lbs",
      image:
        "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=500&auto=format&fit=crop&q=60&ixlib=rb-4.0.3",
    },
    {
      id: 4,
      text: "Finally, calorie counting that doesn't feel like work. Bob makes it as easy as texting a friend.",
      name: "James K.",
      role: "Lost 30 lbs",
      image:
        "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=500&auto=format&fit=crop&q=60&ixlib=rb-4.0.3",
    },
    {
      id: 5,
      text: "The weekly insights are spot on. Bob noticed I lose more when I eat more protein and adjusted my targets.",
      name: "Lisa T.",
      role: "Lost 25 lbs",
      image:
        "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=500&auto=format&fit=crop&q=60&ixlib=rb-4.0.3",
    },
    {
      id: 6,
      text: "Bob catches everything! Asked about my coffee creamer when I said 'just had coffee'. Those hidden calories add up!",
      name: "David C.",
      role: "Lost 20 lbs",
      image:
        "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=500&auto=format&fit=crop&q=60&ixlib=rb-4.0.3",
    },
  ],
};

export type SiteConfig = typeof siteConfig;
