import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../context/AppContext';
import { COLORS, CATEGORY_COLORS } from '../theme';
import { CURRENT_USER } from '../data/mockData';

export default function ProfileScreen({ navigation }) {
  const { events, rsvpedEvents, toggleRsvp } = useApp();
  const myEvents = events.filter((e) => rsvpedEvents.includes(e.id));

  const initials = CURRENT_USER.name
    .split(' ')
    .map((n) => n[0])
    .join('');

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.logo}>My Profile</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
        {/* Profile hero */}
        <View style={styles.profileHero}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
          <View>
            <Text style={styles.name}>{CURRENT_USER.name}</Text>
            <Text style={styles.email}>{CURRENT_USER.email}</Text>
            <View style={styles.chips}>
              <View style={styles.chip}>
                <Text style={styles.chipText}>{CURRENT_USER.major}</Text>
              </View>
              <View style={styles.chip}>
                <Text style={styles.chipText}>{CURRENT_USER.year}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Stats */}
        <View style={styles.statsRow}>
          <StatBox icon="calendar" label="RSVPs" value={rsvpedEvents.length} />
          <StatBox icon="star" label="This Month" value={myEvents.length} />
          <StatBox icon="flame" label="Streak" value="7 days" />
        </View>

        {/* My RSVPs */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>My RSVPs</Text>
            <Text style={styles.sectionSub}>{myEvents.length} events</Text>
          </View>

          {myEvents.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyIcon}>🗓</Text>
              <Text style={styles.emptyText}>No RSVPs yet</Text>
              <Text style={styles.emptySub}>Browse events and RSVP to see them here</Text>
            </View>
          ) : (
            myEvents.map((event) => {
              const cat = CATEGORY_COLORS[event.category] || CATEGORY_COLORS.Default;
              return (
                <View key={event.id} style={styles.myCard}>
                  <View style={[styles.myCardAccent, { backgroundColor: cat.header }]} />
                  <View style={styles.myCardContent}>
                    <View style={[styles.catBadge, { backgroundColor: cat.bg, borderColor: cat.border }]}>
                      <Text style={[styles.catText, { color: cat.text }]}>
                        {event.category}
                      </Text>
                    </View>
                    <Text style={styles.myCardTitle} numberOfLines={2}>
                      {event.title}
                    </Text>
                    <Text style={styles.myCardMeta}>
                      {event.date}  ·  {event.location}
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
                      onPress={() => toggleRsvp(event.id)}
                      style={styles.iconBtn}
                    >
                      <Ionicons name="close-circle-outline" size={22} color={COLORS.red} />
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })
          )}
        </View>

        {/* Organizations */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>My Organizations</Text>
          </View>
          {['ACM @ Cal Poly Pomona', 'CPP Engineering Society'].map((org) => (
            <View key={org} style={styles.orgRow}>
              <View style={styles.orgDot} />
              <Text style={styles.orgName}>{org}</Text>
              <Text style={styles.orgRole}>Member</Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function StatBox({ icon, label, value }) {
  return (
    <View style={styles.statBox}>
      <Ionicons name={icon} size={20} color={COLORS.amber} />
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.cream },
  header: {
    backgroundColor: COLORS.ink,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 3,
    borderBottomColor: COLORS.amber,
  },
  logo: { color: COLORS.amber, fontSize: 18, fontWeight: '800' },

  profileHero: {
    backgroundColor: COLORS.ink,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    padding: 20,
    paddingBottom: 26,
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
  name: { color: COLORS.cream, fontSize: 18, fontWeight: '800' },
  email: { color: '#999', fontSize: 12, marginTop: 2 },
  chips: { flexDirection: 'row', gap: 6, marginTop: 8 },
  chip: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  chipText: { color: '#ddd', fontSize: 11, fontWeight: '600' },

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
  statValue: { fontSize: 18, fontWeight: '800', color: COLORS.ink },
  statLabel: { fontSize: 10, color: COLORS.gray, fontWeight: '600', textAlign: 'center' },

  section: { paddingHorizontal: 16, paddingTop: 22 },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: COLORS.ink },
  sectionSub: { fontSize: 12, color: COLORS.gray },

  empty: { alignItems: 'center', paddingVertical: 32 },
  emptyIcon: { fontSize: 38, marginBottom: 8 },
  emptyText: { fontSize: 15, fontWeight: '700', color: COLORS.ink },
  emptySub: { fontSize: 12, color: COLORS.gray, marginTop: 4, textAlign: 'center' },

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
  myCardTitle: { fontSize: 14, fontWeight: '700', color: COLORS.ink, lineHeight: 19 },
  myCardMeta: { fontSize: 11, color: COLORS.gray },
  myCardActions: {
    padding: 10,
    gap: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBtn: { padding: 5 },

  orgRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  orgDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.amber },
  orgName: { flex: 1, fontSize: 14, color: COLORS.ink, fontWeight: '600' },
  orgRole: { fontSize: 12, color: COLORS.gray, fontWeight: '600' },
});
