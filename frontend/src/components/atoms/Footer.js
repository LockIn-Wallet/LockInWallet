import React from "react";
import { colors, spacing, borderRadius, fontSize } from "../../styles";

const footerStyles = {
  footer: {
    backgroundColor: colors.background.primary,
    padding: `${spacing.xxxl} ${spacing.xxl}`,
    borderTop: `1px solid ${colors.border.default}`,
    marginTop: spacing.xxxl,
  },
  inner: {
    maxWidth: "800px",
    margin: "0 auto",
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
    gap: spacing.xxl,
  },
  colTitle: {
    color: colors.text.primary,
    marginBottom: spacing.lg,
    fontSize: fontSize.normal,
    fontWeight: "600",
  },
  list: {
    listStyle: "none",
    margin: 0,
    padding: 0,
  },
  listItem: {
    marginBottom: spacing.sm,
  },
  link: {
    color: colors.text.muted,
    textDecoration: "none",
    fontSize: fontSize.md,
    transition: "color 0.2s",
  },
  bottom: {
    maxWidth: "800px",
    margin: `${spacing.xxl} auto 0`,
    paddingTop: spacing.xxl,
    borderTop: `1px solid ${colors.border.default}`,
    textAlign: "center",
    color: colors.text.muted,
    fontSize: fontSize.xs,
  },
};

const FOOTER_COLUMNS = [
  {
    title: "Product",
    links: [
      { label: "Home", href: "/" },
      { label: "How It Works", href: "/how-it-works" },
    ],
  },
  {
    title: "Resources",
    links: [
      { label: "Stop Impulse Spending", href: "/impulse-spending" },
      { label: "No-Withdrawal Accounts", href: "/no-withdrawal-account" },
      { label: "Addiction Recovery", href: "/addiction-recovery" },
      { label: "Gambling Help", href: "/gambling-help" },
    ],
  },
  {
    title: "LockIn Wallet",
    links: [
      { label: "Commitment Savings", href: "/" },
      { label: "Forced Savings App", href: "/" },
    ],
  },
];

const Footer = () => {
  return (
    <footer style={footerStyles.footer}>
      <div style={footerStyles.inner}>
        {FOOTER_COLUMNS.map((col) => (
          <div key={col.title}>
            <h4 style={footerStyles.colTitle}>{col.title}</h4>
            <ul style={footerStyles.list}>
              {col.links.map((link) => (
                <li key={link.label} style={footerStyles.listItem}>
                  <a
                    href={link.href}
                    style={footerStyles.link}
                    onMouseEnter={(e) => { e.target.style.color = colors.primary.main; }}
                    onMouseLeave={(e) => { e.target.style.color = colors.text.muted; }}
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div style={footerStyles.bottom}>
        <p>&copy; {new Date().getFullYear()} LockIn Wallet. All rights reserved.</p>
      </div>
    </footer>
  );
};

export default Footer;
