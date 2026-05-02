import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../context/AppContext';
import { EVENTS as MOCK_EVENTS } from '../data/mockData';
import { getEventById, trackEventView, getEventAnalytics, purchaseTicket } from '../services/api';
import { COLORS, CATEGORY_COLORS } from '../theme';

function InfoRow({ icon, label, color }) {
  return (
    <View style={styles.infoRow}>
      <Ionicons name={icon} size={18} color={color || COLORS.gray} style={styles.infoIcon} />
      <Text style={[styles.infoText, color && { color, fontWeight: '700' }]}>{label}</Text>
    </View>
  );
}

function getFallbackEvent(eventId) {
  return MOCK_EVENTS.find((event) => String(event.id) === String(eventId)) || null;
}

function getEventPriceAmount(event) {
  if (!event) {
    return 0;
  }

  const rawPrice = event.priceAmount ?? event.price_amount ?? event.price;

  if (typeof rawPrice === 'number' && Number.isFinite(rawPrice)) {
    return Math.max(rawPrice, 0);
  }

  if (typeof rawPrice === 'string') {
    const normalized = rawPrice.replace(/[^0-9.-]/g, '');
    const parsed = Number.parseFloat(normalized);

    if (Number.isFinite(parsed)) {
      return Math.max(parsed, 0);
    }
  }

  return 0;
}

function isEventFree(event) {
  if (!event) {
    return true;
  }

  if (typeof event.isFree === 'boolean') {
    return event.isFree;
  }

  if (typeof event.is_free === 'boolean') {
    return event.is_free;
  }

  return getEventPriceAmount(event) <= 0;
}

function formatPrice(amount) {
  return `$${amount.toFixed(2)}`;
}

