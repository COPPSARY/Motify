<script lang="ts">
  import { tick } from "svelte";
  import { Eye, EyeOff } from "lucide-svelte";
  import {
    AuthError,
    motionlyLoginUrl,
    resendSignupOtp,
    signInWithPassword,
    signUpWithPassword,
    verifyEmailOtp,
    type MotionlyUser,
  } from "../../auth";
  import { PRIVACY_URL, TERMS_URL } from "../../api/config";
  import { beginOnboarding } from "../../onboarding/begin";
  import "./auth.css";

  /** Which credential flow the form is showing. Bindable so a host can open
   * straight onto "Create account" when that is what it asked the user for. */
  export let mode: "signin" | "signup" = "signin";
  /** Replaces the default heading, e.g. when a prompt is waiting on sign-in. */
  export let title = "";
  /** A line under the heading explaining why an account is needed here. */
  export let subtitle = "";
  export let onauthenticated: (
    user: MotionlyUser,
  ) => void | Promise<void> = () => {};

  let email = "";
  let password = "";
  let showPassword = false;
  let acceptedTerms = false;
  let busy = false;
  let errorMessage = "";
  let verificationSentTo = "";
  let otpCode = "";
  let otpInput: HTMLInputElement;
  let otpStatus = "";

  $: isSignUp = mode === "signup";
  $: heading =
    title || (isSignUp ? "Create your account" : "Log in to your account");

  function switchMode(next: "signin" | "signup"): void {
    mode = next;
    errorMessage = "";
    verificationSentTo = "";
    otpCode = "";
    otpStatus = "";
  }

  function readableError(error: unknown): string {
    if (error instanceof AuthError) return error.message;
    return error instanceof Error
      ? error.message
      : "Something went wrong. Try again.";
  }

  async function submit(event: SubmitEvent): Promise<void> {
    event.preventDefault();
    if (busy) return;
    const address = email.trim();
    if (!address || !password) {
      errorMessage = "Enter your email and password to continue.";
      return;
    }
    if (isSignUp && password.length < 8) {
      errorMessage = "Choose a password of at least 8 characters.";
      return;
    }
    if (isSignUp && !acceptedTerms) {
      errorMessage =
        "Agree to the Terms & Conditions and Privacy Policy to create an account.";
      return;
    }
    busy = true;
    errorMessage = "";
    try {
      if (isSignUp) {
        const signedUp = await signUpWithPassword(address, password);
        password = "";
        if (signedUp) await finishAuthentication(signedUp);
        else await showOtp(address);
      } else {
        const user = await signInWithPassword(address, password);
        password = "";
        await onauthenticated(user);
      }
    } catch (error) {
      // An address that already has an account is a wrong-form mistake, not a
      // failure: send the user to sign in with the email kept.
      if (
        error instanceof AuthError &&
        error.code === "ACCOUNT_ALREADY_EXISTS"
      ) {
        mode = "signin";
        errorMessage = "That account already exists. Log in instead.";
      } else if (
        error instanceof AuthError &&
        error.code === "EMAIL_NOT_VERIFIED"
      ) {
        try {
          await resendSignupOtp(address);
          await showOtp(address);
        } catch (resendError) {
          errorMessage = readableError(resendError);
        }
      } else {
        errorMessage = readableError(error);
      }
    } finally {
      busy = false;
    }
  }

  async function showOtp(address: string): Promise<void> {
    password = "";
    verificationSentTo = address;
    otpCode = "";
    otpStatus = "";
    await tick();
    otpInput?.focus();
  }

  async function resendOtp(): Promise<void> {
    if (busy) return;
    busy = true;
    errorMessage = "";
    otpStatus = "";
    try {
      await resendSignupOtp(verificationSentTo);
      otpStatus = "A new code was sent.";
      otpCode = "";
      await tick();
      otpInput?.focus();
    } catch (error) {
      errorMessage = readableError(error);
    } finally {
      busy = false;
    }
  }

  async function verifyOtp(event: SubmitEvent): Promise<void> {
    event.preventDefault();
    if (busy || !/^\d{6,10}$/.test(otpCode)) {
      errorMessage = "Enter the 6–10 digit code from your email.";
      return;
    }
    busy = true;
    errorMessage = "";
    try {
      await finishAuthentication(
        await verifyEmailOtp(verificationSentTo, otpCode),
      );
    } catch (error) {
      errorMessage = readableError(error);
    } finally {
      busy = false;
    }
  }

  async function finishAuthentication(result: {
    user: MotionlyUser;
    newAccount: boolean;
  }): Promise<void> {
    if (result.newAccount) {
      // New accounts start with Brand DNA, then the tour; a held prompt waits in the composer.
      await beginOnboarding();
      return;
    }
    await onauthenticated(result.user);
  }
</script>

