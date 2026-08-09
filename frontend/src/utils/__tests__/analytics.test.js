// Analytics must never carry a wallet address off this site — every address
// on the chain is public, so one leaked to a vendor joins a real balance and
// transaction history to an IP and a device.
const { sanitizeAnalyticsUrl } = require("../analytics.js");

const ADDRESS = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8";

describe("sanitizeAnalyticsUrl", () => {
  test("redacts an address in a query parameter", () => {
    const clean = sanitizeAnalyticsUrl(`https://lockinwallet.com/?ref=${ADDRESS}`);

    expect(clean).not.toContain(ADDRESS);
    expect(clean).toBe("https://lockinwallet.com/?ref=0xREDACTED");
  });

  test("redacts an address in a path segment", () => {
    const clean = sanitizeAnalyticsUrl(`https://lockinwallet.com/vault/${ADDRESS}`);

    expect(clean).not.toContain(ADDRESS);
  });

  test("redacts a lowercase address, and every address present", () => {
    const other = "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC";
    const clean = sanitizeAnalyticsUrl(
      `https://lockinwallet.com/?ref=${ADDRESS.toLowerCase()}&to=${other}`
    );

    expect(clean).not.toContain(ADDRESS.toLowerCase());
    expect(clean).not.toContain(other);
  });

  test("leaves an address-free URL untouched", () => {
    const url = "https://lockinwallet.com/governance?tab=queue#history";

    expect(sanitizeAnalyticsUrl(url)).toBe(url);
  });

  test("defaults to the current location", () => {
    window.history.replaceState({}, "", `/?ref=${ADDRESS}`);

    expect(sanitizeAnalyticsUrl()).not.toContain(ADDRESS);
  });
});
