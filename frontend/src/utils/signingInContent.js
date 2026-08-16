// Copy and structured data for the sign-in explainer (/signing-in). Kept out
// of the component so the page reads as layout and the wording — which is also
// what search engines index — lives in one editable place.
//
// Written for somebody who has never held crypto, under two rules.
//
// No jargon survives unless the page explains it first.
//
// And nothing is claimed that cannot be backed. That rule has already cost
// this page two rewrites: first it described a passkey as *the* way you sign
// in, when Coinbase may equally send an email code — which is what our own
// first user got. Then it implied we knew what holds the key on the email
// path. We do not: Coinbase runs that sign-in and has not published the
// mechanism. So the page says what is verified, says plainly where our
// knowledge stops, and points at Coinbase for the rest. A page that guesses
// about somebody's money is worse than no page.

import { buildFaqJsonLd, absoluteUrl } from "./seo.js";

export const SIGNING_IN_PATH = "/signing-in";

export const COINBASE_SIGN_IN_HELP =
  "https://help.coinbase.com/en/wallet/getting-started/smart-wallet-passkeys";

export const SIGNING_IN_HERO = {
  eyebrow: "Signing in",
  title: "Signing in without a seed phrase",
  lede: "Most crypto wallets hand you twelve random words and make losing them your problem. LockIn Wallet does not. You sign in the way you sign into anything else — and the savings themselves sit in a contract that only you can authorise.",
};

/** What actually happens when you press sign in. */
export const SIGNING_IN_BASICS = [
  {
    emoji: "✉️",
    title: "An email code, or your device",
    text: "Coinbase runs the sign-in and offers what your device supports: a six-digit code emailed to you, or a passkey — the face or fingerprint check your phone already uses. You may get either. Both reach the same savings.",
  },
  {
    emoji: "🔑",
    title: "No seed phrase to keep",
    text: "There is nothing to write down and nothing to lose. Whichever way you sign in, the thing that authorises your money is looked after rather than handed to you as twelve words you must never misplace.",
  },
  {
    emoji: "🏦",
    title: "The savings are a contract, not an account with us",
    text: "Your money sits in a contract on a public network. We cannot move it, freeze it or reverse it — the withdrawal limits you set are enforced by that contract, and they bind us as much as anyone.",
  },
];

/**
 * The two methods, and what each actually costs you. The email row is the one
 * that matters: it is what most people will get, and it is the one with a
 * privacy consequence nobody mentions.
 */
export const SIGNING_IN_METHODS = [
  {
    step: "An email code — most private? No.",
    text: "Coinbase emails you a six-digit code, good for ten minutes, and keeps you signed in for about thirty days. It works on any device, including ones too old for passkeys. The trade is real: Coinbase now holds your email address alongside your wallet, so your savings are linked to an identity they can be asked about. Your email account also becomes the way in — anyone who reads your inbox can request a code.",
  },
  {
    step: "A passkey — nothing about you leaves",
    text: "Unlocked by your face, fingerprint or device PIN. No email address, no phone number, nothing that names you. The key stays on your device and never travels; what travels is only proof your device approved something. It follows you to other devices through the Google or Apple account that already syncs your passwords.",
  },
  {
    step: "You can have both, and should",
    text: "Coinbase lets you manage your sign-in methods and add the other later. Two ways in means losing one is an inconvenience rather than a disaster. If privacy matters to you, add a passkey and use that day to day.",
  },
];

/** Using the same savings on more than one device. */
export const SIGNING_IN_DEVICES = [
  {
    emoji: "✉️",
    title: "An email code works anywhere",
    text: "Nothing to sync. Open the site on any device, ask for a code, and you are in — which is what reaches an old laptop, a borrowed computer, or a phone you have just bought.",
  },
  {
    emoji: "🔄",
    title: "A passkey usually follows you",
    text: "Passkeys are saved by the account that already syncs your photos and passwords — Google on Android and Chrome, Apple on iPhone and Mac. Sign into that on a new device and it is already there.",
  },
  {
    emoji: "🖥️",
    title: "Apple and Windows together",
    text: "Apple's keychain does not sync to Windows. If you use an iPhone and a Windows PC, use Chrome on both so Google syncs your passkey — or fall back to an email code on the PC.",
  },
];

