"use client";

export function EnvironmentIndicator() {
  const environment = process.env.NEXT_PUBLIC_ENVIRONMENT;

  // Only show in non-production environments
  if (!environment || environment === "production") {
    return null;
  }

  const getEnvironmentStyles = () => {
    switch (environment) {
      case "development":
        return "bg-blue-500 text-white";
      case "staging":
        return "bg-yellow-500 text-black";
      default:
        return "bg-gray-500 text-white";
    }
  };

  return (
    <div
      className={`fixed bottom-20 left-4 z-50 px-3 py-1 rounded-full text-xs font-medium ${getEnvironmentStyles()}`}
    >
      {environment.toUpperCase()}
    </div>
  );
}
