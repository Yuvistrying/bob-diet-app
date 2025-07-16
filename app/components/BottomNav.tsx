"use client";

import { usePathname } from "next/navigation";
import Link, { useLinkStatus } from "next/link";
import { MessageCircle, FileText, User } from "lucide-react";
import { motion } from "motion/react";
import { cn } from "~/lib/utils";

const navigation = [
  { name: "Chat", href: "/chat", icon: MessageCircle },
  { name: "Diary", href: "/diary", icon: FileText },
  { name: "Profile", href: "/profile", icon: User },
];

// Navigation link component with loading indicator
function NavigationLink({ item }: { item: (typeof navigation)[0] }) {
  const pathname = usePathname();
  const { pending } = useLinkStatus();
  const Icon = item.icon;
  const isActive = pathname === item.href;

  return (
    <Link
      key={item.name}
      href={item.href}
      className={cn(
        "relative flex flex-col items-center justify-center gap-1 px-8 py-2 text-xs font-medium transition-all rounded-lg border flex-1 mx-1",
        "touch-manipulation select-none",
        isActive
          ? "text-foreground bg-muted border-border"
          : "text-muted-foreground hover:text-foreground border-transparent hover:border-border",
      )}
      style={{
        WebkitTapHighlightColor: "transparent",
        touchAction: "manipulation",
      }}
    >
      {pending && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="absolute inset-0 rounded-lg bg-muted/50"
        >
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-foreground/20 border-t-foreground/60" />
          </div>
        </motion.div>
      )}
      <Icon className={cn("h-5 w-5", isActive && "stroke-2")} />
      <span className={cn(isActive && "font-semibold")}>{item.name}</span>
    </Link>
  );
}

export function BottomNav() {
  return (
    <nav
      className="fixed bottom-0 left-0 right-0 bg-background border-t border-border/40 z-50"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="max-w-lg mx-auto px-4">
        <div className="flex justify-between items-center h-16">
          {navigation.map((item) => (
            <NavigationLink key={item.name} item={item} />
          ))}
        </div>
      </div>
    </nav>
  );
}
