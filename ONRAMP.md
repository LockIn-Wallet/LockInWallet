# Card purchases (Transak on-ramp)

Buying with a card pays out **into the locked wallet**, not into the user's own
wallet. The provider sends USDC to the user's permanent deposit address (the
`UserProxy` created by `ProxyDeploymentModule`), the payout address form is
disabled server-side, and the existing sweep credits the funds to savings on the
next balance refresh. There is no path in this flow that puts bought funds in a
spendable wallet first.

## Why a backend is required

Transak's widget URL is no longer something the browser can assemble. It is
minted server-side:

1. `POST {partners}/partners/api/v2/refresh-token` with the `api-secret` header
   returns a partner access token, valid 7 days.
2. `POST {gateway}/api/v2/auth/session` with `access-token` returns a
   `widgetUrl` that is **single-use and expires after 5 minutes**.

| Environment | Partners host | Gateway host |
| --- | --- | --- |
| `STAGING` | `https://api-stg.transak.com` | `https://api-gateway-stg.transak.com` |
| `PRODUCTION` | `https://api.transak.com` | `https://api-gateway.transak.com` |

The API secret must never reach the browser, so the call lives in
`frontend/api/transak/session.js` (a Vercel serverless function). The frontend
only ever receives the finished `widgetUrl`.

> **Caveat:** Transak documents that the session call should come from a backend
> with **whitelisted IP addresses**. Vercel's egress IPs are dynamic, so either
> IP whitelisting has to be off for the account, or the endpoint needs a host
> with a static IP (Vercel Secure Compute, or a small service of your own). The
> handler is a plain `(req, res)` function, so moving it is a copy.

## Configuration

Server-side, set in the Vercel project (never with a `REACT_APP_` prefix):

| Variable | Required | Notes |
| --- | --- | --- |
| `TRANSAK_API_KEY` | yes | Partner API key |
| `TRANSAK_API_SECRET` | yes | Partner API secret — server only |
| `TRANSAK_ENVIRONMENT` | no | `STAGING` or `PRODUCTION` (default) |
| `TRANSAK_REFERRER_DOMAIN` | recommended | Must match a domain registered with Transak; falls back to the request's `Host` |

Client-side:

| Variable | Notes |
| --- | --- |
| `REACT_APP_ENABLE_ONRAMP` | `true` declares that the backend half is configured. Anything else hides the feature entirely. |

## Where it is offered

`frontend/src/onrampConfig.json` lists the chains Transak sells the stablecoin
on, plus the token address it delivers. A card purchase is offered only when
**all** of these hold:

- `REACT_APP_ENABLE_ONRAMP=true`
- the chain is in `onrampConfig.json`
- our savings contracts are deployed on that chain (`networkConfig.json`)
- the token address in `networkConfig.json` matches `expectedTokenAddress`

The last check matters: if the two ever disagree, the purchase would deliver a
token the contracts do not sweep and the funds would sit at the deposit address
untouched. A mismatch disables the feature and logs the reason rather than
losing money quietly.

**Transak sells no stablecoin on Optimism — only ETH.** That is why Base was
added. Verify current support against Transak's own list before adding a chain:

```bash
curl -s https://api.transak.com/api/v2/currencies/crypto-currencies \
  | python3 -c "import json,sys; [print(c['symbol'], c['network']['name'], c.get('address')) for c in json.load(sys.stdin)['response'] if c['symbol']=='USDC']"
```

## Local development

`npm start` mounts everything under `frontend/api/` through
`src/setupProxy.js`, so `/api/transak/session` behaves the same locally as on
Vercel. Put the server-side variables in `frontend/.env` (not `.env.local`
with a `REACT_APP_` prefix) and use `TRANSAK_ENVIRONMENT=STAGING`.

## Tests

- `frontend/src/__tests__/functionality/TransakSessionEndpoint.test.js` — the
  endpoint: validation, the locked payout address, secret handling, token reuse.
- `frontend/src/__tests__/functionality/OnrampService.test.js` — availability
  rules and that a purchase always targets the deposit address.
