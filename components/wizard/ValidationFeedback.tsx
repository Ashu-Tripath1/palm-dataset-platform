'use client';

import { AlertCircle, RefreshCw, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';

// ============================================================
// Validation check messages
// ============================================================

const CHECK_MESSAGES = {
  palmSize: {
    fail: 'Your palm is too far from the camera. Move it closer until it fills at least half the frame.',
    pass: 'Palm size: OK',
  },
  handCount: {
    fail: 'Only one hand should be visible in the photo. Please remove any other hands from the frame.',
    pass: 'Single hand: OK',
  },
  palmAngle: {
    fail: 'Your palm is angled too much. Hold it flat and parallel to the camera.',
    pass: 'Palm angle: OK',
  },
  handedness: {
    fail: (expected: string) =>
      `This doesn't look like your ${expected.toLowerCase()} hand. Please check you're photographing the correct hand.`,
    pass: 'Correct hand: OK',
  },
  sharpness: {
    fail: 'The photo is too blurry. Hold your phone steady and ensure good lighting.',
    pass: 'Sharpness: OK',
  },
  brightness: {
    fail: 'The photo is too dark. Move to a well-lit area or turn on a light.',
    pass: 'Brightness: OK',
  },
  brightnessTooLight: {
    fail: 'The photo is overexposed. Avoid direct sunlight or very strong artificial lights.',
    pass: '',
  },
  magicBytes: {
    fail: 'Invalid file type. Please upload a JPEG or PNG photo.',
    pass: 'File type: OK',
  },
} as const;

// ============================================================
// Props
// ============================================================

interface ValidationFeedbackProps {
  validationPassed: boolean;
  failedChecks: string[];
  serverErrors?: string[];
  expectedHand: 'LEFT' | 'RIGHT';
  onRetake: () => void;
  onAccept: () => void;
  isUploading?: boolean;
}

export function ValidationFeedback({
  validationPassed,
  failedChecks,
  serverErrors,
  expectedHand,
  onRetake,
  onAccept,
  isUploading = false,
}: ValidationFeedbackProps) {
  const allErrors = [...serverErrors ?? []];

  // Generate human-readable error messages for each failed check
  for (const check of failedChecks) {
    if (check === 'handedness') {
      allErrors.push(CHECK_MESSAGES.handedness.fail(expectedHand));
    } else if (check in CHECK_MESSAGES) {
      allErrors.push(
        CHECK_MESSAGES[check as keyof typeof CHECK_MESSAGES].fail as string,
      );
    }
  }

  if (validationPassed) {
    return (
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2 p-3 bg-green-500/10 border border-green-500/30 rounded-lg">
          <CheckCircle2 className="h-5 w-5 text-green-400 flex-shrink-0" />
          <p className="text-green-300 text-sm font-medium">
            Photo looks great! Ready to use.
          </p>
        </div>

        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={onRetake}
            className="flex-1 border-slate-600 text-slate-300 hover:bg-slate-800"
            disabled={isUploading}
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Retake
          </Button>
          <Button
            onClick={onAccept}
            disabled={isUploading}
            className="flex-[2] bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500"
          >
            {isUploading ? (
              <>Uploading...</>
            ) : (
              <>
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Use This Photo →
              </>
            )}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="space-y-2">
        {allErrors.map((error, index) => (
          <Alert key={index} variant="destructive" className="bg-red-950/50 border-red-800">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-sm">{error}</AlertDescription>
          </Alert>
        ))}

        {allErrors.length === 0 && (
          <Alert variant="destructive" className="bg-red-950/50 border-red-800">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              This photo didn&apos;t pass validation. Please try again.
            </AlertDescription>
          </Alert>
        )}
      </div>

      <Button
        onClick={onRetake}
        className="w-full bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500"
      >
        <RefreshCw className="h-4 w-4 mr-2" />
        Retake Photo
      </Button>
    </div>
  );
}
