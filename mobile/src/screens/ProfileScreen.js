import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as SecureStore from 'expo-secure-store';

import { useApp } from '../context/AppContext';
import api, { AUTH_TOKEN_KEY, extractUser } from '../services/api';
import { COLORS, CATEGORY_COLORS } from '../theme';

const ALLOWED_YEARS = ['Freshman', 'Sophomore', 'Junior', 'Senior', 'Graduate'];
const NOTIFICATION_TOGGLE_ITEMS = [
  { key: 'rsvp_confirm', label: 'RSVP Confirmations' },
  { key: 'rsvp_cancel', label: 'RSVP Cancellations' },
  { key: 'event_reminder', label: 'Event Reminders' },
  { key: 'event_update', label: 'Event Updates' },
];
const DEFAULT_NOTIFICATION_PREFERENCES = {
  rsvp_confirm: true,
  rsvp_cancel: true,
  event_reminder: true,
  event_update: true,
  quiet_hours_start: null,
  quiet_hours_end: null,
};
const QUIET_HOUR_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

function normalizeRole(role) {
  if (!role) {
    return 'Student';
  }

  return String(role)
    .split('_')
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(' ');
}

function parseEventDate(event) {
  const rawDate = event?.startsAt || event?.date;
  if (!rawDate) {
    return null;
  }

  const parsed = new Date(rawDate);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed;
}

function normalizeNotificationPreferences(payload) {
  const preferences =
    payload?.notificationPreferences ||
    payload?.preferences ||
    payload?.data?.notificationPreferences ||
    payload?.data?.preferences;

  if (!preferences || typeof preferences !== 'object' || Array.isArray(preferences)) {
    return { ...DEFAULT_NOTIFICATION_PREFERENCES };
  }

  return {
    ...DEFAULT_NOTIFICATION_PREFERENCES,
    ...preferences,
  };
}

function normalizeQuietHoursInput(value) {
  if (value === null || value === undefined) {
    return null;
  }

  const trimmed = String(value).trim();
  return trimmed === '' ? null : trimmed;
}

