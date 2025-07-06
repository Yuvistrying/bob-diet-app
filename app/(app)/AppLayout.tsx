"use client";

import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { MessageCircle, FileText, User } from "lucide-react";
import { cn } from "~/lib/utils";
import { useCallback, useState } from "react";

const navigation = [
  { name: "Chat", href: "/chat", icon: MessageCircle },
  { name: "Diary", href: "/diary", icon: FileText },
  { name: "Profile", href: "/profile", icon: User },
];

export function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [isNavigating, setIsNavigating] = useState(false);

  // Handle navigation with debouncing for mobile
  const handleNavigation = useCallback((e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    // Prevent navigation if already navigating
    if (isNavigating || pathname === href) {
      e.preventDefault();
      return;
    }

    // For mobile touch events, prevent default and handle manually
    if ('ontouchstart' in window) {
      e.preventDefault();
      setIsNavigating(true);
      
      // Use router.push for programmatic navigation
      router.push(href);
      
      // Reset navigation state after a delay
      setTimeout(() => {
        setIsNavigating(false);
      }, 500);
    }
    // Let normal Link behavior handle desktop clicks
  }, [pathname, router, isNavigating]);

  return (
    <div className="relative h-screen flex flex-col overflow-hidden">
      {/* Main content */}
      <main className="flex-1 overflow-hidden pb-16">
        {children}
      </main>

      {/* Bottom navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-background border-t border-border/40">
        <div className="max-w-lg mx-auto px-4">
          <div className="flex justify-between items-center h-16">
            {navigation.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  prefetch={false}
                  onClick={(e) => handleNavigation(e, item.href)}
                  className={cn(
                    "flex flex-col items-center justify-center gap-1 px-8 py-2 text-xs font-medium transition-all rounded-lg border flex-1 mx-1",
                    "touch-manipulation select-none",
                    isActive
                      ? "text-foreground bg-muted border-border"
                      : "text-muted-foreground hover:text-foreground border-transparent hover:border-border",
                    isNavigating && "opacity-50 pointer-events-none"
                  )}
                  style={{
                    WebkitTapHighlightColor: 'transparent',
                    touchAction: 'manipulation'
                  }}
                >
                  <Icon className={cn(
                    "h-5 w-5",
                    isActive && "stroke-2"
                  )} />
                  <span className={cn(
                    isActive && "font-semibold"
                  )}>{item.name}</span>
                </Link>
              );
            })}
          </div>
        </div>
      </nav>
    </div>
  );
}