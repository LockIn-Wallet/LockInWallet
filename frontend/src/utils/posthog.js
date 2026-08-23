import posthog from "posthog-js";

import { ADDRESS_PATTERN, sanitizeAnalyticsUrl } from "./analytics.js";

const POSTHOG_API_KEY = "phc_BH8bZb5oenrWcubUWkSPAyHLTsCA4ecdoEVZTWoC5MNp";
const POSTHOG_HOST = "https://us.i.posthog.com";

const REDACTED = "0xREDACTED";

const sanitizeProperties = (properties) => {
  if (!properties) return properties;
  const cleaned = {};
  for (const [key, value] of Object.entries(properties)) {
    cleaned[key] =
      typeof value === "string"
        ? value.replace(ADDRESS_PATTERN, REDACTED)
        : value;
  }
  return cleaned;
};

export const initPostHog = () => {
  posthog.init(POSTHOG_API_KEY, {
    api_host: POSTHOG_HOST,
    person_profiles: "identified_only",
    autocapture: false,
    capture_pageview: false,
    capture_pageleave: false,
  });
};

export const trackEvent = (eventName, properties) => {
  if (!posthog.__loaded) return;
  posthog.capture(eventName, sanitizeProperties(properties));
};

export const trackPageView = () => {
  if (!posthog.__loaded) return;
  posthog.capture("$pageview", {
    $current_url: sanitizeAnalyticsUrl(),
  });
};
