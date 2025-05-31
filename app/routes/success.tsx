"use client";
import { useAuth } from "@clerk/react-router";
import { useMutation, useQuery } from "convex/react";
import { CheckCircle, Loader2 } from "lucide-react";
import { useEffect } from "react";
import { Link } from "react-router";
import Footer from "~/components/homepage/footer";
import { Navbar } from "~/components/homepage/navbar";
import { Button } from "~/components/ui/button";
import { api } from "../../convex/_generated/api";
export default function Success() {
  const { isSignedIn } = useAuth();
  const subscription = useQuery(api.subscriptions.fetchUserSubscription);
  const upsertUser = useMutation(api.users.upsertUser);

  // Ensure user is created/updated when they land on success page
  useEffect(() => {
    if (isSignedIn) {
      upsertUser();
    }
  }, [isSignedIn, upsertUser]);

  if (!isSignedIn) {
    return (
      <>
        <Navbar />
        <section className="flex flex-col items-center justify-center min-h-[calc(100vh-120px)] px-4 pt-20">
          <div className="mx-auto max-w-5xl px-6 text-center">
            <div className="mx-auto mb-8">
              <CheckCircle className="h-16 w-16 text-red-500 mx-auto" />
            </div>
            <h2 className="text-balance text-4xl font-semibold lg:text-5xl mb-4">
              Access Denied
            </h2>
            <p className="text-xl text-muted-foreground mb-8">
              Please sign in to view your subscription details.
            </p>
            <Button asChild size="lg">
              <Link to="/sign-in">Sign In</Link>
            </Button>
          </div>
        </section>
        <Footer />
      </>
    );
  }

  if (!subscription) {
    return (
      <>
        <section className="flex flex-col items-center justify-center min-h-[calc(100vh-120px)] px-4 pt-20">
          <div className="flex items-center gap-2">
            <Loader2 className="h-8 w-8 animate-spin" />
            <span className="text-lg">
              Loading your subscription details...
            </span>
          </div>
        </section>
      </>
    );
  }

  return (
    <>
      {/* Subscription Details Section */}
      <section className="flex flex-col items-center justify-center py-16 md:py-32 h-screen">
        <div className="mx-auto max-w-5xl px-6">
          <div className="grid gap-6 md:grid-cols-2 md:gap-12">
            <div>
              <h2 className="text-4xl font-medium mb-6">
                Your Subscription Details
              </h2>
              <div className="space-y-6">
                <p className="text-muted-foreground">
                  Thank you for choosing React Starter Kit! Your subscription is
                  now active and you have full access to all features.
                </p>
                <div className="space-y-3">
                  <div className="flex justify-between items-center py-2 border-b">
                    <span className="text-muted-foreground">Status:</span>
                    <span className="font-medium capitalize bg-green-100 text-green-800 px-2 py-1 rounded-full text-sm">
                      {subscription.status}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b">
                    <span className="text-muted-foreground">Amount:</span>
                    <span className="font-medium text-lg">
                      $
                      {subscription.amount
                        ? (subscription.amount / 100).toFixed(2)
                        : "0.00"}{" "}
                      {subscription.currency
                        ? subscription.currency.toUpperCase()
                        : "USD"}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b">
                    <span className="text-muted-foreground">
                      Billing Cycle:
                    </span>
                    <span className="font-medium capitalize">
                      {subscription.interval}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-2">
                    <span className="text-muted-foreground">Next Billing:</span>
                    <span className="font-medium">
                      {subscription.currentPeriodEnd
                        ? new Date(
                            subscription.currentPeriodEnd
                          ).toLocaleDateString()
                        : "N/A"}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <h3 className="text-2xl font-medium">What's included:</h3>
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <CheckCircle className="h-5 w-5 text-green-500" />
                  <span>Full access to your dashboard</span>
                </div>
                <div className="flex items-center gap-3">
                  <CheckCircle className="h-5 w-5 text-green-500" />
                  <span>All premium features unlocked</span>
                </div>
                <div className="flex items-center gap-3">
                  <CheckCircle className="h-5 w-5 text-green-500" />
                  <span>Priority customer support</span>
                </div>
                <div className="flex items-center gap-3">
                  <CheckCircle className="h-5 w-5 text-green-500" />
                  <span>Cancel anytime</span>
                </div>
                <div className="flex items-center gap-3">
                  <CheckCircle className="h-5 w-5 text-green-500" />
                  <span>Regular updates and new features</span>
                </div>
              </div>

              <div className="bg-muted rounded-lg p-6 mt-6">
                <p className="text-sm text-muted-foreground">
                  {subscription?.status === "active"
                    ? "You'll receive a confirmation email shortly. If you have any questions, feel free to contact our support team."
                    : "Your payment is processing. It may take a few minutes for your subscription to activate. Please refresh the page or try again shortly."}
                </p>
              </div>
            </div>
          </div>
          <div className="flex justify-center mt-[5rem]">
            <Link to="/dashboard">
              <Button>Go to Dashboard</Button>
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
