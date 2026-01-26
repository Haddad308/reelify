'use client';

import React from 'react';
import { TranscriptionState } from '@/types';
import styles from './TranscriptionLoader.module.css';

interface TranscriptionLoaderProps {
  state: TranscriptionState;
  onRetry?: () => void;
  onSkip?: () => void;
}

export function TranscriptionLoader({ state, onRetry, onSkip }: TranscriptionLoaderProps) {
  if (state.status === 'idle') {
    return null;
  }

  if (state.status === 'loading') {
    return (
      <div className={styles.container}>
        <div className={styles.loadingCard}>
          <div className={styles.spinner} />
          <h3 className={styles.title}>Transcribing Video...</h3>
          <p className={styles.message}>
            This may take a few moments. We're generating captions for your video using AI.
          </p>
          {onSkip && (
            <button onClick={onSkip} className={styles.skipButton}>
              Skip and Continue Without Captions
            </button>
          )}
        </div>
      </div>
    );
  }

  if (state.status === 'error') {
    return (
      <div className={styles.container}>
        <div className={styles.errorCard}>
          <div className={styles.errorIcon}>⚠️</div>
          <h3 className={styles.title}>Transcription Failed</h3>
          <p className={styles.errorMessage}>
            {state.error || 'An error occurred while transcribing the video.'}
          </p>
          <div className={styles.buttonGroup}>
            {onRetry && (
              <button onClick={onRetry} className={styles.retryButton}>
                Retry Transcription
              </button>
            )}
            {onSkip && (
              <button onClick={onSkip} className={styles.skipButton}>
                Continue Without Captions
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return null;
}
