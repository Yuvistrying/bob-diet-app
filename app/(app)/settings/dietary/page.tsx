"use client";

import { useRouter } from "next/navigation";
import { Button } from "~/app/components/ui/button";
import { DietaryPreferencesCard } from "~/app/components/DietaryPreferencesCard";
import { ArrowLeft } from "lucide-react";
import { ClientOnly } from "~/app/components/ClientOnly";

export default function DietarySettings() {
  const router = useRouter();

  return (
    <ClientOnly>
      <div className="container mx-auto p-4 max-w-2xl pb-20">
        <div className="mb-6">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.back()}
            className="mb-4"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Settings
          </Button>
          <h1 className="text-2xl font-bold">Dietary Preferences</h1>
          <p className="text-muted-foreground mt-2">
            Help Bob understand your dietary needs and restrictions
          </p>
        </div>
        
        <DietaryPreferencesCard />
      </div>
    </ClientOnly>
  );
}