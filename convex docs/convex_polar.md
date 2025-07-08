Product
Realtime
Keep your app up to date
Authentication
Over 80+ OAuth integrations
Convex Components
Components
Independent, modular, TypeScript building blocks for your backend.
Open source
Self host and develop locally

AI Coding
Generate high quality Convex code with AI
Compare
Convex vs. Firebase
Convex vs. Supabase
Convex vs. SQL
Developers
Documentation
Get started with your favorite frameworks
Search
Search across Docs, Stack, and Discord
Templates
Use a recipe to get started quickly
Convex for Startups
Start and scale your company with Convex
Convex Champions
Ambassadors that support our thriving community
Convex Community
Share ideas and ask for help in our community Discord
Stack
Stack
Stack is the Convex developer portal and blog, sharing bright ideas and techniques for building with Convex.

Explore Stack
Blog
Docs
Pricing
GitHub
7,778 stars
Log in
Start building
Back to Components
Polar
get-convex's avatar
get-convex/polar
View repo
GitHub logoView package
Category
Integrations
Polar hero image
npm install @convex-dev/polar

Convex Polar Componentnpm version
Add subscriptions and billing to your Convex app with Polar.

Check out the example app for a complete example.

// Get subscription details for the current user
// Note: getCurrentSubscription is for apps that only allow one active
// subscription per user. If you need to support multiple active
// subscriptions, use listUserSubscriptions instead.
const {
productKey,
status,
currentPeriodEnd,
currentPeriodStart,
...
} = await polar.getCurrentSubscription(ctx, {
userId: user.\_id,
});

// Show available plans
<CheckoutLink
polarApi={api.example}
productIds={[products.premiumMonthly.id, products.premiumYearly.id]}
// Optional: turn off embedding to link to a checkout page
embed={false}

> Upgrade to Premium
> </CheckoutLink>

// Manage existing subscriptions
<CustomerPortalLink polarApi={api.example}>
Manage Subscription
</CustomerPortalLink>

Prerequisites#
Convex App#
You'll need a Convex App to use the component. Follow any of the Convex quickstarts to set one up.

Polar Account#
Create a Polar account
Create an organization and generate an organization token with permissions:
products:read
products:write
subscriptions:read
subscriptions:write
customers:read
customers:write
checkouts:read
checkouts:write
checkout_links:read
checkout_links:write
customer_portal:read
customer_portal:write
customer_sessions:write
Installation#
Install the component package:

npm install @convex-dev/polar

Create a convex.config.ts file in your app's convex/ folder and install the component by calling app.use:

// convex/convex.config.ts
import { defineApp } from "convex/server";
import polar from "@convex-dev/polar/convex.config";

const app = defineApp();
app.use(polar);

export default app;

Set your Polar organization token:

npx convex env set POLAR_ORGANIZATION_TOKEN xxxxx

Usage#
Set up Polar webhooks#
The Polar component uses webhooks to keep subscription data in sync. You'll need to:

Create a webhook and webhook secret in the Polar dashboard, using your Convex site URL
/polar/events as the webhook endpoint. It should look like this: https://verb-noun-123.convex.site/polar/events

Enable the following events:

product.created
product.updated
subscription.created
subscription.updated
Set the webhook secret in your Convex environment:

npx convex env set POLAR_WEBHOOK_SECRET xxxxx

Register the webhook handler in your convex/http.ts:
import { httpRouter } from "convex/server";
import { polar } from "./example";

const http = httpRouter();

// Register the webhook handler at /polar/events
polar.registerRoutes(http as any);

export default http;

You can also provide callbacks for webhook events:

polar.registerRoutes(http, {
// Optional custom path, default is "/polar/events"
path: "/polar/events",
// Optional callbacks for webhook events
onSubscriptionUpdated: async (ctx, event) => {
// Handle subscription updates, like cancellations.
// Note that a cancelled subscription will not be deleted from the database,
// so this information remains available without a hook, eg., via
// `getCurrentSubscription()`.
if (event.data.customerCancellationReason) {
console.log("Customer cancelled:", event.data.customerCancellationReason);
}
},
onSubscriptionCreated: async (ctx, event) => {
// Handle new subscriptions
},
onProductCreated: async (ctx, event) => {
// Handle new products
},
onProductUpdated: async (ctx, event) => {
// Handle product updates
},
});

