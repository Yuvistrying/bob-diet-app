"use client";
import { useQuery, useMutation } from "convex/react";
import { useAuth, useUser } from "@clerk/react-router";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Loader2, User, Database, RefreshCw, CreditCard } from "lucide-react";
import { api } from "../../convex/_generated/api";
import { useState } from "react";

export default function UserDebug() {
  const { isSignedIn, userId } = useAuth();
  const { user } = useUser();
  const [syncing, setSyncing] = useState(false);
  
  const dbUser = useQuery(api.users.findUserByToken, 
    isSignedIn && userId ? { tokenIdentifier: userId } : "skip"
  );
  const userSubscription = useQuery(api.subscriptions.fetchUserSubscription);
  const subscriptionStatus = useQuery(api.subscriptions.checkUserSubscriptionStatus);
  const upsertUser = useMutation(api.users.upsertUser);

  const handleSync = async () => {
    setSyncing(true);
    try {
      await upsertUser();
    } catch (error) {
      console.error("Failed to sync user:", error);
    } finally {
      setSyncing(false);
    }
  };

  if (!isSignedIn) {
    return (
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            User Debug
          </CardTitle>
          <CardDescription>User authentication and sync status</CardDescription>
        </CardHeader>
        <CardContent>
          <Badge variant="outline" className="bg-red-100 text-red-800 border-red-200">
            Not Signed In
          </Badge>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <User className="h-5 w-5" />
          User Debug
        </CardTitle>
        <CardDescription>User authentication and sync status</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Clerk Status:</span>
            <Badge variant="outline" className="bg-green-100 text-green-800 border-green-200">
              Signed In
            </Badge>
          </div>
          
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Database Status:</span>
            {dbUser === undefined ? (
              <div className="flex items-center gap-1">
                <Loader2 className="h-3 w-3 animate-spin" />
                <span className="text-xs">Loading...</span>
              </div>
            ) : dbUser ? (
              <Badge variant="outline" className="bg-green-100 text-green-800 border-green-200">
                <Database className="h-3 w-3 mr-1" />
                Synced
              </Badge>
            ) : (
              <Badge variant="outline" className="bg-yellow-100 text-yellow-800 border-yellow-200">
                <Database className="h-3 w-3 mr-1" />
                Not Synced
              </Badge>
            )}
          </div>
        </div>

        <div className="pt-2 border-t space-y-2">
          <div className="text-xs text-muted-foreground space-y-1">
            <div><strong>Clerk ID:</strong> {userId}</div>
            <div><strong>Email:</strong> {user?.primaryEmailAddress?.emailAddress}</div>
            <div><strong>Name:</strong> {user?.fullName}</div>
          </div>
          
          {dbUser && (
            <div className="text-xs text-muted-foreground space-y-1">
              <div><strong>DB Token:</strong> {dbUser.tokenIdentifier}</div>
              <div><strong>DB Email:</strong> {dbUser.email}</div>
              <div><strong>DB Name:</strong> {dbUser.name}</div>
            </div>
          )}
        </div>

        <div className="pt-2 border-t space-y-2">
          <div className="flex items-center gap-2 mb-2">
            <CreditCard className="h-4 w-4" />
            <span className="font-medium text-sm">Subscription Debug</span>
          </div>
          
          <div className="text-xs text-muted-foreground space-y-1">
            <div><strong>Has Active Sub:</strong> {subscriptionStatus?.hasActiveSubscription ? 'Yes' : 'No'}</div>
            {userSubscription && (
              <>
                <div><strong>Polar Price ID:</strong> {userSubscription.polarPriceId}</div>
                <div><strong>Status:</strong> {userSubscription.status}</div>
                <div><strong>Amount:</strong> ${userSubscription.amount ? (userSubscription.amount / 100).toFixed(2) : 'N/A'}</div>
                <div><strong>Currency:</strong> {userSubscription.currency || 'N/A'}</div>
                <div><strong>Interval:</strong> {userSubscription.interval || 'N/A'}</div>
              </>
            )}
          </div>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={handleSync}
          disabled={syncing}
          className="w-full"
        >
          {syncing ? (
            <>
              <Loader2 className="mr-2 h-3 w-3 animate-spin" />
              Syncing...
            </>
          ) : (
            <>
              <RefreshCw className="mr-2 h-3 w-3" />
              Sync User
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}