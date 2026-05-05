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
import * as SecureStore from '../services/secureStorage';

import { useApp } from '../context/AppContext';
import api, { AUTH_TOKEN_KEY, extractAuthToken, extractUser } from '../services/api';
import { COLORS } from '../theme';

export default function LoginScreen({ navigation }) {
  const { setCurrentUser } = useApp();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleLogin = async () => {
    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail || !password) {
      setError('Please enter your email and password.');
      return;
    }

    setError('');
    setSubmitting(true);

    try {
      const loginResponse = await api.login({
        email: normalizedEmail,
        password,
      });

      let token = extractAuthToken(loginResponse);
      let user = extractUser(loginResponse);

      if (!token) {
        throw new Error('Login succeeded but no auth token was returned.');
      }

      await SecureStore.setItemAsync(AUTH_TOKEN_KEY, token);

      if (!user) {
        const meResponse = await api.me(token);
        user = extractUser(meResponse) || meResponse;
      }

      if (!user || typeof user !== 'object') {
        throw new Error('Unable to load your account profile.');
      }

      setCurrentUser(user);
    } catch (requestError) {
      setError(requestError.message || 'Unable to sign in. Please try again.');
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
          <Text style={styles.title}>Welcome Back</Text>
          <Text style={styles.subtitle}>Sign in to CampusConnect</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>CPP Email</Text>
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

          <Text style={styles.label}>Password</Text>
          <TextInput
            value={password}
            onChangeText={setPassword}
            placeholder="Enter password"
            placeholderTextColor={COLORS.gray}
            secureTextEntry
            textContentType="password"
            style={styles.input}
          />

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <Pressable
            style={[styles.primaryButton, submitting && styles.primaryButtonDisabled]}
            onPress={handleLogin}
            disabled={submitting}
          >
            {submitting ? (
              <ActivityIndicator color={COLORS.cream} />
            ) : (
              <Text style={styles.primaryButtonText}>Sign In</Text>
            )}
          </Pressable>

          <Pressable
            onPress={() => navigation.navigate('ForgotPassword')}
            disabled={submitting}
            style={styles.forgotLinkWrap}
          >
            <Text style={styles.forgotLinkText}>Forgot password?</Text>
          </Pressable>

          <Pressable
            onPress={() => navigation.navigate('Register')}
            disabled={submitting}
            style={styles.linkWrap}
          >
            <Text style={styles.linkText}>Don't have an account? Register</Text>
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
  forgotLinkWrap: {
    alignSelf: 'flex-end',
    marginTop: 12,
    paddingVertical: 4,
  },
  forgotLinkText: {
    color: COLORS.blue,
    fontSize: 13,
    fontWeight: '700',
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
