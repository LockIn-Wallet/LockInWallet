// Copy and structured data for the passkey explainer (/passkeys). Kept out of
// the component so the page reads as layout and the wording — which is also
// what search engines index — lives in one editable place.
//
// Written for somebody who has never held crypto. No jargon survives here
// unless the page explains it first, and nothing claims more safety than the
// design actually provides: the honest limits are on the page, not in a
// footnote, because the whole point of this page is that somebody reads it
// before they have money at stake.

import { buildFaqJsonLd, absoluteUrl } from "./seo.js";

export const PASSKEY_PATH = "/passkeys";

export const PASSKEY_HERO = {
  eyebrow: "Signing in",
  title: "What a passkey is, and how it keeps your savings yours",
  lede: "A passkey is the thing your phone already uses when it asks for your face or your fingerprint instead of a password. LockIn Wallet uses one to hold your savings — so there is no password to forget and no secret phrase to write down.",
};

/** The mental model, before any mechanism. */
export const PASSKEY_BASICS = [
  {
    emoji: "👆",
    title: "It is your face or your fingerprint",
    text: "When you sign in, your device checks it is you the same way it unlocks your phone. Nothing is typed, so nothing can be forgotten, guessed, or read over your shoulder.",
  },
  {
    emoji: "📱",
    title: "It lives on your device",
    text: "The passkey itself never leaves your phone or laptop. Not to us, not to anyone. What travels is only proof that your device approved something — never the key that did the approving.",
  },
  {
    emoji: "🔑",
    title: "It replaces the seed phrase",
    text: "Most crypto wallets hand you twelve random words and tell you that losing them means losing everything. A passkey does the same job without ever making you the filing cabinet.",
  },
];

/** How it actually works, for anyone who wants the mechanism. */
export const PASSKEY_MECHANISM = [
  {
    step: "Your device makes two matching halves",
    text: "One half stays locked inside your phone forever. The other half is public and is written into your savings account, which lives on a public network rather than on our servers.",
  },
  {
    step: "Signing proves you have the private half",
    text: "When you move money, your device uses its half to sign the request. Anyone can check the signature against the public half; nobody can work backwards to the private one.",
  },
  {
    step: "Your face never goes anywhere",
    text: "The fingerprint or face check happens on your device, to unlock its own half. Your biometrics are never sent to us, to Coinbase, or onto any network.",
  },
];

/** Getting it onto another device — the thing people actually worry about. */
export const PASSKEY_DEVICES = [
  {
    emoji: "🔄",
    title: "It usually follows you automatically",
    text: "Passkeys are saved by the same account that already syncs your photos and passwords — your Google account on Android and Chrome, or your Apple account on iPhone and Mac. Sign into that account on a new device and your passkey is already there.",
  },
  {
    emoji: "🖥️",
    title: "Moving between Apple and Windows",
    text: "Apple's keychain does not sync to Windows. If you use an iPhone and a Windows PC, either use Chrome on both — Google's password manager syncs across all of them — or scan a QR code with your phone to sign in on the PC when you need to.",
  },
  {
    emoji: "➕",
    title: "Add a second way in, on purpose",
    text: "You can add another passkey from a second device, so either one gets you in. Do this while you still have access: it takes a minute, and it is what turns a lost phone into an inconvenience rather than a problem.",
  },
];

/** What to do when a device is gone. Ordered by what to try first. */
export const PASSKEY_RECOVERY = [
  {
    step: "Sign into your Google or Apple account on a new device",
    text: "This is the ordinary case and it covers most people. Your passkey syncs down with everything else, and your savings are exactly where you left them.",
  },
  {
    step: "Use another device you already added",
    text: "If you added a second passkey earlier, that device still works on its own. Nothing about the lost phone matters.",
  },
  {
    step: "Use your recovery key, if you set one",
    text: "A recovery key is a separate key you keep somewhere safe and rarely touch. It can move your savings to a fresh account even if everything else is gone — and it can freeze the account instantly if you think someone else has got in.",
  },
];

export const PASSKEY_FAQ = [
  {
    question: "What is a passkey, in plain terms?",
    answer:
      "A passkey is a login that lives on your device and is unlocked by your face, fingerprint, or device PIN. There is nothing to type and nothing to remember. It is the same technology your phone already uses for banking apps, and it is built into every current phone and browser.",
  },
  {
    question: "Is my fingerprint or face sent anywhere?",
    answer:
      "No. The check happens on your device and unlocks a key held there. Your biometrics never leave the device — not to LockIn Wallet, not to anyone else, and never onto a public network.",
  },
  {
    question: "Do I still need a seed phrase?",
    answer:
      "No. A passkey does the job that twelve written-down words normally do, without making you responsible for storing them. If you would still like one, you can export your wallet at any time and keep it however you prefer — that option never goes away.",
  },
  {
    question: "What happens if I lose my phone?",
    answer:
      "In most cases nothing at all: your passkey is saved by your Google or Apple account, so signing into that account on a new device brings it back. If you added a second device, that one still works by itself. And if you set a recovery key, that can move your savings to a fresh account even if every device is gone.",
  },
  {
    question: "Can LockIn Wallet move my money?",
    answer:
      "No. The key that authorises anything is on your device, and we never see it. What we can do is show you your savings and hand your signed instructions to the network. The rules that limit withdrawals are enforced by the contract itself, not by us — we cannot override them either.",
  },
  {
    question: "Is signing in with a passkey anonymous?",
    answer:
      "It is not, and it is worth being clear about that. Your key stays on your device, so this is genuinely your money and nobody else can move it. But the signing goes through a service Coinbase operates, which means they can see the requests and the network address they come from — never your key, and never your funds. If you would rather nothing passed through anyone else, connect your own wallet instead. Both options are on the screen where you choose.",
  },
  {
    question: "Can I use a passkey and my own wallet?",
    answer:
      "Yes. They are separate accounts with separate savings, and you can hold both. Signing in is for people who would rather not manage a wallet; connecting your own is for people who already do.",
  },
  {
    question: "What if my browser or device is too old for passkeys?",
    answer:
      "Then signing in will not be offered, and you can connect a wallet such as MetaMask instead. Passkeys need a current browser and an operating system that supports them, which covers most devices from the last few years.",
  },
];

export const PASSKEY_SEO = {
  title: "What Is a Passkey? Sign In Without a Seed Phrase | LockIn Wallet",
  description:
    "A plain-English guide to passkeys: what they are, how signing in with your face or fingerprint works, how to use the same wallet on more than one device, and how to get back in if you lose your phone.",
  path: PASSKEY_PATH,
  jsonLd: {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        "@id": absoluteUrl(PASSKEY_PATH),
        url: absoluteUrl(PASSKEY_PATH),
        name: PASSKEY_HERO.title,
        description: PASSKEY_HERO.lede,
      },
      buildFaqJsonLd(PASSKEY_FAQ),
    ],
  },
};
