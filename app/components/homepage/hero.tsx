import { SignedIn, SignedOut, UserButton } from "@clerk/react-router";
import { Link } from "react-router";
import { Button } from "../ui/button";

export default function Hero() {
  return (
    <section className="flex flex-col items-center justify-center min-h-[calc(30rem)]">
      <div className="mx-auto max-w-5xl px-6">
        <div className="text-center">
          <h2 className="text-balance text-4xl font-semibold lg:text-5xl">
            React Starter Kit
          </h2>
          <p className="mt-4">
            The ultimate starter kit to launch SAAS applications
          </p>

          <div className="mt-4 flex flex-wrap justify-center gap-4">
            <SignedOut>
              <Button asChild>
                <Link to="/sign-in">
                  <span>Sign In</span>
                </Link>
              </Button>
            </SignedOut>

            <SignedIn>
              <Button asChild>
                <Link to="/dashboard">
                  <span>Dashboard</span>
                </Link>
              </Button>
            </SignedIn>
            <UserButton />
          </div>
        </div>
        {/* <img src="/images/hero.png" className="h-100" /> */}
      </div>
    </section>
  );
}