Be sure to run npx convex dev to start your Convex app with the Polar component enabled, which will deploy the webhook handler to your Convex instance.
Create products in Polar#
Create a product in the Polar dashboard for each pricing plan that you want to offer. The product data will be synced to your Convex app automatically.

Note: You can have one price per plan, so a plan with monthly and yearly pricing requires two products in Polar.

Note: The Convex Polar component is currently built to support recurring subscriptions, and may not work as expected with one-time payments. Please open an issue or reach out on Discord if you run into any issues.

Initialize the Polar client#
Create a Polar client in your Convex backend:

// convex/example.ts
import { Polar } from "@convex-dev/polar";
import { api, components } from "./\_generated/api";
import { DataModel } from "./\_generated/dataModel";

export const polar = new Polar(components.polar, {
// Required: provide a function the component can use to get the current user's ID and
// email - this will be used for retrieving the correct subscription data for the
// current user. The function should return an object with `userId` and `email`
// properties.
getUserInfo: async (ctx) => {
const user = await ctx.runQuery(api.example.getCurrentUser);
return {
userId: user.\_id,
email: user.email,
};
},
// Optional: Configure static keys for referencing your products.
// Alternatively you can use the `listAllProducts` function to get
// the product data and sort it out in your UI however you like
// (eg., by price, name, recurrence, etc.).
// Map your product keys to Polar product IDs (you can also use env vars for this)
// Replace these keys with whatever is useful for your app (eg., "pro", "proMonthly",
// whatever you want), and replace the values with the actual product IDs from your
// Polar dashboard
products: {
premiumMonthly: "product_id_from_polar",
premiumYearly: "product_id_from_polar",
premiumPlusMonthly: "product_id_from_polar",
premiumPlusYearly: "product_id_from_polar",
},
// Optional: Set Polar configuration directly in code
organizationToken: "your_organization_token", // Defaults to POLAR_ORGANIZATION_TOKEN env var
webhookSecret: "your_webhook_secret", // Defaults to POLAR_WEBHOOK_SECRET env var
server: "sandbox", // Optional: "sandbox" or "production", defaults to POLAR_SERVER env var
});

// Export API functions from the Polar client
export const {
changeCurrentSubscription,
cancelCurrentSubscription,
getConfiguredProducts,
listAllProducts,
generateCheckoutLink,
generateCustomerPortalUrl,
} = polar.api();

Display products and prices#
Use the exported getConfiguredProducts or listAllProductsfunction to display your products and their prices:

getConfiguredProducts#
// Simple example of displaying products and prices if you've configured
// products by key in the Polar constructor
function PricingTable() {
const products = useQuery(api.example.getConfiguredProducts);
if (!products) return null;

return (

<div>
{products.premiumMonthly && (
<div>
<h3>{products.premiumMonthly.name}</h3>
<p>
${(products.premiumMonthly.prices[0].priceAmount ?? 0) / 100}/month
</p>
</div>
)}
{products.premiumYearly && (
<div>
<h3>{products.premiumYearly.name}</h3>
<p>
${(products.premiumYearly.prices[0].priceAmount ?? 0) / 100}/year
</p>
</div>
)}
</div>
);
}

listAllProducts#
// Simple example of displaying products and prices if you haven't configured
// products by key in the Polar constructor
function PricingTable() {
const products = useQuery(api.example.listAllProducts);
if (!products) return null;

// You can sort through products in the client as below, or you can use
// `polar.listAllProducts` in your own Convex query and return your desired
// products to display in the UI.
const proMonthly = products.find(
(p) => p.prices[0].recurringInterval === "month"
);
const proYearly = products.find(
(p) => p.prices[0].recurringInterval === "year"
);
return (

<div>
{proMonthly && (
<div>
<h3>{proMonthly.name}</h3>
<p>
${(proMonthly.prices[0].priceAmount ?? 0) / 100}/
            {proMonthly.prices[0].recurringInterval}
          </p>
        </div>
      )}
      {proYearly && (
        <div>
          <h3>{proYearly.name}</h3>
          <p>${(proYearly.prices[0].priceAmount ?? 0) / 100}/year</p>
</div>
)}
</div>
);
}

Each product includes:

id: The Polar product ID
name: The product name
prices: Array of prices with:
priceAmount: Price in cents
priceCurrency: Currency code (e.g., "USD")
recurringInterval: "month" or "year"
Add subscription UI components#
Use the provided React components to add subscription functionality to your app:

