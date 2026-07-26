import React from "react";
import { Link } from "react-router-dom";

/**
 * LandingLink - one link component for the three kinds the landing page uses:
 * in-page anchors, router routes (`internal`), and off-site URLs (`external`).
 * Keeps every call site from repeating the target/rel boilerplate.
 */
const LandingLink = ({ href, internal, external, style, children, ...rest }) => {
  if (internal) {
    return (
      <Link to={href} style={style} {...rest}>
        {children}
      </Link>
    );
  }

  const externalProps = external
    ? { target: "_blank", rel: "noopener noreferrer" }
    : {};

  return (
    <a href={href} style={style} {...externalProps} {...rest}>
      {children}
    </a>
  );
};

export default LandingLink;
