import { useForm, usePage, router } from '@inertiajs/react';
import { AlertCircle, ArrowLeft, CheckCircle2, MailCheck, RefreshCw, ShieldCheck } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

/**
 * The second step of an administrative sign-in.
 *
 * Six separate boxes rather than one text field, because a code read off a
 * phone is transcribed one digit at a time and a single field gives no sense
 * of how many are left. They behave as one input: typing advances, Backspace
 * retreats, arrows move, and a pasted code fills all six wherever the cursor
 * happens to be.
 *
 * The code is never put in the URL and never stored — it lives in component
 * state until the form is posted, exactly like a password field.
 */
const LENGTH = 6;

/** Digits only, at most six. Used for both typing and pasting. */
const clean = (value) => String(value ?? '').replace(/\D/g, '').slice(0, LENGTH);

function countdown(seconds) {
  const s = Math.max(0, Math.floor(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export default function VerifyOtp({ email, expiresIn, resendIn }) {
  const { flash } = usePage().props;

  const { data, setData, post, processing, errors, reset } = useForm({ code: '' });

  const [digits, setDigits] = useState(Array(LENGTH).fill(''));
  const [expires, setExpires] = useState(expiresIn ?? 0);
  const [resendWait, setResendWait] = useState(resendIn ?? 0);
  const [resending, setResending] = useState(false);

  const boxes = useRef([]);

  // Keep the hidden form field in step with the six boxes, so the value that
  // is posted can never disagree with what is on screen.
  useEffect(() => setData('code', digits.join('')), [digits]);

  /*
   * Two independent clocks.
   *
   * Both count down in the browser from a figure the server supplied, and
   * neither is trusted for anything: the server checks expiry and the resend
   * cooldown again on every request. These exist so the user knows whether to
   * wait or to act, not to decide anything.
   */
  useEffect(() => {
    if (expires <= 0) return undefined;
    const t = setInterval(() => setExpires((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, [expires]);

  useEffect(() => {
    if (resendWait <= 0) return undefined;
    const t = setInterval(() => setResendWait((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, [resendWait]);

  useEffect(() => { boxes.current[0]?.focus(); }, []);

  const setDigit = (index, value) => {
    const next = [...digits];
    next[index] = value;
    setDigits(next);
  };

  const onChange = (index, raw) => {
    const value = clean(raw);

    // A paste, or a phone keyboard handing over several characters at once:
    // spread it across the remaining boxes rather than dropping all but one.
    if (value.length > 1) {
      const next = [...digits];
      for (let i = 0; i < value.length && index + i < LENGTH; i += 1) {
        next[index + i] = value[i];
      }
      setDigits(next);
      boxes.current[Math.min(index + value.length, LENGTH - 1)]?.focus();
      return;
    }

    setDigit(index, value);
    if (value) boxes.current[index + 1]?.focus();
  };

  const onKeyDown = (index, event) => {
    if (event.key === 'Backspace' && !digits[index] && index > 0) {
      // Step back and clear, which is what a single row of boxes should do:
      // otherwise the cursor sticks on an empty box and Backspace does nothing.
      event.preventDefault();
      setDigit(index - 1, '');
      boxes.current[index - 1]?.focus();
      return;
    }
    if (event.key === 'ArrowLeft') { event.preventDefault(); boxes.current[index - 1]?.focus(); }
    if (event.key === 'ArrowRight') { event.preventDefault(); boxes.current[index + 1]?.focus(); }
  };

  const onPaste = (event) => {
    const value = clean(event.clipboardData.getData('text'));
    if (!value) return;
    event.preventDefault();
    const next = Array(LENGTH).fill('');
    for (let i = 0; i < value.length; i += 1) next[i] = value[i];
    setDigits(next);
    boxes.current[Math.min(value.length, LENGTH - 1)]?.focus();
  };

  const complete = digits.every(Boolean);

  const submit = (event) => {
    event?.preventDefault();
    if (!complete || processing) return;
    post('/admin/verify-otp', {
      // Clear the boxes on a refusal so the next attempt starts clean rather
      // than making the user delete six characters first.
      onError: () => { setDigits(Array(LENGTH).fill('')); reset('code'); boxes.current[0]?.focus(); },
    });
  };

  const resend = () => {
    if (resendWait > 0 || resending) return;
    setResending(true);
    router.post('/admin/verify-otp/resend', {}, {
      preserveScroll: true,
      onSuccess: () => {
        setDigits(Array(LENGTH).fill(''));
        setExpires((expiresIn ?? 300) || 300);
        setResendWait(60);
        boxes.current[0]?.focus();
      },
      onFinish: () => setResending(false),
    });
  };

  const expired = expires <= 0;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-900 via-green-800 to-emerald-700 p-4 sm:p-8">
      <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl sm:p-8">

        <div className="flex flex-col items-center text-center">
          <img
            src="/images/Logo.jpeg"
            alt="Seal of the Municipality of Tumauini, Isabela"
            className="h-20 w-20 rounded-full bg-white object-contain p-1 ring-2 ring-green-700/20"
          />
          <h1 className="mt-4 text-2xl font-bold text-gray-900">GeoFarm-IS</h1>
          <p className="mt-1 inline-flex items-center gap-1.5 text-sm font-semibold text-green-800">
            <ShieldCheck className="h-4 w-4" aria-hidden="true" />
            Login Verification
          </p>
        </div>

        <p className="mt-5 text-center text-sm leading-6 text-gray-600">
          We sent a 6-digit verification code to
          {/* Masked by the server — see LoginOtpService::maskEmail. The full
              address is never sent to the browser. */}
          <span className="mt-1 block font-medium text-gray-900">{email}</span>
        </p>

        {flash?.success && (
          <p className="mt-4 flex items-start gap-2 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-800">
            <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden="true" />
            {flash.success}
          </p>
        )}

        {flash?.error && (
          <p className="mt-4 flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
            <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden="true" />
            {flash.error}
          </p>
        )}

        <form onSubmit={submit} className="mt-6">
          <label className="mb-2 block text-center text-xs font-semibold uppercase tracking-wide text-gray-500">
            Verification Code
          </label>

          <div className="flex justify-center gap-2" onPaste={onPaste}>
            {digits.map((digit, index) => (
              <input
                key={index}
                ref={(el) => { boxes.current[index] = el; }}
                value={digit}
                onChange={(event) => onChange(index, event.target.value)}
                onKeyDown={(event) => onKeyDown(index, event)}
                onFocus={(event) => event.target.select()}
                /*
                 * inputMode numeric rather than type="number": a number input
                 * shows spinner arrows, accepts "e" and "-", and strips
                 * leading zeros — and 000042 is a valid code.
                 */
                type="text"
                inputMode="numeric"
                autoComplete={index === 0 ? 'one-time-code' : 'off'}
                maxLength={LENGTH}
                aria-label={`Digit ${index + 1} of ${LENGTH}`}
                aria-invalid={Boolean(errors.code)}
                className={`h-12 w-11 rounded-lg border text-center text-lg font-semibold text-gray-900 outline-none transition focus:border-green-600 focus:ring-2 focus:ring-green-200 sm:h-14 sm:w-12 sm:text-xl ${
                  errors.code ? 'border-red-400 bg-red-50' : 'border-gray-300'
                }`}
              />
            ))}
          </div>

          {errors.code && (
            <p className="mt-3 flex items-start justify-center gap-1.5 text-center text-sm text-red-600" role="alert">
              <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden="true" />
              {errors.code}
            </p>
          )}

          <p className={`mt-3 text-center text-sm ${expired ? 'font-medium text-red-600' : 'text-gray-500'}`} role="status">
            {expired
              ? 'This code has expired. Please request a new one.'
              : <>Code expires in <span className="font-semibold tabular-nums text-gray-800">{countdown(expires)}</span></>}
          </p>

          <button
            type="submit"
            disabled={!complete || processing || expired}
            className="mt-5 flex w-full items-center justify-center gap-2 rounded-lg bg-green-800 px-4 py-3 text-sm font-semibold text-white transition hover:bg-green-900 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <MailCheck className="h-4 w-4" aria-hidden="true" />
            {processing ? 'Verifying…' : 'Verify Code'}
          </button>
        </form>

        <div className="mt-5 border-t border-gray-100 pt-4 text-center">
          <p className="text-sm text-gray-600">Didn&rsquo;t receive the code?</p>
          <button
            type="button"
            onClick={resend}
            disabled={resendWait > 0 || resending}
            className="mt-1.5 inline-flex items-center gap-1.5 text-sm font-semibold text-green-800 hover:text-green-900 disabled:cursor-not-allowed disabled:text-gray-400"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${resending ? 'animate-spin' : ''}`} aria-hidden="true" />
            {resendWait > 0
              ? `Resend available in ${resendWait}s`
              : (resending ? 'Sending…' : 'Resend Code')}
          </button>
        </div>

        {/*
            A POST, not a link. Going back must abandon the pending attempt on
            the server as well as in the browser — a code already sitting in an
            inbox should stop working the moment its sign-in is given up.
        */}
        <div className="mt-4 text-center">
          <button
            type="button"
            onClick={() => router.post('/admin/verify-otp/cancel')}
            className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700"
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
            Back to Login
          </button>
        </div>

        <p className="mt-6 text-center text-[11px] leading-5 text-gray-400">
          This extra step protects farmer records held by the Municipal Agriculture Office.
          Never share your verification code with anyone.
        </p>
      </div>
    </div>
  );
}