export default function ProfileScreen({ navigation }) {
  const { currentUser, setCurrentUser, toggleRsvp, logout } = useApp();
  const [profileUser, setProfileUser] = useState(currentUser || null);
  const [rsvpRows, setRsvpRows] = useState([]);

  const [loadingProfile, setLoadingProfile] = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);
  const [updatingEventId, setUpdatingEventId] = useState(null);
  const [loadingNotificationPreferences, setLoadingNotificationPreferences] = useState(true);
  const [notificationPreferences, setNotificationPreferences] = useState(
    DEFAULT_NOTIFICATION_PREFERENCES
  );
  const [savedNotificationPreferences, setSavedNotificationPreferences] = useState(
    DEFAULT_NOTIFICATION_PREFERENCES
  );
  const [updatingPreferenceKey, setUpdatingPreferenceKey] = useState(null);

  const [editMode, setEditMode] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [editForm, setEditForm] = useState({
    name: '',
    major: '',
    year: '',
  });

  const [orgVerificationForm, setOrgVerificationForm] = useState({
    orgName: '',
    description: '',
    proofLink: '',
  });
  const [submittingVerification, setSubmittingVerification] = useState(false);
  const [verificationSubmitted, setVerificationSubmitted] = useState(false);

  const hydrateEditForm = useCallback((user) => {
    setEditForm({
      name: user?.name || '',
      major: user?.major || '',
      year: user?.year || '',
    });
  }, []);

  const refreshRsvps = useCallback(async () => {
    const rsvpPayload = await api.fetchMyRsvps();
    const nextRsvps = Array.isArray(rsvpPayload?.rsvps) ? rsvpPayload.rsvps : [];
    setRsvpRows(nextRsvps);
    return nextRsvps;
  }, []);

  const refreshNotificationPreferences = useCallback(async () => {
    setLoadingNotificationPreferences(true);
    try {
      const payload = await api.getNotificationPreferences();
      const nextPreferences = normalizeNotificationPreferences(payload);
      setNotificationPreferences(nextPreferences);
      setSavedNotificationPreferences(nextPreferences);
      return nextPreferences;
    } finally {
      setLoadingNotificationPreferences(false);
    }
  }, []);

  const refreshProfileData = useCallback(async () => {
    setLoadingProfile(true);
    try {
      const [mePayload] = await Promise.all([api.getMe(), refreshRsvps()]);
      const user = extractUser(mePayload) || mePayload;

      if (!user || typeof user !== 'object') {
        throw new Error('Invalid profile response');
      }

      setProfileUser(user);
      setCurrentUser(user);
      hydrateEditForm(user);
    } catch (requestError) {
      Alert.alert(
        'Unable to Load Profile',
        requestError?.message || 'Please try again in a moment.'
      );
    } finally {
      setLoadingProfile(false);
    }
  }, [hydrateEditForm, refreshRsvps, setCurrentUser]);

  useEffect(() => {
    refreshProfileData();
  }, [refreshProfileData]);

  useEffect(() => {
    refreshNotificationPreferences().catch((requestError) => {
      Alert.alert(
        'Unable to Load Notification Settings',
        requestError?.message || 'Please try again in a moment.'
      );
    });
  }, [refreshNotificationPreferences]);

  const effectiveUser = profileUser || currentUser || {};
  const displayName = effectiveUser?.name || 'CampusConnect Student';
  const displayEmail = effectiveUser?.email || 'student@cpp.edu';
  const displayMajor = effectiveUser?.major || 'Undeclared';
  const displayYear = effectiveUser?.year || 'Student';
  const displayRole = normalizeRole(effectiveUser?.role);

  const myEvents = useMemo(
    () => rsvpRows.map((entry) => entry?.event).filter(Boolean),
    [rsvpRows]
  );

  const eventsThisMonth = useMemo(() => {
    const now = new Date();
    const month = now.getMonth();
    const year = now.getFullYear();

    return myEvents.filter((event) => {
      const eventDate = parseEventDate(event);
      return (
        eventDate &&
        eventDate.getMonth() === month &&
        eventDate.getFullYear() === year
      );
    }).length;
  }, [myEvents]);

  const initials = displayName
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const handleLogout = async () => {
    if (loggingOut) {
      return;
    }

    setLoggingOut(true);
    try {
      await SecureStore.deleteItemAsync(AUTH_TOKEN_KEY);
      await logout();
    } finally {
      setLoggingOut(false);
    }
  };

  const handleCancelRsvp = async (eventId) => {
    if (updatingEventId) {
      return;
    }

    setUpdatingEventId(String(eventId));
    try {
      await toggleRsvp(eventId);
      await refreshRsvps();
    } catch (requestError) {
      Alert.alert(
        'Unable to Cancel RSVP',
        requestError?.message || 'Please try again in a moment.'
      );
    } finally {
      setUpdatingEventId(null);
    }
  };

  const handleSaveProfile = async () => {
    if (savingProfile) {
      return;
    }

    const name = editForm.name.trim();
    const major = editForm.major.trim();
    const year = editForm.year.trim();

    if (!name || !major || !year) {
      Alert.alert('Missing Information', 'Name, major, and year are required.');
      return;
    }

    if (!ALLOWED_YEARS.includes(year)) {
      Alert.alert(
        'Invalid Year',
        `Year must be one of: ${ALLOWED_YEARS.join(', ')}`
      );
      return;
    }

    setSavingProfile(true);
    try {
      const updatePayload = await api.updateMyProfile({ name, major, year });
      const updatedUser =
        extractUser(updatePayload) ||
        updatePayload?.user ||
        updatePayload;

      if (!updatedUser || typeof updatedUser !== 'object') {
        throw new Error('Invalid update response');
      }

      setProfileUser(updatedUser);
      setCurrentUser(updatedUser);
      hydrateEditForm(updatedUser);
      setEditMode(false);
    } catch (requestError) {
      Alert.alert(
        'Unable to Save Profile',
        requestError?.message || 'Please try again in a moment.'
      );
    } finally {
      setSavingProfile(false);
    }
  };

  const handleSubmitVerification = async () => {
    if (submittingVerification || verificationSubmitted) {
      return;
    }

    const payload = {
      orgName: orgVerificationForm.orgName.trim(),
      description: orgVerificationForm.description.trim(),
      proofLink: orgVerificationForm.proofLink.trim(),
    };

    if (!payload.orgName) {
      Alert.alert('Missing Information', 'Organization name is required.');
      return;
    }

    setSubmittingVerification(true);
    try {
      await api.submitOrgVerification(payload);
      setVerificationSubmitted(true);
    } catch (requestError) {
      Alert.alert(
        'Unable to Submit Request',
        requestError?.message || 'Please try again in a moment.'
      );
    } finally {
      setSubmittingVerification(false);
    }
  };

  const handleTogglePreference = async (preferenceKey, value) => {
    const previousPreferences = savedNotificationPreferences;
    setNotificationPreferences((prev) => ({ ...prev, [preferenceKey]: value }));
    setUpdatingPreferenceKey(preferenceKey);

    try {
      const payload = await api.updateNotificationPreferences({
        [preferenceKey]: value,
      });
      const nextPreferences = normalizeNotificationPreferences(payload);
      setNotificationPreferences(nextPreferences);
      setSavedNotificationPreferences(nextPreferences);
    } catch (requestError) {
      setNotificationPreferences(previousPreferences);
      Alert.alert(
        'Unable to Update Notification Settings',
        requestError?.message || 'Please try again in a moment.'
      );
    } finally {
      setUpdatingPreferenceKey(null);
    }
  };

  const handleQuietHoursChange = (field, value) => {
    setNotificationPreferences((prev) => ({ ...prev, [field]: value }));
  };

  const handleQuietHoursBlur = async (field) => {
    const nextValue = normalizeQuietHoursInput(notificationPreferences?.[field]);

    if (nextValue !== null && !QUIET_HOUR_PATTERN.test(nextValue)) {
      Alert.alert('Invalid Time', 'Use HH:MM in 24-hour format, or leave blank.');
      setNotificationPreferences((prev) => ({
        ...prev,
        [field]: savedNotificationPreferences?.[field] ?? null,
      }));
      return;
    }

    const previousValue = savedNotificationPreferences?.[field] ?? null;
    if (previousValue === nextValue) {
      setNotificationPreferences((prev) => ({ ...prev, [field]: nextValue }));
      return;
    }

    const previousPreferences = savedNotificationPreferences;
    setNotificationPreferences((prev) => ({ ...prev, [field]: nextValue }));
    setUpdatingPreferenceKey(field);

    try {
      const payload = await api.updateNotificationPreferences({
        [field]: nextValue,
      });
      const nextPreferences = normalizeNotificationPreferences(payload);
      setNotificationPreferences(nextPreferences);
      setSavedNotificationPreferences(nextPreferences);
    } catch (requestError) {
      setNotificationPreferences(previousPreferences);
      Alert.alert(
        'Unable to Update Quiet Hours',
        requestError?.message || 'Please try again in a moment.'
      );
    } finally {
      setUpdatingPreferenceKey(null);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.logo}>My Profile</Text>
        <TouchableOpacity
          style={styles.logoutBtn}
          onPress={handleLogout}
          disabled={loggingOut}
        >
          {loggingOut ? (
            <ActivityIndicator color={COLORS.amber} size="small" />
          ) : (
            <Text style={styles.logoutText}>Logout</Text>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 40 }}
      >
        <View style={styles.profileHero}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
          <View style={styles.heroContent}>
            <Text style={styles.name}>{displayName}</Text>
            <Text style={styles.email}>{displayEmail}</Text>
            <View style={styles.chips}>
              <View style={styles.chip}>
                <Text style={styles.chipText}>{displayMajor}</Text>
              </View>
              <View style={styles.chip}>
                <Text style={styles.chipText}>{displayYear}</Text>
              </View>
              <View style={styles.chip}>
                <Text style={styles.chipText}>{displayRole}</Text>
              </View>
            </View>

            {!editMode ? (
              <TouchableOpacity
                style={styles.editBtn}
                onPress={() => {
                  hydrateEditForm(effectiveUser);
                  setEditMode(true);
                }}
              >
                <Text style={styles.editBtnText}>Edit Profile</Text>
              </TouchableOpacity>
            ) : (
              <View style={styles.editPanel}>
                <TextInput
                  value={editForm.name}
                  onChangeText={(value) =>
                    setEditForm((prev) => ({ ...prev, name: value }))
                  }
                  placeholder="Name"
                  placeholderTextColor={COLORS.gray}
                  style={styles.editInput}
                />
                <TextInput
                  value={editForm.major}
                  onChangeText={(value) =>
                    setEditForm((prev) => ({ ...prev, major: value }))
                  }
                  placeholder="Major"
                  placeholderTextColor={COLORS.gray}
                  style={styles.editInput}
                />
                <TextInput
                  value={editForm.year}
                  onChangeText={(value) =>
                    setEditForm((prev) => ({ ...prev, year: value }))
                  }
                  placeholder="Year"
                  placeholderTextColor={COLORS.gray}
                  style={styles.editInput}
                />
                <Text style={styles.editHint}>
                  Valid years: {ALLOWED_YEARS.join(', ')}
                </Text>
                <View style={styles.editActions}>
                  <TouchableOpacity
                    onPress={() => {
                      hydrateEditForm(effectiveUser);
                      setEditMode(false);
                    }}
                    style={[styles.editActionBtn, styles.editCancelBtn]}
                    disabled={savingProfile}
                  >
                    <Text style={styles.editCancelText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={handleSaveProfile}
                    style={[styles.editActionBtn, styles.editSaveBtn]}
                    disabled={savingProfile}
                  >
                    {savingProfile ? (
                      <ActivityIndicator color={COLORS.ink} size="small" />
                    ) : (
                      <Text style={styles.editSaveText}>Save</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        </View>

        <View style={styles.statsRow}>
          <StatBox icon="calendar" label="RSVPs" value={rsvpRows.length} />
          <StatBox icon="star" label="This Month" value={eventsThisMonth} />
          <StatBox icon="person" label="Role" value={displayRole} />
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Notification Settings</Text>
          </View>
          <View style={styles.notificationCard}>
            {loadingNotificationPreferences ? (
              <View style={styles.loadingWrap}>
                <ActivityIndicator color={COLORS.amber} />
              </View>
            ) : (
              <>
                {NOTIFICATION_TOGGLE_ITEMS.map((item) => (
                  <View key={item.key} style={styles.preferenceRow}>
                    <Text style={styles.preferenceLabel}>{item.label}</Text>
                    <Switch
                      value={Boolean(notificationPreferences?.[item.key])}
                      onValueChange={(nextValue) =>
                        handleTogglePreference(item.key, nextValue)
                      }
                      disabled={Boolean(updatingPreferenceKey)}
                      thumbColor={COLORS.white}
                      trackColor={{ false: '#9ca3af', true: COLORS.blue }}
                    />
                  </View>
                ))}
                <View style={[styles.preferenceRow, styles.preferenceRowLast]}>
                  <View style={styles.quietHoursInfo}>
                    <Text style={styles.preferenceLabel}>Quiet Hours (UTC)</Text>
                    <Text style={styles.quietHoursHint}>Use HH:MM format</Text>
                  </View>
                  <View style={styles.quietHoursInputs}>
                    <TextInput
                      value={notificationPreferences?.quiet_hours_start ?? ''}
                      onChangeText={(value) => handleQuietHoursChange('quiet_hours_start', value)}
                      onBlur={() => handleQuietHoursBlur('quiet_hours_start')}
                      placeholder="HH:MM"
                      placeholderTextColor={COLORS.gray}
                      autoCapitalize="none"
                      style={styles.quietHoursInput}
                    />
                    <Text style={styles.quietHoursSeparator}>to</Text>
                    <TextInput
                      value={notificationPreferences?.quiet_hours_end ?? ''}
                      onChangeText={(value) => handleQuietHoursChange('quiet_hours_end', value)}
                      onBlur={() => handleQuietHoursBlur('quiet_hours_end')}
                      placeholder="HH:MM"
                      placeholderTextColor={COLORS.gray}
                      autoCapitalize="none"
                      style={styles.quietHoursInput}
                    />
                  </View>
                </View>
              </>
            )}
          </View>
          <TouchableOpacity
            style={styles.updateInterestsButton}
            onPress={() =>
              navigation.navigate('InterestsScreen', {
                mode: 'profile_update',
                initialInterests: Array.isArray(effectiveUser?.interests)
                  ? effectiveUser.interests
                  : [],
              })
            }
          >
            <Text style={styles.updateInterestsButtonText}>Update Interests</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>My RSVPs</Text>
            <Text style={styles.sectionSub}>{myEvents.length} events</Text>
          </View>

          {loadingProfile ? (
            <View style={styles.loadingWrap}>
              <ActivityIndicator color={COLORS.amber} />
            </View>
          ) : myEvents.length === 0 ? (
            <View style={styles.empty}>
              <Ionicons name="calendar-outline" size={38} color={COLORS.gray} />
              <Text style={styles.emptyText}>No RSVPs yet</Text>
              <Text style={styles.emptySub}>
                Browse events and RSVP to see them here
              </Text>
            </View>
          ) : (
            myEvents.map((event) => {
              const cat = CATEGORY_COLORS[event.category] || CATEGORY_COLORS.Default;
              return (
                <View key={event.id} style={styles.myCard}>
                  <View
                    style={[styles.myCardAccent, { backgroundColor: cat.header }]}
                  />
                  <View style={styles.myCardContent}>
                    <View
                      style={[
                        styles.catBadge,
                        { backgroundColor: cat.bg, borderColor: cat.border },
                      ]}
                    >
                      <Text style={[styles.catText, { color: cat.text }]}>
                        {event.category}
                      </Text>
                    </View>
                    <Text style={styles.myCardTitle} numberOfLines={2}>
                      {event.title}
                    </Text>
                    <Text style={styles.myCardMeta}>
                      {event.date} - {event.location}
                    </Text>
                  </View>
                  <View style={styles.myCardActions}>
                    <TouchableOpacity
                      onPress={() =>
                        navigation.navigate('EventDetail', { eventId: event.id })
                      }
                      style={styles.iconBtn}
                    >
                      <Ionicons name="qr-code-outline" size={22} color={COLORS.blue} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => handleCancelRsvp(event.id)}
                      style={styles.iconBtn}
                      disabled={updatingEventId === String(event.id)}
                    >
                      <Ionicons
                        name="close-circle-outline"
                        size={22}
                        color={COLORS.red}
                      />
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })
          )}
        </View>

        {effectiveUser?.role === 'org_leader' ? (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Verify My Organization</Text>
            </View>
            <View style={styles.verifyCard}>
              {verificationSubmitted ? (
                <View style={styles.verifySuccessBanner}>
                  <Text style={styles.verifySuccessText}>
                    Request submitted — an admin will review it shortly.
                  </Text>
                </View>
              ) : null}
              <TextInput
                value={orgVerificationForm.orgName}
                onChangeText={(value) =>
                  setOrgVerificationForm((prev) => ({ ...prev, orgName: value }))
                }
                placeholder="Organization name"
                placeholderTextColor={COLORS.gray}
                style={styles.verifyInput}
                editable={!submittingVerification && !verificationSubmitted}
              />
              <TextInput
                value={orgVerificationForm.description}
                onChangeText={(value) =>
                  setOrgVerificationForm((prev) => ({ ...prev, description: value }))
                }
                placeholder="Organization description"
                placeholderTextColor={COLORS.gray}
                multiline
                style={[styles.verifyInput, styles.verifyTextArea]}
                editable={!submittingVerification && !verificationSubmitted}
              />
              <TextInput
                value={orgVerificationForm.proofLink}
                onChangeText={(value) =>
                  setOrgVerificationForm((prev) => ({
                    ...prev,
                    proofLink: value,
                  }))
                }
                placeholder="Proof document link"
                placeholderTextColor={COLORS.gray}
                autoCapitalize="none"
                style={styles.verifyInput}
                editable={!submittingVerification && !verificationSubmitted}
              />
              <TouchableOpacity
                onPress={handleSubmitVerification}
                style={[
                  styles.verifySubmitBtn,
                  verificationSubmitted ? styles.verifySubmitBtnDisabled : null,
                ]}
                disabled={submittingVerification || verificationSubmitted}
              >
                {submittingVerification ? (
                  <ActivityIndicator color={COLORS.ink} size="small" />
                ) : (
                  <Text style={styles.verifySubmitText}>
                    {verificationSubmitted ? 'Request Submitted' : 'Submit Verification'}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function StatBox({ icon, label, value }) {
  return (
    <View style={styles.statBox}>
      <Ionicons name={icon} size={20} color={COLORS.amber} />
      <Text style={styles.statValue} numberOfLines={1}>
        {value}
      </Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.cream },
  header: {
    backgroundColor: COLORS.ink,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 3,
    borderBottomColor: COLORS.amber,
  },
  logo: { color: COLORS.amber, fontSize: 18, fontWeight: '800' },
  logoutBtn: {
    borderWidth: 1,
    borderColor: COLORS.amber,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    minWidth: 72,
    alignItems: 'center',
  },
  logoutText: { color: COLORS.amber, fontSize: 12, fontWeight: '700' },

  profileHero: {
    backgroundColor: COLORS.ink,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 16,
    padding: 20,
    paddingBottom: 24,
  },
  avatar: {
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: COLORS.blue,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: COLORS.amber,
  },
  avatarText: { color: COLORS.cream, fontSize: 22, fontWeight: '800' },
  heroContent: { flex: 1 },
  name: { color: COLORS.cream, fontSize: 18, fontWeight: '800' },
  email: { color: '#999', fontSize: 12, marginTop: 2 },
  chips: { flexDirection: 'row', gap: 6, marginTop: 8, flexWrap: 'wrap' },
  chip: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  chipText: { color: '#ddd', fontSize: 11, fontWeight: '600' },
  editBtn: {
    marginTop: 10,
    alignSelf: 'flex-start',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.amber,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  editBtnText: {
    color: COLORS.amber,
    fontSize: 12,
    fontWeight: '700',
  },
  editPanel: {
    marginTop: 10,
    gap: 7,
  },
  editInput: {
    borderWidth: 1,
    borderColor: '#2e2e36',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 9,
    color: COLORS.cream,
    backgroundColor: 'rgba(255,255,255,0.08)',
    fontSize: 13,
  },
  editHint: {
    color: '#b6b6c2',
    fontSize: 10,
  },
  editActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 2,
  },
  editActionBtn: {
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    minWidth: 76,
    alignItems: 'center',
  },
  editCancelBtn: {
    borderWidth: 1,
    borderColor: '#63637a',
  },
  editSaveBtn: {
    backgroundColor: COLORS.amber,
  },
  editCancelText: {
    color: '#d3d3df',
    fontSize: 12,
    fontWeight: '700',
  },
  editSaveText: {
    color: COLORS.ink,
    fontSize: 12,
    fontWeight: '800',
  },

  statsRow: {
    flexDirection: 'row',
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    padding: 12,
    gap: 10,
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: COLORS.cream,
    borderRadius: 12,
    paddingVertical: 14,
    gap: 4,
  },
  statValue: { fontSize: 16, fontWeight: '800', color: COLORS.ink, maxWidth: '100%' },
  statLabel: {
    fontSize: 10,
    color: COLORS.gray,
    fontWeight: '600',
    textAlign: 'center',
  },

  section: { paddingHorizontal: 16, paddingTop: 22 },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: COLORS.ink },
  sectionSub: { fontSize: 12, color: COLORS.gray },

  notificationCard: {
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    overflow: 'hidden',
  },
  preferenceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  preferenceRowLast: {
    borderBottomWidth: 0,
    alignItems: 'flex-start',
  },
  preferenceLabel: {
    fontSize: 13,
    color: COLORS.ink,
    fontWeight: '600',
    flexShrink: 1,
  },
  quietHoursInfo: {
    flexShrink: 1,
    paddingTop: 2,
  },
  quietHoursHint: {
    color: COLORS.gray,
    fontSize: 11,
    marginTop: 4,
  },
  quietHoursInputs: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  quietHoursInput: {
    width: 68,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 7,
    fontSize: 12,
    color: COLORS.ink,
    backgroundColor: COLORS.cream,
    textAlign: 'center',
  },
  quietHoursSeparator: {
    color: COLORS.gray,
    fontSize: 12,
    fontWeight: '600',
  },
  updateInterestsButton: {
    marginTop: 12,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  updateInterestsButtonText: {
    color: COLORS.blue,
    fontSize: 13,
    fontWeight: '700',
  },

  loadingWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 24,
  },
  empty: { alignItems: 'center', paddingVertical: 32, gap: 8 },
  emptyText: { fontSize: 15, fontWeight: '700', color: COLORS.ink },
  emptySub: {
    fontSize: 12,
    color: COLORS.gray,
    marginTop: 4,
    textAlign: 'center',
  },

  myCard: {
    flexDirection: 'row',
    backgroundColor: COLORS.white,
    borderRadius: 14,
    marginBottom: 10,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  myCardAccent: { width: 5 },
  myCardContent: { flex: 1, padding: 12, gap: 4 },
  catBadge: {
    alignSelf: 'flex-start',
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 7,
    paddingVertical: 2,
    marginBottom: 3,
  },
  catText: { fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },
  myCardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.ink,
    lineHeight: 19,
  },
  myCardMeta: { fontSize: 11, color: COLORS.gray },
  myCardActions: {
    padding: 10,
    gap: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBtn: { padding: 5 },

  verifyCard: {
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    padding: 12,
    gap: 10,
  },
  verifySuccessBanner: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#10b981',
    backgroundColor: '#ecfdf5',
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  verifySuccessText: {
    color: '#065f46',
    fontSize: 12,
    fontWeight: '700',
  },
  verifyInput: {
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 10,
    fontSize: 13,
    color: COLORS.ink,
    backgroundColor: COLORS.cream,
  },
  verifyTextArea: {
    minHeight: 84,
    textAlignVertical: 'top',
  },
  verifySubmitBtn: {
    backgroundColor: COLORS.amber,
    borderRadius: 10,
    paddingVertical: 11,
    alignItems: 'center',
  },
  verifySubmitBtnDisabled: {
    opacity: 0.7,
  },
  verifySubmitText: {
    color: COLORS.ink,
    fontSize: 13,
    fontWeight: '800',
  },
});