import { CheckoutLink, CustomerPortalLink } from "@convex-dev/polar/react";
import { api } from "../convex/\_generated/api";

// For new subscriptions
<CheckoutLink
// For our example, the api.example object includes the generateCheckoutLink
// function. You can also pass any object that includes this function.
polarApi={api.example}
productIds={[products.premiumMonthly.id, products.premiumYearly.id]}
// Optional: turn off embedding to link to a checkout page
embed={false}

> Upgrade to Premium
> </CheckoutLink>

// For managing existing subscriptions
<CustomerPortalLink
polarApi={{
    generateCustomerPortalUrl: api.example.generateCustomerPortalUrl,
  }}

> Manage Subscription
> </CustomerPortalLink>

Handle subscription changes#
The Polar component provides functions to handle subscription changes for the current user.

Note: It is highly recommended to prompt the user for confirmation before changing their subscription this way!

// Change subscription
const changeSubscription = useAction(api.example.changeCurrentSubscription);
await changeSubscription({ productId: "new_product_id" });

// Cancel subscription
const cancelSubscription = useAction(api.example.cancelCurrentSubscription);
await cancelSubscription({ revokeImmediately: true });

Access subscription data#
Query subscription information in your app:

// convex/example.ts

// A query that returns a user with their subscription details
export const getCurrentUser = query({
handler: async (ctx) => {
const user = await ctx.db.query("users").first();
if (!user) throw new Error("No user found");

    const subscription = await polar.getCurrentSubscription(ctx, {
      userId: user._id,
    });

    return {
      ...user,
      subscription,
      isFree: !subscription,
      isPremium:
        subscription?.productKey === "premiumMonthly" ||
        subscription?.productKey === "premiumYearly",
    };

},
});

API Reference#
Polar Client#
The Polar class accepts a configuration object with:

getUserInfo: Function to get the current user's ID and email
products: (Optional) Map of arbitrarily named keys to Polar product IDs
organizationToken: (Optional) Your Polar organization token. Falls back to POLAR_ORGANIZATION_TOKEN env var
webhookSecret: (Optional) Your Polar webhook secret. Falls back to POLAR_WEBHOOK_SECRET env var
server: (Optional) Polar server environment: "sandbox" or "production". Falls back to POLAR_SERVER env var
React Components#
CheckoutLink#
Props:

polarApi: Object containing generateCheckoutLink function
productIds: Array of product IDs to show in the checkout
children: React children (button content)
embed: (Optional) Whether to embed the checkout link. Defaults to true.
className: (Optional) CSS class name
CustomerPortalLink#
Props:

polarApi: Object containing generateCustomerPortalUrl function
children: React children (button content)
className: (Optional) CSS class name
API Functions#
changeCurrentSubscription#
Change an existing subscription to a new plan:

await changeSubscription({ productId: "new_product_id" });

cancelCurrentSubscription#
Cancel an existing subscription:

await cancelSubscription({ revokeImmediately: true });

getCurrentSubscription#
Get the current user's subscription details:

const subscription = await polar.getCurrentSubscription(ctx, { userId });

listUserSubscriptions#
For apps that support multiple active subscriptions per user, get all subscriptions for a user:

const subscriptions = await polar.listUserSubscriptions(ctx, { userId });

getProducts#
List all available products and their prices:

const products = await polar.listProducts(ctx);

registerRoutes#
Register webhook handlers for the Polar component:

polar.registerRoutes(http, {
// Optional: customize the webhook endpoint path (defaults to "/polar/events")
path: "/custom/webhook/path",
});

The webhook handler uses the webhookSecret from the Polar client configuration or the POLAR_WEBHOOK_SECRET environment variable.

Get your app up and running in minutes
Start building

Convex logo
Product
Sync
Realtime
Auth
Open source
AI coding
Chef
FAQ
Pricing
Developers
Docs
Blog
Components
Templates
Startups
Champions
Changelog
Podcast
LLMs.txt
Company
About us
Brand
Investors
Become a partner
Jobs
News
Events
Terms of service
Privacy policy
Security
Social
Twitter
Discord
YouTube
Luma
Bluesky
GitHub
A Trusted Solution

SOC 2
Type 1 Compliant

HIPAA
Compliant

GDPR
Verified
©2025 Convex, Inc.
Polar