function PurchaseModal({ visible, event, purchaseLoading, onConfirm, onCancel }) {
  if (!event) {
    return null;
  }

  const ticketPrice = getEventPriceAmount(event);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onCancel}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalCard}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Purchase Ticket</Text>
            <TouchableOpacity onPress={onCancel}>
              <Ionicons name="close" size={22} color={COLORS.ink} />
            </TouchableOpacity>
          </View>

          <Text style={styles.purchaseEventTitle} numberOfLines={2}>
            {event.title}
          </Text>
          <Text style={styles.purchasePriceLabel}>Total: {formatPrice(ticketPrice)}</Text>

          <TouchableOpacity
            style={[styles.purchaseConfirmBtn, purchaseLoading && styles.purchaseConfirmBtnDisabled]}
            onPress={onConfirm}
            disabled={purchaseLoading}
            activeOpacity={0.85}
          >
            <Text style={styles.purchaseConfirmText}>
              {purchaseLoading ? 'Processing...' : 'Confirm Purchase (Demo)'}
            </Text>
          </TouchableOpacity>

          <Text style={styles.purchaseStripeNote}>Payment processing powered by Stripe</Text>

          <TouchableOpacity style={styles.purchaseCancelBtn} onPress={onCancel} activeOpacity={0.85}>
            <Text style={styles.purchaseCancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

export default function EventDetailScreen({ navigation, route }) {
  const { eventId } = route.params;
  const { toggleRsvp, isRsvped, fetchMyRsvps, refreshNotifications, currentUser } = useApp();
  const [event, setEvent] = useState(null);
  const [fetchLoading, setFetchLoading] = useState(true);
  const [error, setError] = useState(null);
  const [demoMode, setDemoMode] = useState(false);
  const [rsvpLoading, setRsvpLoading] = useState(false);
  const [purchaseModalVisible, setPurchaseModalVisible] = useState(false);
  const [purchaseLoading, setPurchaseLoading] = useState(false);
  const [analyticsVisible, setAnalyticsVisible] = useState(false);
  const [analyticsData, setAnalyticsData] = useState(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);

  const loadEvent = useCallback(async () => {
    setFetchLoading(true);
    setError(null);

    try {
      const payload = await getEventById(eventId);
      setEvent(payload);
      setDemoMode(false);
    } catch (fetchError) {
      const fallbackEvent = getFallbackEvent(eventId);
      setError(fetchError);
      setEvent(fallbackEvent);
      setDemoMode(Boolean(fallbackEvent));
    } finally {
      setFetchLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    loadEvent();
  }, [loadEvent]);

  useEffect(() => {
    trackEventView(eventId).catch(() => {});
  }, [eventId]);

  const rsvped = isRsvped(eventId);
  const eventIsFree = isEventFree(event);
  const eventPriceAmount = getEventPriceAmount(event);
  const eventPriceLabel = formatPrice(eventPriceAmount);
  const canEditEvent =
    currentUser?.role === 'org_leader' || currentUser?.role === 'admin';

  if (fetchLoading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color={COLORS.cream} />
          </TouchableOpacity>
          <Text style={styles.barTitle}>Loading event...</Text>
          <View style={{ width: 30 }} />
        </View>
        <View style={styles.fetchLoadingWrap}>
          <ActivityIndicator size="large" color={COLORS.amber} />
        </View>
      </SafeAreaView>
    );
  }

  if (!event) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color={COLORS.cream} />
          </TouchableOpacity>
          <Text style={styles.barTitle}>Event Details</Text>
          <View style={{ width: 30 }} />
        </View>

        <View style={styles.errorState}>
          <Text style={styles.errorStateTitle}>Unable to load this event.</Text>
          <Text style={styles.errorStateSub}>Please check your connection and try again.</Text>
          <TouchableOpacity style={styles.retryBtnLarge} onPress={loadEvent}>
            <Text style={styles.retryBtnLargeText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const cat = CATEGORY_COLORS[event.category] || CATEGORY_COLORS.Default;
  const safeCapacity = Math.max(Number(event.capacity) || 0, 1);
  const pct = Math.round(((Number(event.rsvpCount) || 0) / safeCapacity) * 100);
  const spotsLeft = Math.max(safeCapacity - (Number(event.rsvpCount) || 0), 0);

  const handleRsvp = async () => {
    if (rsvpLoading) {
      return;
    }

    setRsvpLoading(true);
    try {
      await toggleRsvp(eventId, event);

      if (!rsvped) {
        Alert.alert(
          'RSVP Confirmed',
          `You're registered for "${event.title}". View your ticket in My Ticket below.`
        );
      }
    } catch (requestError) {
      Alert.alert(
        'RSVP Failed',
        requestError?.message || 'We could not process your RSVP right now.'
      );
    } finally {
      setRsvpLoading(false);
    }
  };

  const handleViewAnalytics = async () => {
    setAnalyticsVisible(true);
    if (analyticsData) return;
    setAnalyticsLoading(true);
    try {
      const data = await getEventAnalytics(eventId);
      setAnalyticsData(data);
    } catch {
      Alert.alert('Error', 'Could not load analytics. Please try again.');
      setAnalyticsVisible(false);
    } finally {
      setAnalyticsLoading(false);
    }
  };

  const handleEditEvent = () => {
    const params = { event };
    const routeNames = navigation.getState()?.routeNames || [];

    if (routeNames.includes('CreateEvent')) {
      navigation.navigate('CreateEvent', params);
      return;
    }

    navigation.getParent()?.navigate('Events', {
      screen: 'CreateEvent',
      params,
    });
  };

  const handleCheckInAttendees = () => {
    const params = { event };
    const routeNames = navigation.getState()?.routeNames || [];

    if (routeNames.includes('CheckInScanner')) {
      navigation.navigate('CheckInScanner', params);
      return;
    }

    navigation.getParent()?.navigate('Events', {
      screen: 'CheckInScanner',
      params,
    });
  };

  const handleConfirmPurchase = async () => {
    if (purchaseLoading) {
      return;
    }

    setPurchaseLoading(true);
    try {
      const purchaseResponse = await purchaseTicket(eventId);
      await fetchMyRsvps();
      await refreshNotifications();
      setPurchaseModalVisible(false);

      Alert.alert(
        'Purchase Confirmed',
        purchaseResponse?.demoMode ? 'Ticket purchased! (Demo mode)' : 'Ticket purchased!'
      );
    } catch (purchaseError) {
      Alert.alert(
        'Purchase Failed',
        purchaseError?.message || 'We could not process your ticket purchase right now.'
      );
    } finally {
      setPurchaseLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={COLORS.cream} />
        </TouchableOpacity>
        <Text style={styles.barTitle} numberOfLines={1}>
          {event.title}
        </Text>
        <View style={{ width: 30 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {demoMode && (
          <View style={styles.demoBanner}>
            <Text style={styles.demoBannerText}>Demo mode: event details are from offline fallback data.</Text>
          </View>
        )}

        {error && (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>Could not refresh from live API.</Text>
            <TouchableOpacity style={styles.retryBtn} onPress={loadEvent}>
              <Text style={styles.retryText}>Retry</Text>
            </TouchableOpacity>
          </View>
        )}

        <LinearGradient
          colors={[cat.header, '#080810']}
          style={styles.hero}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <View style={styles.heroTags}>
            <View style={styles.catTag}>
              <Text style={styles.catTagText}>{event.category.toUpperCase()}</Text>
            </View>
            {event.aiRecommended && (
              <View style={styles.aiTag}>
                <Text style={styles.aiTagText}>AI Recommended</Text>
              </View>
            )}
          </View>
          <Text style={styles.heroTitle}>{event.title}</Text>
          <Text style={styles.heroOrg}>{event.org}</Text>
        </LinearGradient>

        <View style={styles.body}>
          <InfoRow icon="calendar-outline" label={event.date} />
          <InfoRow icon="time-outline" label={event.time} />
          <InfoRow icon="location-outline" label={event.location} />
          <InfoRow
            icon="people-outline"
            label={`${Number(event.rsvpCount || 0).toLocaleString()} attending - ${spotsLeft} spots left`}
          />
          <InfoRow
            icon="ticket-outline"
            label={eventIsFree ? 'Free Admission' : eventPriceLabel}
            color={eventIsFree ? COLORS.greenMid : COLORS.amber}
          />

          <View style={styles.capacityWrap}>
            <View style={styles.progressBg}>
              <View
                style={[
                  styles.progressFill,
                  {
                    width: `${Math.min(pct, 100)}%`,
                    backgroundColor: pct > 80 ? COLORS.red : COLORS.greenMid,
                  },
                ]}
              />
            </View>
            <Text style={styles.capacityLabel}>
              {pct}% full{pct > 80 ? ' - RSVP soon!' : ''}
            </Text>
          </View>

          <Text style={styles.descLabel}>About this event</Text>
          <Text style={styles.desc}>{event.description}</Text>

          {Array.isArray(event.tags) && event.tags.length > 0 && (
            <View style={styles.tagRow}>
              {event.tags.map((tag) => (
                <View key={tag} style={styles.tagChip}>
                  <Text style={styles.tagText}>#{tag}</Text>
                </View>
              ))}
            </View>
          )}

          {canEditEvent && (
            <TouchableOpacity
              style={styles.editBtn}
              onPress={handleEditEvent}
              activeOpacity={0.85}
            >
              <Ionicons name="create-outline" size={18} color={COLORS.ink} />
              <Text style={styles.editBtnText}>Edit Event</Text>
            </TouchableOpacity>
          )}

          {canEditEvent && (
            <TouchableOpacity
              style={styles.analyticsBtn}
              onPress={handleViewAnalytics}
              activeOpacity={0.85}
            >
              <Ionicons name="bar-chart-outline" size={18} color={COLORS.cream} />
              <Text style={styles.analyticsBtnText}>View Analytics</Text>
            </TouchableOpacity>
          )}

          {canEditEvent && (
            <TouchableOpacity
              style={styles.checkInBtn}
              onPress={handleCheckInAttendees}
              activeOpacity={0.85}
            >
              <Ionicons name="scan-outline" size={18} color={COLORS.cream} />
              <Text style={styles.checkInBtnText}>Check In Attendees</Text>
            </TouchableOpacity>
          )}

          {!rsvped && !eventIsFree ? (
            <TouchableOpacity
              style={[styles.rsvpBtn, styles.buyBtn]}
              onPress={() => setPurchaseModalVisible(true)}
              activeOpacity={0.85}
            >
              <Ionicons name="card-outline" size={20} color={COLORS.cream} />
              <Text style={styles.rsvpText}>{`Buy Ticket \u2014 ${eventPriceLabel}`}</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.rsvpBtn, rsvped && styles.rsvpBtnGreen]}
              onPress={handleRsvp}
              disabled={rsvpLoading}
              activeOpacity={0.85}
            >
              <Ionicons
                name={rsvped ? 'checkmark-circle' : 'add-circle-outline'}
                size={20}
                color={COLORS.cream}
              />
              <Text style={styles.rsvpText}>
                {rsvpLoading ? 'Processing...' : rsvped ? 'RSVPed' : 'RSVP for Free'}
              </Text>
            </TouchableOpacity>
          )}

          {rsvped && (
            <TouchableOpacity
              style={styles.ticketBtn}
              onPress={() => navigation.navigate('MyTicket', { eventId, event })}
              activeOpacity={0.85}
            >
              <Ionicons name="qr-code-outline" size={20} color={COLORS.blue} />
              <Text style={styles.ticketText}>View My Ticket / Check-in QR</Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>

      <PurchaseModal
        visible={purchaseModalVisible}
        event={event}
        purchaseLoading={purchaseLoading}
        onCancel={() => {
          if (purchaseLoading) {
            return;
          }
          setPurchaseModalVisible(false);
        }}
        onConfirm={handleConfirmPurchase}
      />

      <Modal
        visible={analyticsVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setAnalyticsVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Event Analytics</Text>
              <TouchableOpacity onPress={() => setAnalyticsVisible(false)}>
                <Ionicons name="close" size={22} color={COLORS.ink} />
              </TouchableOpacity>
            </View>

            {analyticsLoading && (
              <ActivityIndicator size="large" color={COLORS.amber} style={{ marginVertical: 32 }} />
            )}

            {!analyticsLoading && analyticsData && (
              <ScrollView showsVerticalScrollIndicator={false}>
                <Text style={styles.analyticsEventTitle} numberOfLines={2}>
                  {analyticsData.title}
                </Text>

                <View style={styles.statRow}>
                  <View style={styles.statCard}>
                    <Text style={styles.statValue}>{analyticsData.rsvpCount ?? 0}</Text>
                    <Text style={styles.statLabel}>RSVPs</Text>
                  </View>
                  <View style={styles.statCard}>
                    <Text style={styles.statValue}>{analyticsData.checkedInCount ?? 0}</Text>
                    <Text style={styles.statLabel}>Checked In</Text>
                  </View>
                  <View style={styles.statCard}>
                    <Text style={styles.statValue}>{analyticsData.capacity ?? '—'}</Text>
                    <Text style={styles.statLabel}>Capacity</Text>
                  </View>
                </View>

                <Text style={styles.analyticsSubhead}>RSVP Rate</Text>
                <View style={styles.progressBg}>
                  <View
                    style={[
                      styles.progressFill,
                      {
                        width: `${Math.min(parseFloat(analyticsData.rsvpRate) || 0, 100)}%`,
                        backgroundColor: COLORS.blue,
                      },
                    ]}
                  />
                </View>
                <Text style={styles.analyticsRateLabel}>{analyticsData.rsvpRate ?? 0}% of capacity</Text>

                <Text style={styles.analyticsSubhead}>Check-in Rate</Text>
                <View style={styles.progressBg}>
                  <View
                    style={[
                      styles.progressFill,
                      {
                        width: `${Math.min(parseFloat(analyticsData.checkInRate) || 0, 100)}%`,
                        backgroundColor: COLORS.greenMid,
                      },
                    ]}
                  />
                </View>
                <Text style={styles.analyticsRateLabel}>{analyticsData.checkInRate ?? 0}% of RSVPs attended</Text>

                {Array.isArray(analyticsData.rsvpTimeline) && analyticsData.rsvpTimeline.length > 0 && (
                  <>
                    <Text style={styles.analyticsSubhead}>RSVP Timeline</Text>
                    {analyticsData.rsvpTimeline.map((row) => (
                      <View key={row.date} style={styles.timelineRow}>
                        <Text style={styles.timelineDate}>{row.date}</Text>
                        <Text style={styles.timelineCount}>{row.count} RSVPs</Text>
                      </View>
                    ))}
                  </>
                )}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.cream },
  topBar: {
    backgroundColor: COLORS.ink,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 10,
    borderBottomWidth: 3,
    borderBottomColor: COLORS.amber,
  },
  backBtn: { padding: 4 },
  barTitle: { flex: 1, color: COLORS.cream, fontSize: 14, fontWeight: '600' },

  fetchLoadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 60,
  },

  errorState: {
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 40,
  },
  errorStateTitle: { fontSize: 18, fontWeight: '700', color: COLORS.ink },
  errorStateSub: {
    fontSize: 13,
    color: COLORS.gray,
    marginTop: 8,
    marginBottom: 16,
    textAlign: 'center',
  },
  retryBtnLarge: {
    backgroundColor: COLORS.blue,
    borderRadius: 10,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  retryBtnLargeText: { color: '#fff', fontWeight: '700', fontSize: 13 },

  demoBanner: {
    backgroundColor: '#f5f5f5',
    borderColor: '#dddddd',
    borderWidth: 1,
    borderRadius: 10,
    marginHorizontal: 16,
    marginTop: 14,
    marginBottom: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  demoBannerText: { color: '#666', fontSize: 12, fontWeight: '600' },

  errorBanner: {
    backgroundColor: COLORS.redLight,
    borderColor: '#f5caca',
    borderWidth: 1,
    borderRadius: 10,
    marginHorizontal: 16,
    marginBottom: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  errorText: { color: '#8a1f1f', fontSize: 12, flex: 1 },
  retryBtn: {
    backgroundColor: COLORS.red,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  retryText: { color: '#fff', fontWeight: '700', fontSize: 12 },

  hero: { padding: 22, paddingTop: 26, paddingBottom: 30 },
  heroTags: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  catTag: {
    backgroundColor: COLORS.amber,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  catTagText: { color: COLORS.ink, fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  aiTag: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  aiTagText: { color: '#fff', fontSize: 11, fontWeight: '600' },
  heroTitle: {
    color: COLORS.cream,
    fontSize: 22,
    fontWeight: '800',
    lineHeight: 28,
    marginBottom: 6,
  },
  heroOrg: { color: 'rgba(255,255,255,0.65)', fontSize: 13 },

  body: { padding: 20 },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  infoIcon: { width: 26 },
  infoText: { flex: 1, fontSize: 14, color: COLORS.ink },

  capacityWrap: { marginTop: 16, marginBottom: 4 },
  progressBg: {
    height: 6,
    backgroundColor: COLORS.border,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: { height: '100%', borderRadius: 3 },
  capacityLabel: { fontSize: 12, color: COLORS.gray, marginTop: 5 },

  descLabel: { fontSize: 15, fontWeight: '700', color: COLORS.ink, marginTop: 22, marginBottom: 8 },
  desc: { fontSize: 14, color: '#444', lineHeight: 22 },

  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 16 },
  tagChip: {
    backgroundColor: COLORS.amberLight,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  tagText: { fontSize: 12, color: '#7a4400', fontWeight: '600' },
  editBtn: {
    marginTop: 18,
    backgroundColor: COLORS.amber,
    borderRadius: 12,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  editBtnText: {
    color: COLORS.ink,
    fontSize: 14,
    fontWeight: '800',
  },

  rsvpBtn: {
    backgroundColor: COLORS.blue,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    marginTop: 26,
  },
  rsvpBtnGreen: { backgroundColor: COLORS.greenMid },
  buyBtn: { backgroundColor: COLORS.amber },
  rsvpText: { color: COLORS.cream, fontSize: 15, fontWeight: '700' },

  ticketBtn: {
    backgroundColor: COLORS.blueLight,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: COLORS.blueMid,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    marginTop: 12,
  },
  ticketText: { color: COLORS.blue, fontSize: 14, fontWeight: '700' },

  analyticsBtn: {
    marginTop: 10,
    backgroundColor: COLORS.ink,
    borderRadius: 12,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  analyticsBtnText: { color: COLORS.cream, fontSize: 14, fontWeight: '700' },
  checkInBtn: {
    marginTop: 10,
    backgroundColor: COLORS.blue,
    borderRadius: 12,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  checkInBtnText: { color: COLORS.cream, fontSize: 14, fontWeight: '700' },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: COLORS.cream,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 22,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  modalTitle: { fontSize: 17, fontWeight: '800', color: COLORS.ink },
  purchaseEventTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.ink,
    lineHeight: 22,
    marginBottom: 6,
  },
  purchasePriceLabel: {
    fontSize: 14,
    color: COLORS.gray,
    marginBottom: 18,
  },
  purchaseConfirmBtn: {
    backgroundColor: COLORS.amber,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 13,
  },
  purchaseConfirmBtnDisabled: {
    opacity: 0.7,
  },
  purchaseConfirmText: {
    color: COLORS.ink,
    fontSize: 14,
    fontWeight: '800',
  },
  purchaseStripeNote: {
    marginTop: 10,
    fontSize: 12,
    color: COLORS.gray,
    textAlign: 'center',
  },
  purchaseCancelBtn: {
    marginTop: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 11,
  },
  purchaseCancelText: {
    color: COLORS.ink,
    fontSize: 14,
    fontWeight: '600',
  },
  analyticsEventTitle: {
    fontSize: 14,
    color: COLORS.gray,
    marginBottom: 18,
    lineHeight: 20,
  },
  statRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  statCard: {
    flex: 1,
    backgroundColor: '#f0ede8',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  statValue: { fontSize: 22, fontWeight: '800', color: COLORS.ink },
  statLabel: { fontSize: 11, color: COLORS.gray, marginTop: 2, fontWeight: '600' },
  analyticsSubhead: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.ink,
    marginTop: 16,
    marginBottom: 6,
  },
  analyticsRateLabel: { fontSize: 12, color: COLORS.gray, marginTop: 4, marginBottom: 4 },
  timelineRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  timelineDate: { fontSize: 13, color: COLORS.ink },
  timelineCount: { fontSize: 13, color: COLORS.gray, fontWeight: '600' },
});
