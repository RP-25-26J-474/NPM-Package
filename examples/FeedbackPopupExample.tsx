// examples/FeedbackPopupExample.tsx
import React, { useState } from "react";
import {
  AdaptiveProvider,
  AdaptiveButton,
  AdaptiveText,
  FeedbackPopup,
  FeedbackData,
} from "@aura/aura-adaptor";

/**
 * Example showing how to integrate the FeedbackPopup component
 * into your application
 */
export default function FeedbackPopupExample() {
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);

  // Handler for when feedback is submitted
  const handleFeedbackSubmit = async (feedback: FeedbackData) => {
    console.log("Feedback received:", feedback);
    
    // You can process the feedback here
    // For example, send analytics, show a notification, etc.
    
    // The FeedbackPopup will automatically submit to the API
    // if apiUrl is provided to AdaptiveProvider
  };

  return (
    <AdaptiveProvider
      userId="demo_user_123"
      simulateExtensionInstalled={true}
      apiUrl="http://localhost:5000/api"  // Your backend API URL
    >
      <div style={{ padding: "2rem" }}>
        <AdaptiveText variant="h1">
          Adaptive UI with Feedback
        </AdaptiveText>
        
        <AdaptiveText variant="body" style={{ marginTop: "1rem" }}>
          This example demonstrates how to collect user feedback about the
          adaptive UI experience.
        </AdaptiveText>

        <div style={{ marginTop: "2rem" }}>
          <AdaptiveButton
            variant="primary"
            onClick={() => setIsFeedbackOpen(true)}
          >
            Give Feedback
          </AdaptiveButton>
        </div>

        {/* Feedback Popup */}
        <FeedbackPopup
          isOpen={isFeedbackOpen}
          onClose={() => setIsFeedbackOpen(false)}
          onSubmit={handleFeedbackSubmit}
          title="How is your experience with the adaptive UI?"
        />
      </div>
    </AdaptiveProvider>
  );
}

/**
 * Example 2: Auto-show feedback popup after a delay
 */
export function AutoFeedbackExample() {
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);

  // Auto-show feedback after 30 seconds
  React.useEffect(() => {
    const timer = setTimeout(() => {
      setIsFeedbackOpen(true);
    }, 30000); // 30 seconds

    return () => clearTimeout(timer);
  }, []);

  return (
    <AdaptiveProvider
      userId="demo_user_456"
      apiUrl="http://localhost:5000/api"
    >
      <div style={{ padding: "2rem" }}>
        <AdaptiveText variant="h1">
          Your Adaptive App
        </AdaptiveText>
        
        <AdaptiveText variant="body">
          The feedback popup will appear automatically after 30 seconds.
        </AdaptiveText>

        <FeedbackPopup
          isOpen={isFeedbackOpen}
          onClose={() => setIsFeedbackOpen(false)}
        />
      </div>
    </AdaptiveProvider>
  );
}

/**
 * Example 3: Feedback with implicit signals
 */
export function FeedbackWithImplicitSignalsExample() {
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);
  const [sessionStart] = useState(Date.now());
  const [interactionCount, setInteractionCount] = useState(0);

  const handleFeedbackSubmit = async (feedback: FeedbackData) => {
    // Add implicit signals to the feedback
    const enrichedFeedback: FeedbackData = {
      ...feedback,
      implicitSignals: {
        timeSpent: Date.now() - sessionStart,
        interactionCount,
        scrollDepth: window.scrollY,
      },
    };

    console.log("Enriched feedback:", enrichedFeedback);

    // Submit to your analytics service
    // await analyticsService.track('feedback_submitted', enrichedFeedback);
  };

  return (
    <AdaptiveProvider userId="demo_user_789" apiUrl="http://localhost:5000/api">
      <div 
        style={{ padding: "2rem" }}
        onClick={() => setInteractionCount(prev => prev + 1)}
      >
        <AdaptiveText variant="h1">
          Interactive Content
        </AdaptiveText>
        
        <div style={{ marginTop: "2rem" }}>
          <AdaptiveButton onClick={() => setIsFeedbackOpen(true)}>
            Give Feedback (Interactions: {interactionCount})
          </AdaptiveButton>
        </div>

        <FeedbackPopup
          isOpen={isFeedbackOpen}
          onClose={() => setIsFeedbackOpen(false)}
          onSubmit={handleFeedbackSubmit}
        />
      </div>
    </AdaptiveProvider>
  );
}
