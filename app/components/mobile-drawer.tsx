import { buttonVariants } from "~/app/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  DrawerTrigger,
} from "~/app/components/ui/drawer";
import { siteConfig } from "~/app/lib/config";
import { cn } from "~/app/lib/utils";
import Link from "next/link";
import { Menu } from "lucide-react";

export function MobileDrawer() {
  return (
    <Drawer>
      <DrawerTrigger>
        <Menu className="h-6 w-6" />
      </DrawerTrigger>
      <DrawerContent>
        <DrawerHeader className="px-6">
          <div className="">
            <Link
              href="/"
              title="brand-logo"
              className="relative mr-6 flex items-center space-x-2"
            >
              <img
                src="/logo.svg"
                alt="Bob Diet Coach"
                className="w-auto h-[40px]"
              />
              <span className="font-bold text-xl">{siteConfig.name}</span>
            </Link>
          </div>
        </DrawerHeader>
        <DrawerFooter>
          <Link
            href="#"
            className={cn(
              buttonVariants({ variant: "default" }),
              "text-black rounded-full group",
            )}
          >
            {siteConfig.cta}
          </Link>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
