import React from "react";
import { colors } from "../../styles";

const footerStyles = {
  footer: {
    backgroundColor: colors.background.primary,
    padding: "3rem 2rem",
    borderTop: `1px solid ${colors.border.default}`,
    marginTop: "3rem",
    marginLeft: "calc(-50vw + 50%)",
    marginRight: "calc(-50vw + 50%)",
    width: "100vw",
  },
  inner: {
    maxWidth: "1100px",
    margin: "0 auto",
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
    gap: "2rem",
  },
  colTitle: {
    color: colors.text.primary,
    marginBottom: "1rem",
    fontSize: "0.95rem",
    fontWeight: "600",
  },
  list: {
    listStyle: "none",
    margin: 0,
    padding: 0,
  },
  listItem: {
    marginBottom: "0.5rem",
    backgroundColor: "transparent",
    margin: 0,
    marginBottom: "0.5rem",
    padding: 0,
    borderRadius: 0,
    width: "auto",
    maxWidth: "none",
    boxShadow: "none",
    color: "inherit",
  },
  link: {
    color: colors.text.muted,
    textDecoration: "none",
    fontSize: "0.9rem",
    transition: "color 0.2s",
  },
  bottom: {
    maxWidth: "1100px",
    margin: "2rem auto 0",
    paddingTop: "2rem",
    borderTop: `1px solid ${colors.border.default}`,
    textAlign: "center",
    color: colors.text.muted,
    fontSize: "0.85rem",
  },
};

const FOOTER_COLUMNS = [
  {
    title: "Product",
    links: [
      { label: "Home", href: "/" },
      { label: "How It Works", href: "/how-it-works" },
      { label: "Security", href: "/security" },
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
