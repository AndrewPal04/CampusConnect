import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../context/AppContext';
import EventCard from '../components/EventCard';
import useEvents from '../hooks/useEvents';
import { COLORS, CATEGORY_COLORS } from '../theme';

const CATEGORIES = ['All', 'Tech', 'Music', 'Sports', 'Social', 'Art', 'Food', 'Academic'];

export default function HomeScreen({ navigation }) {
  const { unreadCount, currentUser } = useApp();
  const [search, setSearch] = useState('');
  const [selectedCat, setSelectedCat] = useState('All');
  const canManageEvents =
    currentUser?.role === 'org_leader' || currentUser?.role === 'admin';
  const {
    events,
    loading,
    error,
    refetch,
    demoMode,
    recommendedEvents,
    recommendedLoading,
    fetchRecommended,
  } = useEvents({
    category: selectedCat,
    search,
    sort: 'date_asc',
  });

  const filtered = events;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <View>
          <Text style={styles.logo}>CampusConnect</Text>
          <Text style={styles.subtitle}>CAL POLY POMONA</Text>
        </View>
        <TouchableOpacity
          onPress={() => navigation.navigate('Notifications')}
          style={styles.notifBtn}
        >
          <Ionicons name="notifications-outline" size={24} color={COLORS.cream} />
          {unreadCount > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{unreadCount}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      <View style={styles.searchRow}>
        <Ionicons name="search-outline" size={17} color={COLORS.gray} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search events, orgs, locations..."
          placeholderTextColor={COLORS.gray}
          value={search}
          onChangeText={setSearch}
          returnKeyType="search"
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')}>
            <Ionicons name="close-circle" size={17} color={COLORS.gray} />
          </TouchableOpacity>
        )}
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 32 }}
      >
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.catScroll}
        >
          {CATEGORIES.map((cat) => {
            const active = selectedCat === cat;
            const c = CATEGORY_COLORS[cat] || CATEGORY_COLORS.Default;
            return (
              <TouchableOpacity
                key={cat}
                onPress={() => setSelectedCat(cat)}
                style={[
                  styles.catChip,
                  active && { backgroundColor: c.header, borderColor: c.header },
                ]}
              >
                <Text style={[styles.catChipText, active && { color: COLORS.cream }]}>
                  {cat}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {demoMode && (
          <View style={styles.demoBanner}>
            <Text style={styles.demoBannerText}>Demo mode: showing offline fallback events.</Text>
          </View>
        )}

        {error && (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>
              Could not reach live events API. Showing fallback data.
            </Text>
            <TouchableOpacity
              style={styles.retryBtn}
              onPress={() => {
                refetch();
                fetchRecommended();
              }}
            >
              <Text style={styles.retryText}>Retry</Text>
            </TouchableOpacity>
          </View>
        )}

        {selectedCat === 'All' && !search && !loading && recommendedEvents.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Recommended For You</Text>
              <Text style={styles.sectionSub}>
                {recommendedLoading ? 'Refreshing...' : 'Based on your activity'}
              </Text>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 16 }}
            >
              {recommendedEvents.map((event) => (
                <View key={event.id} style={{ width: 248, marginRight: 12 }}>
                  <EventCard
                    event={event}
                    compact
                    onPress={() =>
                      navigation.navigate('EventDetail', { eventId: event.id })
                    }
                  />
                </View>
              ))}
            </ScrollView>
          </View>
        )}

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>
              {selectedCat === 'All' ? 'All Events' : `${selectedCat} Events`}
            </Text>
            <Text style={styles.sectionSub}>{filtered.length} events</Text>
          </View>

          {loading ? (
            <View style={styles.loadingWrap}>
              <ActivityIndicator size="large" color={COLORS.amber} />
            </View>
          ) : filtered.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyIcon}>No results</Text>
              <Text style={styles.emptyText}>No events found</Text>
              <Text style={styles.emptySub}>Try a different search or category</Text>
            </View>
          ) : (
            filtered.map((event) => (
              <View key={event.id} style={styles.cardWrap}>
                <EventCard
                  event={event}
                  onPress={() =>
                    navigation.navigate('EventDetail', { eventId: event.id })
                  }
                />
              </View>
            ))
          )}
        </View>
      </ScrollView>

      {canManageEvents && (
        <TouchableOpacity
          style={styles.fab}
          onPress={() => navigation.navigate('CreateEvent')}
          activeOpacity={0.88}
        >
          <Ionicons name="add" size={28} color={COLORS.ink} />
        </TouchableOpacity>
      )}
    </SafeAreaView>
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
  logo: {
    color: COLORS.amber,
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  subtitle: {
    color: '#aaa',
    fontSize: 10,
    letterSpacing: 1.5,
    marginTop: 2,
  },
  notifBtn: { position: 'relative', padding: 4 },
  badge: {
    position: 'absolute',
    top: 0,
    right: 0,
    backgroundColor: COLORS.red,
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  badgeText: { color: '#fff', fontSize: 9, fontWeight: '800' },

  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: COLORS.white,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: COLORS.ink,
    paddingVertical: 0,
  },

  catScroll: { paddingHorizontal: 16, paddingVertical: 12, gap: 8 },
  catChip: {
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 6,
    backgroundColor: COLORS.white,
  },
  catChipText: { fontSize: 13, fontWeight: '600', color: COLORS.ink },

  demoBanner: {
    backgroundColor: '#f5f5f5',
    borderColor: '#dddddd',
    borderWidth: 1,
    borderRadius: 10,
    marginHorizontal: 16,
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
  errorText: { color: '#8a1f1f', fontSize: 12, flex: 1, lineHeight: 17 },
  retryBtn: {
    backgroundColor: COLORS.red,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  retryText: { color: '#fff', fontWeight: '700', fontSize: 12 },

  section: { marginBottom: 8 },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: COLORS.ink },
  sectionSub: { fontSize: 12, color: COLORS.gray },

  cardWrap: { paddingHorizontal: 16, marginBottom: 14 },
  loadingWrap: { alignItems: 'center', paddingVertical: 36 },

  empty: { alignItems: 'center', paddingVertical: 48 },
  emptyIcon: { fontSize: 14, color: COLORS.gray, marginBottom: 8 },
  emptyText: { fontSize: 16, fontWeight: '700', color: COLORS.ink },
  emptySub: { fontSize: 13, color: COLORS.gray, marginTop: 4 },
  fab: {
    position: 'absolute',
    right: 18,
    bottom: 18,
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: COLORS.amber,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
    borderWidth: 2,
    borderColor: COLORS.ink,
  },
});