<div class="auth-panel" data-ph-no-autocapture>
  <span class="auth-panel__mark" aria-hidden="true">
    <img src="/logo.svg" alt="" width="30" height="30" />
  </span>

  {#if verificationSentTo}
    <header class="auth-panel__head" role="status">
      <h2 id="auth-panel-title">Check your inbox</h2>
      <p>
        Enter the verification code sent to <strong>{verificationSentTo}</strong
        >.
      </p>
    </header>
    <form class="auth-panel__form" on:submit={verifyOtp}>
      <label class="auth-panel__field">
        <span>Verification code</span>
        <input
          bind:this={otpInput}
          bind:value={otpCode}
          type="text"
          inputmode="numeric"
          autocomplete="one-time-code"
          pattern={"[0-9]{6,10}"}
          maxlength="10"
          placeholder="Enter code"
          aria-label="Verification code"
          required
        />
      </label>
      {#if errorMessage}
        <p class="auth-panel__error" role="alert">{errorMessage}</p>
      {/if}
      {#if otpStatus}<p class="auth-panel__status" role="status">
          {otpStatus}
        </p>{/if}
      <button class="auth-panel__submit" type="submit" disabled={busy}>
        {busy ? "Verifying…" : "Verify email"}
      </button>
    </form>
    <button
      class="auth-panel__google"
      type="button"
      disabled={busy}
      on:click={resendOtp}>Resend code</button
    >
    <button
      class="auth-panel__google"
      type="button"
      disabled={busy}
      on:click={() => switchMode("signin")}>Back to log in</button
    >
  {:else}
    <header class="auth-panel__head">
      <small>{isSignUp ? "Welcome to Motify" : "Welcome back"}</small>
      <h2 id="auth-panel-title">{heading}</h2>
      {#if subtitle}<p>{subtitle}</p>{/if}
    </header>

    <form class="auth-panel__form" on:submit={submit}>
      <label class="auth-panel__field">
        <span>Email</span>
        <input
          bind:value={email}
          type="email"
          autocomplete="email"
          placeholder="you@studio.com"
          required
        />
      </label>
      <label class="auth-panel__field">
        <span>Password</span>
        <span class="auth-panel__password">
          <input
            bind:value={password}
            type={showPassword ? "text" : "password"}
            autocomplete={isSignUp ? "new-password" : "current-password"}
            placeholder={isSignUp ? "At least 8 characters" : "Your password"}
            minlength="8"
            required
          />
          <button
            type="button"
            class="auth-panel__reveal"
            aria-label={showPassword ? "Hide password" : "Show password"}
            aria-pressed={showPassword}
            on:click={() => (showPassword = !showPassword)}
          >
            {#if showPassword}<EyeOff size={17} />{:else}<Eye size={17} />{/if}
          </button>
        </span>
      </label>
      {#if isSignUp}
        <label class="auth-panel__terms">
          <input type="checkbox" bind:checked={acceptedTerms} required />
          <span>
            I agree to the
            <a href={TERMS_URL} target="_blank" rel="noopener noreferrer"
              >Terms &amp; Conditions</a
            >
            and
            <a href={PRIVACY_URL} target="_blank" rel="noopener noreferrer"
              >Privacy Policy</a
            >.
          </span>
        </label>
      {/if}
      {#if errorMessage}
        <p class="auth-panel__error" role="alert">{errorMessage}</p>
      {/if}
      <button
        class="auth-panel__submit"
        type="submit"
        disabled={busy || (isSignUp && !acceptedTerms)}
      >
        {#if isSignUp}
          {busy ? "Creating account…" : "Create account"}
        {:else}
          {busy ? "Logging in…" : "Log in"}
        {/if}
      </button>
    </form>

    <div class="auth-panel__divider"><span>Or</span></div>

    <a class="auth-panel__google" href={motionlyLoginUrl()}>
      <svg
        class="auth-panel__google-mark"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <path
          fill="#4285F4"
          d="M21.6 12.23c0-.71-.06-1.4-.18-2.05H12v3.88h5.38a4.6 4.6 0 0 1-1.99 3.02v2.51h3.22c1.89-1.74 2.99-4.3 2.99-7.36Z"
        />
        <path
          fill="#34A853"
          d="M12 22c2.7 0 4.96-.9 6.61-2.41l-3.22-2.51c-.9.6-2.05.96-3.39.96-2.61 0-4.82-1.76-5.61-4.13H3.06v2.59A9.98 9.98 0 0 0 12 22Z"
        />
        <path
          fill="#FBBC05"
          d="M6.39 13.91A6 6 0 0 1 6.08 12c0-.66.11-1.3.31-1.91V7.5H3.06A10 10 0 0 0 2 12c0 1.61.39 3.13 1.06 4.5l3.33-2.59Z"
        />
        <path
          fill="#EA4335"
          d="M12 5.96c1.47 0 2.79.51 3.83 1.51l2.87-2.87C16.96 2.96 14.7 2 12 2a9.98 9.98 0 0 0-8.94 5.5l3.33 2.59C7.18 7.72 9.39 5.96 12 5.96Z"
        />
      </svg>
      {isSignUp ? "Sign up with Google" : "Log in with Google"}
    </a>
    <!-- Google can create an account from either mode, so the notice stays in both. -->
    <p class="auth-panel__legal">
      By continuing with Google, you agree to the
      <a href={TERMS_URL} target="_blank" rel="noopener noreferrer"
        >Terms &amp; Conditions</a
      >
      and
      <a href={PRIVACY_URL} target="_blank" rel="noopener noreferrer"
        >Privacy Policy</a
      >.
    </p>

    <p class="auth-panel__switch">
      {#if isSignUp}
        Already have an account?
        <button type="button" on:click={() => switchMode("signin")}
          >Log in</button
        >
      {:else}
        Don't have an account?
        <button type="button" on:click={() => switchMode("signup")}
          >Create account</button
        >
      {/if}
    </p>
  {/if}
</div>
