import { useLoginWithEmail, useLoginWithOAuth } from '@privy-io/expo';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { ErrorText, ScreenHeader } from '@/components/screen-header';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

const CODE_LENGTH = 6;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Step = 'email' | 'code';
type Pending = null | 'send' | 'resend' | 'verify' | 'google';

function messageOf(err: unknown) {
  return err instanceof Error && err.message ? err.message : 'Something went wrong. Try again.';
}

// Closing the Google sheet is a user choice, not a failure worth flagging in red.
function isCancellation(err: unknown) {
  return err instanceof Error && /cancel/i.test(err.message);
}

/**
 * Privy shares one OTP/OAuth status across all login hooks, so this screen keeps its own
 * step/pending/error state and drives the hooks through their promises instead.
 */
export function LoginScreen() {
  const { sendCode, loginWithCode } = useLoginWithEmail();
  const { login: loginWithOAuth } = useLoginWithOAuth();

  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [pending, setPending] = useState<Pending>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const busy = pending !== null;
  const trimmedEmail = email.trim();
  const emailValid = EMAIL_RE.test(trimmedEmail);

  async function run(kind: Exclude<Pending, null>, fn: () => Promise<unknown>) {
    setPending(kind);
    setError(null);
    setNotice(null);
    try {
      await fn();
      return true;
    } catch (err) {
      if (!isCancellation(err)) setError(messageOf(err));
      return false;
    } finally {
      setPending(null);
    }
  }

  async function submitEmail() {
    if (!emailValid) {
      setError('Enter a valid email address.');
      return;
    }
    const ok = await run('send', () => sendCode({ email: trimmedEmail }));
    if (ok) {
      setCode('');
      setStep('code');
    }
  }

  async function resend() {
    const ok = await run('resend', () => sendCode({ email: trimmedEmail }));
    if (ok) {
      setCode('');
      setNotice(`New code sent to ${trimmedEmail}.`);
    }
  }

  async function verify(value = code) {
    if (value.length !== CODE_LENGTH || busy) return;
    const ok = await run('verify', () => loginWithCode({ code: value, email: trimmedEmail }));
    // On success the provider swaps this screen out; on failure stay here with a clean field.
    if (!ok) setCode('');
  }

  function changeEmail() {
    setStep('email');
    setCode('');
    setError(null);
    setNotice(null);
  }

  if (step === 'code') {
    return (
      <>
        <ScreenHeader
          title="Check your email"
          subtitle={`Enter the ${CODE_LENGTH}-digit code we sent to ${trimmedEmail}.`}
        />
        <TextField
          value={code}
          onChangeText={(text) => {
            const digits = text.replace(/\D/g, '').slice(0, CODE_LENGTH);
            setCode(digits);
            setError(null);
            if (digits.length === CODE_LENGTH) verify(digits);
          }}
          placeholder={'0'.repeat(CODE_LENGTH)}
          keyboardType="number-pad"
          textContentType="oneTimeCode"
          autoComplete="one-time-code"
          maxLength={CODE_LENGTH}
          autoFocus
          editable={pending !== 'verify'}
          invalid={!!error}
          style={styles.code}
          accessibilityLabel="Verification code"
        />
        <Button
          title={pending === 'verify' ? 'Verifying…' : 'Verify'}
          loading={pending === 'verify'}
          disabled={code.length !== CODE_LENGTH || busy}
          onPress={() => verify()}
        />
        <ErrorText message={error} />
        {notice ? (
          <ThemedText type="small" themeColor="textSecondary">
            {notice}
          </ThemedText>
        ) : null}
        <View style={styles.links}>
          <Button variant="link" title="Use a different email" disabled={busy} onPress={changeEmail} />
          <Button
            variant="link"
            title={pending === 'resend' ? 'Sending…' : 'Resend code'}
            disabled={busy}
            onPress={resend}
          />
        </View>
      </>
    );
  }

  return (
    <>
      <ScreenHeader title="Nostr" subtitle="Sign in with your email or Google." />
      <TextField
        value={email}
        onChangeText={(text) => {
          setEmail(text);
          setError(null);
        }}
        placeholder="you@example.com"
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="email"
        textContentType="emailAddress"
        keyboardType="email-address"
        returnKeyType="send"
        onSubmitEditing={submitEmail}
        editable={!busy}
        invalid={!!error && pending === null && !emailValid}
        accessibilityLabel="Email address"
      />
      <Button
        title={pending === 'send' ? 'Sending code…' : 'Continue with email'}
        loading={pending === 'send'}
        disabled={!trimmedEmail || busy}
        onPress={submitEmail}
      />
      <View style={styles.divider}>
        <Rule />
        <ThemedText type="small" themeColor="textSecondary">
          or
        </ThemedText>
        <Rule />
      </View>
      <Button
        variant="secondary"
        title={pending === 'google' ? 'Opening Google…' : 'Continue with Google'}
        loading={pending === 'google'}
        disabled={busy}
        onPress={() => run('google', () => loginWithOAuth({ provider: 'google' }))}
      />
      <ErrorText message={error} />
    </>
  );
}

function Rule() {
  const theme = useTheme();
  return <View style={[styles.rule, { backgroundColor: theme.backgroundSelected }]} />;
}

const styles = StyleSheet.create({
  code: { fontSize: 24, letterSpacing: 8, textAlign: 'center', fontVariant: ['tabular-nums'] },
  links: { flexDirection: 'row', justifyContent: 'space-between', marginTop: Spacing.one },
  divider: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  rule: { flex: 1, height: StyleSheet.hairlineWidth },
});
