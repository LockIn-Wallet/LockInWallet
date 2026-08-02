// Copy for the "you don't have a wallet yet" dialog, kept as data so the
// wording lives in one place.
//
// Written for someone who has never touched crypto: short sentences, no
// jargon that isn't immediately explained, and no promise the contracts do
// not keep. Optimism is named directly because it is the only chain the
// wallet is deployed on — update this alongside networkConfig.json when
// another chain goes live (see WalletConnectionPrompt's chains section).

export const METAMASK_DOWNLOAD_URL = "https://metamask.io/download/";

export const ONBOARDING_TITLE = "You'll need MetaMask first";

export const ONBOARDING_LEDE =
  "It takes about two minutes, it's free, and you only do it once. Here's what it is and why you need it.";

export const ONBOARDING_BLOCKS = [
  {
    icon: "🦊",
    title: "MetaMask is your keyring",
    text: "A free add-on for your browser. It holds the key to your money, and only you get a copy — not us, not MetaMask.",
  },
  {
    icon: "🔑",
    title: "It's how you sign in",
    text: "No email, no password. You press connect, MetaMask asks \"is this you?\", you say yes. It asks again every time you move money.",
  },
  {
    icon: "📒",
    title: "A chain is where the money lives",
    text: "Not inside MetaMask — in a public notebook anyone can read and nobody can quietly rewrite. There are several, and they can't see each other, so yours has to be the same one as ours.",
  },
  {
    icon: "🔴",
    title: "Ours is Optimism",
    text: "Ethereum's fast lane: just as hard to cheat, but a transaction costs cents instead of dollars. A daily limit is no use if taking your money out costs more than you take. MetaMask will offer to switch you — say yes.",
  },
];

export const ONBOARDING_STEPS = [
  "Install MetaMask and pin it to your toolbar.",
  "Let it create a wallet for you. It will show you 12 words — write them on paper.",
  "Come back to this page and press connect. You're in.",
];

export const ONBOARDING_WARNING =
  "Those 12 words are the money. Anyone who reads them can take everything, and nothing undoes it. Paper only — never a screenshot, and never sent to anyone, including us.";

export const ONBOARDING_FOOTNOTE =
  "Already installed it? Reload this page so the browser picks it up.";
