import React, { useEffect, useRef, useMemo, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Animated,
  Easing,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import QRCode from 'react-native-qrcode-svg';
import { useApp } from '../context/AppContext';
import { fetchMyRsvps as fetchMyRsvpsRequest } from '../services/api';
import { COLORS } from '../theme';

export default function MyTicketScreen({ navigation, route }) {
  const { eventId } = route.params;
  const routeEvent = route.params?.event || null;
  const { events, currentUser, myRsvps } = useApp();
  const event =
    routeEvent || events.find((candidate) => String(candidate.id) === String(eventId));

  const contextRsvp = useMemo(
    () => myRsvps.find((entry) => String(entry.eventId) === String(eventId)),
    [eventId, myRsvps]
  );
  const [ticketRsvp, setTicketRsvp] = useState(contextRsvp || null);
  const [demoMode, setDemoMode] = useState(false);

  const scanAnim = useRef(new Animated.Value(0)).current;

  const loadTicketRsvp = useCallback(async () => {
    setDemoMode(false);

    try {
      const response = await fetchMyRsvpsRequest();
      const rsvps = Array.isArray(response?.rsvps) ? response.rsvps : [];
      const liveRsvp =
        rsvps.find((entry) => {
          const entryEventId = entry?.eventId || entry?.event?.id;
          return String(entryEventId) === String(eventId);
        }) || null;

      setTicketRsvp(liveRsvp || contextRsvp || null);
    } catch (error) {
      setDemoMode(true);
      setTicketRsvp(contextRsvp || null);
    }
  }, [contextRsvp, eventId]);

  const ticketId = useMemo(() => {
    if (!ticketRsvp?.id) {
      return `CC-${String(eventId).slice(0, 6).toUpperCase()}`;
    }

    const rsvpId = String(ticketRsvp.id);
    return `CC-${rsvpId.slice(0, 4).toUpperCase()}-${rsvpId.slice(-4).toUpperCase()}`;
  }, [eventId, ticketRsvp?.id]);

  const qrToken =
    ticketRsvp?.qrToken !== undefined && ticketRsvp?.qrToken !== null
      ? String(ticketRsvp.qrToken)
      : '';
  const ticketStatus = ticketRsvp?.status || 'confirmed';
  const isCheckedIn = ticketStatus === 'checked_in';
  const shouldShowQrLoader = !demoMode && !qrToken;
  const qrValue = demoMode ? `DEMO-${ticketId}` : qrToken;

  const statusMeta = useMemo(() => {
    if (ticketStatus === 'checked_in') {
      return {
        bannerStyle: styles.statusBannerCheckedIn,
        textStyle: styles.statusTextCheckedIn,
        icon: 'checkmark-circle',
        iconColor: COLORS.greenMid,
        text: '\u2713 Already checked in',
      };
    }

    if (ticketStatus === 'cancelled') {
      return {
        bannerStyle: styles.statusBannerCancelled,
        textStyle: styles.statusTextCancelled,
        icon: 'close-circle',
        iconColor: COLORS.red,
        text: 'This RSVP has been cancelled',
      };
    }

    return {
      bannerStyle: styles.statusBannerConfirmed,
      textStyle: styles.statusTextConfirmed,
      icon: 'qr-code-outline',
      iconColor: COLORS.blueMid,
      text: 'Ready to check in \u2014 show this QR code',
    };
  }, [ticketStatus]);

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(scanAnim, {
          toValue: 1,
          duration: 2000,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
        Animated.timing(scanAnim, {
          toValue: 0,
          duration: 0,
          useNativeDriver: true,
        }),
      ])
    );

    animation.start();
    return () => animation.stop();
  }, [scanAnim]);

  useEffect(() => {
    loadTicketRsvp();
  }, [loadTicketRsvp]);

  if (!event) return null;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={COLORS.cream} />
        </TouchableOpacity>
        <Text style={styles.barTitle}>My Ticket</Text>
        <View style={{ width: 30 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.statusBanner, statusMeta.bannerStyle]}>
          <Ionicons name={statusMeta.icon} size={22} color={statusMeta.iconColor} />
          <Text style={[styles.statusText, statusMeta.textStyle]}>{statusMeta.text}</Text>
        </View>

        <View style={styles.ticket}>
          <LinearGradient
            colors={[COLORS.blue, '#080f24']}
            style={styles.ticketHeader}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <Text style={styles.ticketBrand}>CampusConnect</Text>
            <Text style={styles.ticketEventTitle}>{event.title}</Text>
            <Text style={styles.ticketOrg}>{event.org}</Text>
          </LinearGradient>

          <View style={styles.tearLine}>
            <View style={styles.tearCircleLeft} />
            <View style={styles.tearDash} />
            <View style={styles.tearCircleRight} />
          </View>

          <View style={styles.qrSection}>
            <View style={styles.qrBox}>
              {shouldShowQrLoader ? (
                <ActivityIndicator size="large" color={COLORS.blueMid} />
              ) : (
                <>
                  <View style={isCheckedIn ? styles.qrCheckedInDim : undefined}>
                    <QRCode
                      value={qrValue}
                      size={198}
                      color={COLORS.ink}
                      backgroundColor={COLORS.white}
                    />
                  </View>
                  {isCheckedIn && (
                    <View style={styles.qrCheckedOverlay}>
                      <Ionicons name="checkmark-circle" size={80} color={COLORS.greenMid} />
                    </View>
                  )}
                </>
              )}
            </View>
            {demoMode && <Text style={styles.demoModeText}>Demo mode</Text>}
            <Text style={styles.ticketId}>{ticketId}</Text>
            <Text style={styles.scanHint}>Show this QR code at the event entrance</Text>
          </View>

          <View style={styles.ticketDetails}>
            <DetailRow label="Date" value={event.date} />
            <DetailRow label="Time" value={event.time} />
            <DetailRow label="Location" value={event.location} />
            <DetailRow
              label="Admission"
              value={event.isFree ? 'FREE' : event.price}
              highlight
            />
          </View>
        </View>

        <Text style={styles.scannerLabel}>Org Leader Scanner Preview</Text>
        <View style={styles.scanBox}>
          <Animated.View
            style={[
              styles.scanLine,
              {
                transform: [
                  {
                    translateY: scanAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0, 160],
                    }),
                  },
                ],
                opacity: scanAnim.interpolate({
                  inputRange: [0, 0.05, 0.92, 1],
                  outputRange: [0, 1, 1, 0],
                }),
              },
            ]}
          />

          <View style={[styles.corner, styles.cTL]} />
          <View style={[styles.corner, styles.cTR]} />
          <View style={[styles.corner, styles.cBL]} />
          <View style={[styles.corner, styles.cBR]} />
          <Text style={styles.scanBoxText}>Scanning...</Text>
        </View>

        <View style={styles.resultCard}>
          <Ionicons name="checkmark-circle" size={24} color={COLORS.greenMid} />
          <View style={{ flex: 1 }}>
            <Text style={styles.resultTitle}>Valid Ticket</Text>
            <Text style={styles.resultDesc}>
              {(currentUser?.name || 'CampusConnect Student')} - {event.title}
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function DetailRow({ label, value, highlight }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={[styles.detailValue, highlight && styles.detailHighlight]}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#efece5' },
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

  content: { padding: 16, paddingBottom: 40 },

  statusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1.5,
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  statusBannerConfirmed: {
    backgroundColor: COLORS.blueLight,
    borderColor: COLORS.blueMid,
  },
  statusBannerCheckedIn: {
    backgroundColor: COLORS.greenLight,
    borderColor: COLORS.greenMid,
  },
  statusBannerCancelled: {
    backgroundColor: COLORS.redLight,
    borderColor: COLORS.red,
  },
  statusText: { fontWeight: '700', fontSize: 14 },
  statusTextConfirmed: { color: COLORS.blue },
  statusTextCheckedIn: { color: COLORS.green },
  statusTextCancelled: { color: COLORS.red },

  ticket: {
    backgroundColor: COLORS.white,
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 8,
    marginBottom: 22,
  },
  ticketHeader: { padding: 20, paddingBottom: 26 },
  ticketBrand: {
    color: COLORS.amber,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.5,
    marginBottom: 10,
  },
  ticketEventTitle: {
    color: COLORS.cream,
    fontSize: 20,
    fontWeight: '800',
    lineHeight: 26,
    marginBottom: 5,
  },
  ticketOrg: { color: 'rgba(255,255,255,0.65)', fontSize: 13 },

  tearLine: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
  },
  tearCircleLeft: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#efece5',
    marginLeft: -11,
  },
  tearCircleRight: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#efece5',
    marginRight: -11,
  },
  tearDash: {
    flex: 1,
    borderTopWidth: 2,
    borderTopColor: COLORS.border,
    borderStyle: 'dashed',
  },

  qrSection: { alignItems: 'center', paddingVertical: 24 },
  qrBox: {
    position: 'relative',
    minHeight: 226,
    minWidth: 226,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 14,
    backgroundColor: COLORS.white,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: COLORS.border,
    marginBottom: 14,
  },
  qrCheckedInDim: { opacity: 0.5 },
  qrCheckedOverlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  demoModeText: {
    fontSize: 12,
    color: COLORS.red,
    fontWeight: '700',
    marginBottom: 6,
  },
  qrMissingText: {
    fontSize: 12,
    color: COLORS.gray,
    textAlign: 'center',
  },
  ticketId: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.blue,
    letterSpacing: 2,
    marginBottom: 6,
  },
  scanHint: { fontSize: 12, color: COLORS.gray, textAlign: 'center' },

  ticketDetails: { borderTopWidth: 1, borderTopColor: COLORS.border, padding: 16 },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  detailLabel: { fontSize: 12, color: COLORS.gray, fontWeight: '600' },
  detailValue: {
    fontSize: 13,
    color: COLORS.ink,
    fontWeight: '600',
    maxWidth: '60%',
    textAlign: 'right',
  },
  detailHighlight: { color: COLORS.greenMid, fontWeight: '800' },

  scannerLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.ink,
    textAlign: 'center',
    marginBottom: 10,
  },
  scanBox: {
    height: 180,
    backgroundColor: COLORS.ink,
    borderRadius: 16,
    marginBottom: 12,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scanLine: {
    position: 'absolute',
    left: 20,
    right: 20,
    height: 2,
    backgroundColor: COLORS.amber,
    shadowColor: COLORS.amber,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 6,
  },
  corner: {
    position: 'absolute',
    width: 26,
    height: 26,
    borderColor: COLORS.amber,
    borderStyle: 'solid',
  },
  cTL: { top: 16, left: 16, borderTopWidth: 3, borderLeftWidth: 3, borderRadius: 4 },
  cTR: { top: 16, right: 16, borderTopWidth: 3, borderRightWidth: 3, borderRadius: 4 },
  cBL: { bottom: 16, left: 16, borderBottomWidth: 3, borderLeftWidth: 3, borderRadius: 4 },
  cBR: { bottom: 16, right: 16, borderBottomWidth: 3, borderRightWidth: 3, borderRadius: 4 },
  scanBoxText: { color: 'rgba(255,255,255,0.4)', fontSize: 13, fontWeight: '600' },

  resultCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: COLORS.greenLight,
    borderWidth: 1.5,
    borderColor: COLORS.greenMid,
    borderRadius: 14,
    padding: 14,
  },
  resultTitle: { fontSize: 14, fontWeight: '800', color: COLORS.green },
  resultDesc: { fontSize: 12, color: '#555', marginTop: 2 },
});
