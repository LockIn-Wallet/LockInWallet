import React, { useState, useCallback } from "react";
import PropTypes from "prop-types";

import Icon from "./Icon.js";

import {
  colors,
  space,
  borderRadius,
  type,
  fontWeight,
  letterSpacing,
  transitions,
} from "../../styles";

const STORAGE_KEY = "collapsibleSections";

function loadSavedState(sectionId) {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    return saved[sectionId];
  } catch {
    return undefined;
  }
}

function saveSectionState(sectionId, expanded) {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    saved[sectionId] = expanded;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
  } catch {
    // localStorage unavailable — silently skip
  }
}

const sectionStyles = {
  container: {
    marginBottom: space[2],
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: space[3],
    margin: 0,
    padding: `${space[3]} ${space[4]}`,
    cursor: "pointer",
    userSelect: "none",
    transition: transitions.fast,
    backgroundColor: colors.background.dark,
    border: `1px solid ${colors.border.hairline}`,
    borderRadius: borderRadius.lg,
    width: "100%",
    textAlign: "left",
    color: colors.text.primary,
  },
  title: {
    display: "flex",
    alignItems: "center",
    gap: space[3],
    fontSize: type.body,
    fontWeight: fontWeight.semibold,
    letterSpacing: letterSpacing.snug,
    color: colors.text.primary,
    margin: 0,
  },
  chevron: {
    display: "flex",
    color: colors.text.gray,
    transition: transitions.normal,
  },
  content: {},
};

const CollapsibleSection = ({
  title,
  defaultExpanded = true,
  children,
  icon,
  sectionId,
}) => {
  const storageKey = sectionId || title;
  const [isExpanded, setIsExpanded] = useState(() => {
    const saved = loadSavedState(storageKey);
    return saved !== undefined ? saved : defaultExpanded;
  });

  const toggle = useCallback(() => {
    setIsExpanded((prev) => {
      const next = !prev;
      saveSectionState(storageKey, next);
      return next;
    });
  }, [storageKey]);

  return (
    <div style={sectionStyles.container}>
      <button
        style={sectionStyles.header}
        onClick={toggle}
        type="button"
      >
        <span style={sectionStyles.title}>
          {icon && <Icon name={icon} size={16} />}
          {title}
        </span>
        <span
          style={{
            ...sectionStyles.chevron,
            transform: isExpanded ? "rotate(-90deg)" : "rotate(90deg)",
          }}
        >
          <Icon name="arrowRight" size={16} color={colors.text.gray} />
        </span>
      </button>
      {isExpanded && <div style={sectionStyles.content}>{children}</div>}
    </div>
  );
};

CollapsibleSection.propTypes = {
  title: PropTypes.string.isRequired,
  defaultExpanded: PropTypes.bool,
  children: PropTypes.node.isRequired,
  /** Name from the Icon set — section chrome uses line icons, not emoji */
  icon: PropTypes.string,
  sectionId: PropTypes.string,
};

export default CollapsibleSection;
