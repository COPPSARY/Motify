<script lang="ts">
  import { LogIn, UserPlus } from "lucide-svelte";
  import {
    AuthError,
    motionlyLoginUrl,
    signInWithPassword,
    signUpWithPassword,
    type MotionlyUser,
  } from "../../auth";
  import "./auth.css";

  /** Which credential flow the form is showing. Bindable so a host can open
   * straight onto "Create account" when that is what it asked the user for. */
  export let mode: "signin" | "signup" = "signin";
  export let onauthenticated: (
    user: MotionlyUser,
  ) => void | Promise<void> = () => {};

  let email = "";
  let password = "";
  let busy = false;
  let errorMessage = "";
  let verificationSentTo = "";

  $: isSignUp = mode === "signup";

  function switchMode(next: "signin" | "signup"): void {
    mode = next;
    errorMessage = "";
    verificationSentTo = "";
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
    busy = true;
    errorMessage = "";
    try {
      if (isSignUp) {
        await signUpWithPassword(address, password);
        verificationSentTo = address;
        password = "";
      } else {
        const user = await signInWithPassword(address, password);
        password = "";
        await onauthenticated(user);
      }
    } catch (error) {
      // An address that already has an account is a wrong-form mistake, not a
      // failure: send the user to the sign-in tab with the email kept.
      if (
        error instanceof AuthError &&
        error.code === "ACCOUNT_ALREADY_EXISTS"
      ) {
        mode = "signin";
        errorMessage = "That account already exists. Sign in instead.";
      } else {
        errorMessage = readableError(error);
      }
    } finally {
      busy = false;
    }
  }
</script>

<div class="auth-panel" data-ph-no-autocapture>
  {#if verificationSentTo}
    <div class="auth-panel__sent" role="status">
      <h3>Check your inbox</h3>
      <p>
        We sent a verification link to <strong>{verificationSentTo}</strong>.
        Open it to finish setting up your account — you will land back here
        signed in.
      </p>
      <button
        class="auth-panel__ghost"
        type="button"
        on:click={() => switchMode("signin")}>Back to sign in</button
      >
    </div>
  {:else}
    <div class="auth-panel__tabs" role="tablist" aria-label="Account">
      <button
        class="auth-panel__tab"
        class:auth-panel__tab--active={!isSignUp}
        type="button"
        role="tab"
        aria-selected={!isSignUp}
        on:click={() => switchMode("signin")}>Sign in</button
      >
      <button
        class="auth-panel__tab"
        class:auth-panel__tab--active={isSignUp}
        type="button"
        role="tab"
        aria-selected={isSignUp}
        on:click={() => switchMode("signup")}>Create account</button
      >
    </div>

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
      Continue with Google
    </a>

    <div class="auth-panel__divider"><span>or</span></div>

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
        <input
          bind:value={password}
          type="password"
          autocomplete={isSignUp ? "new-password" : "current-password"}
          placeholder={isSignUp ? "At least 8 characters" : "Your password"}
          minlength="8"
          required
        />
      </label>
      {#if errorMessage}
        <p class="auth-panel__error" role="alert">{errorMessage}</p>
      {/if}
      <button class="auth-panel__submit" type="submit" disabled={busy}>
        {#if isSignUp}
          <UserPlus size={16} />
          {busy ? "Creating account…" : "Create account"}
        {:else}
          <LogIn size={16} />
          {busy ? "Signing in…" : "Sign in"}
        {/if}
      </button>
    </form>
  {/if}
</div>
