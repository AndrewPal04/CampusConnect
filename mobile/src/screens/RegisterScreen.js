import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Picker } from '@react-native-picker/picker';
import * as SecureStore from '../services/secureStorage';

import { useApp } from '../context/AppContext';
import api, { AUTH_TOKEN_KEY, extractAuthToken, extractUser } from '../services/api';
import { COLORS } from '../theme';

const YEARS = ['Freshman', 'Sophomore', 'Junior', 'Senior', 'Graduate'];

export default function RegisterScreen({ navigation }) {
  const { setCurrentUser } = useApp();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [major, setMajor] = useState('');
  const [year, setYear] = useState(YEARS[0]);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const normalizedEmail = useMemo(() => email.trim().toLowerCase(), [email]);
  const hasCppEmail = normalizedEmail.endsWith('@cpp.edu');
  const showEmailError = email.length > 0 && !hasCppEmail;

  const handleRegister = async () => {
    if (!name.trim() || !normalizedEmail || !password || !major.trim()) {
      setError('Please complete all fields before creating your account.');
      return;
    }

    if (!hasCppEmail) {
      setError('Use your CPP email address ending in @cpp.edu.');
      return;
    }

    setError('');
    setSubmitting(true);

    try {
      const registerResponse = await api.register({
        name: name.trim(),
        email: normalizedEmail,
        password,
        major: major.trim(),
        year,
      });

      let token = extractAuthToken(registerResponse);
      let user = extractUser(registerResponse);

      if (!token) {
        const loginResponse = await api.login({
          email: normalizedEmail,
          password,
        });
        token = extractAuthToken(loginResponse);
        user = user || extractUser(loginResponse);
      }

      if (!token) {
        throw new Error('Account created but no auth token was returned.');
      }

      await SecureStore.setItemAsync(AUTH_TOKEN_KEY, token);

      if (!user) {
        const meResponse = await api.me(token);
        user = extractUser(meResponse) || meResponse;
      }

      if (!user || typeof user !== 'object') {
        throw new Error('Unable to load your account profile.');
      }

      if (typeof navigation?.replace === 'function') {
        navigation.replace('InterestsOnboarding', { pendingUser: user });
        return;
      }

      setCurrentUser(user);
    } catch (requestError) {
      setError(requestError.message || 'Unable to create your account.');
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
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          <View style={styles.header}>
            <Text style={styles.title}>Create Account</Text>
            <Text style={styles.subtitle}>Join CampusConnect at Cal Poly Pomona</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.label}>Full Name</Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="Jane Bronco"
              placeholderTextColor={COLORS.gray}
              autoCapitalize="words"
              style={styles.input}
            />

            <Text style={styles.label}>CPP Email</Text>
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="you@cpp.edu"
              placeholderTextColor={COLORS.gray}
              autoCapitalize="none"
              keyboardType="email-address"
              style={[styles.input, showEmailError && styles.inputError]}
            />
            {showEmailError ? (
              <Text style={styles.fieldError}>Email must end with @cpp.edu</Text>
            ) : null}

            <Text style={styles.label}>Password</Text>
            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder="Create password"
              placeholderTextColor={COLORS.gray}
              secureTextEntry
              textContentType="newPassword"
              style={styles.input}
            />

            <Text style={styles.label}>Major</Text>
            <TextInput
              value={major}
              onChangeText={setMajor}
              placeholder="Computer Science"
              placeholderTextColor={COLORS.gray}
              style={styles.input}
            />

            <Text style={styles.label}>Year</Text>
            <View style={styles.pickerWrap}>
              <Picker
                selectedValue={year}
                onValueChange={(value) => setYear(value)}
                style={styles.picker}
              >
                {YEARS.map((entry) => (
                  <Picker.Item key={entry} label={entry} value={entry} />
                ))}
              </Picker>
            </View>

            {error ? <Text style={styles.errorText}>{error}</Text> : null}

            <Pressable
              style={[styles.primaryButton, submitting && styles.primaryButtonDisabled]}
              onPress={handleRegister}
              disabled={submitting}
            >
              {submitting ? (
                <ActivityIndicator color={COLORS.cream} />
              ) : (
                <Text style={styles.primaryButtonText}>Create Account</Text>
              )}
            </Pressable>

            <Pressable
              onPress={() => navigation.navigate('Login')}
              disabled={submitting}
              style={styles.linkWrap}
            >
              <Text style={styles.linkText}>Already have an account? Sign In</Text>
            </Pressable>
          </View>
        </ScrollView>
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
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 40,
  },
  header: {
    marginBottom: 20,
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
  inputError: {
    borderColor: COLORS.red,
  },
  fieldError: {
    fontSize: 12,
    color: COLORS.red,
    marginTop: 6,
  },
  pickerWrap: {
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: COLORS.cream,
  },
  picker: {
    color: COLORS.ink,
    minHeight: 48,
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
