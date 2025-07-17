"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { Button } from "~/app/components/ui/button";
import { Menu, X } from "lucide-react";
import { cn } from "~/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

const menuItems = [
  { name: "How It Works", href: "#features" },
  { name: "Success Stories", href: "#testimonials" },
  { name: "Pricing", href: "#pricing" },
];

export function Header() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const handleNavClick = (href: string) => {
    if (href.startsWith("#")) {
      const element = document.querySelector(href);
      if (element) {
        element.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      }
    }
    setIsMobileMenuOpen(false);
  };

  return (
    <header className="fixed top-0 z-50 w-full">
      <nav
        className={cn(
          "mx-auto transition-all duration-300",
          isScrolled && "bg-background/80 backdrop-blur-lg border-b",
        )}
      >
        <div className="mx-auto max-w-6xl px-4">
          <div className="flex h-16 items-center justify-between">
            {/* Logo */}
            <Link href="/" className="flex items-center gap-2">
              <Image
                src="/logo.svg"
                alt="Bob Diet Coach"
                width={32}
                height={32}
                className="w-8 h-8"
              />
              <span className="font-bold text-lg hidden sm:block">
                Bob Diet Coach
              </span>
            </Link>

            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center gap-8">
              {menuItems.map((item) => (
                <button
                  key={item.name}
                  onClick={() => handleNavClick(item.href)}
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  {item.name}
                </button>
              ))}
              <div className="flex items-center gap-3">
                <Button variant="ghost" asChild>
                  <Link href="/sign-in">Sign In</Link>
                </Button>
                <Button asChild>
                  <Link href="/sign-up">Start Free</Link>
                </Button>
              </div>
            </div>

            {/* Mobile Menu Button */}
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="md:hidden p-2"
            >
              {isMobileMenuOpen ? (
                <X className="h-5 w-5" />
              ) : (
                <Menu className="h-5 w-5" />
              )}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        <AnimatePresence>
          {isMobileMenuOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="md:hidden border-t bg-background"
            >
              <div className="px-4 py-4 space-y-4">
                {menuItems.map((item) => (
                  <button
                    key={item.name}
                    onClick={() => handleNavClick(item.href)}
                    className="block w-full text-left text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {item.name}
                  </button>
                ))}
                <div className="flex flex-col gap-2 pt-4 border-t">
                  <Button variant="ghost" asChild className="w-full">
                    <Link href="/sign-in">Sign In</Link>
                  </Button>
                  <Button asChild className="w-full">
                    <Link href="/sign-up">Start Free</Link>
                  </Button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </nav>
    </header>
  );
}
