// src/components/ComponentFeedbackModal.tsx
import React, { useState } from 'react';

export type ComponentFeedbackType = 'button' | 'text' | 'container' | 'input';

interface ComponentFeedbackModalProps {
  componentId: string;
  componentType: ComponentFeedbackType;
  currentProps: any;
  onClose: () => void;
  onSubmit: (feedback: { issue: string; severity: number; comment?: string }) => void;
}

export function ComponentFeedbackModal({
  componentId,
  componentType,
  currentProps,
  onClose,
  onSubmit
}: ComponentFeedbackModalProps) {
  const [issue, setIssue] = useState<string>('');
  const [comment, setComment] = useState('');

  const getIssuesForType = (type: ComponentFeedbackType, props: any) => {
    const options = [];
    
    // Common visual checks (simplified logic)
    const isSmall = props?.computedSize && props.computedSize < 40;
    const isLarge = props?.computedSize && props.computedSize > 50;

    switch (type) {
      case 'button':
        if (isLarge) {
            options.push({ value: 'too_large', label: 'Button is too large' });
        } else {
            options.push({ value: 'too_small', label: 'Too small to click' });
        }
        
        options.push(
          { value: 'hard_to_read', label: 'Text hard to read' },
          { value: 'bad_contrast', label: 'Low contrast' },
          { value: 'wrong_color', label: 'Color mismatch' },
          { value: 'layout', label: 'Position/Layout issue' }
        );
        break;

      case 'text':
        options.push(
          { value: 'too_small', label: 'Text too small' },
          { value: 'too_large', label: 'Text too large' },
          { value: 'hard_to_read', label: 'Hard to read (font/weight)' },
          { value: 'line_height', label: 'Line spacing issue' },
          { value: 'bad_contrast', label: 'Low contrast' }
        );
        break;

      case 'container':
      case 'input':
      default:
        options.push(
            { value: 'layout', label: 'Layout/Spacing issue' },
            { value: 'bad_contrast', label: 'Visibility issue' },
            { value: 'other', label: 'Other/Visual Bug' }
        );
        break;
    }
    return options;
  };

  const handleSubmit = () => {
    if (!issue) return;
    onSubmit({
      issue,
      severity: 1, // Default severity
      comment
    });
    onClose();
  };

  return React.createElement('div', {
    style: {
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.5)',
      zIndex: 10000,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: 'system-ui, -apple-system, sans-serif' // Ensure consistent font
    },
    onClick: onClose
  }, 
    React.createElement('div', {
      style: {
        backgroundColor: 'white',
        padding: '24px',
        borderRadius: '12px',
        width: '320px',
        maxWidth: '90%',
        boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
        color: '#1a1a1a' // Force dark text
      },
      onClick: (e: any) => e.stopPropagation()
    },
      React.createElement('h3', { style: { marginTop: 0, marginBottom: '16px', fontSize: '18px' } }, 
        `Report Issue: ${componentType}`
      ),
      
      React.createElement('div', { style: { marginBottom: '16px' } },
        React.createElement('label', { style: { display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: 500 } }, 'What is wrong?'),
        React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: '8px' } },
          getIssuesForType(componentType, currentProps).map(opt => 
            React.createElement('label', { 
              key: opt.value, 
              style: { 
                display: 'flex', 
                alignItems: 'center', 
                gap: '8px', 
                cursor: 'pointer',
                fontSize: '14px' 
              } 
            },
              React.createElement('input', {
                type: 'radio',
                name: 'issue',
                value: opt.value,
                checked: issue === opt.value,
                onChange: (e: any) => setIssue(e.target.value)
              }),
              opt.label
            )
          )
        )
      ),

      React.createElement('div', { style: { marginBottom: '20px' } },
        React.createElement('label', { style: { display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: 500 } }, 'Comment (Optional)'),
        React.createElement('textarea', {
          style: { 
            width: '100%', 
            padding: '8px', 
            borderRadius: '6px', 
            border: '1px solid #ccc',
            minHeight: '60px',
            resize: 'vertical',
            boxSizing: 'border-box' // Fix padding issues
          },
          value: comment,
          onChange: (e: any) => setComment(e.target.value),
          placeholder: 'Details...'
        })
      ),

      React.createElement('div', { style: { display: 'flex', justifyContent: 'flex-end', gap: '12px' } },
        React.createElement('button', {
          style: {
            padding: '8px 16px',
            border: 'none',
            background: 'transparent',
            color: '#666',
            cursor: 'pointer',
            fontSize: '14px'
          },
          onClick: onClose
        }, 'Cancel'),
        React.createElement('button', {
          style: {
            padding: '8px 16px',
            border: 'none',
            background: issue ? '#2563eb' : '#93c5fd',
            color: 'white',
            borderRadius: '6px',
            cursor: issue ? 'pointer' : 'not-allowed',
            fontWeight: 500,
            fontSize: '14px'
          },
          disabled: !issue,
          onClick: handleSubmit
        }, 'Submit Feedback')
      )
    )
  );
}
