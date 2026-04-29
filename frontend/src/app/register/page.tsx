'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowLeft,
  ArrowRight,
  Camera,
  CheckCircle,
  CreditCard,
  Eye,
  EyeOff,
  Globe,
  Loader2,
  Lock,
  Mail,
  Phone,
  ScanFace,
  ShieldCheck,
  Upload,
  User,
} from 'lucide-react';
import api from '@/lib/api';
import { useAuthStore } from '@/store/authStore';

const optionalDataUrlSchema = z.union([z.literal(''), z.string().startsWith('data:image/', 'Please upload an image file')]);

const schema = z
  .object({
    firstName: z.string().min(2, 'First name is too short'),
    lastName: z.string().min(2, 'Last name is too short'),
    email: z.string().email('Enter a valid email address'),
    idNumber: z.string().optional(),
    idDocumentImage: optionalDataUrlSchema,
    faceVerificationImage: optionalDataUrlSchema,
    phone: z.string().min(9, 'Enter a valid phone number'),
    country: z.string().min(2, 'Select your country'),
    password: z.string().min(6, 'Password must be at least 6 characters'),
    confirmPassword: z.string().min(6, 'Confirm your password'),
    referralCode: z.string().optional(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Passwords do not match',
  });

type FormData = z.infer<typeof schema>;

const COUNTRIES = [
  { code: 'KE', name: 'Kenya', dialCode: '+254' },
  { code: 'UG', name: 'Uganda', dialCode: '+256' },
  { code: 'TZ', name: 'Tanzania', dialCode: '+255' },
  { code: 'ET', name: 'Ethiopia', dialCode: '+251' },
  { code: 'GH', name: 'Ghana', dialCode: '+233' },
  { code: 'NG', name: 'Nigeria', dialCode: '+234' },
];

const STEPS = [
  {
    number: 1,
    title: 'Personal Details',
    description: 'Name, email and phone details',
    fields: ['firstName', 'lastName', 'email', 'country', 'phone'] as const,
  },
  {
    number: 2,
    title: 'ID Verification',
    description: 'Upload your government-issued ID',
    fields: ['idNumber', 'idDocumentImage'] as const,
  },
  {
    number: 3,
    title: 'Face Verification',
    description: 'Capture a live selfie that matches your ID',
    fields: ['faceVerificationImage'] as const,
  },
  {
    number: 4,
    title: 'Secure Your Account',
    description: 'Create your password and finish',
    fields: ['password', 'confirmPassword', 'referralCode'] as const,
  },
];

const toDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });

const stripKnownDialCode = (phoneValue: string) => {
  const trimmed = phoneValue.trim();
  const matchedCountry = COUNTRIES.find((entry) => trimmed.startsWith(entry.dialCode));
  if (!matchedCountry) return trimmed.replace(/\s+/g, '');
  return trimmed.slice(matchedCountry.dialCode.length).replace(/\s+/g, '');
};

const getApiErrorMessage = (err: any, fallback: string) => {
  const message = err?.response?.data?.message || err?.response?.data;
  return typeof message === 'string' && message.trim() ? message : fallback;
};

function RegisterPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { setUser, setToken } = useAuthStore();
  const [currentStep, setCurrentStep] = useState(0);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [idPreview, setIdPreview] = useState('');
  const [facePreview, setFacePreview] = useState('');
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [startingCamera, setStartingCamera] = useState(false);
  const [faceAligned, setFaceAligned] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    trigger,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      idNumber: '',
      idDocumentImage: '',
      faceVerificationImage: '',
      referralCode: searchParams.get('ref') || '',
    },
  });

  const firstName = watch('firstName');
  const email = watch('email');
  const phone = watch('phone');
  const country = watch('country');
  const password = watch('password');
  const selectedCountryConfig = COUNTRIES.find((entry) => entry.code === country);

  useEffect(() => {
    if (!country) return;

    const dialCode = selectedCountryConfig?.dialCode;
    if (!dialCode) return;

    const currentPhone = phone || '';
    const localPart = stripKnownDialCode(currentPhone);
    const nextPhone = `${dialCode}${localPart}`;

    if (currentPhone !== nextPhone) {
      setValue('phone', nextPhone, { shouldValidate: true, shouldDirty: true });
    }
  }, [country, phone, selectedCountryConfig, setValue]);

  const stopCamera = () => {
    if (streamRef.current) {
      for (const track of streamRef.current.getTracks()) {
        track.stop();
      }
      streamRef.current = null;
    }
    setCameraReady(false);
  };

  const startCamera = async () => {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setCameraError('This device does not support live camera capture.');
      return;
    }

    setStartingCamera(true);
    setCameraError('');

    try {
      stopCamera();
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCameraReady(true);
    } catch {
      setCameraError('Camera access was denied. Allow camera access or use a supported browser.');
    } finally {
      setStartingCamera(false);
    }
  };

  useEffect(() => {
    if (currentStep === 2 && !facePreview) {
      startCamera();
    } else if (currentStep !== 2) {
      stopCamera();
    }

    return () => {
      stopCamera();
    };
  }, [currentStep, facePreview]);

  const handleImageUpload = async (
    event: React.ChangeEvent<HTMLInputElement>,
    field: 'idDocumentImage' | 'faceVerificationImage',
    setPreview: (value: string) => void
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const dataUrl = await toDataUrl(file);
      setValue(field, dataUrl, { shouldValidate: true });
      setPreview(dataUrl);
      if (field === 'faceVerificationImage') {
        setFaceAligned(true);
      }
    } catch {
      toast.error('Failed to process image');
    }
  };

  const captureFace = () => {
    if (!videoRef.current || !canvasRef.current) {
      toast.error('Camera is not ready yet');
      return;
    }

    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth || 720;
    canvas.height = video.videoHeight || 960;

    const context = canvas.getContext('2d');
    if (!context) {
      toast.error('Could not access the camera frame');
      return;
    }

    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    const image = canvas.toDataURL('image/jpeg', 0.92);
    setValue('faceVerificationImage', image, { shouldValidate: true });
    setFacePreview(image);
    setFaceAligned(true);
    stopCamera();
    toast.success('Live face capture saved');
  };

  const resetFaceCapture = () => {
    setFacePreview('');
    setFaceAligned(false);
    setValue('faceVerificationImage', '', { shouldValidate: true });
    startCamera();
  };

  const goToNextStep = async () => {
    const valid = await trigger([...STEPS[currentStep].fields]);
    if (!valid) return;

    setCurrentStep((prev) => Math.min(prev + 1, STEPS.length - 1));
  };

  const onSubmit = async (data: FormData) => {
    const valid = await trigger([...STEPS[3].fields]);
    if (!valid) return;

    setIsLoading(true);
    try {
      const { confirmPassword, ...payload } = data;
      const res = await api.post('/auth/register', payload);
      setToken(res.data.token);
      setUser(res.data.user);
      toast.success('Account created! Welcome to CashFlowConnect');
      router.push('/dashboard');
    } catch (err: any) {
      toast.error(getApiErrorMessage(err, 'Registration failed'));
    } finally {
      setIsLoading(false);
    }
  };

  const step = STEPS[currentStep];
  const progressPercentage = ((currentStep + 1) / STEPS.length) * 100;

  return (
    <div className="relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top,_rgba(34,197,94,0.18),_transparent_24%),radial-gradient(circle_at_bottom_right,_rgba(14,165,233,0.12),_transparent_26%),linear-gradient(180deg,_#020617_0%,_#081120_48%,_#0f172a_100%)] px-4 py-8 md:px-6 md:py-12">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <motion.div
          className="absolute left-[8%] top-20 h-40 w-40 rounded-full bg-green-500/10 blur-3xl"
          animate={{ y: [0, -18, 0], opacity: [0.35, 0.5, 0.35] }}
          transition={{ duration: 7, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          className="absolute right-[10%] top-32 h-56 w-56 rounded-full bg-cyan-400/10 blur-3xl"
          animate={{ y: [0, 20, 0], x: [0, -14, 0] }}
          transition={{ duration: 9, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          className="absolute bottom-10 left-1/2 h-64 w-64 -translate-x-1/2 rounded-full bg-emerald-500/10 blur-3xl"
          animate={{ scale: [1, 1.12, 1] }}
          transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
        />
        <div className="absolute inset-0 opacity-[0.14]" style={{ backgroundImage: 'linear-gradient(rgba(148,163,184,0.14) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,184,0.14) 1px, transparent 1px)', backgroundSize: '42px 42px' }} />
      </div>

      <div className="relative mx-auto w-full max-w-6xl">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease: 'easeOut' }}
          className="mb-6 text-center md:mb-8"
        >
          <motion.div
            initial={{ scale: 0.92, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.12, duration: 0.45 }}
            className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-[22px] bg-gradient-to-br from-green-400 to-emerald-500 text-2xl font-black text-slate-950 shadow-[0_20px_60px_rgba(34,197,94,0.35)]"
          >
            C
          </motion.div>
          <h1 className="mx-auto max-w-3xl text-4xl font-black tracking-tight text-white md:text-5xl">
            Create your
            <span className="bg-gradient-to-r from-green-300 via-emerald-400 to-cyan-300 bg-clip-text text-transparent"> CashFlowConnect account</span>
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-slate-400 md:text-base">
            A simple 4-step signup flow.
          </p>
        </motion.div>

        <div className="grid gap-6 lg:grid-cols-[300px_minmax(0,1fr)] xl:gap-8">
          <motion.aside
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.45, ease: 'easeOut', delay: 0.08 }}
            className="card h-fit space-y-5 border-white/10 bg-white/[0.04] p-5 shadow-[0_20px_70px_rgba(2,6,23,0.45)] backdrop-blur-xl"
          >
            <div>
              <div className="mb-4 flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-green-300">Step {step.number}/4</p>
                  <h2 className="mt-2 text-2xl font-bold text-white">{step.title}</h2>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-right backdrop-blur">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-400">Progress</p>
                  <p className="text-lg font-bold text-white">{Math.round(progressPercentage)}%</p>
                </div>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-slate-800/90">
                <motion.div
                  className="h-full rounded-full bg-gradient-to-r from-green-400 via-emerald-400 to-cyan-400"
                  animate={{ width: `${progressPercentage}%` }}
                  transition={{ duration: 0.5, ease: 'easeInOut' }}
                />
              </div>
              <p className="mt-4 text-sm leading-6 text-slate-300">{step.description}</p>
            </div>

            <div className="space-y-3">
              {STEPS.map((entry, index) => {
                const active = index === currentStep;
                const completed = index < currentStep;

                return (
                  <motion.div
                    key={entry.number}
                    initial={{ opacity: 0, y: 14 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.35, delay: 0.06 * index }}
                    className={`rounded-2xl border p-4 transition-all ${
                      active
                        ? 'border-green-400/50 bg-gradient-to-br from-emerald-500/12 to-cyan-400/8 shadow-[0_12px_30px_rgba(16,185,129,0.14)]'
                        : completed
                          ? 'border-white/10 bg-white/[0.04]'
                          : 'border-white/10 bg-slate-950/45'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={`mt-0.5 flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold transition-all ${
                          completed
                            ? 'bg-gradient-to-br from-green-300 to-emerald-400 text-slate-950'
                            : active
                              ? 'bg-white text-slate-950 shadow-[0_0_20px_rgba(255,255,255,0.12)]'
                              : 'bg-slate-800/90 text-slate-400'
                        }`}
                      >
                        {completed ? <CheckCircle size={16} /> : entry.number}
                      </div>
                      <div>
                        <p className="font-semibold text-white">{entry.title}</p>
                        <p className="mt-1 text-xs leading-5 text-slate-400">{entry.description}</p>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>

            <div className="rounded-[24px] border border-white/10 bg-gradient-to-br from-slate-900/80 to-slate-950/80 p-4 text-sm text-slate-300">
              <p className="font-semibold text-white">Verification notes</p>
              <p className="mt-2 leading-6 text-slate-400">
                Use a clear ID photo, then capture a live selfie in good lighting with your face centered inside the guide.
              </p>
            </div>
          </motion.aside>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: 'easeOut', delay: 0.14 }}
            className="card overflow-hidden border-white/10 bg-white/[0.04] p-0 shadow-[0_24px_80px_rgba(2,6,23,0.5)] backdrop-blur-xl"
          >
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-0">
              <input type="hidden" {...register('idDocumentImage')} />
              <input type="hidden" {...register('faceVerificationImage')} />

              <div className="relative border-b border-white/10 bg-gradient-to-r from-white/[0.05] to-transparent px-6 py-6 md:px-8">
                <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_right,_rgba(34,197,94,0.12),_transparent_28%)]" />
                <div className="flex items-center gap-3">
                  <motion.div
                    key={currentStep}
                    initial={{ scale: 0.85, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ duration: 0.3 }}
                    className="flex h-14 w-14 items-center justify-center rounded-[20px] bg-gradient-to-br from-white/10 to-white/[0.04] text-green-300 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"
                  >
                    {currentStep === 0 && <User size={22} />}
                    {currentStep === 1 && <CreditCard size={22} />}
                    {currentStep === 2 && <ScanFace size={22} />}
                    {currentStep === 3 && <ShieldCheck size={22} />}
                  </motion.div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.24em] text-green-300">Step {step.number} of 4</p>
                    <h3 className="text-2xl font-bold text-white">{step.title}</h3>
                    <p className="mt-1 text-sm text-slate-400">Move through each section with instant validation and smoother transitions.</p>
                  </div>
                </div>
              </div>

              <div className="px-6 py-6 md:px-8 md:py-8">
                <AnimatePresence mode="wait">
                  {currentStep === 0 && (
                    <motion.div
                      key="step-0"
                      initial={{ opacity: 0, y: 24 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -16 }}
                      transition={{ duration: 0.3, ease: 'easeOut' }}
                      className="space-y-6"
                    >
                    <div className="grid gap-4 md:grid-cols-2">
                      <div>
                        <label className="mb-1.5 flex items-center gap-2 text-sm font-medium text-slate-300">
                          <User size={14} /> First Name
                        </label>
                        <input {...register('firstName')} className="input" />
                        {errors.firstName && <p className="mt-1 text-xs text-red-400">{errors.firstName.message}</p>}
                      </div>

                      <div>
                        <label className="mb-1.5 flex items-center gap-2 text-sm font-medium text-slate-300">
                          <User size={14} /> Last Name
                        </label>
                        <input {...register('lastName')} className="input" />
                        {errors.lastName && <p className="mt-1 text-xs text-red-400">{errors.lastName.message}</p>}
                      </div>
                    </div>

                    <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_220px]">
                      <div>
                        <label className="mb-1.5 flex items-center gap-2 text-sm font-medium text-slate-300">
                          <Mail size={14} /> Email Address
                        </label>
                        <input {...register('email')} className="input" />
                        {errors.email && <p className="mt-1 text-xs text-red-400">{errors.email.message}</p>}
                      </div>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                      <div>
                        <label className="mb-1.5 flex items-center gap-2 text-sm font-medium text-slate-300">
                          <Globe size={14} /> Country
                        </label>
                        <select {...register('country')} className="input">
                          <option value="">Select your country</option>
                          {COUNTRIES.map((entry) => (
                            <option key={entry.code} value={entry.code}>
                              {entry.name}
                            </option>
                          ))}
                        </select>
                        {errors.country && <p className="mt-1 text-xs text-red-400">{errors.country.message}</p>}
                      </div>

                      <div>
                        <label className="mb-1.5 flex items-center gap-2 text-sm font-medium text-slate-300">
                          <Phone size={14} /> Phone Number
                        </label>
                        <input {...register('phone')} className="input" />
                        {errors.phone && <p className="mt-1 text-xs text-red-400">{errors.phone.message}</p>}
                      </div>
                    </div>

                    <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4 text-sm text-slate-300">
                      <p className="font-semibold text-white">Phone number</p>
                      <p className="mt-1 text-slate-400">Phone OTP is skipped for now. Users can create accounts directly.</p>
                    </div>
                    </motion.div>
                  )}

                  {currentStep === 1 && (
                    <motion.div
                      key="step-1"
                      initial={{ opacity: 0, y: 24 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -16 }}
                      transition={{ duration: 0.3, ease: 'easeOut' }}
                      className="space-y-6"
                    >
                    <div className="rounded-[28px] border border-white/10 bg-gradient-to-br from-white/[0.05] to-slate-950/40 p-5">
                      <div className="flex items-center justify-between gap-3">
                        <label className="mb-1.5 block text-sm font-medium text-slate-300">ID Number</label>
                        <span className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">Optional for now</span>
                      </div>
                      <input {...register('idNumber')} placeholder="National ID / Passport number" className="input" />
                      {errors.idNumber && <p className="mt-1 text-xs text-red-400">{errors.idNumber.message}</p>}
                    </div>

                    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_260px]">
                      <div className="rounded-[28px] border border-dashed border-slate-700 bg-slate-900/70 p-5">
                        <div className="mb-4 flex items-center gap-3">
                          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-800 text-green-400">
                            <Upload size={18} />
                          </div>
                          <div>
                            <p className="font-semibold text-white">Upload ID front</p>
                            <p className="text-sm text-slate-400">Optional for now. You can skip and complete verification later.</p>
                          </div>
                        </div>

                        <label className="flex cursor-pointer flex-col items-center justify-center rounded-[24px] border border-slate-700 bg-slate-950/70 px-6 py-10 text-center transition hover:border-green-500/40">
                          <input
                            type="file"
                            accept="image/*"
                            capture="environment"
                            className="hidden"
                            onChange={(event) => handleImageUpload(event, 'idDocumentImage', setIdPreview)}
                          />
                          <CreditCard className="mb-3 text-slate-400" size={30} />
                          <p className="font-medium text-white">Tap to upload or scan your ID</p>
                          <p className="mt-1 text-sm text-slate-500">PNG or JPG, well lit, no glare</p>
                        </label>

                        {errors.idDocumentImage && <p className="mt-3 text-xs text-red-400">{errors.idDocumentImage.message}</p>}
                      </div>

                      <div className="rounded-[28px] border border-slate-800 bg-slate-900/70 p-4">
                        <p className="text-sm font-semibold text-white">ID preview</p>
                        <div className="mt-3 overflow-hidden rounded-[22px] border border-slate-800 bg-slate-950/80">
                          {idPreview ? (
                            <img src={idPreview} alt="ID preview" className="h-[330px] w-full object-cover" />
                          ) : (
                            <div className="flex h-[330px] items-center justify-center px-6 text-center text-sm text-slate-500">
                              Your uploaded document will appear here for review.
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                  )}

                  {currentStep === 2 && (
                    <motion.div
                      key="step-2"
                      initial={{ opacity: 0, y: 24 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -16 }}
                      transition={{ duration: 0.3, ease: 'easeOut' }}
                      className="space-y-6"
                    >
                    <div className="grid gap-5 lg:grid-cols-[260px_minmax(0,1fr)]">
                      <div className="rounded-[28px] border border-slate-800 bg-slate-900/70 p-4">
                        <p className="text-sm font-semibold text-white">Reference from your ID</p>
                        <div className="mt-3 overflow-hidden rounded-[22px] border border-slate-800 bg-slate-950/80">
                          {idPreview ? (
                            <img src={idPreview} alt="ID reference" className="h-[330px] w-full object-cover" />
                          ) : (
                            <div className="flex h-[330px] items-center justify-center px-6 text-center text-sm text-slate-500">
                              No ID uploaded yet. You can skip this step and verify later.
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="rounded-[28px] border border-slate-800 bg-slate-900/70 p-5">
                        <div className="mb-4 flex items-center justify-between gap-4">
                          <div>
                            <p className="font-semibold text-white">Live face verification</p>
                            <p className="text-sm text-slate-400">Optional for now. You can capture a selfie now or skip and continue.</p>
                          </div>
                          <div className="rounded-full border border-green-500/30 bg-green-500/10 px-3 py-1 text-xs font-medium text-green-300">
                            Optional step
                          </div>
                        </div>

                        <div className="relative overflow-hidden rounded-[30px] border border-white/10 bg-black shadow-[0_20px_50px_rgba(0,0,0,0.35)]">
                          {!facePreview ? (
                            <>
                              <motion.video
                                ref={videoRef}
                                playsInline
                                muted
                                className="aspect-[4/5] w-full object-cover"
                                initial={{ scale: 1.03, opacity: 0.6 }}
                                animate={{ scale: 1, opacity: 1 }}
                                transition={{ duration: 0.4 }}
                              />
                              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                                <motion.div
                                  className="h-[68%] w-[58%] rounded-[45%] border-2 border-white/80 shadow-[0_0_0_9999px_rgba(2,6,23,0.45)]"
                                  animate={{ scale: [1, 1.02, 1], opacity: [0.82, 1, 0.82] }}
                                  transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
                                />
                              </div>
                              <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950 via-slate-950/65 to-transparent px-5 py-5 text-center text-sm text-slate-200">
                                Align your face inside the oval and keep your eyes level.
                              </div>
                            </>
                          ) : (
                            <img src={facePreview} alt="Face verification preview" className="aspect-[4/5] w-full object-cover" />
                          )}
                        </div>

                        <canvas ref={canvasRef} className="hidden" />

                        <div className="mt-4 flex flex-wrap gap-3">
                          {!facePreview && (
                            <button
                              type="button"
                              onClick={captureFace}
                              disabled={!cameraReady}
                              className="btn-primary flex items-center gap-2 px-5"
                            >
                              <Camera size={16} /> Capture Live Selfie
                            </button>
                          )}

                          {facePreview && (
                            <button type="button" onClick={resetFaceCapture} className="btn-secondary flex items-center gap-2 px-5">
                              <Camera size={16} /> Retake Selfie
                            </button>
                          )}

                          {!facePreview && (
                            <button
                              type="button"
                              onClick={startCamera}
                              disabled={startingCamera}
                              className="btn-outline flex items-center gap-2 px-5"
                            >
                              {startingCamera ? <Loader2 size={16} className="animate-spin" /> : <ScanFace size={16} />}
                              Restart Camera
                            </button>
                          )}
                        </div>

                        {cameraError && <p className="mt-3 text-sm text-red-400">{cameraError}</p>}
                        {errors.faceVerificationImage && <p className="mt-3 text-xs text-red-400">{errors.faceVerificationImage.message}</p>}

                        <div className="mt-4 rounded-2xl border border-slate-800 bg-slate-950/80 p-4 text-sm text-slate-300">
                          <p className="font-semibold text-white">Face verification</p>
                          <div className="mt-2 space-y-2 text-slate-400">
                            <p>1. This step is optional right now and will not block account creation.</p>
                            <p>2. If you do capture now, face the camera directly and avoid blur.</p>
                            <p>3. You can complete full identity review later when needed.</p>
                          </div>
                          {faceAligned && (
                            <div className="mt-3 flex items-center gap-2 text-green-300">
                              <CheckCircle size={15} /> Live face capture saved for identity review
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                  )}

                  {currentStep === 3 && (
                    <motion.div
                      key="step-3"
                      initial={{ opacity: 0, y: 24 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -16 }}
                      transition={{ duration: 0.3, ease: 'easeOut' }}
                      className="space-y-6"
                    >
                    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_280px]">
                      <div className="space-y-5">
                        <div className="grid gap-4 md:grid-cols-2">
                          <div>
                            <label className="mb-1.5 flex items-center gap-2 text-sm font-medium text-slate-300">
                              <Lock size={14} /> Password
                            </label>
                            <div className="relative">
                              <input
                                {...register('password')}
                                type={showPassword ? 'text' : 'password'}
                                placeholder="Min. 6 characters"
                                className="input pr-10"
                              />
                              <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
                              >
                                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                              </button>
                            </div>
                            {errors.password && <p className="mt-1 text-xs text-red-400">{errors.password.message}</p>}
                          </div>

                          <div>
                            <label className="mb-1.5 flex items-center gap-2 text-sm font-medium text-slate-300">
                              <Lock size={14} /> Confirm Password
                            </label>
                            <div className="relative">
                              <input
                                {...register('confirmPassword')}
                                type={showConfirmPassword ? 'text' : 'password'}
                                placeholder="Repeat your password"
                                className="input pr-10"
                              />
                              <button
                                type="button"
                                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
                              >
                                {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                              </button>
                            </div>
                            {errors.confirmPassword && <p className="mt-1 text-xs text-red-400">{errors.confirmPassword.message}</p>}
                          </div>
                        </div>

                        <div>
                          <label className="mb-1.5 block text-sm font-medium text-slate-300">Referral Code (optional)</label>
                          <input {...register('referralCode')} placeholder="REF-XXXXXXXX" className="input" />
                        </div>
                      </div>

                      <div className="rounded-[28px] border border-slate-800 bg-slate-900/70 p-5">
                        <p className="text-sm font-semibold text-white">Ready to submit</p>
                        <div className="mt-4 space-y-3 text-sm">
                          <div className="flex items-center justify-between rounded-2xl border border-slate-800 bg-slate-950/80 px-4 py-3">
                            <span className="text-slate-400">Email</span>
                            <span className={email ? 'text-green-300' : 'text-amber-300'}>{email ? 'Added' : 'Missing'}</span>
                          </div>
                          <div className="flex items-center justify-between rounded-2xl border border-slate-800 bg-slate-950/80 px-4 py-3">
                            <span className="text-slate-400">Phone</span>
                            <span className="text-green-300">Added</span>
                          </div>
                          <div className="flex items-center justify-between rounded-2xl border border-slate-800 bg-slate-950/80 px-4 py-3">
                            <span className="text-slate-400">ID upload</span>
                            <span className={idPreview ? 'text-green-300' : 'text-slate-400'}>{idPreview ? 'Added' : 'Skipped'}</span>
                          </div>
                          <div className="flex items-center justify-between rounded-2xl border border-slate-800 bg-slate-950/80 px-4 py-3">
                            <span className="text-slate-400">Face capture</span>
                            <span className={facePreview ? 'text-green-300' : 'text-slate-400'}>{facePreview ? 'Captured' : 'Skipped'}</span>
                          </div>
                        </div>

                        <div className="mt-4 rounded-2xl border border-green-500/20 bg-green-500/10 p-4 text-sm text-slate-200">
                          <p className="font-semibold text-white">Password strength</p>
                          <p className="mt-1 text-slate-300">
                            {password?.length >= 10
                              ? 'Strong enough for launch.'
                              : 'Use 10+ characters if possible for a stronger account password.'}
                          </p>
                        </div>
                      </div>
                    </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <div className="flex flex-col gap-4 border-t border-white/10 bg-gradient-to-r from-white/[0.035] to-transparent px-6 py-5 md:flex-row md:items-center md:justify-between md:px-8">
                <p className="text-sm text-slate-500">
                  Already have an account?{' '}
                  <Link href="/login" className="font-medium text-green-400 hover:text-green-300">
                    Login
                  </Link>
                </p>

                <div className="flex flex-col-reverse gap-3 sm:flex-row">
                  {currentStep > 0 && (
                    <button
                      type="button"
                      onClick={() => setCurrentStep((prev) => Math.max(prev - 1, 0))}
                      className="btn-outline flex items-center justify-center gap-2"
                    >
                      <ArrowLeft size={16} /> Back
                    </button>
                  )}

                  {currentStep < STEPS.length - 1 ? (
                    <button type="button" onClick={goToNextStep} className="btn-primary flex items-center justify-center gap-2">
                      Continue <ArrowRight size={16} />
                    </button>
                  ) : (
                    <button
                      type="submit"
                      disabled={isLoading}
                      className="btn-primary flex items-center justify-center gap-2"
                    >
                      {isLoading ? <Loader2 size={18} className="animate-spin" /> : 'Create Account'}
                    </button>
                  )}
                </div>
              </div>
            </form>
          </motion.div>
        </div>
      </div>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-950" />}>
      <RegisterPageContent />
    </Suspense>
  );
}
