import { loadStripe } from '@stripe/stripe-js';

// Create a single Stripe promise instance to avoid loading Stripe.js multiple times
export const stripePromise = loadStripe(
  import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || ''
);
