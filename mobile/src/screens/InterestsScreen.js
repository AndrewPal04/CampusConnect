import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { useApp } from '../context/AppContext';
import { getRecommendedEvents, saveUserInterests } from '../services/api';
import { COLORS } from '../theme';

const CATEGORY_OPTIONS = [
  { key: 'tech', label: 'Tech' },
  { key: 'music', label: 'Music' },
  { key: 'sports', label: 'Sports' },
  { key: 'social', label: 'Social' },
  { key: 'art', label: 'Art' },
  { key: 'food', label: 'Food' },
  { key: 'academic', label: 'Academic' },
];
const ALLOWED_CATEGORY_KEYS = new Set(CATEGORY_OPTIONS.map((category) => category.key));

function normalizeSelectedCategories(categories) {
  if (!Array.isArray(categories)) {
    return [];
  }

  return [...new Set(
    categories
      .map((entry) => String(entry || '').trim().toLowerCase())
      .filter((entry) => ALLOWED_CATEGORY_KEYS.has(entry))
  )].slice(0, 3);
}

export default function InterestsScreen({ navigation, route }) {
  const pendingUser = route?.params?.pendingUser || null;
  const isProfileUpdate = route?.params?.mode === 'profile_update';
  const { currentUser, setCurrentUser, setRecommendedEvents } = useApp();
  const initialSelectedCategories = useMemo(
    () => normalizeSelectedCategories(
      route?.params?.initialInterests
        || (isProfileUpdate ? currentUser?.interests : pendingUser?.interests)
    ),
    [
      route?.params?.initialInterests,
      isProfileUpdate,
      currentUser?.interests,
      pendingUser?.interests,
    ]
  );
  const [selectedCategories, setSelectedCategories] = useState(initialSelectedCategories);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setSelectedCategories(initialSelectedCategories);
  }, [initialSelectedCategories]);

  const canContinue = useMemo(
    () => selectedCategories.length >= 1 && selectedCategories.length <= 3,
    [selectedCategories.length]
  );

  const toggleCategory = (categoryKey) => {
    if (submitting) {
      return;
    }

    setSelectedCategories((prev) => {
      if (prev.includes(categoryKey)) {
        return prev.filter((entry) => entry !== categoryKey);
      }

      if (prev.length >= 3) {
        return prev;
      }

      return [...prev, categoryKey];
    });
  };

  const completeOnboarding = (interestsOverride = null) => {
    if (!pendingUser || typeof pendingUser !== 'object') {
      setError('Unable to continue. Please sign in again.');
      return;
    }

    setCurrentUser(
      interestsOverride ? { ...pendingUser, interests: interestsOverride } : pendingUser
    );
  };

  const handleSkip = () => {
    if (isProfileUpdate && typeof navigation?.goBack === 'function') {
      navigation.goBack();
      return;
    }

    completeOnboarding();
  };

  const handleContinue = async () => {
    if (!canContinue || submitting) {
      return;
    }

    setError('');
    setSubmitting(true);

    try {
      await saveUserInterests(selectedCategories);

      try {
        const recommendedPayload = await getRecommendedEvents();
        const warmedRecommendations = Array.isArray(recommendedPayload?.events)
          ? recommendedPayload.events
          : [];
        setRecommendedEvents(warmedRecommendations);
      } catch (warmError) {
        console.warn('Recommendation warm-up failed:', warmError?.message || warmError);
      }

      if (isProfileUpdate) {
        setCurrentUser((previousUser) => (
          previousUser && typeof previousUser === 'object'
            ? { ...previousUser, interests: selectedCategories }
            : previousUser
        ));

        if (typeof navigation?.goBack === 'function') {
          navigation.goBack();
        }
        return;
      }

      completeOnboarding(selectedCategories);
    } catch (requestError) {
      setError(requestError?.message || 'Unable to save interests right now.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <Text style={styles.title}>
          {isProfileUpdate ? 'Update your interests' : 'What are you into?'}
        </Text>
        <Text style={styles.subtitle}>Pick 1 to 3 interests to personalize your recommendations.</Text>

        <View style={styles.chipsWrap}>
          {CATEGORY_OPTIONS.map((category) => {
            const selected = selectedCategories.includes(category.key);
            return (
              <Pressable
                key={category.key}
                style={[styles.chip, selected && styles.chipSelected]}
                onPress={() => toggleCategory(category.key)}
              >
                <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                  {category.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={styles.counterText}>{selectedCategories.length}/3 selected</Text>
        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <Pressable
          onPress={handleContinue}
          disabled={!canContinue || submitting}
          style={[
            styles.primaryButton,
            (!canContinue || submitting) && styles.primaryButtonDisabled,
          ]}
        >
          {submitting ? (
            <ActivityIndicator color={COLORS.cream} />
          ) : (
            <Text style={styles.primaryButtonText}>
              {isProfileUpdate ? 'Save Interests' : 'Continue'}
            </Text>
          )}
        </Pressable>

        <Pressable onPress={handleSkip} disabled={submitting} style={styles.skipButton}>
          <Text style={styles.skipText}>{isProfileUpdate ? 'Cancel' : 'Skip'}</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: COLORS.cream,
  },
  container: {
    flex: 1,
    paddingHorizontal: 22,
    paddingTop: 44,
    paddingBottom: 30,
  },
  title: {
    fontSize: 30,
    fontWeight: '800',
    color: COLORS.ink,
  },
  subtitle: {
    marginTop: 8,
    fontSize: 14,
    color: COLORS.gray,
    lineHeight: 20,
  },
  chipsWrap: {
    marginTop: 26,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  chip: {
    borderWidth: 1.5,
    borderColor: COLORS.border,
    backgroundColor: COLORS.white,
    borderRadius: 999,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  chipSelected: {
    borderColor: COLORS.amber,
    backgroundColor: COLORS.amber,
  },
  chipText: {
    color: COLORS.ink,
    fontWeight: '700',
    fontSize: 14,
  },
  chipTextSelected: {
    color: COLORS.ink,
  },
  counterText: {
    marginTop: 18,
    color: COLORS.gray,
    fontSize: 12,
    fontWeight: '600',
  },
  errorText: {
    marginTop: 8,
    color: COLORS.red,
    fontSize: 12,
  },
  primaryButton: {
    marginTop: 26,
    backgroundColor: COLORS.amber,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryButtonDisabled: {
    opacity: 0.6,
  },
  primaryButtonText: {
    color: COLORS.ink,
    fontSize: 15,
    fontWeight: '800',
  },
  skipButton: {
    marginTop: 14,
    alignItems: 'center',
    paddingVertical: 8,
  },
  skipText: {
    color: COLORS.blue,
    fontSize: 14,
    fontWeight: '700',
  },
});
