'use client';

import { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useWizardStore } from '@/store/wizardStore';
import { MediaPipeProvider } from '@/components/camera/MediaPipeProvider';
import { CameraCapture } from '@/components/camera/CameraCapture';
import { ValidationFeedback } from '@/components/wizard/ValidationFeedback';
import { StepIndicator } from '@/components/wizard/StepIndicator';
import { PhotoThumbnailStrip } from '@/components/wizard/PhotoThumbnailStrip';
import { WIZARD_STEPS, buildStepKey } from '@/lib/submission';
import type { CapturedPhoto } from '@/store/wizardStore';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { ChevronRight, ChevronLeft, CheckCircle2 } from 'lucide-react';
import compressImage from 'browser-image-compression';

// ============================================================
// PhotoWizard — orchestrates all 12 capture steps
// ============================================================

type WizardPhase = 'capture' | 'preview' | 'uploading' | 'done';

export function PhotoWizard() {
  const router = useRouter();
  const {
    participantId,
    currentStep,
    photos,
    setCurrentStep,
    addPhoto,
    markPhotoUploaded,
    removePhoto,
  } = useWizardStore();


  const [phase, setPhase] = useState<WizardPhase>('capture');
  const [capturedDataUrl, setCapturedDataUrl] = useState<string | null>(null);
  // thumbnailDataUrl is set on capture and reset on retake (stored in wizardStore via addPhoto)
  const [, setCapturedThumbnail] = useState<string | null>(null);

  const [validationPassed, setValidationPassed] = useState<boolean | null>(null);
  const [failedChecks, setFailedChecks] = useState<string[]>([]);
  const [serverErrors, setServerErrors] = useState<string[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [sessionExpiredOpen, setSessionExpiredOpen] = useState(false);

  const step = WIZARD_STEPS[currentStep];
  const stepKey = buildStepKey(step);
  const existingPhoto = photos[stepKey];

  // Redirect to profile if no participant ID
  useEffect(() => {
    if (!participantId) {
      router.push('/participate/profile');
    }
  }, [participantId, router]);

  // If this step already has a photo, show it
  useEffect(() => {
    if (existingPhoto) {
      setCapturedDataUrl(existingPhoto.imageDataUrl);
      setCapturedThumbnail(existingPhoto.thumbnailDataUrl);
      setValidationPassed(existingPhoto.uploaded);
      setPhase('preview');
    } else {
      setCapturedDataUrl(null);
      setCapturedThumbnail(null);
      setValidationPassed(null);
      setPhase('capture');
    }
  }, [stepKey, existingPhoto]);

  // ─── Upload photo to server ──────────────────────────────

  const uploadPhoto = useCallback(
    async (dataUrl: string, retryCount = 0): Promise<boolean> => {
      if (!participantId) return false;

      setIsUploading(true);
      setServerErrors([]);

      try {
        // Convert data URL to Blob
        const response = await fetch(dataUrl);
        const blob = await response.blob();

        // Client-side EXIF stripping via piexifjs (import dynamically)
        let processedBlob = blob;
        try {
          const piexif = (await import('piexifjs')).default;
          const arrayBuffer = await blob.arrayBuffer();
          const uint8Array = new Uint8Array(arrayBuffer);
          let binaryStr = '';
          for (let i = 0; i < uint8Array.byteLength; i++) {
            binaryStr += String.fromCharCode(uint8Array[i]);
          }
          const stripped = piexif.remove(binaryStr);
          const strippedBytes = new Uint8Array(stripped.length);
          for (let i = 0; i < stripped.length; i++) {
            strippedBytes[i] = stripped.charCodeAt(i);
          }
          processedBlob = new Blob([strippedBytes], { type: 'image/jpeg' });
        } catch {
          // piexifjs failure is non-critical — server will strip too
        }

        // Client-side compression (if > 3MB, compress to ~2MB)
        if (processedBlob.size > 3 * 1024 * 1024) {
          const file = new File([processedBlob], 'palm.jpg', { type: 'image/jpeg' });
          const compressed = await compressImage(file, {
            maxSizeMB: 3,
            maxWidthOrHeight: 2048,
            useWebWorker: true,
          });
          processedBlob = compressed;
        }

        // Build form data
        const formData = new FormData();
        formData.append('image', processedBlob, 'palm.jpg');
        formData.append('participantId', participantId);
        formData.append('hand', step.hand);
        formData.append('cameraType', step.cameraType);
        formData.append('backgroundNumber', String(step.backgroundNumber));

        const uploadResponse = await fetch('/api/photos/upload', {
          method: 'POST',
          body: formData,
          credentials: 'include',
        });

        const result = await uploadResponse.json() as {
          photoId?: string;
          validationPassed?: boolean;
          errorMessages?: string[];
          error?: string;
          code?: string;
        };

        if (!uploadResponse.ok) {
          if (uploadResponse.status === 401 && result.code === 'SESSION_EXPIRED') {
            setSessionExpiredOpen(true);
            return false;
          }

          if (result.errorMessages && result.errorMessages.length > 0) {
            setServerErrors(result.errorMessages);
            setValidationPassed(false);
            setPhase('preview');
            return false;
          }

          // Retry on network errors (up to 3 times)
          if (retryCount < 3 && uploadResponse.status >= 500) {
            const delay = Math.pow(2, retryCount) * 1000; // Exponential backoff
            await new Promise((r) => setTimeout(r, delay));
            return uploadPhoto(dataUrl, retryCount + 1);
          }

          setServerErrors([result.error ?? 'Upload failed. Please try again.']);
          setValidationPassed(false);
          setPhase('preview');
          return false;
        }

        if (result.validationPassed && result.photoId) {
          markPhotoUploaded(stepKey, result.photoId);
          setValidationPassed(true);
          return true;
        } else {
          setServerErrors(result.errorMessages ?? ['Photo failed server validation.']);
          setValidationPassed(false);
          return false;
        }
      } catch {

        if (retryCount < 3) {
          const delay = Math.pow(2, retryCount) * 1000;
          await new Promise((r) => setTimeout(r, delay));
          return uploadPhoto(dataUrl, retryCount + 1);
        }

        setServerErrors(['Network error. Please check your connection and try again.']);
        setValidationPassed(false);
        setPhase('preview');
        return false;
      } finally {
        setIsUploading(false);
      }
    },
    [participantId, step, stepKey, markPhotoUploaded],
  );

  // ─── Handle camera capture ──────────────────────────────

  const handleCapture = useCallback(
    async (imageDataUrl: string, thumbnailDataUrl: string) => {
      setCapturedDataUrl(imageDataUrl);
      setCapturedThumbnail(thumbnailDataUrl);
      setPhase('preview');

      // Store in wizard state immediately (before upload)
      const capturedPhoto: CapturedPhoto = {
        stepKey,
        hand: step.hand,
        cameraType: step.cameraType,
        backgroundNumber: step.backgroundNumber,
        thumbnailDataUrl,
        imageDataUrl,
        uploaded: false,
      };
      addPhoto(capturedPhoto);

      // Auto-upload
      await uploadPhoto(imageDataUrl);
    },
    [step, stepKey, addPhoto, uploadPhoto],
  );

  // ─── Handle gallery file ─────────────────────────────────

  const handleGalleryUpload = useCallback(
    async (file: File) => {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      // Create thumbnail
      const img = new Image();
      img.src = dataUrl;
      await new Promise<void>((res) => (img.onload = () => res()));
      const thumbCanvas = document.createElement('canvas');
      const ratio = img.height / img.width;
      thumbCanvas.width = 400;
      thumbCanvas.height = 400 * ratio;
      thumbCanvas.getContext('2d')!.drawImage(img, 0, 0, 400, 400 * ratio);
      const thumbnailDataUrl = thumbCanvas.toDataURL('image/jpeg', 0.7);

      await handleCapture(dataUrl, thumbnailDataUrl);
    },
    [handleCapture],
  );

  // ─── Accept photo and advance ────────────────────────────

  const handleAccept = useCallback(() => {
    if (currentStep < 11) {
      setCurrentStep(currentStep + 1);
    } else {
      router.push('/participate/review');
    }
  }, [currentStep, setCurrentStep, router]);

  // ─── Retake photo ────────────────────────────────────────

  const handleRetake = useCallback(() => {
    removePhoto(stepKey);
    setCapturedDataUrl(null);
    setCapturedThumbnail(null);
    setValidationPassed(null);
    setServerErrors([]);
    setFailedChecks([]);
    setPhase('capture');
  }, [stepKey, removePhoto]);

  if (!step) return null;

  return (
    <MediaPipeProvider>
      <div className="space-y-6">
        {/* Step indicator */}
        <StepIndicator currentStep={currentStep} />

        {/* Capture or preview */}
        {phase === 'capture' && (
          <CameraCapture
            expectedHand={step.hand}
            cameraType={step.cameraType}
            onCapture={handleCapture}
            onGalleryUpload={handleGalleryUpload}
          />
        )}

        {(phase === 'preview' || phase === 'uploading') && capturedDataUrl && (
          <div className="space-y-4">
            {/* Preview image */}
            <div className="relative rounded-xl overflow-hidden aspect-[4/3] bg-black">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={capturedDataUrl}
                alt="Captured palm"
                className="w-full h-full object-cover"
              />
              {isUploading && (
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                  <div className="text-center text-white">
                    <div className="animate-spin h-8 w-8 border-2 border-white border-t-transparent rounded-full mx-auto mb-2" />
                    <p className="text-sm">Uploading & validating...</p>
                  </div>
                </div>
              )}
            </div>

            {/* Validation feedback */}
            {!isUploading && (
              <ValidationFeedback
                validationPassed={validationPassed ?? false}
                failedChecks={failedChecks}
                serverErrors={serverErrors}
                expectedHand={step.hand}
                onRetake={handleRetake}
                onAccept={handleAccept}
                isUploading={isUploading}
              />
            )}
          </div>
        )}

        {/* Navigation */}
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentStep(Math.max(0, currentStep - 1))}
            disabled={currentStep === 0}
            className="border-slate-600 text-slate-400 hover:bg-slate-800"
          >
            <ChevronLeft className="h-4 w-4" />
            Prev
          </Button>

          <div className="flex-1" />

          {validationPassed && (
            <Button
              size="sm"
              onClick={handleAccept}
              className="bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500"
            >
              {currentStep < 11 ? (
                <>
                  Next Step
                  <ChevronRight className="h-4 w-4 ml-1" />
                </>
              ) : (
                <>
                  Review All Photos
                  <CheckCircle2 className="h-4 w-4 ml-1" />
                </>
              )}
            </Button>
          )}
        </div>

        {/* Thumbnail strip */}
        <PhotoThumbnailStrip />

        {/* Session expired modal */}
        <Dialog open={sessionExpiredOpen} onOpenChange={setSessionExpiredOpen}>
          <DialogContent className="bg-slate-900 border-slate-700">
            <DialogHeader>
              <DialogTitle className="text-white">Session Expired</DialogTitle>
              <DialogDescription className="text-slate-400">
                Your session has expired. Your captured photos are saved in your browser.
                Please re-enter your details to continue uploading.
              </DialogDescription>
            </DialogHeader>
            <Button
              onClick={() => {
                setSessionExpiredOpen(false);
                router.push('/participate/profile');
              }}
              className="w-full bg-violet-600 hover:bg-violet-500"
            >
              Re-enter Details
            </Button>
          </DialogContent>
        </Dialog>
      </div>
    </MediaPipeProvider>
  );
}
