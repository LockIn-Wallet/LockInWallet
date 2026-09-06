import React from "react";
import PropTypes from "prop-types";

import { buttonStyles, setupPathStyles } from "../../styles";
import { SETUP_PATHS, SETUP_PATH_CHOICE } from "../../utils/lockContent.js";

/**
 * SetupPathChoice - the first thing a new wallet is asked.
 *
 * Two ways to lock in, side by side: a spending limit you live under, or a
 * coin locked outright until a date. Presented as a fork rather than one
 * default with the other hidden behind it, because a visitor who came to lock
 * a coin until 2030 should not have to configure a weekly allowance first.
 */
const SetupPathChoice = ({ onChoose, lockPathAvailable }) => (
  <div style={setupPathStyles.container}>
    <h3 style={setupPathStyles.title}>{SETUP_PATH_CHOICE.title}</h3>
    <p style={setupPathStyles.lede}>{SETUP_PATH_CHOICE.lede}</p>

    <div style={setupPathStyles.grid}>
      {SETUP_PATH_CHOICE.options
        .filter((option) => option.key !== SETUP_PATHS.lock || lockPathAvailable)
        .map((option) => (
          <article key={option.key} style={setupPathStyles.card}>
            <h4 style={setupPathStyles.cardTitle}>{option.title}</h4>
            <p style={setupPathStyles.cardBody}>{option.body}</p>
            <button
              type="button"
              style={option.key === SETUP_PATHS.limits ? buttonStyles.primary : buttonStyles.secondary}
              onClick={() => onChoose(option.key)}
            >
              {option.cta}
            </button>
          </article>
        ))}
    </div>

    <p style={setupPathStyles.footnote}>{SETUP_PATH_CHOICE.footnote}</p>
  </div>
);

SetupPathChoice.propTypes = {
  onChoose: PropTypes.func.isRequired,
  lockPathAvailable: PropTypes.bool,
};

export default SetupPathChoice;
