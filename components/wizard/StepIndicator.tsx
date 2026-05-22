'use client';

import { WIZARD_STEPS } from '@/lib/submission';
import { Progress } from '@/components/ui/progress';

interface StepIndicatorProps {
  currentStep: number; // 0-indexed
}

const HAND_COLORS = {
  RIGHT: 'from-violet-500 to-purple-600',
  LEFT: 'from-cyan-500 to-blue-600',
};

export function StepIndicator({ currentStep }: StepIndicatorProps) {
  const step = WIZARD_STEPS[currentStep];
  if (!step) return null;

  const progressPercent = ((currentStep + 1) / 12) * 100;

  const handLabel = step.hand === 'RIGHT' ? 'Right' : 'Left';
  const cameraLabel = step.cameraType === 'BACK' ? 'Back Camera' : 'Front (Selfie) Camera';

  const backgroundLabels: Record<1 | 2 | 3, string> = {
    1: 'Plain Light Background',
    2: 'Plain Dark Background',
    3: 'Natural / Outdoor Background',
  };

  return (
    <div className="space-y-4">
      {/* Step header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-slate-400 text-sm font-medium">
            Step {currentStep + 1} of 12
          </p>
          <h2 className={`text-xl font-bold bg-gradient-to-r ${HAND_COLORS[step.hand]} bg-clip-text text-transparent`}>
            {handLabel} Palm
          </h2>
        </div>
        <div className="text-right">
          <span className="text-3xl font-black text-slate-300">
            {currentStep + 1}
            <span className="text-slate-600 text-xl">/12</span>
          </span>
        </div>
      </div>

      {/* Progress bar */}
      <Progress
        value={progressPercent}
        className="h-2 bg-slate-700"
      />

      {/* Step details */}
      <div className="flex flex-wrap gap-2">
        <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-gradient-to-r ${HAND_COLORS[step.hand]} text-white`}>
          {handLabel} Hand
        </span>
        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-slate-700 text-slate-300">
          {cameraLabel}
        </span>
        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-slate-700/60 text-slate-400">
          {backgroundLabels[step.backgroundNumber as 1 | 2 | 3]}
        </span>
      </div>

      {/* Camera instruction */}
      <div className={`rounded-lg p-3 border text-sm ${
        step.cameraType === 'BACK'
          ? 'bg-violet-500/10 border-violet-500/30 text-violet-300'
          : 'bg-cyan-500/10 border-cyan-500/30 text-cyan-300'
      }`}>
        {step.cameraType === 'BACK'
          ? '📸 Use your phone\'s main rear camera. Hold your palm facing the camera.'
          : '🤳 Switch to your selfie (front) camera. Hold your palm facing the screen.'}
      </div>

      {/* Background instruction */}
      <div className="rounded-lg p-3 bg-slate-800/50 border border-slate-700/50 text-sm text-slate-400">
        <span className="text-slate-300 font-medium">Background: </span>
        {backgroundLabels[step.backgroundNumber as 1 | 2 | 3]}
        {step.backgroundNumber === 1 && ' — Place your hand against a white or light-colored wall or surface.'}
        {step.backgroundNumber === 2 && ' — Place your hand against a dark table, dark fabric, or black background.'}
        {step.backgroundNumber === 3 && ' — Any natural or outdoor background is fine — grass, pavement, sky.'}
      </div>
    </div>
  );
}
