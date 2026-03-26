import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../context/AppContext';
import { COLORS, CATEGORY_COLORS } from '../theme';

function InfoRow({ icon, label, color }) {
  return (
    <View style={styles.infoRow}>
      <Ionicons name={icon} size={18} color={color || COLORS.gray} style={styles.infoIcon} />
      <Text style={[styles.infoText, color && { color, fontWeight: '700' }]}>{label}</Text>
    </View>
  );
}

export default function EventDetailScreen({ navigation, route }) {
  const { eventId } = route.params;
  const { events, toggleRsvp, isRsvped } = useApp();
  const event = events.find((e) => e.id === eventId);
  const [loading, setLoading] = useState(false);
  const rsvped = isRsvped(eventId);

  if (!event) return null;

  const cat = CATEGORY_COLORS[event.category] || CATEGORY_COLORS.Default;
  const pct = Math.round((event.rsvpCount / event.capacity) * 100);
  const spotsLeft = event.capacity - event.rsvpCount;

  const handleRsvp = () => {
    setLoading(true);
    setTimeout(() => {
      toggleRsvp(eventId);
      setLoading(false);
      if (!rsvped) {
        Alert.alert(
          '🎉 RSVP Confirmed!',
          `You're registered for "${event.title}". View your ticket in My Ticket below.`
        );
      }
    }, 500);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Top bar */}
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
        {/* Hero */}
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
                <Text style={styles.aiTagText}>✨ AI Recommended</Text>
              </View>
            )}
          </View>
          <Text style={styles.heroTitle}>{event.title}</Text>
          <Text style={styles.heroOrg}>{event.org}</Text>
        </LinearGradient>

        <View style={styles.body}>
          {/* Info rows */}
          <InfoRow icon="calendar-outline" label={event.date} />
          <InfoRow icon="time-outline" label={event.time} />
          <InfoRow icon="location-outline" label={event.location} />
          <InfoRow
            icon="people-outline"
            label={`${event.rsvpCount.toLocaleString()} attending · ${spotsLeft} spots left`}
          />
          <InfoRow
            icon="ticket-outline"
            label={event.isFree ? 'Free Admission' : event.price}
            color={event.isFree ? COLORS.greenMid : COLORS.amber}
          />

          {/* Capacity bar */}
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
              {pct}% full{pct > 80 ? ' · RSVP soon!' : ''}
            </Text>
          </View>

          {/* Description */}
          <Text style={styles.descLabel}>About this event</Text>
          <Text style={styles.desc}>{event.description}</Text>

          {/* Tags */}
          <View style={styles.tagRow}>
            {event.tags.map((tag) => (
              <View key={tag} style={styles.tagChip}>
                <Text style={styles.tagText}>#{tag}</Text>
              </View>
            ))}
          </View>

          {/* RSVP */}
          <TouchableOpacity
            style={[styles.rsvpBtn, rsvped && styles.rsvpBtnGreen]}
            onPress={handleRsvp}
            disabled={loading}
            activeOpacity={0.85}
          >
            <Ionicons
              name={rsvped ? 'checkmark-circle' : 'add-circle-outline'}
              size={20}
              color={COLORS.cream}
            />
            <Text style={styles.rsvpText}>
              {loading ? 'Processing…' : rsvped ? 'RSVPed ✓' : 'RSVP for Free'}
            </Text>
          </TouchableOpacity>

          {/* Ticket button */}
          {rsvped && (
            <TouchableOpacity
              style={styles.ticketBtn}
              onPress={() => navigation.navigate('MyTicket', { eventId })}
              activeOpacity={0.85}
            >
              <Ionicons name="qr-code-outline" size={20} color={COLORS.blue} />
              <Text style={styles.ticketText}>View My Ticket / Check-in QR</Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
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
});
