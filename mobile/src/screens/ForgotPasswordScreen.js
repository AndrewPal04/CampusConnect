import React, { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import api from '../services/api';
import { COLORS } from '../theme';

export default function ForgotPasswordScreen({ navigation }) {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSendResetLink = async () => {
    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail) {
      setError('Please enter your email address.');
      return;
    }

    setError('');
    setSuccessMessage('');
    setSubmitting(true);

    try {
      await api.forgotPassword({ email: normalizedEmail });
      setSuccessMessage(
        "If that email is registered, you'll receive a reset link shortly."
      );
    } catch (requestError) {
      setError(requestError.message || 'Unable to send reset link. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <KeyboardAvoidingView
        style={styles.keyboard}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.header}>
          <Text style={styles.title}>Forgot Password</Text>
          <Text style={styles.subtitle}>We will send a password reset link to your email</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>Email</Text>
          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder="you@cpp.edu"
            placeholderTextColor={COLORS.gray}
            autoCapitalize="none"
            keyboardType="email-address"
            textContentType="emailAddress"
            style={styles.input}
          />

          {successMessage ? <Text style={styles.successText}>{successMessage}</Text> : null}
          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <Pressable
            style={[styles.primaryButton, submitting && styles.primaryButtonDisabled]}
            onPress={handleSendResetLink}
            disabled={submitting}
          >
            {submitting ? (
              <ActivityIndicator color={COLORS.cream} />
            ) : (
              <Text style={styles.primaryButtonText}>Send Reset Link</Text>
            )}
          </Pressable>

          <Pressable
            onPress={() => navigation.navigate('Login')}
            disabled={submitting}
            style={styles.linkWrap}
          >
            <Text style={styles.linkText}>Back to Sign In</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: COLORS.cream,
  },
  keyboard: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 28,
  },
  header: {
    marginBottom: 24,
  },
  title: {
    fontSize: 30,
    fontWeight: '800',
    color: COLORS.ink,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 14,
    color: '#5d5d6c',
  },
  card: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 4,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.ink,
    marginBottom: 6,
    marginTop: 10,
  },
  input: {
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 15,
    color: COLORS.ink,
    backgroundColor: COLORS.cream,
  },
  successText: {
    color: '#2f7f47',
    fontSize: 12,
    marginTop: 12,
    lineHeight: 18,
  },
  errorText: {
    color: COLORS.red,
    fontSize: 12,
    marginTop: 12,
    lineHeight: 18,
  },
  primaryButton: {
    marginTop: 18,
    backgroundColor: COLORS.amber,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryButtonDisabled: {
    opacity: 0.7,
  },
  primaryButtonText: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.ink,
  },
  linkWrap: {
    alignSelf: 'center',
    marginTop: 16,
    paddingVertical: 4,
  },
  linkText: {
    color: COLORS.blue,
    fontSize: 13,
    fontWeight: '700',
  },
});
