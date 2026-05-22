'use client';

import type { LiveValidationState } from './CameraCapture';

interface ValidationOverlayProps {
  liveValidation: LiveValidationState;
  imageWidth: number;
  imageHeight: number;
}

// ============================================================
// ValidationOverlay
// SVG overlay rendered on top of the camera viewfinder
// Shows bounding box, check indicators
// ============================================================

export function ValidationOverlay({
  liveValidation,
  imageWidth,
  imageHeight,
}: ValidationOverlayProps) {
  const { boundingBox, checks, allChecksPass, handDetected } = liveValidation;

  // Scale factor: the canvas is shown at display size but
  // bbox is in original video pixel coordinates
  // Use CSS percentage-based positioning

  const toPercent = (val: number, total: number) => `${(val / total) * 100}%`;

  return (
    <div className="absolute inset-0 pointer-events-none">
      {/* Bounding box overlay */}
      {handDetected && boundingBox && (
        <div
          className="absolute border-2 transition-all duration-100 rounded-lg"
          style={{
            left: toPercent(boundingBox.x, imageWidth),
            top: toPercent(boundingBox.y, imageHeight),
            width: toPercent(boundingBox.width, imageWidth),
            height: toPercent(boundingBox.height, imageHeight),
            borderColor: allChecksPass ? '#22c55e' : '#f59e0b',
            boxShadow: allChecksPass
              ? '0 0 16px rgba(34,197,94,0.4)'
              : '0 0 16px rgba(245,158,11,0.3)',
          }}
        >
          {/* Corner accents */}
          <div
            className="absolute -top-1 -left-1 w-4 h-4 border-t-2 border-l-2 rounded-tl"
            style={{ borderColor: allChecksPass ? '#22c55e' : '#f59e0b' }}
          />
          <div
            className="absolute -top-1 -right-1 w-4 h-4 border-t-2 border-r-2 rounded-tr"
            style={{ borderColor: allChecksPass ? '#22c55e' : '#f59e0b' }}
          />
          <div
            className="absolute -bottom-1 -left-1 w-4 h-4 border-b-2 border-l-2 rounded-bl"
            style={{ borderColor: allChecksPass ? '#22c55e' : '#f59e0b' }}
          />
          <div
            className="absolute -bottom-1 -right-1 w-4 h-4 border-b-2 border-r-2 rounded-br"
            style={{ borderColor: allChecksPass ? '#22c55e' : '#f59e0b' }}
          />
        </div>
      )}

      {/* No hand detected message */}
      {!handDetected && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="bg-black/60 backdrop-blur-sm rounded-xl px-5 py-3 text-center">
            <p className="text-white text-sm font-medium">
              👋 Show your palm to the camera
            </p>
          </div>
        </div>
      )}

      {/* Check indicators panel — bottom of viewfinder */}
      {handDetected && (
        <div className="absolute bottom-3 left-3 right-3">
          <div className="bg-black/70 backdrop-blur-sm rounded-xl p-3 grid grid-cols-4 gap-2">
            <CheckBadge
              label="Size"
              passed={checks.palmSize}
              detail={`${Math.round(liveValidation.palmCoverage * 100)}%`}
            />
            <CheckBadge
              label="One Hand"
              passed={checks.handCount}
              detail={`${liveValidation.handCount} hand`}
            />
            <CheckBadge
              label="Angle"
              passed={checks.palmAngle}
              detail={`${Math.round(liveValidation.palmTiltAngle)}°`}
            />
            <CheckBadge
              label="Hand"
              passed={checks.handedness}
              detail={liveValidation.handedness ?? '?'}
            />
          </div>
        </div>
      )}

      {/* All checks pass banner */}
      {allChecksPass && (
        <div className="absolute top-3 left-3 right-3">
          <div className="bg-green-500/90 backdrop-blur-sm rounded-lg px-4 py-2 text-center">
            <p className="text-white text-sm font-semibold">
              ✓ Perfect! Tap capture when ready
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Small check badge ───────────────────────────────────────

function CheckBadge({
  label,
  passed,
  detail,
}: {
  label: string;
  passed: boolean;
  detail: string;
}) {
  return (
    <div className="flex flex-col items-center gap-0.5">
      <div
        className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${
          passed ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
        }`}
      >
        {passed ? '✓' : '✗'}
      </div>
      <span className="text-white text-[10px] font-medium">{label}</span>
      <span className="text-slate-300 text-[9px]">{detail}</span>
    </div>
  );
}
