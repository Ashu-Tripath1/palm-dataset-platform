import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { WizardStep } from '@/lib/submission';

// ============================================================
// Captured Photo Data (stored in state + localStorage)
// ============================================================

export interface CapturedPhoto {
  stepKey: string; // e.g. "RIGHT_BACK_1"
  hand: 'LEFT' | 'RIGHT';
  cameraType: 'FRONT' | 'BACK';
  backgroundNumber: 1 | 2 | 3;
  // Data URL for thumbnail preview (compressed)
  thumbnailDataUrl: string;
  // The actual file for upload (stored as data URL, converted before upload)
  imageDataUrl: string;
  // Upload state
  uploadedPhotoId?: string;
  uploaded: boolean;
  uploadError?: string;
}

// ============================================================
// Participant Profile Data (stored before API call)
// ============================================================

export interface ParticipantProfile {
  age: number;
  gender: 'MALE' | 'FEMALE' | 'OTHER' | 'PREFER_NOT_TO_SAY';
  profession: string;
  professionCategory?: string;
  country: string;
  email?: string;
  consentGiven: boolean;
}

// ============================================================
// Wizard Store State
// ============================================================

export interface WizardState {
  // Participant data (set after profile form submission)
  participantId: string | null;
  profile: ParticipantProfile | null;

  // Wizard navigation
  currentStep: number; // 0-11

  // Photos captured (keyed by stepKey)
  photos: Record<string, CapturedPhoto>;

  // Submission state
  submissionComplete: boolean;
  referenceCode: string | null;

  // UI state (not persisted)
  isUploading: boolean;
  uploadProgress: number; // 0-100

  // Actions
  setParticipantId: (id: string) => void;
  setProfile: (profile: ParticipantProfile) => void;
  setCurrentStep: (step: number) => void;
  addPhoto: (photo: CapturedPhoto) => void;
  removePhoto: (stepKey: string) => void;
  markPhotoUploaded: (stepKey: string, photoId: string) => void;
  markPhotoUploadError: (stepKey: string, error: string) => void;
  setSubmissionComplete: (referenceCode: string) => void;
  setIsUploading: (uploading: boolean) => void;
  setUploadProgress: (progress: number) => void;
  resetWizard: () => void;

  // Selectors
  getPhotoCount: () => number;
  getUploadedCount: () => number;
  getAllPhotosUploaded: () => boolean;
  hasPhoto: (stepKey: string) => boolean;
  getPhoto: (stepKey: string) => CapturedPhoto | undefined;
}

// ============================================================
// Initial State
// ============================================================

const initialState: Omit<
  WizardState,
  | 'setParticipantId'
  | 'setProfile'
  | 'setCurrentStep'
  | 'addPhoto'
  | 'removePhoto'
  | 'markPhotoUploaded'
  | 'markPhotoUploadError'
  | 'setSubmissionComplete'
  | 'setIsUploading'
  | 'setUploadProgress'
  | 'resetWizard'
  | 'getPhotoCount'
  | 'getUploadedCount'
  | 'getAllPhotosUploaded'
  | 'hasPhoto'
  | 'getPhoto'
> = {
  participantId: null,
  profile: null,
  currentStep: 0,
  photos: {},
  submissionComplete: false,
  referenceCode: null,
  isUploading: false,
  uploadProgress: 0,
};

// ============================================================
// Zustand Store with localStorage persistence
// ============================================================

export const useWizardStore = create<WizardState>()(
  persist(
    (set, get) => ({
      ...initialState,

      setParticipantId: (id) => set({ participantId: id }),

      setProfile: (profile) => set({ profile }),

      setCurrentStep: (step) =>
        set({ currentStep: Math.max(0, Math.min(11, step)) }),

      addPhoto: (photo) =>
        set((state) => ({
          photos: { ...state.photos, [photo.stepKey]: photo },
        })),

      removePhoto: (stepKey) =>
        set((state) => {
          const { [stepKey]: _removed, ...rest } = state.photos;
          return { photos: rest };
        }),

      markPhotoUploaded: (stepKey, photoId) =>
        set((state) => ({
          photos: {
            ...state.photos,
            [stepKey]: {
              ...state.photos[stepKey],
              uploaded: true,
              uploadedPhotoId: photoId,
              uploadError: undefined,
            },
          },
        })),

      markPhotoUploadError: (stepKey, error) =>
        set((state) => ({
          photos: {
            ...state.photos,
            [stepKey]: {
              ...state.photos[stepKey],
              uploaded: false,
              uploadError: error,
            },
          },
        })),

      setSubmissionComplete: (referenceCode) =>
        set({ submissionComplete: true, referenceCode }),

      setIsUploading: (isUploading) => set({ isUploading }),

      setUploadProgress: (uploadProgress) => set({ uploadProgress }),

      resetWizard: () => set({ ...initialState }),

      // Selectors
      getPhotoCount: () => Object.keys(get().photos).length,

      getUploadedCount: () =>
        Object.values(get().photos).filter((p) => p.uploaded).length,

      getAllPhotosUploaded: () => {
        const photos = get().photos;
        return Object.keys(photos).length === 12 &&
          Object.values(photos).every((p) => p.uploaded);
      },

      hasPhoto: (stepKey) => stepKey in get().photos,

      getPhoto: (stepKey) => get().photos[stepKey],
    }),
    {
      name: 'palm-wizard-state',
      storage: createJSONStorage(() => localStorage),
      // Persist everything except transient UI state
      partialize: (state) => ({
        participantId: state.participantId,
        profile: state.profile,
        currentStep: state.currentStep,
        photos: state.photos,
        submissionComplete: state.submissionComplete,
        referenceCode: state.referenceCode,
      }),
    },
  ),
);
