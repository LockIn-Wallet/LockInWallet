import React, { useState, useCallback } from "react";
import PropTypes from "prop-types";
import { colors, spacing, borderRadius, fontSize, fontWeight, transitions } from "../../styles";

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
    marginBottom: spacing.sm,
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: `${spacing.sm} ${spacing.md}`,
    cursor: "pointer",
    userSelect: "none",
    transition: transitions.fast,
    backgroundColor: colors.background.dark,
    border: `1px solid ${colors.border.default}`,
    borderRadius: borderRadius.lg,
    width: "100%",
    color: colors.text.primary,
  },
  title: {
    fontSize: fontSize.normal,
    fontWeight: fontWeight.semibold,
    color: colors.text.secondary,
    margin: 0,
  },
  chevron: {
    fontSize: fontSize.sm,
    color: colors.text.muted,
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
          {icon && <span>{icon} </span>}
          {title}
        </span>
        <span
          style={{
            ...sectionStyles.chevron,
            transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)",
          }}
        >
          ▼
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
  icon: PropTypes.string,
  sectionId: PropTypes.string,
};

export default CollapsibleSection;
