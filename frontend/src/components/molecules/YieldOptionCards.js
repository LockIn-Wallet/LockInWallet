import React from "react";
import PropTypes from "prop-types";

import {
  cardStyles,
  modalStyles,
  colors,
  space,
  type,
  fontWeight,
  borderRadius,
  fontFamily,
} from "../../styles";
import ApyBadge from "../atoms/ApyBadge.js";
import { YIELD_OPTIONS } from "../../utils/yieldContent.js";

/**
 * YieldOptionCards - the three earning choices, as selectable cards.
 *
 * Purely presentational. `options` carries the live rates from the adapter,
 * keyed by the same keys as YIELD_OPTIONS; the copy comes from the content
 * module. An option whose protocol is not configured (or whose feature flag is
 * off) renders greyed out rather than hidden, so the user can see what exists.
 */
const YieldOptionCards = ({ options, selected, onSelect, disabled = false }) => {
  const rates = new Map(options.map((option) => [option.key, option]));

  return (
    <div style={modalStyles.optionGrid}>
      {YIELD_OPTIONS.map((option) => {
        const rate = rates.get(option.key);
        // Availability comes from the chain — whether a strategy is configured
        // for this vault's token — rather than a flag. "Off" needs no protocol.
        const available = option.key === "off" || Boolean(rate?.available);
        const isSelected = selected === option.key;
        const selectable = available && !disabled;

        return (
          <button
            key={option.key}
            type="button"
            onClick={() => selectable && onSelect(option.key)}
            disabled={!selectable}
            aria-pressed={isSelected}
            style={{
              ...cardStyles.yieldOptionCard,
              ...(isSelected ? cardStyles.yieldOptionCardSelected : {}),
              ...(selectable ? {} : cardStyles.yieldOptionCardDisabled),
            }}
          >
            <span
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: space[3],
                marginBottom: space[2],
              }}
            >
              <span
                style={{
                  fontSize: type.bodyLg,
                  fontWeight: fontWeight.medium,
                  color: isSelected ? colors.success.light : colors.text.primary,
                }}
              >
                {option.title}
              </span>

              {/* No badge on an option that has no rate to quote: "off" never
                  does, and an unavailable one would just read "0.00% a year",
                  which says nothing true about what it will pay. */}
              {option.key === "off" || !available ? null : (
                <ApyBadge apyPercent={rate?.netApyPercent ?? 0} />
              )}
            </span>

            <span
              style={{
                display: "block",
                fontSize: type.small,
                color: colors.text.secondary,
                lineHeight: 1.6,
                marginBottom: space[2],
              }}
            >
              {option.blurb}
            </span>

            <span
              style={{
                display: "block",
                fontSize: type.caption,
                color: colors.text.muted,
                lineHeight: 1.5,
              }}
            >
              {option.detail}
            </span>

            {/* The grand prize is the whole point of the prize option, so show
                it whenever the pool actually reports one. */}
            {option.key === "prize" && rate?.grandPrize ? (
              <span
                style={{
                  display: "block",
                  marginTop: space[2],
                  fontFamily: fontFamily.mono,
                  fontSize: type.caption,
                  color: colors.text.light,
                }}
              >
                Current grand prize: {rate.grandPrize}
              </span>
            ) : null}

            {/* Say why an option cannot be picked rather than leaving it inert. */}
            {available ? null : (
              <span
                style={{
                  display: "inline-block",
                  marginTop: space[3],
                  padding: `${space[1]} ${space[2]}`,
                  borderRadius: borderRadius.pill,
                  backgroundColor: colors.background.dark,
                  fontSize: type.micro,
                  color: colors.text.muted,
                }}
              >
                {option.badge || "Not available for this token"}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
};

YieldOptionCards.propTypes = {
  options: PropTypes.arrayOf(
    PropTypes.shape({
      key: PropTypes.string.isRequired,
      netApyPercent: PropTypes.number,
      grandPrize: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
      available: PropTypes.bool,
    }),
  ),
  selected: PropTypes.string,
  onSelect: PropTypes.func.isRequired,
  disabled: PropTypes.bool,
};

YieldOptionCards.defaultProps = {
  options: [],
};

export default YieldOptionCards;
