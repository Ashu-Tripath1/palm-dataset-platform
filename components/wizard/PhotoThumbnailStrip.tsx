'use client';

import { WIZARD_STEPS, buildStepKey } from '@/lib/submission';
import { useWizardStore } from '@/store/wizardStore';
import { CheckCircle2 } from 'lucide-react';


// ============================================================
// PhotoThumbnailStrip
// Horizontal scrollable strip of 12 step thumbnails
// ============================================================

export function PhotoThumbnailStrip() {
  const { photos, currentStep, setCurrentStep } = useWizardStore();

  return (
    <div className="w-full">
      <p className="text-xs text-slate-500 mb-2 font-medium uppercase tracking-wider">
        Your Photos ({Object.keys(photos).length} / 12)
      </p>
      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-slate-600">
        {WIZARD_STEPS.map((step, index) => {
          const key = buildStepKey(step);
          const photo = photos[key];
          const isCurrent = index === currentStep;
          const isCompleted = !!photo?.uploaded;
          const isCaptured = !!photo;

          return (
            <button
              key={key}
              onClick={() => setCurrentStep(index)}
              className={`
                flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 transition-all relative
                ${isCurrent
                  ? 'border-violet-500 shadow-lg shadow-violet-500/30 scale-105'
                  : isCompleted
                  ? 'border-green-500/70 opacity-90'
                  : isCaptured
                  ? 'border-amber-500/70'
                  : 'border-slate-600/40 bg-slate-800/50'}
              `}
              title={`Step ${index + 1}: ${step.hand} palm — ${step.cameraType} camera — BG ${step.backgroundNumber}`}
            >
              {photo?.thumbnailDataUrl ? (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={photo.thumbnailDataUrl}
                    alt={`Step ${index + 1}`}
                    className="w-full h-full object-cover"
                  />
                  {isCompleted && (
                    <div className="absolute top-0.5 right-0.5 bg-green-500 rounded-full p-0.5">
                      <CheckCircle2 className="h-2.5 w-2.5 text-white" />
                    </div>
                  )}
                </>
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center">
                  <span className="text-slate-500 text-[10px] font-medium">
                    {index + 1}
                  </span>
                  <span className="text-[8px] text-slate-600 mt-0.5">
                    {step.hand === 'RIGHT' ? 'R' : 'L'}
                    {step.cameraType === 'BACK' ? 'B' : 'F'}
                    {step.backgroundNumber}
                  </span>
                  {isCurrent && (
                    <div className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-4 h-0.5 rounded-full bg-violet-500" />
                  )}
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
