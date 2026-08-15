// Copy and structured data for the sign-in explainer (/signing-in). Kept out
// of the component so the page reads as layout and the wording — which is also
// what search engines index — lives in one editable place.
//
// Written for somebody who has never held crypto. Two rules held throughout:
// no jargon survives unless the page explains it first, and nothing is claimed
// that cannot be backed. The second rule cost this page a rewrite — it first
// described a passkey as the way you sign in, when Coinbase may equally hand
// you an email code, and a page that tells you the wrong thing about your own
// login is worse than no page.

import { buildFaqJsonLd, absoluteUrl } from "./seo.js";

export const SIGNING_IN_PATH = "/signing-in";

export const SIGNING_IN_HERO = {
  eyebrow: "Signing in",
  title: "Signing in without a seed phrase",
  lede: "Most crypto wallets hand you twelve random words and make losing them your problem. LockIn Wallet does not. You sign in the way you sign into anything else — and your savings are held by an account only you can authorise.",
};

/** What actually happens when you press sign in. */
export const SIGNING_IN_BASICS = [
  {
    emoji: "👆",
    title: "Your device, or your email",
    text: "Coinbase runs the sign-in and offers whichever methods your device supports: a passkey — the face or fingerprint check your phone already uses — or a code sent to your email. You may get either. Both end up at the same wallet.",
  },
  {
    emoji: "🔑",
    title: "No seed phrase to keep",
    text: "There is nothing to write down and nothing to lose. Whichever way you sign in, the thing that authorises your money is managed for you rather than handed over as twelve words you must never misplace.",
  },
  {
    emoji: "🏦",
    title: "Your savings are a contract, not an account with us",
    text: "The account holding your money lives on a public network. We cannot move it, freeze it, or reverse it, and neither can Coinbase — the rules are enforced by the contract itself.",
  },
];

/** How the two methods differ, without pretending they are the same. */
export const SIGNING_IN_METHODS = [
  {
    step: "A passkey",
    text: "Unlocked by your face, fingerprint or device PIN. The key stays on your device and never travels — what travels is only proof your device approved something. It follows you to other devices through the Google or Apple account that already syncs your passwords.",
  },
  {
    step: "An email code",
    text: "Coinbase emails you a code and you type it in. It works on any device, including ones too old for passkeys, and there is nothing to sync. It also means your email account is the thing standing between someone else and your sign-in, so it is worth protecting properly.",
  },
  {
    step: "You can have both",
    text: "Coinbase lets you manage your sign-in methods and add the other one later. Having two means losing access to one is an inconvenience rather than a problem — which is the single most useful thing you can do here, and it takes a minute.",
  },
];

/** Using the same savings on more than one device. */
export const SIGNING_IN_DEVICES = [
  {
    emoji: "🔄",
    title: "A passkey usually follows you",
    text: "Passkeys are saved by the account that already syncs your photos and passwords — Google on Android and Chrome, Apple on iPhone and Mac. Sign into that on a new device and it is already there.",
  },
  {
    emoji: "📧",
    title: "An email code works anywhere",
    text: "Nothing to sync at all. Open the site on any device, ask for a code, and you are in — which is why this is the method that reaches an old laptop or a borrowed computer.",
  },
  {
    emoji: "🖥️",
    title: "Apple and Windows together",
    text: "Apple's keychain does not sync to Windows. If you use an iPhone and a Windows PC, use Chrome on both so Google syncs your passkey, or fall back to an email code on the PC.",
  },
];

/** What to do when a device is gone. Ordered by what to try first. */
export const SIGNING_IN_RECOVERY = [
  {
    step: "Sign in again, the same way",
    text: "This covers most people. An email code works from any device immediately. A passkey comes back when you sign into the Google or Apple account that saved it. Your savings are exactly where you left them — they live on the network, not on the phone.",
  },
  {
    step: "Use your other sign-in method",
    text: "If you added both a passkey and an email code, the one you still have gets you in on its own. This is why adding the second one early is worth the minute it takes.",
  },
  {
    step: "Use your recovery key, if you set one",
    text: "A recovery key is a separate key you keep somewhere safe and rarely touch. It can move your savings to a fresh account even if every sign-in method is gone — and it can freeze the account instantly if you think somebody else has got in.",
  },
];

export const SIGNING_IN_FAQ = [
  {
    question: "Will I get a passkey or an email code?",
    answer:
      "Whichever Coinbase offers your device — it runs the sign-in, not us. A current phone or browser will usually offer a passkey, using the same face or fingerprint check you already use to unlock it. An older one, or a browser that does not support passkeys, will use an emailed code instead. Both reach the same wallet, and you can add the other method afterwards.",
  },
  {
    question: "Do I still need a seed phrase?",
    answer:
      "No. There is nothing to write down. If you would rather hold your own key anyway, you can export your wallet at any time and keep it however you prefer — that option never goes away, and using it does not close your account.",
  },
  {
    question: "What happens if I lose my phone?",
    answer:
      "Your savings are on a public network, not on the phone, so they are unaffected. Signing in again from another device is usually all that is needed: an email code works anywhere immediately, and a passkey returns when you sign into the Google or Apple account that saved it. If you also set a recovery key, that gets you in even when nothing else does.",
  },
  {
    question: "Can LockIn Wallet move my money?",
    answer:
      "No. We can show you your savings and pass your authorised instructions to the network, and that is all. The limits on withdrawals are enforced by the contract itself — we cannot override them for you, or for anyone else.",
  },
  {
    question: "Is signing in anonymous?",
    answer:
      "No, and it is worth being clear about that. Coinbase operates the sign-in and the signing service, so they can see the requests and the network address behind them — never your funds, which only you can authorise moving. If you would rather nothing passed through anyone else, connect your own wallet instead. Both options are on the screen where you choose.",
  },
  {
    question: "Is my fingerprint or face sent anywhere?",
    answer:
      "No. When you sign in with a passkey the check happens on your device, to unlock a key held there. Your biometrics never leave the device and never reach us, Coinbase, or any network.",
  },
  {
    question: "Can I use this and my own wallet?",
    answer:
      "Yes. They are separate accounts with separate savings, and you can hold both. Signing in suits people who would rather not manage a wallet; connecting your own suits people who already do.",
  },
];

export const SIGNING_IN_SEO = {
  title: "Signing In Without a Seed Phrase | LockIn Wallet",
  description:
    "A plain-English guide to signing into LockIn Wallet: passkeys and email codes explained, how to use the same savings on more than one device, and how to get back in if you lose your phone.",
  path: SIGNING_IN_PATH,
  jsonLd: {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        "@id": absoluteUrl(SIGNING_IN_PATH),
        url: absoluteUrl(SIGNING_IN_PATH),
        name: SIGNING_IN_HERO.title,
        description: SIGNING_IN_HERO.lede,
      },
      buildFaqJsonLd(SIGNING_IN_FAQ),
    ],
  },
};
