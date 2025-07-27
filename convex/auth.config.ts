export default {
  providers: [
    // Dev Clerk instance
    {
      domain: "https://dear-starling-14.clerk.accounts.dev",
      applicationID: "convex",
    },
    // Staging Clerk instance
    {
      domain: "https://evolving-penguin-29.clerk.accounts.dev",
      applicationID: "convex",
    },
  ],
};
