import React, { useRef, useEffect, useState } from "react";

/**
 * TypewriterText component - Animated typewriter effect
 * Cycles through words with typing and deleting animation
 * Uses refs to persist state across renders
 */
const TypewriterText = ({
  words = ["text"],
  typingSpeed = 100,
  deletingSpeed = 50,
  delayBetweenWords = 2000,
  style = {},
}) => {
  const [displayText, setDisplayText] = useState("");
  const [showCursor, setShowCursor] = useState(true);

  const wordIndexRef = useRef(0);
  const charIndexRef = useRef(0);
  const isDeletingRef = useRef(false);
  const timerRef = useRef(null);
  const wordsRef = useRef(words);
  const typingSpeedRef = useRef(typingSpeed);
  const deletingSpeedRef = useRef(deletingSpeed);
  const delayRef = useRef(delayBetweenWords);

  // Update refs when props change without restarting the effect
  wordsRef.current = words;
  typingSpeedRef.current = typingSpeed;
  deletingSpeedRef.current = deletingSpeed;
  delayRef.current = delayBetweenWords;

  useEffect(() => {
    const tick = () => {
      const currentWord = wordsRef.current[wordIndexRef.current];

      if (!isDeletingRef.current) {
        // Typing
        if (charIndexRef.current < currentWord.length) {
          charIndexRef.current++;
          setDisplayText(currentWord.substring(0, charIndexRef.current));
          timerRef.current = setTimeout(tick, typingSpeedRef.current);
        } else {
          // Finished typing, wait then start deleting
          isDeletingRef.current = true;
          timerRef.current = setTimeout(tick, delayRef.current);
        }
      } else {
        // Deleting
        if (charIndexRef.current > 0) {
          charIndexRef.current--;
          setDisplayText(currentWord.substring(0, charIndexRef.current));
          timerRef.current = setTimeout(tick, deletingSpeedRef.current);
        } else {
          // Finished deleting, move to next word
          isDeletingRef.current = false;
          wordIndexRef.current = (wordIndexRef.current + 1) % wordsRef.current.length;
          timerRef.current = setTimeout(tick, 100);
        }
      }
    };

    // Start the animation
    tick();

    // Cleanup
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []); // Run once - props accessed via refs

  // Cursor blinking effect
  useEffect(() => {
    const cursorInterval = setInterval(() => {
      setShowCursor((prev) => !prev);
    }, 530);

    return () => clearInterval(cursorInterval);
  }, []);

  return (
    <span style={style}>
      {displayText}
      <span
        style={{
          opacity: showCursor ? 1 : 0,
          transition: "opacity 0.1s",
          fontWeight: "normal",
        }}
      >
        |
      </span>
    </span>
  );
};

export default TypewriterText;
