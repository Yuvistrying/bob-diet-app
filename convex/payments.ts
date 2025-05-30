import { Polar } from "@polar-sh/sdk";
import { v } from "convex/values";
import {
    Webhook,
    WebhookVerificationError
} from "standardwebhooks";
import { api } from "./_generated/api";
import {
    action,
    httpAction,
    mutation,
    query
} from "./_generated/server";


// Create a checkout session
const createCheckout = async ({
    customerEmail,
    productPriceId,
    successUrl,
    metadata
}: {
    customerEmail: string;
    productPriceId: string;
    successUrl: string;
    metadata?: Record<string, string>;
}) => {

    if (!process.env.POLAR_ACCESS_TOKEN) {
        throw new Error("POLAR_ACCESS_TOKEN is not configured");
    }

    const polar = new Polar({
        server: process.env.FRONTEND_URL?.endsWith(".fyi") ? "production" : "sandbox",
        accessToken: process.env.POLAR_ACCESS_TOKEN,
    });

    console.log("Initialized Polar SDK with token:", process.env.POLAR_ACCESS_TOKEN?.substring(0, 8) + "...");

    // Make sure we have a proper URL with scheme, not just a relative path
    const fullSuccessUrl = successUrl.startsWith('http') ? successUrl : `https://${successUrl}`;

    // Create a one-time payment checkout
    // const result = await polar.checkouts.create({
    //     productPriceId,
    //     successUrl: fullSuccessUrl,
    //     customerEmail,
    //     metadata
    // });

    return;
};