/** What to do when a device is gone. Ordered by what to try first. */
export const SIGNING_IN_RECOVERY = [
  {
    step: "Sign in again, the same way",
    text: "This covers most people. An email code works from any device straight away. A passkey comes back when you sign into the Google or Apple account that saved it. Your savings are untouched either way — they live on the network, not on the phone.",
  },
  {
    step: "Use your other sign-in method",
    text: "If you added both, the one you still have gets you in on its own. This is why adding the second early is worth the minute it takes.",
  },
  {
    step: "Use your recovery key, if you set one",
    text: "A recovery key is a separate key you keep somewhere safe and rarely touch. It can move your savings to a fresh account even when every sign-in method is gone — and it can freeze the account instantly if you think somebody else has got in.",
  },
];

export const SIGNING_IN_FAQ = [
  {
    question: "Will I get an email code or a passkey?",
    answer:
      "Whichever Coinbase offers your device — they run the sign-in, not us. Many people get an emailed six-digit code. A current phone or browser may instead offer a passkey, using the same face or fingerprint check that unlocks it. Both reach the same savings, and you can add the other method afterwards in Coinbase's settings.",
  },
  {
    question: "Does signing in with email mean I am identified?",
    answer:
      "Yes, to Coinbase. They hold the email address you signed in with, and it is linked to your wallet address — which is itself public, like every address on a blockchain. So an email sign-in connects a real identity to your savings in Coinbase's records, and that record can be requested from them. A passkey shares nothing of the kind: no email, no phone number, nothing that names you. If that difference matters to you, use a passkey, or bring your own wallet instead.",
  },
  {
    question: "Who can actually move my money?",
    answer:
      "Only whoever can authorise a transaction from your account. That is you, through the sign-in method you chose. We cannot move your money and never could — we can show you your savings and pass on instructions you have authorised. The withdrawal limits are enforced by the contract itself, so we cannot lift them for you either.",
  },
  {
    question: "Where exactly is the key that signs for me?",
    answer:
      "With a passkey it is on your device and never leaves. With an email code, Coinbase manages it, and they have not published exactly how — they describe these wallets as self-custody, with key operations inside secure hardware they say they cannot read. We are not in a position to verify that, so we would rather point you at their documentation than repeat a guarantee we cannot check. If this matters to you, that is a good reason to use a passkey or your own wallet.",
  },
  {
    question: "What happens if I lose access to my email?",
    answer:
      "If email is your only sign-in method, you would need Coinbase's help to recover the account — which is exactly why adding a second method is worth doing while you still can. A passkey on a device, or a recovery key you have set, both get you in without touching your email at all.",
  },
  {
    question: "Do I still need a seed phrase?",
    answer:
      "No. There is nothing to write down. If you would rather hold your own key anyway, you can export your wallet at any time and keep it however you prefer — that option never goes away, and using it does not close your account.",
  },
  {
    question: "Is my fingerprint or face sent anywhere?",
    answer:
      "No. When you sign in with a passkey the check happens on your device, to unlock a key held there. Your biometrics never leave the device and never reach us, Coinbase, or any network.",
  },
  {
    question: "Can I use this and my own wallet?",
    answer:
      "Yes. They are separate accounts with separate savings, and you can hold both. Signing in suits people who would rather not manage a wallet; connecting your own suits people who already do, and keeps every request between you and the network.",
  },
];

export const SIGNING_IN_SEO = {
  title: "Signing In Without a Seed Phrase | LockIn Wallet",
  description:
    "How signing into LockIn Wallet works: email codes and passkeys explained, what each one means for your privacy, using the same savings on more than one device, and how to get back in if you lose your phone.",
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
