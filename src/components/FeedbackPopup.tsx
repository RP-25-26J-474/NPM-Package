// src/components/FeedbackPopup.tsx
import * as React from "react";
import { useState, useEffect, type CSSProperties } from "react";
import { useAdaptive } from "../AdaptiveProvider";
import type { AdaptiveComponentProps, FeedbackType, FeedbackData } from "../types";

export interface FeedbackPopupProps extends AdaptiveComponentProps {
  /** Whether the popup is visible */
  isOpen: boolean;
  /** Callback when popup should close */
  onClose: () => void;
  /** Callback when feedback is submitted */
  onSubmit?: (feedback: FeedbackData) => void | Promise<void>;
  /** API URL for submitting feedback */
  apiUrl?: string;
  /** Custom title for the popup */
  title?: string;
  /** Show after a delay (in ms) */
  autoShowDelay?: number;
}

export function FeedbackPopup({
  isOpen,
  onClose,
  onSubmit,
  apiUrl,
  title = "How is your experience?",
  className = "",
  style,
}: FeedbackPopupProps) {
  const { tokens, userId, profile } = useAdaptive();
  const { colors, spacing, controls, typography, flags } = tokens;

  const [feedbackType, setFeedbackType] = useState<FeedbackType | null>(null);
  const [rating, setRating] = useState<number>(0);
  const [comment, setComment] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [hoveredStar, setHoveredStar] = useState<number>(0);

  // Reset state when popup opens
  useEffect(() => {
    if (isOpen) {
      setFeedbackType(null);
      setRating(0);
      setComment("");
      setSubmitted(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async () => {
    if (!feedbackType) return;

    const feedbackData: FeedbackData = {
      userId: userId || "guest",
      feedbackType,
      rating: rating > 0 ? rating : undefined,
      comment: comment.trim() || undefined,
      timestamp: new Date().toISOString(),
      currentSettings: profile || undefined,
    };

    setSubmitting(true);

    try {
      // Call custom onSubmit callback if provided
      if (onSubmit) {
        await onSubmit(feedbackData);
      }

      // Submit to API if URL provided
      if (apiUrl && userId) {
        await fetch(`${apiUrl}/users/${userId}/feedback`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(feedbackData),
        });
      }

      setSubmitted(true);
      setTimeout(() => {
        onClose();
      }, 2000);
    } catch (error) {
      console.error("Failed to submit feedback:", error);
    } finally {
      setSubmitting(false);
    }
  };

  // Styles
  const overlayStyle: CSSProperties = {
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 9999,
    padding: `${spacing.base * 2}px`,
  };

  const popupStyle: CSSProperties = {
    backgroundColor: colors.surface,
    color: colors.text,
    borderRadius: "12px",
    padding: `${spacing.base * 3}px`,
    maxWidth: "500px",
    width: "100%",
    boxShadow: flags.highContrast
      ? `0 0 0 3px ${colors.border}`
      : "0 10px 40px rgba(0,0,0,0.2)",
    border: flags.highContrast ? `2px solid ${colors.border}` : "none",
    ...style,
  };

  const titleStyle: CSSProperties = {
    fontSize: typography.h3,
    fontWeight: "600",
    marginBottom: `${spacing.gap}px`,
    color: colors.text,
  };

  const buttonGroupStyle: CSSProperties = {
    display: "flex",
    gap: `${spacing.gap}px`,
    marginBottom: `${spacing.gap * 1.5}px`,
    flexWrap: "wrap",
  };

  const feedbackButtonStyle = (type: FeedbackType, selected: boolean): CSSProperties => ({
    flex: "1",
    minWidth: "100px",
    padding: `${spacing.base}px ${spacing.base * 2}px`,
    fontSize: typography.body,
    fontWeight: "500",
    border: `2px solid ${selected ? colors.primary : colors.border}`,
    backgroundColor: selected ? colors.primary : colors.surface,
    color: selected ? colors.onPrimary : colors.text,
    borderRadius: "8px",
    cursor: "pointer",
    minHeight: `${controls.minTargetSize}px`,
    transition: flags.reducedMotion ? "none" : "all 0.2s",
  });

  const starContainerStyle: CSSProperties = {
    display: "flex",
    gap: `${spacing.base}px`,
    marginBottom: `${spacing.gap}px`,
    justifyContent: "center",
  };

  const starStyle = (index: number): CSSProperties => {
    const filled = index <= (hoveredStar || rating);
    return {
      fontSize: "32px",
      cursor: "pointer",
      color: filled ? colors.accent : colors.border,
      transition: flags.reducedMotion ? "none" : "transform 0.2s",
      transform: hoveredStar === index ? "scale(1.2)" : "scale(1)",
    };
  };

  const textareaStyle: CSSProperties = {
    width: "100%",
    minHeight: "80px",
    padding: `${spacing.base}px`,
    fontSize: typography.body,
    fontFamily: "inherit",
    border: `2px solid ${colors.border}`,
    borderRadius: "6px",
    backgroundColor: colors.background,
    color: colors.text,
    resize: "vertical",
    marginBottom: `${spacing.gap}px`,
  };

  const actionButtonStyle = (isPrimary: boolean): CSSProperties => ({
    padding: `${spacing.base}px ${spacing.base * 3}px`,
    fontSize: typography.body,
    fontWeight: "600",
    border: isPrimary ? "none" : `2px solid ${colors.border}`,
    backgroundColor: isPrimary ? colors.primary : "transparent",
    color: isPrimary ? colors.onPrimary : colors.text,
    borderRadius: "8px",
    cursor: submitting ? "not-allowed" : "pointer",
    minHeight: `${controls.minTargetSize}px`,
    minWidth: "100px",
    opacity: submitting ? 0.6 : 1,
    transition: flags.reducedMotion ? "none" : "all 0.2s",
  });

  const actionsStyle: CSSProperties = {
    display: "flex",
    gap: `${spacing.gap}px`,
    justifyContent: "flex-end",
  };

  const successStyle: CSSProperties = {
    textAlign: "center",
    padding: `${spacing.base * 3}px`,
    fontSize: typography.h3,
    color: colors.primary,
  };

  if (submitted) {
    return (
      <div style={overlayStyle} onClick={onClose}>
        <div style={popupStyle} onClick={(e) => e.stopPropagation()}>
          <div style={successStyle}>
            <div style={{ fontSize: "48px", marginBottom: `${spacing.gap}px` }}>✓</div>
            <div>Thank you for your feedback!</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={overlayStyle} onClick={onClose} className={className}>
      <div style={popupStyle} onClick={(e) => e.stopPropagation()}>
        <h2 style={titleStyle}>{title}</h2>

        {/* Feedback Type Selection */}
        <div style={buttonGroupStyle}>
          <button
            style={feedbackButtonStyle("positive", feedbackType === "positive")}
            onClick={() => setFeedbackType("positive")}
            aria-pressed={feedbackType === "positive"}
          >
            👍 Positive
          </button>
          <button
            style={feedbackButtonStyle("neutral", feedbackType === "neutral")}
            onClick={() => setFeedbackType("neutral")}
            aria-pressed={feedbackType === "neutral"}
          >
            😐 Neutral
          </button>
          <button
            style={feedbackButtonStyle("negative", feedbackType === "negative")}
            onClick={() => setFeedbackType("negative")}
            aria-pressed={feedbackType === "negative"}
          >
            👎 Negative
          </button>
        </div>

        {/* Star Rating */}
        {feedbackType && (
          <>
            <div style={{ marginBottom: `${spacing.base}px`, fontSize: typography.body }}>
              Rate your experience:
            </div>
            <div style={starContainerStyle}>
              {[1, 2, 3, 4, 5].map((star) => (
                <span
                  key={star}
                  style={starStyle(star)}
                  onClick={() => setRating(star)}
                  onMouseEnter={() => setHoveredStar(star)}
                  onMouseLeave={() => setHoveredStar(0)}
                  role="button"
                  aria-label={`Rate ${star} stars`}
                  tabIndex={0}
                >
                  {star <= (hoveredStar || rating) ? "★" : "☆"}
                </span>
              ))}
            </div>

            {/* Comment */}
            <div style={{ marginBottom: `${spacing.base}px`, fontSize: typography.body }}>
              Additional comments (optional):
            </div>
            <textarea
              style={textareaStyle}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Tell us more about your experience..."
              aria-label="Feedback comment"
            />

            {/* Actions */}
            <div style={actionsStyle}>
              <button
                style={actionButtonStyle(false)}
                onClick={onClose}
                disabled={submitting}
              >
                Cancel
              </button>
              <button
                style={actionButtonStyle(true)}
                onClick={handleSubmit}
                disabled={submitting || !feedbackType}
              >
                {submitting ? "Submitting..." : "Submit"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
