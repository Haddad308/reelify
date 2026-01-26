'use client';

import React, { useState, useEffect } from 'react';
import { useReelEditorStore } from '@/lib/store/useReelEditorStore';
import styles from './TranscriptionEditor.module.css';

export function TranscriptionEditor() {
  const { captions, currentClip, setCaptions, trimPoints } = useReelEditorStore();
  const [transcriptionText, setTranscriptionText] = useState('');
  const [isEditing, setIsEditing] = useState(false);

  // Build full transcription text from visible captions only (within trim range)
  useEffect(() => {
    // Don't update text if user is currently editing
    if (isEditing) return;

    if (captions.length > 0) {
      // Filter captions within trim range
      const visibleCaptions = captions
        .filter(caption => caption.isVisible)
        .sort((a, b) => a.startTime - b.startTime);
      
      const fullText = visibleCaptions
        .map(caption => caption.text)
        .join(' ');
      
      setTranscriptionText(fullText);
    } else if (currentClip?.transcription) {
      // Filter original transcription segments within trim range
      const visibleSegments = currentClip.transcription.segments
        .filter(seg => seg.start >= trimPoints.startTime && seg.end <= trimPoints.endTime)
        .sort((a, b) => a.start - b.start);
      
      const fullText = visibleSegments
        .map(seg => seg.text)
        .join(' ');
      
      setTranscriptionText(fullText);
    }
  }, [captions, currentClip, trimPoints.startTime, trimPoints.endTime, isEditing]);

  const handleSave = () => {
    if (!transcriptionText.trim()) {
      alert('Transcription cannot be empty');
      return;
    }

    // Detect language from text
    const detectLanguage = (text: string): 'ar' | 'en' => {
      const arabicRegex = /[\u0600-\u06FF]/;
      return arabicRegex.test(text) ? 'ar' : 'en';
    };

    const detectedLanguage = detectLanguage(transcriptionText);

    // Split text into sentences or by punctuation
    const sentences = transcriptionText
      .split(/([.!?،؛]+)/)
      .filter(s => s.trim().length > 0)
      .reduce((acc: string[], curr, idx, arr) => {
        if (curr.match(/[.!?،؛]+/) && acc.length > 0) {
          acc[acc.length - 1] += curr;
        } else if (!curr.match(/[.!?،؛]+/)) {
          acc.push(curr.trim());
        }
        return acc;
      }, []);

    // Calculate timing based on TRIM POINTS (not full video duration)
    const totalDuration = trimPoints.endTime - trimPoints.startTime;
    const segmentDuration = totalDuration / Math.max(sentences.length, 1);

    // Preserve existing caption styles if available
    const existingStyle = captions.length > 0 ? captions[0].style : {
      fontSize: 48,
      fontFamily: 'Arial',
      color: '#FFFFFF',
      backgroundColor: 'rgba(0, 0, 0, 0.7)',
      textAlign: 'center' as const,
      padding: { top: 10, right: 20, bottom: 10, left: 20 },
    };

    const existingPosition = captions.length > 0 ? captions[0].position : { x: 540, y: 1500 };

    // Create new captions from edited text within trim range
    const newCaptions = sentences.map((text, index) => {
      const startTime = trimPoints.startTime + (index * segmentDuration);
      const endTime = startTime + segmentDuration;

      return {
        id: `caption-${index}`,
        text: text.trim(),
        startTime,
        endTime,
        position: existingPosition, // Preserve position
        style: existingStyle, // Preserve style
        isVisible: true,
        language: detectedLanguage, // Use detected language
      };
    });

    setCaptions(newCaptions);
    setIsEditing(false);
  };

  const handleCancel = () => {
    // Restore original text (only visible captions)
    const visibleCaptions = captions
      .filter(caption => caption.isVisible)
      .sort((a, b) => a.startTime - b.startTime);
    
    const fullText = visibleCaptions
      .map(caption => caption.text)
      .join(' ');
    
    setTranscriptionText(fullText);
    setIsEditing(false);
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h3 className={styles.title}>Full Transcription</h3>
        {!isEditing ? (
          <button onClick={() => setIsEditing(true)} className={styles.editButton}>
            Edit Text
          </button>
        ) : (
          <div className={styles.buttonGroup}>
            <button onClick={handleSave} className={styles.saveButton}>
              Save
            </button>
            <button onClick={handleCancel} className={styles.cancelButton}>
              Cancel
            </button>
          </div>
        )}
      </div>

      <div className={styles.textBoxContainer}>
        {isEditing ? (
          <textarea
            value={transcriptionText}
            onChange={(e) => setTranscriptionText(e.target.value)}
            className={styles.textarea}
            placeholder="Enter your transcription here... (Supports Arabic and English)"
            rows={10}
            dir="auto"
          />
        ) : (
          <div className={styles.textDisplay} dir="auto">
            {transcriptionText || 'No transcription available. Click "Edit Text" to add one.'}
          </div>
        )}
      </div>

      <div className={styles.info}>
        <p className={styles.infoText}>
          {captions.filter(c => c.isVisible).length} visible segments • {transcriptionText.split(' ').filter(w => w.length > 0).length} words
          {captions.length > 0 && captions[0].language && (
            <span> • Language: {captions[0].language === 'ar' ? 'Arabic' : 'English'}</span>
          )}
        </p>
        <p className={styles.infoText} style={{ marginTop: '4px', fontSize: '11px', color: '#666' }}>
          Trim range: {trimPoints.startTime.toFixed(1)}s - {trimPoints.endTime.toFixed(1)}s
        </p>
      </div>
    </div>
  );
}
